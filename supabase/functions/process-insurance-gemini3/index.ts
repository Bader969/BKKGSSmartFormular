import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Keine Antwort von der KI erhalten');
    }

    console.log('Raw AI response:', content);

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

    console.log('Extracted JSON:', JSON.stringify(extractedJson, null, 2));

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
