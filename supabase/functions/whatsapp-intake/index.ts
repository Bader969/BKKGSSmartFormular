// WhatsApp intake webhook — receives WHAPI webhook events, buffers messages per chat,
// detects "..." separator blocks (3 dots × 2), runs OCR via process-insurance-gemini3
// and creates an encrypted draft in `applications` (source='whatsapp').
//
// Auth: X-Intake-Secret header must match env WHATSAPP_INTAKE_SECRET.
// Configured with verify_jwt=false in supabase/config.toml.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENC_SECRET = Deno.env.get("APPLICATIONS_ENCRYPTION_KEY")!;
const INTAKE_SECRET = Deno.env.get("WHATSAPP_INTAKE_SECRET")!;
const WHAPI_TOKEN = Deno.env.get("WHAPI_TOKEN") ?? "";
const ALLOWED_CHAT_ID = Deno.env.get("WHATSAPP_ALLOWED_CHAT_ID") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-intake-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// ---------- Encryption (mirror applications-api) ----------
const enc = new TextEncoder();
let cachedKey: CryptoKey | null = null;
async function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const material = await crypto.subtle.digest("SHA-256", enc.encode(ENC_SECRET));
  cachedKey = await crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  return cachedKey;
}
function canonicalize(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonicalize).join(",") + "]";
  const keys = Object.keys(v as Record<string, unknown>).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize((v as Record<string, unknown>)[k])).join(",") + "}";
}
function bytesToHex(b: Uint8Array): string {
  let h = "";
  for (let i = 0; i < b.length; i++) h += b[i].toString(16).padStart(2, "0");
  return "\\x" + h;
}
async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function encryptPayload(payload: unknown) {
  const key = await getKey();
  const canon = canonicalize(payload);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(canon)));
  return { ivHex: bytesToHex(iv), ctHex: bytesToHex(ct), hash: await sha256Hex(canon) };
}

// ---------- Classification ----------
const KRANKENKASSE_KEYWORDS: Array<{ re: RegExp; key: string }> = [
  { re: /\bBKK\s*GS\b/i, key: "bkk_gs" },
  { re: /\bBIG\b|big\s*direkt/i, key: "big_plusbonus" },
  { re: /\bVIACTIV\b/i, key: "viactiv" },
  { re: /\bDAK\b/i, key: "dak" },
  { re: /\bNOVITAS\b/i, key: "novitas" },
];
const VP_OPTIONS = [
  "BA Blitzvox", "EM BA Blitzvox", "GH Blitzvox", "EM GH Blitzvox",
  "AM Blitzvox", "EM AM Blitzvox", "MO Blitzvox", "EM MO Blitzvox",
  "AD Blitzvox", "EM AD Blitzvox", "HZ Blitzvox", "EM HZ Blitzvox",
];
const DOT_RE = /^\s*\.\s*$/;
const PHONE_RE = /^\s*(\+?\d[\d\s\-/()]{6,})\s*$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /\b(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})\b/;

type MsgType = "dot" | "phone" | "email" | "header" | "text" | "image" | "pdf";
function classifyText(text: string): MsgType | null {
  const t = text.trim();
  if (!t) return null;
  if (DOT_RE.test(t)) return "dot";
  if (EMAIL_RE.test(t)) return "email";
  if (PHONE_RE.test(t) && !DATE_RE.test(t)) return "phone";
  // Header: contains a date AND a Krankenkasse keyword
  if (DATE_RE.test(t) && KRANKENKASSE_KEYWORDS.some((k) => k.re.test(t))) return "header";
  return "text";
}

// ---------- WHAPI payload normalization ----------
type IntakeMsg = {
  wa_message_id: string;
  chat_id: string;
  type: MsgType;
  text?: string;
  media_url?: string;
  media_mime?: string;
};
function extractMessages(payload: unknown): IntakeMsg[] {
  const out: IntakeMsg[] = [];
  const arr = Array.isArray((payload as { messages?: unknown }).messages)
    ? (payload as { messages: unknown[] }).messages
    : Array.isArray(payload) ? (payload as unknown[]) : [];
  for (const raw of arr) {
    if (!raw || typeof raw !== "object") continue;
    const m = raw as Record<string, unknown>;
    const id = String(m.id ?? m.message_id ?? "");
    const chat = String(m.chat_id ?? m.from ?? m.chat ?? "");
    if (!id || !chat) continue;
    const type = String(m.type ?? "text").toLowerCase();
    if (type === "text" || type === "chat") {
      const txt = String((m.text as { body?: string } | undefined)?.body ?? (m.body as string) ?? "");
      const cls = classifyText(txt);
      if (!cls) continue;
      out.push({ wa_message_id: id, chat_id: chat, type: cls, text: txt });
    } else if (type === "image") {
      const media = (m.image as Record<string, unknown>) ?? {};
      out.push({
        wa_message_id: id,
        chat_id: chat,
        type: "image",
        media_url: String(media.link ?? media.url ?? ""),
        media_mime: String(media.mime_type ?? "image/jpeg"),
      });
    } else if (type === "document") {
      const media = (m.document as Record<string, unknown>) ?? {};
      const mime = String(media.mime_type ?? "application/pdf");
      out.push({
        wa_message_id: id,
        chat_id: chat,
        type: mime === "application/pdf" ? "pdf" : "image",
        media_url: String(media.link ?? media.url ?? ""),
        media_mime: mime,
      });
    }
  }
  return out;
}

// ---------- Block detection ----------
// Trenner = 3 aufeinanderfolgende dot-Nachrichten (nach received_at).
// Ein Block ist alles zwischen zwei Trenner-Gruppen.
type BufferRow = {
  id: string;
  wa_message_id: string;
  type: MsgType;
  text: string | null;
  media_url: string | null;
  media_mime: string | null;
  received_at: string;
  block_id: string | null;
  processed_at: string | null;
};

function findClosedBlocks(rows: BufferRow[]): Array<{ rows: BufferRow[]; separatorIds: string[] }> {
  // returns unprocessed blocks that lie between two complete separator triplets
  const trennerEnds: number[] = []; // index of the LAST dot in each triplet
  let dotStreak = 0;
  let streakStart = -1;
  rows.forEach((r, i) => {
    if (r.type === "dot") {
      if (dotStreak === 0) streakStart = i;
      dotStreak++;
      if (dotStreak === 3) trennerEnds.push(i);
      // consecutive additional dots beyond 3 still count as same separator; reset only on non-dot
    } else {
      dotStreak = 0;
      streakStart = -1;
    }
  });
  const blocks: Array<{ rows: BufferRow[]; separatorIds: string[] }> = [];
  for (let k = 0; k + 1 < trennerEnds.length; k++) {
    const startAfter = trennerEnds[k];
    const endBefore = trennerEnds[k + 1] - 2; // -2 = skip the 3 dots of the next triplet start
    const inner: BufferRow[] = [];
    for (let i = startAfter + 1; i <= endBefore; i++) {
      if (rows[i].type !== "dot") inner.push(rows[i]);
    }
    // Only accept if there's at least one media + one header
    const hasMedia = inner.some((r) => r.type === "image" || r.type === "pdf");
    const hasHeader = inner.some((r) => r.type === "header");
    if (!hasMedia || !hasHeader) continue;
    // Skip if any row in the block is already processed
    if (inner.some((r) => r.processed_at)) continue;
    const sepIds = [
      rows[trennerEnds[k]].id,
      rows[trennerEnds[k] - 1].id,
      rows[trennerEnds[k] - 2].id,
      rows[trennerEnds[k + 1]].id,
      rows[trennerEnds[k + 1] - 1].id,
      rows[trennerEnds[k + 1] - 2].id,
    ];
    blocks.push({ rows: inner, separatorIds: sepIds });
  }
  return blocks;
}

// ---------- Header parsing ----------
type ParsedHeader = {
  vorname: string;
  name: string;
  datum: string; // dd.mm.yyyy
  krankenkasse: string; // internal key
  krankenkasseLabel: string;
  vertriebspartner: string;
  betrag: string;
  warnings: string[];
};
function parseHeader(text: string): ParsedHeader {
  const warnings: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let vorname = "", name = "", datum = "", krankenkasse = "", krankenkasseLabel = "", vertriebspartner = "", betrag = "";
  for (const line of lines) {
    if (!datum) {
      const m = line.match(DATE_RE);
      if (m) { datum = m[1].replace(/[-/]/g, "."); continue; }
    }
    if (!krankenkasse) {
      const kk = KRANKENKASSE_KEYWORDS.find((k) => k.re.test(line));
      if (kk) { krankenkasse = kk.key; krankenkasseLabel = line; }
    }
    if (!vertriebspartner) {
      const vp = VP_OPTIONS.find((v) => line.toLowerCase().includes(v.toLowerCase()));
      if (vp) vertriebspartner = vp;
    }
    if (!betrag) {
      const b = line.match(/(\d+[.,]?\d*)\s*€/);
      if (b) betrag = b[1];
    }
  }
  // Name line = first line that is neither the date nor kk nor vp
  for (const line of lines) {
    if (DATE_RE.test(line)) continue;
    if (KRANKENKASSE_KEYWORDS.some((k) => k.re.test(line))) continue;
    if (VP_OPTIONS.some((v) => line.toLowerCase().includes(v.toLowerCase()))) continue;
    if (/^\d/.test(line)) continue;
    const parts = line.split(/\s+/);
    if (parts.length >= 2) { vorname = parts[0]; name = parts.slice(1).join(" "); }
    else { name = line; }
    break;
  }
  if (!vorname && !name) warnings.push("Name konnte nicht erkannt werden.");
  if (!datum) warnings.push("Datum konnte nicht erkannt werden.");
  if (!krankenkasse) warnings.push("Krankenkasse konnte nicht erkannt werden.");
  return { vorname, name, datum, krankenkasse, krankenkasseLabel, vertriebspartner, betrag, warnings };
}

function toIsoDate(ddmmyyyy: string): string {
  const m = ddmmyyyy.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (!m) return "";
  const [, d, mo, y] = m;
  const yyyy = y.length === 2 ? `20${y}` : y;
  return `${yyyy}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

// ---------- Media download from WHAPI ----------
async function fetchMediaAsBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  if (!url) return null;
  const headers: Record<string, string> = {};
  if (WHAPI_TOKEN) headers.Authorization = `Bearer ${WHAPI_TOKEN}`;
  try {
    const r = await fetch(url, { headers });
    if (!r.ok) return null;
    const mimeType = r.headers.get("content-type") ?? "application/octet-stream";
    const buf = new Uint8Array(await r.arrayBuffer());
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      bin += String.fromCharCode(...buf.subarray(i, i + chunk));
    }
    return { base64: btoa(bin), mimeType };
  } catch {
    return null;
  }
}

// ---------- Owner user for whatsapp intake ----------
// Uses the first admin user as the owner of ingested drafts.
async function resolveOwnerUserId(admin: ReturnType<typeof createClient>): Promise<string | null> {
  const { data } = await admin.from("user_roles").select("user_id").eq("role", "admin").limit(1).maybeSingle();
  return (data?.user_id as string | undefined) ?? null;
}

// ---------- Block processing ----------
async function processBlock(
  admin: ReturnType<typeof createClient>,
  chatId: string,
  rows: BufferRow[],
  separatorIds: string[],
) {
  const blockId = crypto.randomUUID();
  const warnings: string[] = [];

  // Atomically claim ALL block rows (content + separators) by setting block_id
  // ONLY where block_id is still null. If another concurrent invocation already
  // claimed them, we get 0 updated rows and bail out — prevents duplicate drafts.
  const allIds = [...rows.map((r) => r.id), ...separatorIds];
  const { data: claimed, error: claimErr } = await admin
    .from("whatsapp_inbox_messages")
    .update({ block_id: blockId })
    .in("id", allIds)
    .is("block_id", null)
    .select("id");
  if (claimErr) {
    console.error("claim failed", claimErr.message);
    return { blockId, warnings: ["claim failed"], applicationId: null };
  }
  if (!claimed || claimed.length < allIds.length) {
    console.log("block already claimed by another invocation, skipping", {
      expected: allIds.length,
      claimed: claimed?.length ?? 0,
    });
    return { blockId, warnings: ["already claimed"], applicationId: null };
  }

  const headerRow = rows.find((r) => r.type === "header");
  const phoneRow = rows.find((r) => r.type === "phone");
  const emailRow = rows.find((r) => r.type === "email");
  const mediaRows = rows.filter((r) => r.type === "image" || r.type === "pdf");

  const parsed = headerRow?.text ? parseHeader(headerRow.text) : {
    vorname: "", name: "", datum: "", krankenkasse: "", krankenkasseLabel: "", vertriebspartner: "", betrag: "", warnings: ["Kein Header im Block."],
  };
  warnings.push(...parsed.warnings);

  // Download media (images only for OCR; PDFs skipped for now, still referenced)
  const images: Array<{ base64: string; mimeType: string }> = [];
  for (const mr of mediaRows) {
    if (mr.type !== "image" || !mr.media_url) continue;
    const m = await fetchMediaAsBase64(mr.media_url);
    if (m) images.push(m);
    else warnings.push("Bild konnte nicht geladen werden.");
  }

  // Call OCR function (invoke via service_role)
  let ocr: Record<string, unknown> = {};
  if (images.length > 0 && parsed.krankenkasse) {
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/process-insurance-gemini3`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "member",
          selectedKrankenkasse: parsed.krankenkasse,
          images,
        }),
      });
      if (r.ok) {
        const data = await r.json().catch(() => ({}));
        const { improvedImages: _drop, ...rest } = data ?? {};
        ocr = rest as Record<string, unknown>;
      } else {
        warnings.push(`OCR fehlgeschlagen (Status ${r.status}).`);
      }
    } catch (e) {
      warnings.push(`OCR-Fehler: ${(e as Error).message}`);
    }
  } else if (!images.length) {
    warnings.push("Keine Bilder für OCR im Block.");
  }

  // Assemble payload — WhatsApp header wins over OCR for Name/Datum/VP/Telefon/E-Mail
  const payload: Record<string, unknown> = {
    ...ocr,
    selectedKrankenkasse: parsed.krankenkasse || (ocr.selectedKrankenkasse ?? ""),
    mitgliedVorname: parsed.vorname || ocr.mitgliedVorname || "",
    mitgliedName: parsed.name || ocr.mitgliedName || "",
    datum: toIsoDate(parsed.datum) || ocr.datum || "",
    signaturDatum: toIsoDate(parsed.datum) || ocr.signaturDatum || "",
    vertriebspartner: parsed.vertriebspartner || ocr.vertriebspartner || "",
    telefon: (phoneRow?.text ?? "").trim() || ocr.telefon || "",
    email: (emailRow?.text ?? "").trim() || ocr.email || "",
  };

  const ownerId = await resolveOwnerUserId(admin);
  if (!ownerId) {
    warnings.push("Kein Admin-User als Owner gefunden — Antrag nicht gespeichert.");
    return { blockId, warnings, applicationId: null };
  }

  const { ivHex, ctHex, hash } = await encryptPayload(payload);
  const antragsform = parsed.krankenkasseLabel || parsed.krankenkasse || "WhatsApp-Intake";
  const applicantName = String(payload.mitgliedName ?? "").slice(0, 120) || null;
  const applicantVorname = String(payload.mitgliedVorname ?? "").slice(0, 120) || null;

  const { data: appRow, error } = await admin
    .from("applications")
    .insert({
      user_id: ownerId,
      krankenkasse: parsed.krankenkasse || "unselected",
      payload_encrypted: ctHex,
      payload_iv: ivHex,
      payload_hash: hash,
      vertriebspartner: parsed.vertriebspartner || null,
      applicant_name: applicantName,
      applicant_vorname: applicantVorname,
      antragsform,
      source: "whatsapp",
      intake_meta: {
        chat_id: chatId,
        block_id: blockId,
        message_ids: rows.map((r) => r.wa_message_id),
        warnings,
        betrag: parsed.betrag || null,
      },
    })
    .select("id")
    .single();

  if (error || !appRow) {
    console.error("insert failed", error?.message);
    return { blockId, warnings, applicationId: null };
  }

  // Mark buffer rows as processed
  await admin
    .from("whatsapp_inbox_messages")
    .update({ processed_at: new Date().toISOString() })
    .in("id", allIds);

  await admin.from("application_events").insert({
    application_id: appRow.id,
    user_id: ownerId,
    event_type: "whatsapp_intake",
    meta: { block_id: blockId, chat_id: chatId, warnings, images: images.length },
  });

  return { blockId, warnings, applicationId: appRow.id };
}

// ---------- HTTP handler ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  // Health check for WHAPI "Check webhook" and browser pings
  if (req.method === "GET" || req.method === "HEAD") {
    return json(200, { ok: true, service: "whatsapp-intake" });
  }
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  // Accept secret via header (preferred) or query param (?s=... fallback for tools
  // that can't set custom headers on the health check).
  const url = new URL(req.url);
  const secret =
    req.headers.get("x-intake-secret") ??
    url.searchParams.get("s") ??
    url.searchParams.get("secret") ??
    "";
  if (!INTAKE_SECRET || secret !== INTAKE_SECRET) {
    return json(401, { error: "unauthorized" });
  }

  let raw: unknown;
  try { raw = await req.json(); } catch { return json(400, { error: "invalid_json" }); }

  let msgs = extractMessages(raw);

  console.log("intake batch", {
    total: msgs.length,
    chats: Array.from(new Set(msgs.map((m) => m.chat_id))),
    types: msgs.map((m) => m.type),
    allowed: ALLOWED_CHAT_ID || "(none)",
  });

  if (ALLOWED_CHAT_ID) {
    msgs = msgs.filter((m) => m.chat_id === ALLOWED_CHAT_ID);
    if (!msgs.length) {
      console.log("all messages filtered out (no chat matched allowed id)");
      return json(200, { ok: true, ingested: 0, filtered: true, blocks: [] });
    }
  }

  if (!msgs.length) return json(200, { ok: true, ingested: 0, blocks: [] });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // Insert (ignore duplicates via unique index on wa_message_id)
  const inserts = msgs.map((m) => ({
    chat_id: m.chat_id,
    wa_message_id: m.wa_message_id,
    type: m.type,
    text: m.text ?? null,
    media_url: m.media_url ?? null,
    media_mime: m.media_mime ?? null,
  }));
  const { error: insErr } = await admin
    .from("whatsapp_inbox_messages")
    .upsert(inserts, { onConflict: "wa_message_id", ignoreDuplicates: true });
  if (insErr) console.error("buffer insert failed", insErr.message);

  // Look at unique chats touched by this batch and try to close blocks
  const chats = Array.from(new Set(msgs.map((m) => m.chat_id)));
  const results: Array<{ chat_id: string; applicationId: string | null; warnings: string[] }> = [];

  for (const chatId of chats) {
    const { data: bufRows } = await admin
      .from("whatsapp_inbox_messages")
      .select("id, wa_message_id, type, text, media_url, media_mime, received_at, block_id, processed_at")
      .eq("chat_id", chatId)
      .order("received_at", { ascending: true })
      .limit(500);
    if (!bufRows) continue;
    const blocks = findClosedBlocks(bufRows as BufferRow[]);
    console.log("block scan", {
      chat: chatId,
      buffered: bufRows.length,
      types: (bufRows as BufferRow[]).map((r) => r.type),
      closedBlocks: blocks.length,
    });
    for (const b of blocks) {
      console.log("processing block", {
        rowTypes: b.rows.map((r) => r.type),
        rowCount: b.rows.length,
      });
      const res = await processBlock(admin, chatId, b.rows, b.separatorIds);
      console.log("block result", {
        applicationId: res.applicationId,
        warnings: res.warnings,
      });
      results.push({ chat_id: chatId, applicationId: res.applicationId, warnings: res.warnings });
    }
  }

  return json(200, { ok: true, ingested: msgs.length, blocks: results });
});