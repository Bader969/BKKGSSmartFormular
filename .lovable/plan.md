
# Multi-Krankenkassen OCR-Import: Korrigierte Pflichtfelder-Analyse

## Wichtige Korrekturen basierend auf Ihrem Feedback

Nach Ihrer Klarstellung wurden folgende Felder als **Pflicht** identifiziert, die im vorherigen Plan nicht korrekt markiert waren:

| Feld | Vorheriger Status | Korrigierter Status |
|------|-------------------|---------------------|
| Mitglied Geburtsort | Optional | **Pflicht** (VIACTIV) |
| Mitglied Geburtsland | Optional | **Pflicht** (VIACTIV) |
| Arbeitgeber-Daten (alle) | Optional | **Pflicht wenn "beschäftigt"** |
| Ehegatte Versichertennummer | Optional | **Pflicht** (VIACTIV) |
| Kinder Versichertennummer | Optional | **Pflicht** (VIACTIV) |

---

## Vollstaendige VIACTIV Pflichtfeld-Liste (korrigiert)

### Mitglied - Immer Pflicht

| Feld | FormData-Pfad |
|------|---------------|
| Vorname | `mitgliedVorname` |
| Name | `mitgliedName` |
| Geburtsdatum | `mitgliedGeburtsdatum` |
| **Geburtsort** | `mitgliedGeburtsort` |
| **Geburtsland** | `mitgliedGeburtsland` |
| Strasse | `mitgliedStrasse` |
| Hausnummer | `mitgliedHausnummer` |
| PLZ | `mitgliedPlz` |
| Ort | `ort` |
| KV-Nummer | `mitgliedKvNummer` |
| Krankenkasse | `mitgliedKrankenkasse` |
| Familienstand | `familienstand` |
| Telefon | `telefon` |
| E-Mail | `email` |
| Geschlecht | `viactivGeschlecht` |
| Staatsangehörigkeit | `viactivStaatsangehoerigkeit` |
| Beschäftigungsstatus | `viactivBeschaeftigung` |
| Versicherungsart | `viactivVersicherungsart` |

### Arbeitgeber - Pflicht wenn `viactivBeschaeftigung === 'beschaeftigt'`

| Feld | FormData-Pfad |
|------|---------------|
| Name | `viactivArbeitgeber.name` |
| Strasse | `viactivArbeitgeber.strasse` |
| Hausnummer | `viactivArbeitgeber.hausnummer` |
| PLZ | `viactivArbeitgeber.plz` |
| Ort | `viactivArbeitgeber.ort` |

### Bonus-Programm - Immer Pflicht

| Feld | FormData-Pfad |
|------|---------------|
| Vertragsnummer | `viactivBonusVertragsnummer` |
| IBAN | `viactivBonusIBAN` |
| Kontoinhaber | `viactivBonusKontoinhaber` |

### Ehegatte - Pflicht wenn Familienversicherung aktiviert

| Feld | FormData-Pfad |
|------|---------------|
| Vorname | `ehegatte.vorname` |
| Name | `ehegatte.name` |
| Geburtsdatum | `ehegatte.geburtsdatum` |
| Geschlecht | `ehegatte.geschlecht` |
| Geburtsname | `ehegatte.geburtsname` |
| Geburtsort | `ehegatte.geburtsort` |
| Geburtsland | `ehegatte.geburtsland` |
| Staatsangehörigkeit | `ehegatte.staatsangehoerigkeit` |
| Beschäftigungsstatus | `ehegatte.beschaeftigung` |
| **Versichertennummer** | `ehegatte.versichertennummer` |

### Kinder - Pflicht pro Kind

| Feld | FormData-Pfad |
|------|---------------|
| Vorname | `kinder[].vorname` |
| Name | `kinder[].name` |
| Geburtsdatum | `kinder[].geburtsdatum` |
| Geschlecht | `kinder[].geschlecht` |
| Geburtsname | `kinder[].geburtsname` |
| Geburtsort | `kinder[].geburtsort` |
| Geburtsland | `kinder[].geburtsland` |
| Staatsangehörigkeit | `kinder[].staatsangehoerigkeit` |
| Verwandtschaft | `kinder[].verwandtschaft` |
| **Versichertennummer** | `kinder[].versichertennummer` |

---

## Technische Implementierung

### Phase 1: Backend-Erweiterung (Edge Function)

**Datei:** `supabase/functions/process-insurance-gemini3/index.ts`

#### Korrigiertes VIACTIV JSON-Schema

```json
{
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
  "viactivStaatsangehoerigkeit": "ISO-Code",
  "viactivBeschaeftigung": "beschaeftigt|ausbildung|rente|arbeitsuchend|sonstiges",
  "viactivVersicherungsart": "pflichtversichert|privat|freiwillig_versichert|familienversichert",
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
    "geburtsland": "",
    "staatsangehoerigkeit": "",
    "beschaeftigung": "",
    "versichertennummer": "",
    "bisherigArt": "mitgliedschaft|familienversicherung|nicht_gesetzlich",
    "bisherigBestandBei": ""
  },
  "kinder": [{
    "vorname": "",
    "name": "",
    "geburtsdatum": "",
    "geschlecht": "m|w|d",
    "geburtsname": "",
    "geburtsort": "",
    "geburtsland": "",
    "staatsangehoerigkeit": "",
    "verwandtschaft": "leiblich|stief|enkel|pflege",
    "versichertennummer": "",
    "bisherigArt": ""
  }]
}
```

#### Korrigierter VIACTIV Prompt

```typescript
case 'viactiv':
  return {
    schema: viactivSchema,
    prompt: `Extrahiere Daten fuer VIACTIV Beitrittserklaerung.

PFLICHTFELDER MITGLIED:
- Vorname, Name, Geburtsdatum
- Geburtsort und Geburtsland (BEIDE PFLICHT!)
- Adresse (Strasse, Hausnummer, PLZ, Ort)
- KV-Nummer, Krankenkasse
- Geschlecht, Staatsangehoerigkeit (ISO-Code)
- Beschaeftigungsstatus, Versicherungsart

ARBEITGEBER (PFLICHT wenn Beschaeftigung = "beschaeftigt"):
- Name, Strasse, Hausnummer, PLZ, Ort

BONUS-PROGRAMM (PFLICHT):
- Vertragsnummer, IBAN, Kontoinhaber

EHEGATTE (PFLICHT alle Felder wenn vorhanden):
- Vorname, Name, Geburtsdatum, Geschlecht
- Geburtsname, Geburtsort, Geburtsland
- Staatsangehoerigkeit, Beschaeftigung
- VERSICHERTENNUMMER (PFLICHT!)

KINDER (PFLICHT alle Felder pro Kind):
- Vorname, Name, Geburtsdatum, Geschlecht
- Geburtsname, Geburtsort, Geburtsland
- Staatsangehoerigkeit, Verwandtschaft
- VERSICHERTENNUMMER (PFLICHT!)`
  };
```

#### Novitas Schema (unveraendert - kein Versichertennummer-Feld)

```json
{
  "mitgliedVorname": "",
  "mitgliedName": "",
  "mitgliedKvNummer": "",
  "mitgliedKrankenkasse": "",
  "familienstand": "",
  "telefon": "",
  "email": "",
  "ehegatte": {
    "vorname": "",
    "name": "",
    "geburtsdatum": "",
    "geschlecht": "m|w",
    "geburtsname": "",
    "geburtsort": "",
    "geburtsland": "",
    "staatsangehoerigkeit": "",
    "bisherigArt": "mitgliedschaft|familienversicherung",
    "bisherigVorname": "",
    "bisherigNachname": ""
  },
  "kinder": [{
    "vorname": "",
    "name": "",
    "geburtsdatum": "",
    "geschlecht": "m|w",
    "geburtsname": "",
    "geburtsort": "",
    "geburtsland": "",
    "staatsangehoerigkeit": "",
    "verwandtschaft": "leiblich|stief|pflege|adoptiert"
  }]
}
```

#### DAK Schema (unveraendert - kein Versichertennummer-Feld)

```json
{
  "mitgliedVorname": "",
  "mitgliedName": "",
  "mitgliedGeburtsdatum": "",
  "mitgliedStrasse": "",
  "mitgliedHausnummer": "",
  "mitgliedPlz": "",
  "ort": "",
  "mitgliedKvNummer": "",
  "mitgliedKrankenkasse": "",
  "familienstand": "",
  "telefon": "",
  "email": "",
  "ehegatte": {
    "vorname": "",
    "name": "",
    "geburtsdatum": "",
    "geschlecht": "m|w|d",
    "geburtsname": "",
    "geburtsort": "",
    "geburtsland": "",
    "staatsangehoerigkeit": "",
    "bisherigArt": "mitgliedschaft|familienversicherung"
  },
  "kinder": [{
    "vorname": "",
    "name": "",
    "geburtsdatum": "",
    "geschlecht": "m|w|d",
    "geburtsname": "",
    "geburtsort": "",
    "geburtsland": "",
    "staatsangehoerigkeit": "",
    "verwandtschaft": "leiblich|stief|pflege"
  }]
}
```

---

### Phase 2: Frontend-Aenderungen

#### 1. UI-Validierung korrigieren

**Datei:** `src/components/MemberSection.tsx`

Geburtsort und Geburtsland als Pflicht fuer VIACTIV markieren:

```typescript
// Zeile 73-91: required-Attribut hinzufuegen fuer VIACTIV
<FormField
  type="text"
  label="Geburtsort"
  id="mitgliedGeburtsort"
  value={formData.mitgliedGeburtsort}
  onChange={(value) => updateFormData({ mitgliedGeburtsort: value })}
  placeholder="z.B. Berlin"
  required={formData.selectedKrankenkasse === 'viactiv'}
  validate={validateOrt}
/>
<FormField
  type="select"
  label="Geburtsland"
  id="mitgliedGeburtsland"
  value={formData.mitgliedGeburtsland}
  onChange={(value) => updateFormData({ mitgliedGeburtsland: value })}
  options={countries.map(c => ({ value: c.code, label: c.name }))}
  placeholder="Land auswählen"
  required={formData.selectedKrankenkasse === 'viactiv'}
  validate={formData.selectedKrankenkasse === 'viactiv' ? validateSelect : undefined}
/>
```

**Datei:** `src/components/ViactivSection.tsx`

Arbeitgeber-Felder als Pflicht wenn beschaeftigt:

```typescript
// Zeile 136-186: required-Attribut bedingt hinzufuegen
const isArbeitgeberRequired = formData.viactivBeschaeftigung === 'beschaeftigt';

<FormField
  type="text"
  label="Name des Arbeitgebers"
  id="arbeitgeberName"
  value={formData.viactivArbeitgeber.name}
  onChange={(value) => updateArbeitgeber({ name: value })}
  placeholder="z.B. Musterfirma GmbH"
  required={isArbeitgeberRequired}
  validate={isArbeitgeberRequired ? validateName : undefined}
/>
// ... gleiche Logik fuer Strasse, Hausnummer, PLZ, Ort
```

Versichertennummer Ehegatte und Kinder als Pflicht:

```typescript
// Zeile 384-393: required hinzufuegen
<FormField
  type="text"
  label="Versichertennummer"
  id="viactiv-ehegatte-versichertennummer"
  value={formData.ehegatte.versichertennummer}
  onChange={(value) => updateEhegatte({ versichertennummer: value })}
  placeholder="Versichertennummer"
  required
  validate={validateVersichertennummer}
/>

// Zeile 560-570: required hinzufuegen fuer Kinder
<FormField
  type="text"
  label="Versichertennummer"
  id={`viactiv-kind${index}-versichertennummer`}
  value={kind.versichertennummer}
  onChange={(value) => updateKind(index, { versichertennummer: value })}
  placeholder="Versichertennummer"
  required
  validate={validateVersichertennummer}
/>
```

#### 2. JsonImportDialog erweitern

**Datei:** `src/components/JsonImportDialog.tsx`

Props und Request erweitern:

```typescript
// Zeile 33-37: Props erweitern
interface JsonImportDialogProps {
  formData: FormData;
  setFormData: (data: FormData) => void;
  currentMode: FormMode;
  selectedKrankenkasse: Krankenkasse;  // NEU
}

// Zeile 302-318: Request-Body erweitern
const requestBody: { 
  text?: string; 
  images?: { base64: string; mimeType: string }[];
  mode: FormMode;
  selectedKrankenkasse: string;  // NEU
} = {
  mode: currentMode,
  selectedKrankenkasse: selectedKrankenkasse || '',  // NEU
  images: uploadedFiles.map(f => ({
    base64: f.base64,
    mimeType: f.mimeType
  }))
};
```

#### 3. Index.tsx anpassen

**Datei:** `src/pages/Index.tsx`

Props an Dialog uebergeben:

```typescript
<JsonImportDialog 
  formData={formData} 
  setFormData={setFormData} 
  currentMode={formData.mode}
  selectedKrankenkasse={formData.selectedKrankenkasse}
/>
```

---

### Phase 3: Mapping-Logik mit allen Pflichtfeldern

```typescript
const applyKrankenkassenMapping = (
  extractedData: any,
  selectedKrankenkasse: Krankenkasse,
  currentFormData: FormData
): FormData => {
  
  switch (selectedKrankenkasse) {
    case 'viactiv':
      return {
        ...currentFormData,
        // Basis-Felder
        mitgliedVorname: extractedData.mitgliedVorname || currentFormData.mitgliedVorname,
        mitgliedName: extractedData.mitgliedName || currentFormData.mitgliedName,
        mitgliedGeburtsdatum: extractedData.mitgliedGeburtsdatum || currentFormData.mitgliedGeburtsdatum,
        // PFLICHT: Geburtsort und Geburtsland
        mitgliedGeburtsort: extractedData.mitgliedGeburtsort || currentFormData.mitgliedGeburtsort,
        mitgliedGeburtsland: extractedData.mitgliedGeburtsland || currentFormData.mitgliedGeburtsland,
        // Adresse
        mitgliedStrasse: extractedData.mitgliedStrasse || currentFormData.mitgliedStrasse,
        mitgliedHausnummer: extractedData.mitgliedHausnummer || currentFormData.mitgliedHausnummer,
        mitgliedPlz: extractedData.mitgliedPlz || currentFormData.mitgliedPlz,
        ort: extractedData.ort || currentFormData.ort,
        // Weitere Felder
        mitgliedKvNummer: extractedData.mitgliedKvNummer || currentFormData.mitgliedKvNummer,
        mitgliedKrankenkasse: extractedData.mitgliedKrankenkasse || currentFormData.mitgliedKrankenkasse,
        familienstand: extractedData.familienstand || currentFormData.familienstand,
        telefon: extractedData.telefon || currentFormData.telefon,
        email: extractedData.email || currentFormData.email,
        // VIACTIV-spezifisch
        viactivGeschlecht: extractedData.viactivGeschlecht || currentFormData.viactivGeschlecht,
        viactivStaatsangehoerigkeit: extractedData.viactivStaatsangehoerigkeit || currentFormData.viactivStaatsangehoerigkeit,
        viactivBeschaeftigung: extractedData.viactivBeschaeftigung || currentFormData.viactivBeschaeftigung,
        viactivVersicherungsart: extractedData.viactivVersicherungsart || currentFormData.viactivVersicherungsart,
        // BEDINGT PFLICHT: Arbeitgeber
        viactivArbeitgeber: extractedData.viactivArbeitgeber 
          ? { ...currentFormData.viactivArbeitgeber, ...extractedData.viactivArbeitgeber }
          : currentFormData.viactivArbeitgeber,
        // PFLICHT: Bonus
        viactivBonusVertragsnummer: extractedData.viactivBonusVertragsnummer || currentFormData.viactivBonusVertragsnummer,
        viactivBonusIBAN: extractedData.viactivBonusIBAN || currentFormData.viactivBonusIBAN,
        viactivBonusKontoinhaber: extractedData.viactivBonusKontoinhaber || currentFormData.viactivBonusKontoinhaber,
        // EHEGATTE mit Versichertennummer (PFLICHT)
        ehegatte: extractedData.ehegatte
          ? {
              ...currentFormData.ehegatte,
              ...extractedData.ehegatte,
              versichertennummer: extractedData.ehegatte.versichertennummer || '',
            }
          : currentFormData.ehegatte,
        // KINDER mit Versichertennummer (PFLICHT)
        kinder: extractedData.kinder?.map((kind: any) => ({
          ...createEmptyFamilyMember(),
          ...kind,
          versichertennummer: kind.versichertennummer || '',
          bisherigBestehtWeiter: true,
        })) || currentFormData.kinder,
      };

    case 'novitas':
    case 'dak':
      // Kein Versichertennummer-Feld fuer Ehegatte/Kinder
      return {
        ...currentFormData,
        mitgliedVorname: extractedData.mitgliedVorname || currentFormData.mitgliedVorname,
        mitgliedName: extractedData.mitgliedName || currentFormData.mitgliedName,
        mitgliedKvNummer: extractedData.mitgliedKvNummer || currentFormData.mitgliedKvNummer,
        // ... weitere Felder ohne Versichertennummer fuer Familie
        ehegatte: extractedData.ehegatte
          ? { ...currentFormData.ehegatte, ...extractedData.ehegatte }
          : currentFormData.ehegatte,
        kinder: extractedData.kinder?.map((kind: any) => ({
          ...createEmptyFamilyMember(),
          ...kind,
          bisherigBestehtWeiter: true,
        })) || currentFormData.kinder,
      };

    default:
      return currentFormData;
  }
};
```

---

## Zusammenfassung der Dateiaenderungen

| Datei | Aenderungen |
|-------|-------------|
| `supabase/functions/process-insurance-gemini3/index.ts` | 3 Schemata mit korrekten Pflichtfeldern, Schema-Router, angepasste Prompts |
| `src/components/MemberSection.tsx` | Geburtsort/Geburtsland als Pflicht fuer VIACTIV |
| `src/components/ViactivSection.tsx` | Arbeitgeber bedingt Pflicht, Versichertennummer Pflicht |
| `src/components/JsonImportDialog.tsx` | Props erweitern, Request anpassen, Mapping-Logik |
| `src/components/FreitextImportDialog.tsx` | Gleiche Aenderungen wie JsonImportDialog |
| `src/pages/Index.tsx` | Props an Dialoge uebergeben |

---

## Qualitaetssicherung

- Alle VIACTIV Pflichtfelder werden im OCR-Schema abgedeckt
- Arbeitgeber-Daten nur extrahiert wenn Beschaeftigung = "beschaeftigt"
- Versichertennummer fuer Ehegatte und Kinder bei VIACTIV Pflicht
- Novitas und DAK: Keine Versichertennummer (nicht im PDF)
- Backward-kompatibel: Bestehende Daten bleiben erhalten
