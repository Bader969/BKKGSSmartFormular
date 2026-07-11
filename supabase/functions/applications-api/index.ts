import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENC_SECRET = Deno.env.get("APPLICATIONS_ENCRYPTION_KEY")!;

const enc = new TextEncoder();
const dec = new TextDecoder();

let cachedKey: CryptoKey | null = null;
async function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const material = await crypto.subtle.digest("SHA-256", enc.encode(ENC_SECRET));
  cachedKey = await crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  return cachedKey;
}

function b64encode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
// Postgres bytea hex format: "\\xDEADBEEF"
function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith("\\x") ? hex.slice(2) : hex;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
  return out;
}
function bytesToHex(bytes: Uint8Array): string {
  let h = "";
  for (let i = 0; i < bytes.length; i++) h += bytes[i].toString(16).padStart(2, "0");
  return "\\x" + h;
}

async function sha256Hex(input: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize((value as Record<string, unknown>)[k])).join(",") + "}";
}

async function encryptPayload(payload: unknown): Promise<{ iv: Uint8Array; ct: Uint8Array; hash: string }> {
  const key = await getKey();
  const canon = canonicalize(payload);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(canon)));
  const hash = await sha256Hex(canon);
  return { iv, ct, hash };
}

async function decryptPayload(ctHex: string, ivHex: string): Promise<unknown> {
  const key = await getKey();
  const ct = hexToBytes(ctHex);
  const iv = hexToBytes(ivHex);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(dec.decode(new Uint8Array(pt)));
}

async function hashIp(ip: string | null): Promise<string | null> {
  if (!ip) return null;
  return await sha256Hex(ip + "|" + ENC_SECRET);
}

type Action = "save" | "list" | "decrypt" | "mark-exported" | "delete" | "events";

type PersonDesired = {
  person_role: "ehegatte" | "kind";
  person_index: number | null;
  applicant_vorname: string;
  applicant_name: string;
};

function collectPersonsWithOwnMembership(payload: Record<string, unknown>): PersonDesired[] {
  const out: PersonDesired[] = [];
  const eh = payload.ehegatte as Record<string, unknown> | undefined;
  if (eh && eh.eigeneMitgliedschaft === true) {
    const vor = typeof eh.vorname === "string" ? eh.vorname.trim() : "";
    const nam = typeof eh.name === "string" ? eh.name.trim() : "";
    if (vor || nam) {
      out.push({ person_role: "ehegatte", person_index: null, applicant_vorname: vor.slice(0, 120), applicant_name: nam.slice(0, 120) });
    }
  }
  const kinder = Array.isArray(payload.kinder) ? (payload.kinder as Array<Record<string, unknown>>) : [];
  kinder.forEach((k, i) => {
    if (k && k.eigeneMitgliedschaft === true) {
      const vor = typeof k.vorname === "string" ? k.vorname.trim() : "";
      const nam = typeof k.name === "string" ? k.name.trim() : "";
      if (vor || nam) {
        out.push({ person_role: "kind", person_index: i + 1, applicant_vorname: vor.slice(0, 120), applicant_name: nam.slice(0, 120) });
      }
    }
  });
  return out;
}

function buildSubAntragsform(baseAntragsform: string | null, p: PersonDesired): string {
  const label = p.person_role === "ehegatte"
    ? "Ehegatte"
    : `Kind ${p.person_index ?? ""}`.trim();
  const personName = [p.applicant_vorname, p.applicant_name].filter(Boolean).join(" ");
  const suffix = personName ? `${label}: ${personName}` : label;
  const base = baseAntragsform ?? "";
  return (base ? `${base} (${suffix})` : suffix).slice(0, 80);
}

async function syncSubEntries(args: {
  admin: ReturnType<typeof createClient>;
  parentId: string;
  userId: string;
  krankenkasse: string;
  vertriebspartner: string | null;
  antragsform: string | null;
  ctHex: string;
  ivHex: string;
  hash: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const { admin, parentId, userId, krankenkasse, vertriebspartner, antragsform, ctHex, ivHex, hash, payload } = args;

  const desired = collectPersonsWithOwnMembership(payload);
  const { data: existing } = await admin
    .from("applications")
    .select("id, person_role, person_index")
    .eq("parent_application_id", parentId);

  const existingMap = new Map<string, { id: string }>();
  (existing ?? []).forEach((r) => {
    const key = `${r.person_role}#${r.person_index ?? ""}`;
    existingMap.set(key, { id: r.id });
  });

  const desiredKeys = new Set<string>();
  for (const p of desired) {
    const key = `${p.person_role}#${p.person_index ?? ""}`;
    desiredKeys.add(key);
    const sub = {
      user_id: userId,
      krankenkasse,
      payload_encrypted: ctHex,
      payload_iv: ivHex,
      payload_hash: hash,
      vertriebspartner,
      applicant_name: p.applicant_name || null,
      applicant_vorname: p.applicant_vorname || null,
      antragsform: buildSubAntragsform(antragsform, p),
      parent_application_id: parentId,
      person_role: p.person_role,
      person_index: p.person_index,
    };
    const existingRow = existingMap.get(key);
    if (existingRow) {
      await admin.from("applications").update(sub).eq("id", existingRow.id);
    } else {
      await admin.from("applications").insert(sub);
    }
  }

  const stale = (existing ?? []).filter((r) => !desiredKeys.has(`${r.person_role}#${r.person_index ?? ""}`));
  if (stale.length) {
    await admin.from("applications").delete().in("id", stale.map((s) => s.id));
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json(401, { error: "missing_auth" });

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json(401, { error: "invalid_session" });
    const user = userData.user;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const checkAdmin = async (): Promise<boolean> => {
      const { data } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    };

    const body = (await req.json().catch(() => ({}))) as { action?: Action; [k: string]: unknown };
    const action = body.action;
    const ipHash = await hashIp(req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null);
    const ua = (req.headers.get("user-agent") ?? "").slice(0, 255);

    const writeEvent = async (application_id: string, event_type: string, meta: Record<string, unknown>) => {
      await admin.from("application_events").insert({
        application_id,
        user_id: user.id,
        event_type,
        meta,
        ip_hash: ipHash,
        user_agent: ua,
      });
    };

    if (action === "save") {
      const { application_id, krankenkasse, payload, vertriebspartner, applicant_name, applicant_vorname, antragsform } = body as {
        application_id?: string;
        krankenkasse?: string;
        payload?: unknown;
        vertriebspartner?: string;
        applicant_name?: string;
        applicant_vorname?: string;
        antragsform?: string;
      };
      if (!krankenkasse || typeof krankenkasse !== "string") return json(400, { error: "krankenkasse_required" });
      if (!payload || typeof payload !== "object") return json(400, { error: "payload_required" });

      const { iv, ct, hash } = await encryptPayload(payload);
      const meta = {
        vertriebspartner: typeof vertriebspartner === "string" ? vertriebspartner.slice(0, 120) : null,
        applicant_name: typeof applicant_name === "string" ? applicant_name.slice(0, 120) : null,
        applicant_vorname: typeof applicant_vorname === "string" ? applicant_vorname.slice(0, 120) : null,
        antragsform: typeof antragsform === "string" ? antragsform.slice(0, 80) : null,
      };

      const ctHex = bytesToHex(ct);
      const ivHex = bytesToHex(iv);

      let parentRow: { id: string; krankenkasse: string; status: string; created_at: string; updated_at: string; payload_hash: string; pdf_count: number; exported_at: string | null } | null = null;

      if (application_id) {
        const { data, error } = await admin
          .from("applications")
          .update({
            krankenkasse,
            payload_encrypted: ctHex,
            payload_iv: ivHex,
            payload_hash: hash,
            ...meta,
          })
          .eq("id", application_id)
          .eq("user_id", user.id)
          .is("parent_application_id", null)
          .select("id, krankenkasse, status, created_at, updated_at, payload_hash, pdf_count, exported_at")
          .maybeSingle();
        if (error) return json(500, { error: "db_update_failed" });
        if (!data) return json(404, { error: "not_found" });
        await writeEvent(data.id, "updated", { krankenkasse });
        parentRow = data;
      } else {
        const { data, error } = await admin
          .from("applications")
          .insert({
            user_id: user.id,
            krankenkasse,
            payload_encrypted: ctHex,
            payload_iv: ivHex,
            payload_hash: hash,
            ...meta,
          })
          .select("id, krankenkasse, status, created_at, updated_at, payload_hash, pdf_count, exported_at")
          .single();
        if (error) return json(500, { error: "db_insert_failed" });
        await writeEvent(data.id, "created", { krankenkasse });
        parentRow = data;
      }

      // Sync sub-entries for persons with their own membership
      await syncSubEntries({
        admin,
        parentId: parentRow.id,
        userId: user.id,
        krankenkasse,
        vertriebspartner: meta.vertriebspartner,
        antragsform: meta.antragsform,
        ctHex,
        ivHex,
        hash,
        payload: payload as Record<string, unknown>,
      });

      return json(200, { application: parentRow });
    }

    if (action === "list") {
      const { data, error } = await admin
        .from("applications")
        .select("id, user_id, krankenkasse, status, pdf_count, exported_at, last_opened_at, created_at, updated_at, vertriebspartner, applicant_name, applicant_vorname, antragsform, parent_application_id, person_role, person_index, source")
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) return json(500, { error: "db_list_failed" });
      // Apply role-based filter manually since we're on service_role
      const isAdminData = await checkAdmin();
      const filtered = isAdminData ? data : (data ?? []).filter((r) => r.user_id === user.id);
      // Attach emails and display names for every visible row
      let userEmails: Record<string, string> = {};
      let userDisplayNames: Record<string, string> = {};
      if (filtered && filtered.length) {
        const ids = Array.from(new Set(filtered.map((r) => r.user_id)));
        const { data: profs } = await admin.from("profiles").select("id, email, display_name").in("id", ids);
        userEmails = Object.fromEntries((profs ?? []).map((p) => [p.id, p.email ?? ""]));
        userDisplayNames = Object.fromEntries((profs ?? []).map((p) => [p.id, p.display_name ?? ""]));
      }
      // Attach latest emailed_at / whatsapp_sent_at per application row (per person).
      // Sub-entries (Ehegatte/Kind) key on (parent_id, person_role, person_index);
      // parent rows key on (id, 'main', null) with a legacy fallback for events
      // that were written without a person_role.
      const withStatus = (filtered ?? []).map((r) => ({ ...r, emailed_at: null as string | null, whatsapp_sent_at: null as string | null }));
      if (withStatus.length) {
        // Determine which parent application ids we need to look up events for:
        // parent-rows themselves + parents of any sub-rows.
        const parentIds = new Set<string>();
        for (const r of withStatus) {
          parentIds.add(r.parent_application_id ?? r.id);
        }
        const { data: evs } = await admin
          .from("application_events")
          .select("application_id, event_type, meta, created_at")
          .in("application_id", Array.from(parentIds))
          .in("event_type", ["emailed", "whatsapp_sent"])
          .order("created_at", { ascending: false })
          .limit(2000);
        // Bucket latest timestamp per (parent_application_id, event_type, person_role, person_index)
        const latest = new Map<string, string>();
        for (const ev of evs ?? []) {
          const meta = (ev.meta ?? {}) as Record<string, unknown>;
          const role = typeof meta.person_role === "string" ? meta.person_role : "__legacy__";
          const idx = typeof meta.person_index === "number" ? meta.person_index : "";
          const key = `${ev.application_id}#${ev.event_type}#${role}#${idx}`;
          if (!latest.has(key)) latest.set(key, ev.created_at as string);
        }
        for (const r of withStatus) {
          const pid = r.parent_application_id ?? r.id;
          const isSub = !!r.parent_application_id;
          const role = isSub ? (r.person_role ?? "") : "main";
          const idx = isSub && r.person_role === "kind" ? (r.person_index ?? "") : "";
          const pick = (evType: string): string | null => {
            // Preferred: strict per-person match
            const hit = latest.get(`${pid}#${evType}#${role}#${idx}`);
            if (hit) return hit;
            // Legacy fallback: parent rows also accept events without any person_role
            if (!isSub) return latest.get(`${pid}#${evType}#__legacy__#`) ?? null;
            return null;
          };
          r.emailed_at = pick("emailed");
          r.whatsapp_sent_at = pick("whatsapp_sent");
        }
      }
      return json(200, { applications: withStatus, isAdmin: !!isAdminData, userEmails, userDisplayNames });
    }

    if (action === "decrypt") {
      const { application_id } = body as { application_id?: string };
      if (!application_id) return json(400, { error: "application_id_required" });
      const { data, error } = await admin
        .from("applications")
        .select("id, user_id, krankenkasse, payload_encrypted, payload_iv")
        .eq("id", application_id)
        .maybeSingle();
      if (error || !data) return json(404, { error: "not_found" });
      const isAdminData = await checkAdmin();
      if (data.user_id !== user.id && !isAdminData) return json(403, { error: "forbidden" });
      const payload = await decryptPayload(data.payload_encrypted as unknown as string, data.payload_iv as unknown as string);
      await admin.from("applications").update({ last_opened_at: new Date().toISOString() }).eq("id", application_id);
      await writeEvent(application_id, "decrypted", { krankenkasse: data.krankenkasse });
      return json(200, { payload, krankenkasse: data.krankenkasse });
    }

    if (action === "mark-exported") {
      const { application_id, pdf_count } = body as { application_id?: string; pdf_count?: number };
      if (!application_id) return json(400, { error: "application_id_required" });
      const { data, error } = await admin
        .from("applications")
        .update({
          status: "exported",
          exported_at: new Date().toISOString(),
          pdf_count: typeof pdf_count === "number" ? pdf_count : 1,
        })
        .eq("id", application_id)
        .eq("user_id", user.id)
        .select("id, status, exported_at, pdf_count")
        .maybeSingle();
      if (error || !data) return json(404, { error: "not_found" });
      await writeEvent(application_id, "exported", { pdf_count: data.pdf_count });
      return json(200, { application: data });
    }

    if (action === "delete") {
      const { application_id } = body as { application_id?: string };
      if (!application_id) return json(400, { error: "application_id_required" });
      // Disallow deleting sub-entries directly — they are managed via the parent.
      const { data: target } = await admin
        .from("applications")
        .select("parent_application_id")
        .eq("id", application_id)
        .maybeSingle();
      if (target?.parent_application_id) return json(400, { error: "delete_subentry_via_parent" });
      const isAdminData = await checkAdmin();
      const q = admin.from("applications").delete().eq("id", application_id);
      const { error } = isAdminData ? await q : await q.eq("user_id", user.id);
      if (error) return json(500, { error: "db_delete_failed" });
      // Event row cascades; log nothing further (row is gone).
      return json(200, { ok: true });
    }

    if (action === "events") {
      const { application_id } = body as { application_id?: string };
      if (!application_id) return json(400, { error: "application_id_required" });
      const { data, error } = await admin
        .from("application_events")
        .select("id, event_type, meta, created_at, user_id")
        .eq("application_id", application_id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) return json(500, { error: "db_events_failed" });
      return json(200, { events: data ?? [] });
    }

    return json(400, { error: "unknown_action" });
  } catch (_e) {
    // No PII or payload contents in logs
    return json(500, { error: "internal_error" });
  }
});