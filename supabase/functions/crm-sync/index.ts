import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENC_SECRET = Deno.env.get("APPLICATIONS_ENCRYPTION_KEY")!;
const CRM_IMPORT_SECRET = Deno.env.get("CRM_IMPORT_SECRET") ?? "";
const CRM_IMPORT_URL = Deno.env.get("CRM_IMPORT_URL") ??
  "https://acvuxtmkzhjzecrfvhfp.supabase.co/functions/v1/gkv-import";

const enc = new TextEncoder();
const dec = new TextDecoder();

let cachedKey: CryptoKey | null = null;
async function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const material = await crypto.subtle.digest("SHA-256", enc.encode(ENC_SECRET));
  cachedKey = await crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  return cachedKey;
}

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith("\\x") ? hex.slice(2) : hex;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
  return out;
}

async function decryptPayload(ctHex: string, ivHex: string): Promise<Record<string, unknown>> {
  const key = await getKey();
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: hexToBytes(ivHex) },
    key,
    hexToBytes(ctHex),
  );
  return JSON.parse(dec.decode(new Uint8Array(pt))) as Record<string, unknown>;
}

// ---------------------------------------------------------------- VP mapping
const VP_ADVISOR: Record<string, string> = {
  "AD Blitzvox": "Adam",
  "AM Blitzvox": "Ammar",
  "BA Blitzvox": "Bashar Yahia",
  "EM AM Blitzvox": "Ammar",
  "EM HZ Blitzvox": "Hamza",
  "GH Blitzvox": "Gheith",
  "HZ Blitzvox": "Hamza",
  "JA Blitzvox": "Jamil",
};
const advisorForVp = (vp?: string | null) => (vp && VP_ADVISOR[vp.trim()]) || null;

const KK_LABEL: Record<string, string> = {
  bkk_gs: "BKK GILDEMEISTER SEIDENSTICKER",
  viactiv: "VIACTIV Krankenkasse",
  novitas: "Novitas BKK",
  dak: "DAK-Gesundheit",
  big_plusbonus: "BIG direkt gesund",
};

// ---------------------------------------------------------------- helpers
const s = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** dd.mm.yyyy | yyyy-mm-dd → yyyy-mm-dd (oder null) */
function toIsoDate(v: unknown): string | null {
  const raw = s(v);
  if (!raw) return null;
  const de = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (de) return `${de[3]}-${de[2].padStart(2, "0")}-${de[1].padStart(2, "0")}`;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return raw;
  return null;
}

function mapGeschlecht(v: unknown): "m" | "w" | "d" | null {
  const g = s(v).toLowerCase();
  if (["w", "weiblich", "f"].includes(g)) return "w";
  if (["m", "maennlich", "männlich"].includes(g)) return "m";
  if (["d", "divers", "x", "unbestimmt"].includes(g)) return "d";
  return null;
}

const salutationFor = (g: "m" | "w" | "d" | null) =>
  g === "w" ? "Frau" : g === "m" ? "Herr" : g === "d" ? "Divers" : null;

const streetOf = (strasse: unknown, hausnummer: unknown) =>
  [s(strasse), s(hausnummer)].filter(Boolean).join(" ") || null;

const nn = (v: string | null) => (v && v.length ? v : null);

type CrmEntry = Record<string, unknown>;

// -------------------------------------------------- eigene Mitgliedschaft
function ageInYears(v: unknown): number | null {
  const iso = toIsoDate(v);
  if (!iso) return null;
  const d = new Date(iso);
  const ref = new Date();
  let a = ref.getFullYear() - d.getFullYear();
  const mDiff = ref.getMonth() - d.getMonth();
  if (mDiff < 0 || (mDiff === 0 && ref.getDate() < d.getDate())) a -= 1;
  return a;
}

/**
 * Nur Personen mit eigener Mitgliedschaft werden als eigener Kunde + GKV-Vertrag
 * übertragen. Novitas: Ehegatte + Kinder ≥ 16, wenn Hauptmitglied Jobcenter.
 */
function hasOwnMembership(
  payload: Record<string, unknown>,
  krankenkasse: string,
  m: Record<string, unknown>,
  relation: "ehegatte" | "kind",
): boolean {
  if (krankenkasse === "novitas") {
    if ((payload.novitasMode ?? "familie") !== "familie") return false;
    if (payload.viactivBeschaeftigung !== "al_geld_2") return false;
    if (relation === "ehegatte") return true;
    const age = ageInYears(m.geburtsdatum);
    return age != null && age >= 16;
  }
  return m.eigeneMitgliedschaft === true;
}

function buildEntries(app: {
  id: string;
  krankenkasse: string;
  created_at: string;
  vertriebspartner: string | null;
}, payload: Record<string, unknown>): CrmEntry[] {
  const advisor = advisorForVp(app.vertriebspartner);
  const currentKasse = KK_LABEL[s(payload.selectedKrankenkasse) || app.krankenkasse] ??
    (s(payload.selectedKrankenkasse) || app.krankenkasse);
  const previousKasse = nn(s(payload.mitgliedKrankenkasse));
  const startDate = toIsoDate(payload.beginnFamilienversicherung);
  const mainStreet = streetOf(payload.mitgliedStrasse, payload.mitgliedHausnummer);
  const mainZip = nn(s(payload.mitgliedPlz));
  const mainCity = nn(s(payload.ort));
  const phone = nn(s(payload.telefon));
  const email = nn(s(payload.email));
  const mainGeschlecht = mapGeschlecht(payload.viactivGeschlecht);
  const staat = nn(s(payload.viactivStaatsangehoerigkeit));

  const common = {
    source: "gkv-antragsportal",
    application_id: app.id,
    vp_code: app.vertriebspartner ?? null,
    advisor_name: advisor,
    created_at: app.created_at,
    lead_source: "sonstiges",
    lead_source_detail: "GKV-Kampagne",
  };

  const kinder = Array.isArray(payload.kinder) ? (payload.kinder as Array<Record<string, unknown>>) : [];
  const ehegatte = (payload.ehegatte ?? null) as Record<string, unknown> | null;

  const familyMembers: CrmEntry[] = [];
  const memberRow = (m: Record<string, unknown>, relation: "ehegatte" | "kind") => ({
    relation,
    first_name: s(m.vorname),
    last_name: s(m.name),
    birthdate: toIsoDate(m.geburtsdatum),
    versicherungsnummer: nn(s(m.versichertennummer)),
    geschlecht: mapGeschlecht(m.geschlecht),
    verwandtschaft: nn(s(m.verwandtschaft)) as string | null,
    geburtsname: nn(s(m.geburtsname)) ?? nn(s(m.name)),
    geburtsort: nn(s(m.geburtsort)),
    geburtsland: nn(s(m.geburtsland)),
    staatsangehoerigkeit: nn(s(m.staatsangehoerigkeit)) ?? staat,
    bisherig_kasse: nn(s(m.bisherigBestandBei)) ?? previousKasse,
    bisherig_ende: toIsoDate(m.bisherigEndeteAm),
    bisherig_art: nn(s(m.bisherigArt)) as string | null,
    abweichende_anschrift: nn(s(m.abweichendeAnschrift)),
  });

  if (ehegatte && (s(ehegatte.vorname) || s(ehegatte.name))) {
    familyMembers.push(memberRow(ehegatte, "ehegatte"));
  }
  for (const k of kinder) {
    if (!k || (!s(k.vorname) && !s(k.name))) continue;
    familyMembers.push(memberRow(k, "kind"));
  }

  const entries: CrmEntry[] = [];

  // Hauptmitglied
  entries.push({
    ...common,
    external_ref: `${app.id}:main`,
    role: "hauptmitglied",
    customer: {
      salutation: salutationFor(mainGeschlecht),
      first_name: s(payload.mitgliedVorname),
      last_name: s(payload.mitgliedName),
      birthdate: toIsoDate(payload.mitgliedGeburtsdatum),
      phone,
      email,
      street: mainStreet,
      zip: mainZip,
      city: mainCity,
    },
    contract: {
      type: "gkv",
      status: "in_pruefung",
      provider: currentKasse,
      start_date: startDate,
      kv_details: {
        geschlecht: mainGeschlecht,
        familienstand: nn(s(payload.familienstand)),
        geburtsort: nn(s(payload.mitgliedGeburtsort)),
        geburtsland: nn(s(payload.mitgliedGeburtsland)),
        staatsangehoerigkeit: staat,
        kv_nummer: nn(s(payload.mitgliedKvNummer)) ?? nn(s(payload.mitgliedVersichertennummer)),
        vorherige_kasse: previousKasse,
        vorherige_kasse_ende: null,
      },
    },
    family_members: familyMembers,
  });

  // Familienmitglieder: eigener Kunde + eigener GKV-Vertrag
  const personEntry = (m: Record<string, unknown>, relation: "ehegatte" | "kind", idx: number | null) => {
    const g = mapGeschlecht(m.geschlecht);
    const abweichend = nn(s(m.abweichendeAnschrift));
    return {
      ...common,
      external_ref: `${app.id}:${relation}${idx ? `:${idx}` : ""}`,
      role: relation,
      related_to_external_ref: `${app.id}:main`,
      own_membership: m.eigeneMitgliedschaft === true,
      customer: {
        salutation: salutationFor(g),
        first_name: s(m.vorname),
        last_name: s(m.name),
        birthdate: toIsoDate(m.geburtsdatum),
        phone,
        email,
        street: abweichend ?? mainStreet,
        zip: abweichend ? null : mainZip,
        city: abweichend ? null : mainCity,
      },
      contract: {
        type: "gkv",
        status: "in_pruefung",
        provider: currentKasse,
        start_date: startDate,
        kv_details: {
          geschlecht: g,
          familienstand: relation === "ehegatte" ? nn(s(payload.familienstand)) : null,
          geburtsort: nn(s(m.geburtsort)),
          geburtsland: nn(s(m.geburtsland)),
          staatsangehoerigkeit: nn(s(m.staatsangehoerigkeit)) ?? staat,
          kv_nummer: nn(s(m.versichertennummer)),
          vorherige_kasse: nn(s(m.bisherigBestandBei)) ?? previousKasse,
          vorherige_kasse_ende: toIsoDate(m.bisherigEndeteAm),
        },
      },
    };
  };

  if (ehegatte && (s(ehegatte.vorname) || s(ehegatte.name))) {
    entries.push(personEntry(ehegatte, "ehegatte", null));
  }
  kinder.forEach((k, i) => {
    if (!k || (!s(k.vorname) && !s(k.name))) return;
    entries.push(personEntry(k, "kind", i + 1));
  });

  return entries;
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
    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    const isAdmin = !!roleRow;

    const body = (await req.json().catch(() => ({}))) as {
      action?: "preview" | "push";
      application_ids?: string[];
      dry_run?: boolean;
    };
    const action = body.action ?? "preview";
    const ids = Array.isArray(body.application_ids)
      ? body.application_ids.filter((x) => typeof x === "string").slice(0, 200)
      : [];
    if (!ids.length) return json(400, { error: "no_applications" });

    let q = admin
      .from("applications")
      .select("id, user_id, krankenkasse, created_at, vertriebspartner, parent_application_id, payload_encrypted, payload_iv, crm_synced_at")
      .in("id", ids)
      .is("parent_application_id", null);
    if (!isAdmin) q = q.eq("user_id", user.id);
    const { data: apps, error: appsErr } = await q;
    if (appsErr) return json(500, { error: "db_read_failed" });

    const results: Array<Record<string, unknown>> = [];
    const batch: CrmEntry[] = [];
    const appEntryCount = new Map<string, number>();

    for (const app of apps ?? []) {
      if (!advisorForVp(app.vertriebspartner)) {
        results.push({ application_id: app.id, status: "skipped", reason: "vp_not_eligible", vp: app.vertriebspartner });
        continue;
      }
      let payload: Record<string, unknown>;
      try {
        payload = await decryptPayload(app.payload_encrypted as unknown as string, app.payload_iv as unknown as string);
      } catch (_e) {
        results.push({ application_id: app.id, status: "error", reason: "decrypt_failed" });
        continue;
      }
      const entries = buildEntries(
        { id: app.id, krankenkasse: app.krankenkasse, created_at: app.created_at, vertriebspartner: app.vertriebspartner },
        payload,
      );
      appEntryCount.set(app.id, entries.length);
      batch.push(...entries);
      results.push({
        application_id: app.id,
        status: "prepared",
        entries: entries.length,
        already_synced_at: app.crm_synced_at ?? null,
      });
    }

    if (action === "preview" || body.dry_run) {
      return json(200, { ok: true, mode: "preview", entries: batch.length, results, payload_sample: batch.slice(0, 2) });
    }

    if (!CRM_IMPORT_SECRET) {
      return json(400, { error: "crm_secret_missing", message: "CRM_IMPORT_SECRET ist nicht konfiguriert." });
    }
    if (!batch.length) return json(200, { ok: true, entries: 0, results });

    const res = await fetch(CRM_IMPORT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-import-secret": CRM_IMPORT_SECRET },
      body: JSON.stringify({ source: "gkv-antragsportal", entries: batch }),
    });
    const text = await res.text();
    let parsed: unknown = text;
    try { parsed = JSON.parse(text); } catch { /* keep text */ }

    if (!res.ok) {
      console.error(`CRM import failed [${res.status}]: ${text.slice(0, 2000)}`);
      for (const app of apps ?? []) {
        if (!appEntryCount.has(app.id)) continue;
        await admin.from("crm_sync_log").insert({
          application_id: app.id,
          actor_id: user.id,
          status: "error",
          entries: appEntryCount.get(app.id) ?? 0,
          response: { status: res.status, body: parsed },
          error: `CRM ${res.status}`,
        });
      }
      return json(res.status, { error: "crm_import_failed", status: res.status, details: parsed });
    }

    const now = new Date().toISOString();
    for (const app of apps ?? []) {
      if (!appEntryCount.has(app.id)) continue;
      await admin.from("applications").update({ crm_synced_at: now }).eq("id", app.id);
      await admin.from("crm_sync_log").insert({
        application_id: app.id,
        actor_id: user.id,
        status: "ok",
        entries: appEntryCount.get(app.id) ?? 0,
        response: { status: res.status, body: parsed },
      });
      await admin.from("application_events").insert({
        application_id: app.id,
        user_id: user.id,
        event_type: "crm_synced",
        meta: { entries: appEntryCount.get(app.id) ?? 0 },
      });
    }

    return json(200, { ok: true, entries: batch.length, synced_at: now, results, crm_response: parsed });
  } catch (e) {
    console.error("crm-sync error", e);
    return json(500, { error: "unexpected", message: e instanceof Error ? e.message : String(e) });
  }
});