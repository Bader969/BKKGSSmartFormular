import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();
    
    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Text ist erforderlich' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Processing insurance text with Gemini 3...');
    console.log('Input text length:', text.length);

    const systemPrompt = `Du bist ein Experte für das Extrahieren von strukturierten Daten aus Versicherungstexten.
Extrahiere alle relevanten Informationen aus dem gegebenen Text und gib sie als JSON zurück.

Das JSON muss folgendes Format haben (fülle nur Felder aus, die du im Text findest):

{
  "mode": "familienversicherung_und_rundum" | "nur_familienversicherung" | "nur_rundum",
  "mitgliedName": "Nachname des Mitglieds",
  "mitgliedVorname": "Vorname des Mitglieds",
  "mitgliedGeburtsdatum": "TT.MM.JJJJ",
  "mitgliedKvNummer": "Krankenversicherungsnummer",
  "mitgliedKrankenkasse": "Name der Krankenkasse",
  "familienstand": "ledig" | "verheiratet" | "geschieden" | "verwitwet",
  "telefon": "Telefonnummer",
  "email": "E-Mail-Adresse",
  "beginnFamilienversicherung": "TT.MM.JJJJ",
  "datum": "JJJJ-MM-TT",
  "ort": "Ort",
  "ehegatte": {
    "name": "Nachname",
    "vorname": "Vorname",
    "geschlecht": "m" | "w",
    "geburtsdatum": "TT.MM.JJJJ",
    "geburtsname": "Geburtsname",
    "geburtsort": "Geburtsort",
    "geburtsland": "Geburtsland",
    "staatsangehoerigkeit": "Staatsangehörigkeit",
    "versichertennummer": "Versichertennummer",
    "bisherigBestandBei": "Vorherige Krankenkasse",
    "bisherigEndeteAm": "TT.MM.JJJJ",
    "bisherigArt": "mitgliedschaft" | "familienversicherung",
    "bisherigVorname": "Vorname des bisherigen Mitglieds",
    "bisherigNachname": "Nachname des bisherigen Mitglieds",
    "familienversichert": true | false
  },
  "kinder": [
    {
      "name": "Nachname",
      "vorname": "Vorname",
      "geschlecht": "m" | "w",
      "geburtsdatum": "TT.MM.JJJJ",
      "geburtsort": "Geburtsort",
      "geburtsland": "Geburtsland",
      "staatsangehoerigkeit": "Staatsangehörigkeit",
      "versichertennummer": "Versichertennummer",
      "verwandtschaft": "leiblich" | "adoptiert" | "stief" | "pflege",
      "bisherigBestandBei": "Vorherige Krankenkasse",
      "bisherigEndeteAm": "TT.MM.JJJJ",
      "bisherigArt": "mitgliedschaft" | "familienversicherung",
      "familienversichert": true | false
    }
  ],
  "rundumSicherPaket": {
    "iban": "IBAN",
    "kontoinhaber": "Name des Kontoinhabers",
    "arztMitglied": { "name": "Arztname", "ort": "Praxisort" },
    "arztEhegatte": { "name": "Arztname", "ort": "Praxisort" },
    "aerzteKinder": [{ "name": "Arztname", "ort": "Praxisort" }]
  }
}

Wichtig:
- Gib NUR das JSON zurück, keine zusätzliche Erklärung
- Verwende deutsche Datumsformate (TT.MM.JJJJ) außer für das "datum" Feld (JJJJ-MM-TT)
- Lasse Felder weg, für die du keine Informationen findest
- Achte auf korrekte Schreibweisen und Formatierungen`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Extrahiere die Versicherungsdaten aus folgendem Text:\n\n${text}` }
        ],
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
