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
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

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

type MsgType = "dot" | "phone" | "email" | "header" | "text" | "image" | "pdf" | "audio";
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
    } else if (["audio", "voice", "ptt"].includes(type)) {
      const media = ((m.audio as Record<string, unknown>) ??
        (m.voice as Record<string, unknown>) ??
        (m.ptt as Record<string, unknown>) ??
        m) as Record<string, unknown>;
      out.push({
        wa_message_id: id,
        chat_id: chat,
        type: "audio",
        media_url: String(media.link ?? media.url ?? media.media_url ?? ""),
        media_mime: String(media.mime_type ?? media.mime ?? "audio/ogg"),
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
  chat_id?: string;
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
    // Only accept if there's something processable plus enough context. Audio can carry both.
    const hasProcessableMedia = inner.some((r) => r.type === "image" || r.type === "pdf" || r.type === "audio");
    const hasContext = inner.some((r) => r.type === "header" || r.type === "text" || r.type === "audio");
    if (!hasProcessableMedia || !hasContext) continue;
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
      if (m) datum = m[1].replace(/[-/]/g, ".");
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

function audioFormatFromMime(mimeType: string): string {
  const clean = mimeType.toLowerCase().split(";")[0].trim();
  if (clean.includes("mpeg") || clean.includes("mp3")) return "mp3";
  if (clean.includes("mp4") || clean.includes("m4a")) return "m4a";
  if (clean.includes("wav")) return "wav";
  if (clean.includes("webm")) return "webm";
  if (clean.includes("aac")) return "aac";
  if (clean.includes("flac")) return "flac";
  return "ogg";
}

async function transcribeAudio(
  audio: { base64: string; mimeType: string },
  warnings: string[],
): Promise<string> {
  if (!LOVABLE_API_KEY) {
    warnings.push("Audio konnte nicht transkribiert werden: KI-Schlüssel fehlt.");
    return "";
  }
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Transkribiere diese WhatsApp-Sprachnachricht für einen Krankenkassen-Antrag wortgetreu auf Deutsch. Gib nur den gesprochenen Inhalt zurück, keine Erklärung.",
              },
              {
                type: "input_audio",
                input_audio: {
                  data: audio.base64,
                  format: audioFormatFromMime(audio.mimeType),
                },
              },
            ],
          },
        ],
        max_tokens: 2048,
      }),
    });
    if (!response.ok) {
      warnings.push(`Audio-Transkription fehlgeschlagen (Status ${response.status}).`);
      return "";
    }
    const data = await response.json().catch(() => ({}));
    return String(data?.choices?.[0]?.message?.content ?? "").trim();
  } catch (error) {
    warnings.push(`Audio-Transkription fehlgeschlagen: ${(error as Error).message}`);
    return "";
  }
}

function extractFirstMatch(text: string, re: RegExp): string {
  return String(text.match(re)?.[0] ?? "").trim();
}

// ---------- Owner user for whatsapp intake ----------
// Uses the first admin user as the owner of ingested drafts.
async function resolveOwnerUserId(admin: ReturnType<typeof createClient>): Promise<string | null> {
  const { data } = await admin.from("user_roles").select("user_id").eq("role", "admin").limit(1).maybeSingle();
  return (data?.user_id as string | undefined) ?? null;
}

async function hasAdminAuthorization(admin: ReturnType<typeof createClient>, req: Request): Promise<boolean> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) return false;
  const { data: role } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();
  return !!role;
}

// ---------- Block processing ----------
async function callOcr(
  krankenkasse: string,
  contextText: string,
  images: Array<{ base64: string; mimeType: string }>,
  warnings: string[],
): Promise<Record<string, unknown>> {
  if ((!images.length && !contextText.trim()) || !krankenkasse) {
    if (!images.length && !contextText.trim()) warnings.push("Keine Bilder oder Textdaten für die Erkennung.");
    return {};
  }
  // Chunk to keep gateway under 60s limit (main cause of 504s)
  const CHUNK = 6;
  const chunks: Array<typeof images> = [];
  if (images.length) {
    for (let i = 0; i < images.length; i += CHUNK) chunks.push(images.slice(i, i + CHUNK));
  } else {
    chunks.push([]);
  }
  const merged: Record<string, unknown> = {};
  for (let ci = 0; ci < chunks.length; ci++) {
    const batch = chunks[ci];
    let lastStatus = 0;
    let ok = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      const ctl = new AbortController();
      const to = setTimeout(() => ctl.abort(), 110_000);
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/process-insurance-gemini3`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mode: "member",
            selectedKrankenkasse: krankenkasse,
            text: contextText,
            images: batch,
            // Small batches (≤4 Bilder) nutzen Gemini 2.5 Pro für maximale Qualität,
            // größere Batches fallen auf flash zurück, um 504-Timeouts zu vermeiden.
            fastOcr: batch.length > 4,
          }),
          signal: ctl.signal,
        });
        lastStatus = r.status;
        if (r.ok) {
          const data = await r.json().catch(() => ({}));
          const { improvedImages: _drop, ...rest } = (data ?? {}) as Record<string, unknown>;
          for (const [k, v] of Object.entries(rest)) {
            if (v === undefined || v === null || v === "") continue;
            merged[k] = v;
          }
          ok = true;
          break;
        }
        if (![502, 503, 504].includes(r.status)) break;
      } catch (e) {
        warnings.push(`OCR-Fehler (Chunk ${ci + 1}/${chunks.length}, Versuch ${attempt + 1}): ${(e as Error).message}`);
      } finally {
        clearTimeout(to);
      }
      if (attempt === 0) await new Promise((res) => setTimeout(res, 2000));
    }
    if (!ok) warnings.push(`OCR fehlgeschlagen (Chunk ${ci + 1}/${chunks.length}, Status ${lastStatus}).`);
  }
  return merged;
}

// Split rows into per-header groups. If all media appears before multiple headers,
// treat it as shared evidence and process it for every person. Otherwise media goes
// with the current header (the last header seen at that point).
function splitByHeader(rows: BufferRow[]): Array<{ header: BufferRow; media: BufferRow[] }> {
  const headers = rows.filter((r) => r.type === "header");
  if (!headers.length) return [];
  const groups = headers.map((h) => ({ header: h, media: [] as BufferRow[] }));
  const mediaRows = rows.filter((r) => r.type === "image" || r.type === "pdf");
  const firstHeaderIndex = rows.findIndex((r) => r.type === "header");
  const lastMediaIndex = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.type === "image" || r.type === "pdf").at(-1)?.i ?? -1;
  if (headers.length > 1 && mediaRows.length > 0 && lastMediaIndex < firstHeaderIndex) {
    for (const group of groups) group.media.push(...mediaRows);
    return groups;
  }
  let curIdx = 0;
  let seenHeader = false;
  for (const r of rows) {
    if (r.type === "header") {
      curIdx = headers.indexOf(r);
      seenHeader = true;
      continue;
    }
    if (r.type !== "image" && r.type !== "pdf") continue;
    if (!seenHeader) groups[0].media.push(r);
    else groups[curIdx].media.push(r);
  }
  return groups;
}

async function processRowsAsBlock(
  admin: ReturnType<typeof createClient>,
  chatId: string,
  rows: BufferRow[],
  separatorIds: string[],
  blockId = crypto.randomUUID(),
  claimRows = true,
) {
  const warnings: string[] = [];

  // Atomically claim the CONTENT rows by setting block_id ONLY where block_id is
  // still null. Separator dots can be shared by consecutive blocks, so they must
  // not be part of the all-or-nothing claim; otherwise every block after the
  // first one can be skipped because its opening separator was claimed earlier.
  const contentIds = rows.map((r) => r.id);
  const allIds = [...contentIds, ...separatorIds];
  if (claimRows) {
    const existingBlockIds = Array.from(new Set(rows.map((r) => r.block_id).filter(Boolean))) as string[];
    const anyContentAlreadyClaimed = rows.length > 0 && rows.some((r) => !!r.block_id && !r.processed_at);
    const newestReceived = Math.max(...rows.map((r) => Date.parse(r.received_at)).filter((n) => Number.isFinite(n)));
    const staleClaim = anyContentAlreadyClaimed && Number.isFinite(newestReceived) && newestReceived < Date.now() - 90_000;

    if (existingBlockIds.length >= 1 && staleClaim) {
      blockId = existingBlockIds[0];
      await admin
        .from("whatsapp_inbox_messages")
        .update({ block_id: blockId })
        .in("id", contentIds)
        .is("block_id", null);
      console.log("processing previously claimed stale block", { blockId, rowCount: rows.length });
    } else {
      const { data: claimed, error: claimErr } = await admin
        .from("whatsapp_inbox_messages")
        .update({ block_id: blockId })
        .in("id", contentIds)
        .is("block_id", null)
        .select("id");
      if (claimErr) {
        console.error("claim failed", claimErr.message);
        return { blockId, warnings: ["claim failed"], applicationIds: [] as string[] };
      }
      if (!claimed || claimed.length < contentIds.length) {
        console.log("block already claimed by another invocation, skipping", {
          expected: contentIds.length,
          claimed: claimed?.length ?? 0,
        });
        return { blockId, warnings: ["already claimed"], applicationIds: [] as string[] };
      }
    }

    if (separatorIds.length) {
      await admin
        .from("whatsapp_inbox_messages")
        .update({ block_id: blockId })
        .in("id", separatorIds)
        .is("block_id", null);
    }
  }

  const phoneRow = rows.find((r) => r.type === "phone");
  const emailRow = rows.find((r) => r.type === "email");
  const audioRows = rows.filter((r) => r.type === "audio");
  const audioTranscripts: string[] = [];
  for (const ar of audioRows) {
    if (!ar.media_url) {
      warnings.push("Audio ohne Medien-Link empfangen.");
      continue;
    }
    const audio = await fetchMediaAsBase64(ar.media_url);
    if (!audio) {
      warnings.push("Audio konnte nicht geladen werden.");
      continue;
    }
    const transcript = await transcribeAudio(audio, warnings);
    if (transcript) audioTranscripts.push(transcript);
  }
  const freeText = rows.filter((r) => r.type === "text").map((r) => r.text ?? "").filter(Boolean);
  const audioContext = audioTranscripts.map((t, i) => `Sprachnachricht ${i + 1}: ${t}`).join("\n");
  const fallbackHeaderText = [...freeText, ...audioTranscripts].join("\n").trim();
  const headerGroups = splitByHeader(rows);
  const groups = headerGroups.length
    ? headerGroups.map((g) => ({
        headerText: g.header.text ?? "",
        media: g.media,
        messageIds: [g.header.wa_message_id, ...g.media.map((r) => r.wa_message_id)],
      }))
    : fallbackHeaderText
      ? [{
          headerText: fallbackHeaderText,
          media: rows.filter((r) => r.type === "image" || r.type === "pdf"),
          messageIds: rows.filter((r) => r.type !== "dot").map((r) => r.wa_message_id),
        }]
      : [];
  if (!groups.length) {
    warnings.push("Kein Header oder auswertbarer Audio-/Textinhalt im Block.");
    return { blockId, warnings, applicationIds: [] as string[] };
  }

  const ownerId = await resolveOwnerUserId(admin);
  if (!ownerId) {
    warnings.push("Kein Admin-User als Owner gefunden — Antrag nicht gespeichert.");
    return { blockId, warnings, applicationIds: [] as string[] };
  }

  const applicationIds: string[] = [];
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    const personWarnings: string[] = [];
    const parsed = parseHeader(g.headerText);
    personWarnings.push(...parsed.warnings);
    const combinedContextSource = [g.headerText, audioContext].filter(Boolean).join("\n");
    const audioPhone = extractFirstMatch(combinedContextSource, /\+?\d[\d\s\-/()]{6,}/);
    const audioEmail = extractFirstMatch(combinedContextSource, /[^\s@]+@[^\s@]+\.[^\s@]+/);

    const images: Array<{ base64: string; mimeType: string }> = [];
    for (const mr of g.media) {
      if ((mr.type !== "image" && mr.type !== "pdf") || !mr.media_url) continue;
      const m = await fetchMediaAsBase64(mr.media_url);
      if (m) images.push(m);
      else personWarnings.push("Bild konnte nicht geladen werden.");
    }

    const contextText = [
      `Zielperson: ${parsed.vorname} ${parsed.name}`.trim(),
      parsed.datum ? `Antragsdatum: ${parsed.datum}` : "",
      parsed.krankenkasseLabel ? `Krankenkasse/Zielantrag: ${parsed.krankenkasseLabel}` : "",
      parsed.vertriebspartner ? `Vertriebspartner: ${parsed.vertriebspartner}` : "",
      phoneRow?.text || audioPhone ? `Telefon: ${(phoneRow?.text ?? audioPhone).trim()}` : "",
      emailRow?.text || audioEmail ? `Email: ${(emailRow?.text ?? audioEmail).trim()}` : "",
      audioContext,
      freeText.length ? `Weitere Textnachrichten:\n${freeText.join("\n")}` : "",
    ].filter(Boolean).join("\n");
    const ocr = await callOcr(parsed.krankenkasse, contextText, images, personWarnings);

    const payload: Record<string, unknown> = {
      ...ocr,
      selectedKrankenkasse: parsed.krankenkasse || (ocr.selectedKrankenkasse ?? ""),
      mitgliedVorname: parsed.vorname || ocr.mitgliedVorname || "",
      mitgliedName: parsed.name || ocr.mitgliedName || "",
      datum: toIsoDate(parsed.datum) || ocr.datum || "",
      signaturDatum: toIsoDate(parsed.datum) || ocr.signaturDatum || "",
      vertriebspartner: parsed.vertriebspartner || ocr.vertriebspartner || "",
      telefon: (phoneRow?.text ?? audioPhone).trim() || ocr.telefon || "",
      email: (emailRow?.text ?? audioEmail).trim() || ocr.email || "",
    };

    // ---------- Auto-Ableitungen aus Familienerkennung ----------
    const eh = payload.ehegatte as Record<string, unknown> | undefined;
    const kinder = Array.isArray(payload.kinder) ? (payload.kinder as unknown[]) : [];
    const hasSpouse = !!(eh && (eh.vorname || eh.name));
    const hasChildren = kinder.length > 0;
    const hasFamily = hasSpouse || hasChildren;

    if (hasSpouse && !payload.familienstand) {
      payload.familienstand = "verheiratet";
    }

    const kk = payload.selectedKrankenkasse;
    if (hasFamily) {
      if (kk === "big_plusbonus") {
        payload.bigFamilienversicherung = true;
        if (!payload.bigMitgliedBeschaeftigt) payload.bigMitgliedBeschaeftigt = "beschaeftigt";
      } else if (kk === "viactiv") {
        payload.viactivFamilienangehoerigeMitversichern = true;
      } else if (kk === "bkk_gs" && !payload.mode) {
        payload.mode = "familienversicherung_und_rundum";
      }
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
          person_index: gi,
          person_count: groups.length,
          message_ids: g.messageIds,
          warnings: personWarnings,
          betrag: parsed.betrag || null,
          ocr_fields: Object.keys(ocr).length,
          image_count: images.length,
        },
      })
      .select("id")
      .single();

    if (error || !appRow) {
      console.error("insert failed", error?.message);
      warnings.push(`Person ${gi + 1}: insert failed`);
      continue;
    }
    applicationIds.push(appRow.id);
    warnings.push(...personWarnings.map((w) => `P${gi + 1}: ${w}`));

    await admin.from("application_events").insert({
      application_id: appRow.id,
      user_id: ownerId,
      event_type: "whatsapp_intake",
      meta: { block_id: blockId, chat_id: chatId, warnings: personWarnings, images: images.length, person_index: gi },
    });
  }

  // Mark buffer rows as processed
  if (claimRows) {
    await admin
      .from("whatsapp_inbox_messages")
      .update({ processed_at: new Date().toISOString() })
      .in("id", allIds);
  }

  return { blockId, warnings, applicationIds };
}

async function processBlock(
  admin: ReturnType<typeof createClient>,
  chatId: string,
  rows: BufferRow[],
  separatorIds: string[],
) {
  return processRowsAsBlock(admin, chatId, rows, separatorIds);
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
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const isSecretAuthorized = !!INTAKE_SECRET && secret === INTAKE_SECRET;
  const isRescanRequest = !!url.searchParams.get("rescan_block_id") || url.searchParams.get("rescan_unprocessed") === "1";
  const isAdminAuthorized = isRescanRequest ? await hasAdminAuthorization(admin, req) : false;
  if (!isSecretAuthorized && !isAdminAuthorized) {
    return json(401, { error: "unauthorized" });
  }

  if (url.searchParams.get("rescan_block_id")) {
    const targetBlockId = url.searchParams.get("rescan_block_id")!;
    const { data: blockRows, error: blockErr } = await admin
      .from("whatsapp_inbox_messages")
      .select("id, wa_message_id, type, text, media_url, media_mime, received_at, block_id, processed_at")
      .eq("block_id", targetBlockId)
      .order("received_at", { ascending: true });

    if (blockErr) return json(500, { error: "rescan_read_failed" });
    const contentRows = ((blockRows ?? []) as BufferRow[]).filter((r) => r.type !== "dot");
    if (!contentRows.length) return json(404, { error: "block_not_found" });

    const freshBlockId = crypto.randomUUID();
    const res = await processRowsAsBlock(admin, contentRows[0].chat_id ?? ALLOWED_CHAT_ID, contentRows, [], freshBlockId, false);
    return json(200, { ok: true, rescan: true, previousBlockId: targetBlockId, ...res });
  }

  if (url.searchParams.get("rescan_unprocessed") === "1") {
    const targetChatId = url.searchParams.get("chat_id") || ALLOWED_CHAT_ID;
    if (!targetChatId) return json(400, { error: "missing_chat_id" });
    const { data: bufRows } = await admin
      .from("whatsapp_inbox_messages")
      .select("id, wa_message_id, type, text, media_url, media_mime, received_at, block_id, processed_at")
      .eq("chat_id", targetChatId)
      .order("received_at", { ascending: true })
      .limit(500);
    const blocks = findClosedBlocks((bufRows ?? []) as BufferRow[]);
    const results = [];
    for (const b of blocks) {
      results.push(await processBlock(admin, targetChatId, b.rows, b.separatorIds));
    }
    return json(200, { ok: true, rescan: true, blockCount: blocks.length, results });
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

  // Respond 200 to WHAPI immediately; WHAPI has a short timeout and retries on
  // hang, which would otherwise trigger duplicate OCR + duplicate drafts.
  // Actual block scanning + OCR runs in the background.
  const chats = Array.from(new Set(msgs.map((m) => m.chat_id)));
  const scan = (async () => {
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
        closedBlocks: blocks.length,
      });
      for (const b of blocks) {
        console.log("processing block", { rowCount: b.rows.length });
        const res = await processBlock(admin, chatId, b.rows, b.separatorIds);
        console.log("block result", {
          applicationIds: res.applicationIds,
          warnings: res.warnings,
        });
      }
    }
  })();
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(scan);
  else scan.catch((e) => console.error("bg scan failed", (e as Error).message));

  return json(200, { ok: true, ingested: msgs.length, queued: true });
});