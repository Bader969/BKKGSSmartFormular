import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENC_SECRET = Deno.env.get("APPLICATIONS_ENCRYPTION_KEY")!;
const CRM_IMPORT_SECRET = Deno.env.get("CRM_IMPORT_SECRET") ?? "";
const CRM_IMPORT_URL = Deno.env.get("CRM_IMPORT_URL") ??
  "https://acvuxtmkzhjzecrfvhfp.supabase.co/functions/v1/gkv-import";
/** Secret kann inkl. "/rest/v1/" hinterlegt sein – für createClient muss die Basis-URL rein. */
const CRM_SUPABASE_URL = (Deno.env.get("CRM_SUPABASE_URL") ?? "")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/rest\/v1$/, "");
const CRM_SERVICE_ROLE_KEY = Deno.env.get("CRM_SERVICE_ROLE_KEY") ?? "";

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
const NORM_VP_ADVISOR: Record<string, string> = Object.fromEntries(
  Object.entries(VP_ADVISOR).map(([k, v]) => [k.trim().toLowerCase().replace(/\s+/g, " "), v]),
);
const advisorForVp = (vp?: string | null): string | null => {
  if (!vp) return null;
  return NORM_VP_ADVISOR[vp.trim().toLowerCase().replace(/\s+/g, " ")] ?? null;
};

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
    if (hasOwnMembership(payload, app.krankenkasse, ehegatte, "ehegatte")) {
      entries.push(personEntry(ehegatte, "ehegatte", null));
    }
  }
  kinder.forEach((k, i) => {
    if (!k || (!s(k.vorname) && !s(k.name))) return;
    if (!hasOwnMembership(payload, app.krankenkasse, k, "kind")) return;
    entries.push(personEntry(k, "kind", i + 1));
  });

  return entries;
}

// ---------------------------------------------------------------- SQL export
const KV_FAMILIENSTAND = ["ledig", "verheiratet", "getrennt", "geschieden", "verwitwet"];
const KV_VERWANDTSCHAFT = ["leiblich", "stief", "enkel", "pflege"];
const KV_BISHERIG_ART = ["mitgliedschaft", "familienversicherung", "nicht_gesetzlich"];

const q = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
};
const qEnum = (v: unknown, allowed: string[], type: string): string => {
  const val = typeof v === "string" ? v.toLowerCase() : "";
  return allowed.includes(val) ? `${q(val)}::public.${type}` : "NULL";
};
const qDate = (v: unknown): string => (v ? `${q(v)}::date` : "NULL");

function entryToSql(e: CrmEntry): string {
  const cust = (e.customer ?? {}) as Record<string, unknown>;
  const contract = (e.contract ?? {}) as Record<string, unknown>;
  const kv = (contract.kv_details ?? {}) as Record<string, unknown>;
  const fam = Array.isArray(e.family_members) ? (e.family_members as Array<Record<string, unknown>>) : [];
  const ref = String(e.external_ref);
  const details = {
    external_ref: ref,
    source: e.source,
    application_id: e.application_id,
    role: e.role,
    own_membership: e.own_membership ?? (e.role === "hauptmitglied"),
    related_to_external_ref: e.related_to_external_ref ?? null,
    vp_code: e.vp_code ?? null,
    advisor_name: e.advisor_name ?? null,
  };

  const famSql = fam
    .map(
      (m) => `  INSERT INTO public.contract_family_members
    (contract_id, relation, first_name, last_name, birthdate, versicherungsnummer,
     geschlecht, verwandtschaft, geburtsname, geburtsort, geburtsland,
     staatsangehoerigkeit, bisherig_kasse, bisherig_ende, bisherig_art, abweichende_anschrift)
  VALUES (v_contract, ${q(m.relation)}::public.family_relation, ${q(m.first_name)}, ${q(m.last_name)},
     ${qDate(m.birthdate)}, ${q(m.versicherungsnummer)},
     ${qEnum(m.geschlecht, ["m", "w", "d"], "kv_geschlecht")},
     ${qEnum(m.verwandtschaft, KV_VERWANDTSCHAFT, "kv_verwandtschaft")},
     ${q(m.geburtsname)}, ${q(m.geburtsort)}, ${q(m.geburtsland)}, ${q(m.staatsangehoerigkeit)},
     ${q(m.bisherig_kasse)}, ${qDate(m.bisherig_ende)},
     ${qEnum(m.bisherig_art, KV_BISHERIG_ART, "kv_bisherig_art")}, ${q(m.abweichende_anschrift)});`,
    )
    .join("\n");

  return `-- ${ref} · ${cust.first_name ?? ""} ${cust.last_name ?? ""} (${e.role})
DO $do$
DECLARE v_adv uuid; v_cust uuid; v_contract uuid;
BEGIN
  SELECT id INTO v_adv FROM public.profiles
   WHERE lower(btrim(full_name)) = lower(btrim(${q(e.advisor_name)})) LIMIT 1;
  IF v_adv IS NULL THEN
    RAISE NOTICE 'Berater nicht gefunden: % (%)', ${q(e.advisor_name)}, ${q(ref)};
    RETURN;
  END IF;

  SELECT id INTO v_contract FROM public.contracts WHERE details->>'external_ref' = ${q(ref)} LIMIT 1;
  IF v_contract IS NOT NULL THEN RETURN; END IF;  -- bereits importiert

  SELECT id INTO v_cust FROM public.customers
   WHERE lower(first_name) = lower(${q(cust.first_name)})
     AND lower(last_name) = lower(${q(cust.last_name)})
     AND birthdate IS NOT DISTINCT FROM ${qDate(cust.birthdate)}
   LIMIT 1;

  IF v_cust IS NULL THEN
    INSERT INTO public.customers
      (salutation, first_name, last_name, birthdate, phone, email, street, zip, city, status,
       lead_source, lead_source_detail, assigned_to, recorded_by, advisor_id, created_by)
    VALUES (${q(cust.salutation)}, ${q(cust.first_name)}, ${q(cust.last_name)}, ${qDate(cust.birthdate)},
       ${q(cust.phone)}, ${q(cust.email)}, ${q(cust.street)}, ${q(cust.zip)}, ${q(cust.city)}, 'kunde'::public.customer_status,
       ${q(e.lead_source)}, ${q(e.lead_source_detail)}, v_adv, v_adv, v_adv, v_adv)
    RETURNING id INTO v_cust;
  END IF;

  INSERT INTO public.contracts
    (customer_id, type, status, provider, start_date, details, created_by, created_at)
  VALUES (v_cust, 'gkv'::public.contract_type, ${q(contract.status)}::public.contract_status,
     ${q(contract.provider)}, ${qDate(contract.start_date)},
     ${q(JSON.stringify(details))}::jsonb, v_adv, ${q(e.created_at)}::timestamptz)
  RETURNING id INTO v_contract;

  INSERT INTO public.contract_kv_details
    (contract_id, geschlecht, familienstand, geburtsort, geburtsland,
     staatsangehoerigkeit, kv_nummer, vorherige_kasse, vorherige_kasse_ende)
  VALUES (v_contract, ${qEnum(kv.geschlecht, ["m", "w", "d"], "kv_geschlecht")},
     ${qEnum(kv.familienstand, KV_FAMILIENSTAND, "kv_familienstand")},
     ${q(kv.geburtsort)}, ${q(kv.geburtsland)}, ${q(kv.staatsangehoerigkeit)}, ${q(kv.kv_nummer)},
     ${q(kv.vorherige_kasse)}, ${qDate(kv.vorherige_kasse_ende)});
${famSql}
END $do$;`;
}

function buildSqlScript(batch: CrmEntry[]): string {
  const header = `-- GKV-Antragsportal → Vermittler Suite (CRM)
-- Generiert: ${new Date().toISOString()}
-- Einträge (Mitgliedschaften): ${batch.length}
-- Idempotent: Verträge mit gleicher details->>'external_ref' werden übersprungen.
`;
  return [header, ...batch.map(entryToSql)].join("\n\n");
}

// ------------------------------------------------- Direktschreiben ins CRM
type DirectResult = {
  external_ref: string;
  status: "created" | "skipped" | "error";
  reason?: string;
  customer_id?: string;
  contract_id?: string;
};

const famRow = (contractId: string, m: Record<string, unknown>) => ({
  contract_id: contractId,
  relation: m.relation,
  first_name: s(m.first_name) || "-",
  last_name: s(m.last_name) || "-",
  birthdate: m.birthdate ?? null,
  versicherungsnummer: m.versicherungsnummer ?? null,
  geschlecht: m.geschlecht ?? null,
  verwandtschaft: KV_VERWANDTSCHAFT.includes(String(m.verwandtschaft ?? "").toLowerCase())
    ? String(m.verwandtschaft).toLowerCase() : null,
  geburtsname: m.geburtsname ?? null,
  geburtsort: m.geburtsort ?? null,
  geburtsland: m.geburtsland ?? null,
  staatsangehoerigkeit: m.staatsangehoerigkeit ?? null,
  bisherig_kasse: m.bisherig_kasse ?? null,
  bisherig_ende: m.bisherig_ende ?? null,
  bisherig_art: KV_BISHERIG_ART.includes(String(m.bisherig_art ?? "").toLowerCase())
    ? String(m.bisherig_art).toLowerCase() : null,
  abweichende_anschrift: m.abweichende_anschrift ?? null,
});

async function writeEntriesDirect(batch: CrmEntry[]): Promise<DirectResult[]> {
  const crm = createClient(CRM_SUPABASE_URL, CRM_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const out: DirectResult[] = [];

  // Berater einmalig laden – full_name im CRM kann Leerzeichen/Groß-Kleinschreibung abweichen
  const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");
  const advisorMap = new Map<string, string>();
  {
    const { data: profs, error: profErr } = await crm.from("profiles").select("id, full_name");
    if (profErr) throw new Error(`profiles_read:${profErr.message}`);
    for (const p of (profs ?? []) as Array<{ id: string; full_name: string | null }>) {
      if (p.full_name) advisorMap.set(norm(p.full_name), p.id);
    }
  }
  const findAdvisor = (name: string | null): string | null =>
    name ? advisorMap.get(norm(name)) ?? null : null;

  for (const e of batch) {
    const ref = String(e.external_ref);
    const cust = (e.customer ?? {}) as Record<string, unknown>;
    const contract = (e.contract ?? {}) as Record<string, unknown>;
    const kv = (contract.kv_details ?? {}) as Record<string, unknown>;
    const fam = Array.isArray(e.family_members) ? (e.family_members as Array<Record<string, unknown>>) : [];

    try {
      const advisorId = findAdvisor((e.advisor_name ?? null) as string | null);
      if (!advisorId) {
        out.push({ external_ref: ref, status: "error", reason: `advisor_not_found:${e.advisor_name}` });
        continue;
      }

      // Idempotenz: bereits importierter Vertrag?
      const { data: existing } = await crm
        .from("contracts").select("id").eq("details->>external_ref", ref).limit(1).maybeSingle();
      if (existing) {
        out.push({ external_ref: ref, status: "skipped", reason: "already_imported", contract_id: (existing as { id: string }).id });
        continue;
      }

      // Kunde suchen (Name + Geburtsdatum)
      let customerId: string | null = null;
      let q = crm.from("customers").select("id")
        .ilike("first_name", String(cust.first_name ?? ""))
        .ilike("last_name", String(cust.last_name ?? ""));
      q = cust.birthdate ? q.eq("birthdate", cust.birthdate as string) : q.is("birthdate", null);
      const { data: foundCust } = await q.limit(1).maybeSingle();
      customerId = (foundCust as { id?: string } | null)?.id ?? null;

      if (!customerId) {
        const { data: insCust, error: custErr } = await crm.from("customers").insert({
          salutation: cust.salutation ?? null,
          first_name: cust.first_name ?? null,
          last_name: cust.last_name ?? null,
          birthdate: cust.birthdate ?? null,
          phone: cust.phone ?? null,
          email: cust.email ?? null,
          street: cust.street ?? null,
          zip: cust.zip ?? null,
          city: cust.city ?? null,
          status: "kunde",
          lead_source: e.lead_source ?? null,
          lead_source_detail: e.lead_source_detail ?? null,
          assigned_to: advisorId,
          recorded_by: advisorId,
          advisor_id: advisorId,
          created_by: advisorId,
        }).select("id").single();
        if (custErr) throw new Error(`customer_insert:${custErr.message}`);
        customerId = (insCust as { id: string }).id;
      }

      const details = {
        external_ref: ref,
        source: e.source,
        application_id: e.application_id,
        role: e.role,
        own_membership: e.own_membership ?? e.role === "hauptmitglied",
        related_to_external_ref: e.related_to_external_ref ?? null,
        vp_code: e.vp_code ?? null,
        advisor_name: e.advisor_name ?? null,
      };

      const { data: insContract, error: contractErr } = await crm.from("contracts").insert({
        customer_id: customerId,
        type: "gkv",
        status: contract.status ?? "in_pruefung",
        provider: contract.provider ?? null,
        start_date: contract.start_date ?? null,
        details,
        created_by: advisorId,
        created_at: e.created_at ?? null,
      }).select("id").single();
      if (contractErr) throw new Error(`contract_insert:${contractErr.message}`);
      const contractId = (insContract as { id: string }).id;

      const { error: kvErr } = await crm.from("contract_kv_details").insert({
        contract_id: contractId,
        geschlecht: kv.geschlecht ?? null,
        familienstand: KV_FAMILIENSTAND.includes(String(kv.familienstand ?? "").toLowerCase())
          ? String(kv.familienstand).toLowerCase() : null,
        geburtsort: kv.geburtsort ?? null,
        geburtsland: kv.geburtsland ?? null,
        staatsangehoerigkeit: kv.staatsangehoerigkeit ?? null,
        kv_nummer: kv.kv_nummer ?? null,
        vorherige_kasse: kv.vorherige_kasse ?? null,
        vorherige_kasse_ende: kv.vorherige_kasse_ende ?? null,
      });
      if (kvErr) throw new Error(`kv_insert:${kvErr.message}`);

      if (fam.length) {
        const rows = fam
          .filter((m) => s(m.first_name) || s(m.last_name))
          .map((m) => famRow(contractId, m));
        if (rows.length) {
          const { error: famErr } = await crm.from("contract_family_members").insert(rows);
          if (famErr) throw new Error(`family_insert:${famErr.message}`);
        }
      }

      out.push({ external_ref: ref, status: "created", customer_id: customerId, contract_id: contractId });
    } catch (err) {
      out.push({ external_ref: ref, status: "error", reason: err instanceof Error ? err.message : String(err) });
    }
  }

  return out;
}

// -------- Familienmitglieder im CRM prüfen / nachtragen (Hauptvertrag) --------
type FamAudit = {
  external_ref: string;
  status: "ok" | "missing_contract" | "inserted" | "incomplete" | "error";
  expected: number;
  found: number;
  inserted?: number;
  reason?: string;
};

async function auditFamilyMembers(batch: CrmEntry[], repair: boolean): Promise<FamAudit[]> {
  const crm = createClient(CRM_SUPABASE_URL, CRM_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const out: FamAudit[] = [];
  const key = (f: unknown, l: unknown, b: unknown) =>
    `${String(f ?? "").trim().toLowerCase()}|${String(l ?? "").trim().toLowerCase()}|${b ?? ""}`;

  for (const e of batch) {
    if (e.role !== "hauptmitglied") continue;
    const ref = String(e.external_ref);
    const fam = (Array.isArray(e.family_members) ? (e.family_members as Array<Record<string, unknown>>) : [])
      .filter((m) => s(m.first_name) || s(m.last_name));
    try {
      const { data: contract, error: cErr } = await crm
        .from("contracts").select("id").eq("details->>external_ref", ref).limit(1).maybeSingle();
      if (cErr) throw new Error(cErr.message);
      if (!contract) {
        out.push({ external_ref: ref, status: "missing_contract", expected: fam.length, found: 0 });
        continue;
      }
      const contractId = (contract as { id: string }).id;
      const { data: rows, error: rErr } = await crm
        .from("contract_family_members")
        .select("first_name, last_name, birthdate").eq("contract_id", contractId);
      if (rErr) throw new Error(rErr.message);
      const have = new Set((rows ?? []).map((r: Record<string, unknown>) => key(r.first_name, r.last_name, r.birthdate)));
      const missing = fam.filter((m) => !have.has(key(m.first_name, m.last_name, m.birthdate)));

      if (!missing.length) {
        out.push({ external_ref: ref, status: "ok", expected: fam.length, found: (rows ?? []).length });
        continue;
      }
      if (!repair) {
        out.push({ external_ref: ref, status: "incomplete", expected: fam.length, found: (rows ?? []).length });
        continue;
      }
      const { error: iErr } = await crm
        .from("contract_family_members").insert(missing.map((m) => famRow(contractId, m)));
      if (iErr) throw new Error(`family_insert:${iErr.message}`);
      out.push({
        external_ref: ref, status: "inserted", expected: fam.length,
        found: (rows ?? []).length, inserted: missing.length,
      });
    } catch (err) {
      out.push({
        external_ref: ref, status: "error", expected: fam.length, found: 0,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return out;
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
      action?: "preview" | "push" | "export-sql" | "direct-push" | "audit-family" | "repair-family";
      application_ids?: string[];
      dry_run?: boolean;
    };
    const action = body.action ?? "preview";
    const ids = Array.isArray(body.application_ids)
      ? body.application_ids.filter((x) => typeof x === "string").slice(0, 500)
      : [];
    const isFamilyAction = action === "audit-family" || action === "repair-family";
    if (!ids.length && !isFamilyAction) return json(400, { error: "no_applications" });

    let q = admin
      .from("applications")
      .select("id, user_id, krankenkasse, created_at, vertriebspartner, parent_application_id, payload_encrypted, payload_iv, crm_synced_at")
      .is("parent_application_id", null);
    if (ids.length) q = q.in("id", ids);
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

    if (action === "export-sql") {
      return json(200, { ok: true, mode: "export-sql", entries: batch.length, results, sql: buildSqlScript(batch) });
    }

    if (action === "audit-family" || action === "repair-family") {
      if (!CRM_SUPABASE_URL || !CRM_SERVICE_ROLE_KEY) {
        return json(400, { error: "crm_credentials_missing", message: "CRM_SUPABASE_URL / CRM_SERVICE_ROLE_KEY fehlen." });
      }
      const audit = await auditFamilyMembers(batch, action === "repair-family");
      const summary = {
        checked: audit.length,
        ok: audit.filter((a) => a.status === "ok").length,
        incomplete: audit.filter((a) => a.status === "incomplete").length,
        inserted: audit.reduce((n, a) => n + (a.inserted ?? 0), 0),
        missing_contract: audit.filter((a) => a.status === "missing_contract").length,
        errors: audit.filter((a) => a.status === "error"),
      };
      return json(200, {
        ok: !summary.errors.length,
        mode: action,
        ...summary,
        details: audit.filter((a) => a.status !== "ok").slice(0, 50),
      });
    }

    if (action === "direct-push") {
      if (!CRM_SUPABASE_URL || !CRM_SERVICE_ROLE_KEY) {
        return json(400, { error: "crm_credentials_missing", message: "CRM_SUPABASE_URL / CRM_SERVICE_ROLE_KEY fehlen." });
      }
      if (!batch.length) return json(200, { ok: true, entries: 0, results });

      const written = await writeEntriesDirect(batch);
      const created = written.filter((w) => w.status === "created").length;
      const skipped = written.filter((w) => w.status === "skipped").length;
      const failed = written.filter((w) => w.status === "error");
      const now = new Date().toISOString();

      for (const app of apps ?? []) {
        if (!appEntryCount.has(app.id)) continue;
        const appRefs = written.filter((w) => w.external_ref.startsWith(`${app.id}:`));
        const appFailed = appRefs.filter((w) => w.status === "error");
        if (!appFailed.length) {
          await admin.from("applications").update({ crm_synced_at: now }).eq("id", app.id);
          await admin.from("application_events").insert({
            application_id: app.id,
            user_id: user.id,
            event_type: "crm_synced",
            meta: { entries: appRefs.length, mode: "direct" },
          });
        }
        await admin.from("crm_sync_log").insert({
          application_id: app.id,
          actor_id: user.id,
          status: appFailed.length ? "error" : "ok",
          entries: appRefs.length,
          response: { mode: "direct", details: appRefs },
          error: appFailed.length ? appFailed.map((f) => f.reason).join("; ").slice(0, 500) : null,
        });
      }

      return json(200, {
        ok: !failed.length,
        mode: "direct-push",
        entries: batch.length,
        created,
        skipped,
        failed: failed.length,
        errors: failed.slice(0, 20),
        results,
      });
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