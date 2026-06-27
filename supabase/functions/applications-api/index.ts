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
      const { application_id, krankenkasse, payload } = body as {
        application_id?: string;
        krankenkasse?: string;
        payload?: unknown;
      };
      if (!krankenkasse || typeof krankenkasse !== "string") return json(400, { error: "krankenkasse_required" });
      if (!payload || typeof payload !== "object") return json(400, { error: "payload_required" });

      const { iv, ct, hash } = await encryptPayload(payload);

      if (application_id) {
        const { data, error } = await admin
          .from("applications")
          .update({
            krankenkasse,
            payload_encrypted: bytesToHex(ct),
            payload_iv: bytesToHex(iv),
            payload_hash: hash,
          })
          .eq("id", application_id)
          .eq("user_id", user.id)
          .select("id, krankenkasse, status, created_at, updated_at, payload_hash, pdf_count, exported_at")
          .maybeSingle();
        if (error) return json(500, { error: "db_update_failed" });
        if (!data) return json(404, { error: "not_found" });
        await writeEvent(data.id, "updated", { krankenkasse });
        return json(200, { application: data });
      } else {
        const { data, error } = await admin
          .from("applications")
          .insert({
            user_id: user.id,
            krankenkasse,
            payload_encrypted: bytesToHex(ct),
            payload_iv: bytesToHex(iv),
            payload_hash: hash,
          })
          .select("id, krankenkasse, status, created_at, updated_at, payload_hash, pdf_count, exported_at")
          .single();
        if (error) return json(500, { error: "db_insert_failed" });
        await writeEvent(data.id, "created", { krankenkasse });
        return json(200, { application: data });
      }
    }

    if (action === "list") {
      const { data, error } = await admin
        .from("applications")
        .select("id, user_id, krankenkasse, status, pdf_count, exported_at, last_opened_at, created_at, updated_at")
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) return json(500, { error: "db_list_failed" });
      // Apply role-based filter manually since we're on service_role
      const { data: isAdminData } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
      const filtered = isAdminData ? data : (data ?? []).filter((r) => r.user_id === user.id);
      // Attach emails for admin view
      let userEmails: Record<string, string> = {};
      if (isAdminData && filtered && filtered.length) {
        const ids = Array.from(new Set(filtered.map((r) => r.user_id)));
        const { data: profs } = await admin.from("profiles").select("id, email").in("id", ids);
        userEmails = Object.fromEntries((profs ?? []).map((p) => [p.id, p.email ?? ""]));
      }
      return json(200, { applications: filtered, isAdmin: !!isAdminData, userEmails });
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
      const { data: isAdminData } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
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
      const { data: isAdminData } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
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