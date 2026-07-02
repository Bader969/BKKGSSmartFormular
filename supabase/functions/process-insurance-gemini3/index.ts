import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAIN_NUMBER_ALIASES = [
  'mitgliedKvNummer', 'mitgliedVersichertennummer', 'kvnr', 'kvNummer', 'kv_nummer',
  'versichertennummer', 'versicherungsnummer', 'mitgliedsnummer',
  'krankenversichertennummer', 'krankenversicherungsnummer', 'egkNummer', 'eGKNummer',
];

const PERSON_NUMBER_ALIASES = [
  'versichertennummer', 'versichertenNummer', 'versicherungsnummer', 'mitgliedsnummer',
  'kvnr', 'kvNummer', 'kv_nummer', 'krankenversichertennummer', 'krankenversicherungsnummer',
  'egkNummer', 'eGKNummer',
];

const FIRST_LETTER_CORRECTIONS: Record<string, string> = { '0': 'O', '1': 'I', '5': 'S', '8': 'B' };
const DIGIT_CORRECTIONS: Record<string, string> = { O: '0', Q: '0', D: '0', I: '1', L: '1', Z: '2', S: '5', B: '8', G: '9' };

const stripKnownLabels = (value: string) => value.replace(
  /\b(?:KVNR|KV\s*-?\s*NR|KV\s*-?\s*NUMMER|VERSICHERTEN\s*-?\s*NR|VERSICHERTEN\s*-?\s*NUMMER|VERSICHERUNGS\s*-?\s*NR|VERSICHERUNGS\s*-?\s*NUMMER|MITGLIEDS\s*-?\s*NR|MITGLIEDS\s*-?\s*NUMMER|EGK\s*-?\s*NUMMER)\b/gi,
  '',
);

const normalizeCandidate = (candidate: string): string => {
  if (candidate.length !== 10) return '';
  const first = FIRST_LETTER_CORRECTIONS[candidate[0]] ?? candidate[0];
  if (!/^[A-Z]$/.test(first)) return '';
  const digits = candidate.slice(1).split('').map((char) => DIGIT_CORRECTIONS[char] ?? char).join('');
  return /^\d{9}$/.test(digits) ? `${first}${digits}` : '';
};

const normalizeInsuranceNumber = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const compact = stripKnownLabels(String(value)).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (!compact) return '';
  const exact = normalizeCandidate(compact);
  if (exact) return exact;
  for (let index = 0; index <= compact.length - 10; index += 1) {
    const normalized = normalizeCandidate(compact.slice(index, index + 10));
    if (normalized) return normalized;
  }
  return compact;
};

const isValidInsuranceNumber = (value: unknown): boolean => /^[A-Z]\d{9}$/.test(normalizeInsuranceNumber(value));

const findInsuranceNumberAlias = (source: unknown, aliases: string[]): string => {
  if (!source || typeof source !== 'object') return '';
  const record = source as Record<string, unknown>;
  for (const alias of aliases) {
    const normalized = normalizeInsuranceNumber(record[alias]);
    if (isValidInsuranceNumber(normalized)) return normalized;
  }
  for (const [key, value] of Object.entries(record)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (
      normalizedKey.includes('kvnr') ||
      normalizedKey.includes('kvnummer') ||
      normalizedKey.includes('versichertennummer') ||
      normalizedKey.includes('versicherungsnummer') ||
      normalizedKey.includes('mitgliedsnummer') ||
      normalizedKey.includes('egknummer')
    ) {
      const normalized = normalizeInsuranceNumber(value);
      if (isValidInsuranceNumber(normalized)) return normalized;
    }
  }
  return '';
};

const normalizeInsuranceNumbersInPayload = (payload: Record<string, unknown>) => {
  const mainNumber = findInsuranceNumberAlias(payload, MAIN_NUMBER_ALIASES);
  if (mainNumber) {
    payload.mitgliedKvNummer = mainNumber;
    payload.mitgliedVersichertennummer = mainNumber;
  }

  const normalizePerson = (person: unknown) => {
    if (!person || typeof person !== 'object') return;
    const record = person as Record<string, unknown>;
    const number = findInsuranceNumberAlias(record, PERSON_NUMBER_ALIASES);
    if (number) record.versichertennummer = number;
  };

  normalizePerson(payload.ehegatte);
  if (Array.isArray(payload.kinder)) payload.kinder.forEach(normalizePerson);
  return payload;
};

// VIACTIV Schema - Beitrittserklärung + Familienversicherung
const viactivSchema = `{
  "mitgliedVorname": "", 
  "mitgliedName": "",
  "mitgliedGeburtsdatum": "TT.MM.JJJJ",
  "mitgliedGeburtsort": "",
  "mitgliedGeburtsland": "ISO-Code (DE, TR, SY...)",
  "mitgliedStrasse": "", 
  "mitgliedHausnummer": "", 
  "mitgliedPlz": "", 
  "ort": "",
  "mitgliedKvNummer": "", 
  "mitgliedKrankenkasse": "",
  "familienstand": "ledig|verheiratet|geschieden|verwitwet",
  "telefon": "", 
  "email": "",
  "viactivGeschlecht": "weiblich|maennlich|divers",
  "viactivStaatsangehoerigkeit": "ISO-Code (DE, TR, SY, PL...)",
  "viactivBeschaeftigung": "beschaeftigt|ausbildung|rente|freiwillig_versichert|studiere|al_geld_1|al_geld_2|minijob|selbststaendig|einkommen_ueber_grenze",
  "viactivVersicherungsart": "pflichtversichert|privat|freiwillig_versichert|nicht_gesetzlich|familienversichert|zuzug_ausland",
  "viactivArbeitgeber": {
    "name": "",
    "strasse": "",
    "hausnummer": "",
    "plz": "",
    "ort": ""
  },
  "viactivBonusVertragsnummer": "",
  "viactivBonusIBAN": "",
  "viactivBonusKontoinhaber": "",
  "ehegatte": {
    "vorname": "",
    "name": "",
    "geburtsdatum": "",
    "geschlecht": "m|w|d",
    "geburtsname": "",
    "geburtsort": "",
    "geburtsland": "ISO-Code",
    "staatsangehoerigkeit": "ISO-Code",
    "beschaeftigung": "beschaeftigt|ausbildung|rente|...",
    "versichertennummer": "",
    "bisherigArt": "mitgliedschaft|familienversicherung|nicht_gesetzlich",
    "bisherigBestandBei": "",
    "abweichendeAnschrift": ""
  },
  "kinder": [{
    "vorname": "",
    "name": "",
    "geburtsdatum": "",
    "geschlecht": "m|w|d",
    "geburtsname": "",
    "geburtsort": "",
    "geburtsland": "ISO-Code",
    "staatsangehoerigkeit": "ISO-Code",
    "verwandtschaft": "leiblich|stief|enkel|pflege",
    "versichertennummer": "",
    "bisherigArt": "mitgliedschaft|familienversicherung|nicht_gesetzlich"
  }]
}`;

// Novitas Schema - Familienversicherung (ohne Adress-/Geburtsfelder für Mitglied)
const novitasSchema = `{
  "mitgliedVorname": "",
  "mitgliedName": "",
  "mitgliedKvNummer": "",
  "mitgliedKrankenkasse": "",
  "familienstand": "ledig|verheiratet|geschieden|verwitwet",
  "telefon": "",
  "email": "",
  "ehegatte": {
    "vorname": "",
    "name": "",
    "geburtsdatum": "TT.MM.JJJJ",
    "geschlecht": "m|w",
    "geburtsname": "",
    "geburtsort": "",
    "geburtsland": "Klartext (z.B. Deutschland, Türkei)",
    "staatsangehoerigkeit": "Klartext (z.B. deutsch, türkisch)",
    "bisherigArt": "mitgliedschaft|familienversicherung",
    "bisherigVorname": "",
    "bisherigNachname": ""
  },
  "kinder": [{
    "vorname": "",
    "name": "",
    "geburtsdatum": "TT.MM.JJJJ",
    "geschlecht": "m|w",
    "geburtsname": "",
    "geburtsort": "",
    "geburtsland": "Klartext",
    "staatsangehoerigkeit": "Klartext",
    "verwandtschaft": "leiblich|stief|pflege|adoptiert"
  }]
}`;

// BIG direkt Plusbonus Schema - Mitglied + SEPA-Bankdaten + Familie
const bigSchema = `{
  "mitgliedVorname": "",
  "mitgliedName": "",
  "mitgliedGeburtsdatum": "TT.MM.JJJJ",
  "mitgliedGeburtsort": "",
  "mitgliedGeburtsland": "ISO-Code (DE, TR, SY...)",
  "mitgliedStrasse": "",
  "mitgliedHausnummer": "",
  "mitgliedPlz": "",
  "ort": "",
  "mitgliedKvNummer": "",
  "mitgliedKrankenkasse": "",
  "familienstand": "ledig|verheiratet|geschieden|verwitwet",
  "telefon": "",
  "email": "",
  "bigBank": {
    "kontoinhaberVorname": "",
    "kontoinhaberNachname": "",
    "kreditinstitut": "",
    "iban": "",
    "bic": ""
  },
  "ehegatte": {
    "vorname": "",
    "name": "",
    "geburtsdatum": "TT.MM.JJJJ",
    "geschlecht": "m|w|d",
    "geburtsname": "",
    "geburtsort": "",
    "geburtsland": "ISO-Code",
    "staatsangehoerigkeit": "ISO-Code",
    "versichertennummer": ""
  },
  "kinder": [{
    "vorname": "",
    "name": "",
    "geburtsdatum": "TT.MM.JJJJ",
    "geschlecht": "m|w|d",
    "geburtsname": "",
    "geburtsort": "",
    "geburtsland": "ISO-Code",
    "staatsangehoerigkeit": "ISO-Code",
    "versichertennummer": "",
    "verwandtschaft": "leiblich|stief|pflege|adoptiert"
  }]
}`;

// DAK Schema - Familienversicherung
const dakSchema = `{
  "mitgliedVorname": "",
  "mitgliedName": "",
  "mitgliedGeburtsdatum": "TT.MM.JJJJ",
  "mitgliedStrasse": "",
  "mitgliedHausnummer": "",
  "mitgliedPlz": "",
  "ort": "",
  "mitgliedKvNummer": "",
  "mitgliedKrankenkasse": "",
  "familienstand": "ledig|verheiratet|geschieden|verwitwet",
  "telefon": "",
  "email": "",
  "ehegatte": {
    "vorname": "",
    "name": "",
    "geburtsdatum": "TT.MM.JJJJ",
    "geschlecht": "m|w|d",
    "geburtsname": "",
    "geburtsort": "",
    "geburtsland": "Klartext",
    "staatsangehoerigkeit": "Klartext",
    "bisherigArt": "mitgliedschaft|familienversicherung"
  },
  "kinder": [{
    "vorname": "",
    "name": "",
    "geburtsdatum": "TT.MM.JJJJ",
    "geschlecht": "m|w|d",
    "geburtsname": "",
    "geburtsort": "",
    "geburtsland": "Klartext",
    "staatsangehoerigkeit": "Klartext",
    "verwandtschaft": "leiblich|stief|pflege"
  }]
}`;

// Default/Fallback Schema (BKK GS)
const defaultFamilySchema = `{
  "mode": "familienversicherung_und_rundum",
  "mitgliedName": "Nachname des Mitglieds",
  "mitgliedVorname": "Vorname des Mitglieds",
  "mitgliedGeburtsdatum": "TT.MM.JJJJ",
  "mitgliedGeburtsort": "Geburtsort des Mitglieds",
  "mitgliedGeburtsland": "Geburtsland (ISO-Code)",
  "mitgliedStrasse": "Straßenname",
  "mitgliedHausnummer": "Hausnummer",
  "mitgliedPlz": "Postleitzahl",
  "mitgliedKvNummer": "Krankenversicherungsnummer",
  "mitgliedKrankenkasse": "Name der Krankenkasse",
  "familienstand": "ledig|verheiratet|geschieden|verwitwet",
  "telefon": "Telefonnummer",
  "email": "E-Mail-Adresse",
  "beginnFamilienversicherung": "TT.MM.JJJJ",
  "datum": "JJJJ-MM-TT",
  "ort": "Wohnort",
  "ehegatteKrankenkasse": "Name der bisherigen Krankenkasse des Ehegatten",
  "ehegatte": {
    "name": "Nachname",
    "vorname": "Vorname",
    "geschlecht": "m|w",
    "geburtsdatum": "TT.MM.JJJJ",
    "geburtsname": "Geburtsname",
    "geburtsort": "Geburtsort",
    "geburtsland": "Geburtsland",
    "staatsangehoerigkeit": "Staatsangehörigkeit",
    "versichertennummer": "Versichertennummer",
    "bisherigBestandBei": "Vorherige Krankenkasse",
    "bisherigEndeteAm": "TT.MM.JJJJ",
    "bisherigArt": "mitgliedschaft|familienversicherung",
    "familienversichert": true
  },
  "kinder": [{
    "name": "Nachname",
    "vorname": "Vorname",
    "geschlecht": "m|w",
    "geburtsdatum": "TT.MM.JJJJ",
    "geburtsort": "Geburtsort",
    "geburtsland": "Geburtsland",
    "staatsangehoerigkeit": "Staatsangehörigkeit",
    "versichertennummer": "Versichertennummer",
    "verwandtschaft": "leiblich|adoptiert|stief|pflege",
    "bisherigBestandBei": "Vorherige Krankenkasse",
    "bisherigEndeteAm": "TT.MM.JJJJ",
    "bisherigArt": "mitgliedschaft|familienversicherung",
    "familienversichert": true
  }],
  "rundumSicherPaket": {
    "iban": "IBAN",
    "kontoinhaber": "Name des Kontoinhabers",
    "arztMitglied": { "name": "Arztname", "ort": "Praxisort" },
    "arztEhegatte": { "name": "Arztname", "ort": "Praxisort" },
    "aerzteKinder": [{ "name": "Arztname", "ort": "Praxisort" }]
  }
}`;

const defaultRundumOnlySchema = `{
  "mode": "nur_rundum",
  "mitgliedName": "Nachname des Mitglieds",
  "mitgliedVorname": "Vorname des Mitglieds",
  "mitgliedGeburtsdatum": "TT.MM.JJJJ",
  "mitgliedGeburtsort": "Geburtsort des Mitglieds",
  "mitgliedGeburtsland": "Geburtsland (ISO-Code)",
  "mitgliedStrasse": "Straßenname",
  "mitgliedHausnummer": "Hausnummer",
  "mitgliedPlz": "Postleitzahl",
  "mitgliedKvNummer": "Krankenversicherungsnummer",
  "mitgliedKrankenkasse": "Name der Krankenkasse",
  "familienstand": "ledig|verheiratet|geschieden|verwitwet",
  "telefon": "Telefonnummer",
  "email": "E-Mail-Adresse",
  "datum": "JJJJ-MM-TT",
  "ort": "Wohnort",
  "rundumSicherPaket": {
    "iban": "IBAN",
    "kontoinhaber": "Name des Kontoinhabers",
    "arztMitglied": { "name": "Arztname", "ort": "Praxisort" }
  }
}`;

// Schema-Router: Gibt passendes Schema und Prompt basierend auf Krankenkasse zurück
const getSchemaForKrankenkasse = (kasse: string, mode: string): { schema: string; prompt: string } => {
  const isFamily = mode !== 'nur_rundum';
  
  switch (kasse) {
    case 'viactiv':
      return {
        schema: viactivSchema,
        prompt: `Extrahiere Daten für VIACTIV Beitrittserklärung.

PFLICHTFELDER MITGLIED (ALLE WICHTIG!):
- Vorname, Name, Geburtsdatum
- Geburtsort und Geburtsland (BEIDE PFLICHT!) - Geburtsland als ISO-Code (DE, TR, SY, PL...)
- Adresse (Straße, Hausnummer, PLZ, Ort)
- KV-Nummer, Krankenkasse
- Geschlecht (weiblich/maennlich/divers)
- Staatsangehörigkeit als ISO-Code (DE, TR, SY, PL...)
- Beschäftigungsstatus, Versicherungsart

ARBEITGEBER (PFLICHT wenn Beschäftigung = "beschaeftigt"):
- Name, Straße, Hausnummer, PLZ, Ort - ALLE FELDER!

BONUS-PROGRAMM:
- Vertragsnummer, IBAN, Kontoinhaber (falls vorhanden)

EHEGATTE (ALLE Felder wenn vorhanden):
- Vorname, Name, Geburtsdatum, Geschlecht
- Geburtsname, Geburtsort, Geburtsland (ISO-Code)
- Staatsangehörigkeit (ISO-Code), Beschäftigung
- VERSICHERTENNUMMER (PFLICHT!)
- Bisherige Versicherungsart

KINDER (ALLE Felder pro Kind):
- Vorname, Name, Geburtsdatum, Geschlecht
- Geburtsname, Geburtsort, Geburtsland (ISO-Code)
- Staatsangehörigkeit (ISO-Code), Verwandtschaft
- VERSICHERTENNUMMER (PFLICHT!)`
      };
      
    case 'big_plusbonus':
      return {
        schema: bigSchema,
        prompt: `Extrahiere Daten für BIG direkt Plusbonus-Antrag.

WICHTIG: Die Dokumente enthalten i.d.R. MEHRERE Kartenbilder bzw. Scans:
- eine elektronische Gesundheitskarte (eGK / Versichertenkarte) → liefert KV-Nummer und Name der aktuellen Krankenkasse
- eine Bankkarte (Debit/EC) → liefert Kontoinhaber, Kreditinstitut, IBAN, BIC
- ggf. Personalausweis/Pass und/oder Meldebescheinigung → liefert Geburtsdaten und Anschrift
Werte ALLE Bilder/Seiten aus und kombiniere sie. Verwechsle Versichertenkarte und Bankkarte nicht.

MITGLIED (aus eGK + Ausweis/Meldebescheinigung):
- Vorname, Name, Geburtsdatum, Geburtsort, Geburtsland (ISO-Code)
- Adresse (Straße, Hausnummer, PLZ, Ort)
- Familienstand, Telefon, Email

VERSICHERTENKARTE / eGK (PFLICHT wenn ein eGK-Bild vorhanden ist):
- mitgliedKvNummer: Die Versicherten-/KV-Nummer auf der Karte (Format: 1 Großbuchstabe + 9 Ziffern, z.B. A123456789). Steht meist auf der Vorderseite über/unter dem Namen. NIEMALS leer lassen, wenn auf einem der Bilder eine eGK zu sehen ist.
- mitgliedKrankenkasse: Name der Krankenkasse wie auf der Karte aufgedruckt (z.B. "AOK Bayern", "Techniker Krankenkasse", "BARMER", "DAK-Gesundheit", "BIG direkt gesund"). Auch das Logo oben links/rechts auswerten.

SEPA / BANKKARTE (PFLICHT wenn auf Dokument/Bankkarte vorhanden — in "bigBank" einsetzen!):
- kontoinhaberVorname, kontoinhaberNachname (Name wie auf der Karte; aufteilen in Vor- und Nachname)
- kreditinstitut (Name der Bank, z.B. "Sparkasse Köln", "DKB", "ING")
- iban (Großbuchstaben, ohne Leerzeichen)
- bic (Großbuchstaben)

EHEGATTE / KINDER (falls vorhanden): Vorname, Name, Geburtsdatum, Geschlecht, Geburtsname,
Geburtsort, Geburtsland (ISO-Code), Staatsangehörigkeit (ISO-Code), bei Kindern Verwandtschaft.
Falls für Ehegatte/Kinder ebenfalls eine eGK vorliegt, deren KV-Nummer zwingend in versichertennummer übernehmen.`
      };

    case 'novitas':
      return {
        schema: novitasSchema,
        prompt: `Extrahiere Daten für Novitas BKK Familienversicherung.

WICHTIG - NUR DIESE FELDER FÜR MITGLIED:
- Vorname, Name (KEINE Adresse, KEIN Geburtsdatum!)
- KV-Nummer, Krankenkasse
- Familienstand, Telefon, Email

EHEGATTE (alle Felder):
- Vorname, Name, Geburtsdatum, Geschlecht
- Geburtsname, Geburtsort, Geburtsland (als KLARTEXT: Deutschland, Türkei, etc.)
- Staatsangehörigkeit (als KLARTEXT: deutsch, türkisch, etc.)
- Bisherige Versicherungsart (mitgliedschaft/familienversicherung)
- bisherigVorname, bisherigNachname (Name des bisherigen Mitglieds)

KINDER (alle Felder pro Kind):
- Vorname, Name, Geburtsdatum, Geschlecht
- Geburtsname, Geburtsort, Geburtsland (KLARTEXT)
- Staatsangehörigkeit (KLARTEXT)
- Verwandtschaft (leiblich/stief/pflege/adoptiert)`
      };
      
    case 'dak':
      return {
        schema: dakSchema,
        prompt: `Extrahiere Daten für DAK Familienversicherung.

MITGLIED:
- Vorname, Name, Geburtsdatum
- Adresse (Straße, Hausnummer, PLZ, Ort)
- KV-Nummer, Krankenkasse
- Familienstand, Telefon, Email

EHEGATTE (alle Felder):
- Vorname, Name, Geburtsdatum
- Geschlecht (m/w/d)
- Geburtsname, Geburtsort, Geburtsland (KLARTEXT)
- Staatsangehörigkeit (KLARTEXT)
- Bisherige Versicherungsart

KINDER (alle Felder, max 2 pro PDF):
- Vorname, Name, Geburtsdatum
- Geschlecht (m/w/d)
- Geburtsname, Geburtsort, Geburtsland (KLARTEXT)
- Staatsangehörigkeit (KLARTEXT)
- Verwandtschaft (leiblich/stief/pflege)`
      };
      
    default:
      return {
        schema: isFamily ? defaultFamilySchema : defaultRundumOnlySchema,
        prompt: `Extrahiere allgemeine Versicherungsdaten.
Identifiziere die Rollen (Mitglied, Ehegatte, Kinder) basierend auf Namen und Geburtsdaten.
Extrahiere alle Familienmitglieder wenn vorhanden.`
      };
  }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authenticated caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { text, images, mode, selectedKrankenkasse } = body;
    
    // Validate input - either text or images required
    if ((!text || typeof text !== 'string') && (!images || !Array.isArray(images) || images.length === 0)) {
      return new Response(
        JSON.stringify({ error: 'Text oder Bilder/PDFs sind erforderlich' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get schema and prompt based on selected Krankenkasse
    const { schema: jsonSchema, prompt: kassePrompt } = getSchemaForKrankenkasse(
      selectedKrankenkasse || '', 
      mode || 'familienversicherung_und_rundum'
    );

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Separate images and PDFs
    const imageFiles = images?.filter((img: { mimeType: string }) => img.mimeType.startsWith('image/')) || [];
    const pdfFiles = images?.filter((img: { mimeType: string }) => img.mimeType === 'application/pdf') || [];

    console.log('Processing insurance data with Gemini...');
    console.log('Input type:', images ? `${imageFiles.length} images, ${pdfFiles.length} PDFs` : 'text');
    console.log('Mode:', mode || 'familienversicherung_und_rundum');
    console.log('Selected Krankenkasse:', selectedKrankenkasse || 'none (default)');

    const systemPrompt = `Du bist ein Experte für Versicherungsdaten. Analysiere diese Dokumente.

${kassePrompt}

Extrahiere alle relevanten Daten und gib sie EXAKT in diesem JSON-Schema zurück:

${jsonSchema}

Wichtig:
- Gib NUR das JSON zurück, keine zusätzliche Erklärung
- Verwende deutsche Datumsformate (TT.MM.JJJJ) außer für das "datum" Feld (JJJJ-MM-TT)
- Falls Daten auf den Bildern/im Text fehlen, setze ""
- Achte auf korrekte Schreibweisen und Formatierungen
- Versichertennummer/KVNR immer im Format 1 Großbuchstabe + 9 Ziffern zurückgeben (z.B. A123456789), ohne Leerzeichen oder Bindestriche
- Hauptmitglied: jede KVNR/eGK-Nummer ausschließlich in mitgliedKvNummer schreiben
- Ehegatte/Kinder: eigene KVNR/eGK-Nummern ausschließlich in versichertennummer schreiben
- Verwechsle KVNR/eGK-Nummern niemals mit IBAN, BIC, Kartennummern oder Vertragsnummern
- Wenn mehrere Karten vorhanden sind, ordne die Nummer über den Namen auf der Karte der richtigen Person zu
- Antworte NUR mit dem JSON`;

    // Build messages array based on input type
    let messages: any[];
    
    const hasVisualContent = imageFiles.length > 0 || pdfFiles.length > 0;
    
    if (hasVisualContent) {
      // Build content array with all files (images and PDFs)
      const fileContents: any[] = [];
      
      // Add images
      for (const img of imageFiles) {
        fileContents.push({
          type: "image_url",
          image_url: {
            url: `data:${img.mimeType};base64,${img.base64}`
          }
        });
      }
      
      // Add PDFs - Gemini 2.5 Pro supports PDF input
      for (const pdf of pdfFiles) {
        fileContents.push({
          type: "image_url",
          image_url: {
            url: `data:${pdf.mimeType};base64,${pdf.base64}`
          }
        });
      }

      messages = [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: [
            { type: 'text', text: 'Analysiere diese Dokumente (Bilder und/oder PDFs) und extrahiere alle Versicherungsdaten:' },
            ...fileContents
          ]
        }
      ];
    } else {
      // Text-based extraction
      messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Extrahiere die Versicherungsdaten aus folgendem Text:\n\n${text}` }
      ];
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Always use gemini-2.5-pro for visual content (supports images and PDFs)
        model: hasVisualContent ? 'google/gemini-2.5-pro' : 'google/gemini-2.5-flash',
        messages,
        max_tokens: 8192,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit erreicht. Bitte versuche es später erneut.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Guthaben erschöpft. Bitte lade dein Konto auf.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const finishReason = data.choices?.[0]?.finish_reason || data.stop_reason;
    if (finishReason === 'length' || finishReason === 'max_tokens') {
      throw new Error('KI-Antwort wurde abgeschnitten. Bitte mit weniger Dokumenten erneut versuchen.');
    }
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Keine Antwort von der KI erhalten');
    }

    // Note: AI response content contains PII (names, addresses, KV-Nummern, IBAN, etc.)
    // and is intentionally NOT logged to avoid persisting personal data in function logs.
    console.log('AI response received, length:', content.length);

    // Try to extract JSON from the response
    let extractedJson;
    try {
      // Try direct parse first
      extractedJson = JSON.parse(content);
    } catch {
      // Try to find JSON in the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedJson = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Kein gültiges JSON in der KI-Antwort gefunden');
      }
    }

    normalizeInsuranceNumbersInPayload(extractedJson);

    console.log('Extraction complete, top-level fields:', Object.keys(extractedJson).length);

    // Images/PDFs are processed in memory only - no storage
    // This ensures PII data is never persisted

    return new Response(
      JSON.stringify(extractedJson),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-insurance-gemini3:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unbekannter Fehler' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
