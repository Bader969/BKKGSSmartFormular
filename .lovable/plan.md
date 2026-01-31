

# Krankenkassenspezifische Beispiel-JSON Generierung

## Problem

Die Funktionen `createFamilyExampleJson()` und `createRundumOnlyExampleJson()` im `JsonImportDialog.tsx` sind **statisch** und zeigen immer das alte BKK GS Format mit Feldern wie:

- `rundumSicherPaket`
- `mitgliedKrankenkasse: 'BKK GS'`
- `beginnFamilienversicherung`

Dies ist irreführend, da BKK GS ausgeblendet ist und die anderen Krankenkassen (VIACTIV, Novitas, DAK) andere Felder benötigen.

---

## Lösung

Die Beispiel-JSON-Generierung muss **dynamisch** basierend auf `selectedKrankenkasse` erfolgen.

---

## Technische Änderungen

### Datei: `src/components/JsonImportDialog.tsx`

#### 1. Neue krankenkassenspezifische Beispiel-Funktionen erstellen

**VIACTIV Beispiel:**
```typescript
const createViactivExampleJson = (): Partial<FormData> => ({
  mitgliedName: 'Mustermann',
  mitgliedVorname: 'Max',
  mitgliedGeburtsdatum: '15.05.1985',
  mitgliedGeburtsort: 'Berlin',
  mitgliedGeburtsland: 'DE',
  mitgliedStrasse: 'Musterstraße',
  mitgliedHausnummer: '12a',
  mitgliedPlz: '12345',
  ort: 'Musterstadt',
  mitgliedKvNummer: 'A123456789',
  mitgliedKrankenkasse: 'VIACTIV',
  familienstand: 'verheiratet',
  telefon: '0123456789',
  email: 'max.mustermann@example.com',
  viactivGeschlecht: 'maennlich',
  viactivStaatsangehoerigkeit: 'DE',
  viactivBeschaeftigung: 'beschaeftigt',
  viactivVersicherungsart: 'pflichtversichert',
  viactivArbeitgeber: {
    name: 'Musterfirma GmbH',
    strasse: 'Industrieweg',
    hausnummer: '5',
    plz: '12345',
    ort: 'Musterstadt',
    beschaeftigtSeit: ''
  },
  viactivBonusVertragsnummer: '123456789',
  viactivBonusIBAN: 'DE89370400440532013000',
  viactivBonusKontoinhaber: 'Max Mustermann',
  ehegatte: {
    vorname: 'Maria',
    name: 'Mustermann',
    geburtsdatum: '20.08.1987',
    geschlecht: 'w',
    geburtsname: 'Musterfrau',
    geburtsort: 'Hamburg',
    geburtsland: 'DE',
    staatsangehoerigkeit: 'DE',
    beschaeftigung: 'beschaeftigt',
    versichertennummer: 'B987654321',
    bisherigArt: 'mitgliedschaft',
    bisherigBestandBei: 'AOK',
    // ... weitere Felder
  },
  kinder: [{
    vorname: 'Lisa',
    name: 'Mustermann',
    geburtsdatum: '10.03.2015',
    geschlecht: 'w',
    geburtsort: 'Musterstadt',
    geburtsland: 'DE',
    staatsangehoerigkeit: 'DE',
    verwandtschaft: 'leiblich',
    versichertennummer: 'C111222333',
    // ... weitere Felder
  }]
});
```

**Novitas BKK Beispiel:**
```typescript
const createNovitasExampleJson = (): Partial<FormData> => ({
  mitgliedName: 'Mustermann',
  mitgliedVorname: 'Max',
  mitgliedKvNummer: 'A123456789',
  mitgliedKrankenkasse: 'Novitas BKK',
  familienstand: 'verheiratet',
  telefon: '0123456789',
  email: 'max.mustermann@example.com',
  ehegatte: {
    vorname: 'Maria',
    name: 'Mustermann',
    geburtsdatum: '20.08.1987',
    geschlecht: 'w',
    geburtsname: 'Musterfrau',
    geburtsort: 'Hamburg',
    geburtsland: 'Deutschland',
    staatsangehoerigkeit: 'deutsch',
    bisherigArt: 'mitgliedschaft',
    bisherigVorname: 'Max',
    bisherigNachname: 'Mustermann',
    // KEINE versichertennummer (nicht benötigt)
  },
  kinder: [{
    vorname: 'Lisa',
    name: 'Mustermann',
    geburtsdatum: '10.03.2015',
    geschlecht: 'w',
    geburtsort: 'Musterstadt',
    geburtsland: 'Deutschland',
    staatsangehoerigkeit: 'deutsch',
    verwandtschaft: 'leiblich',
    // KEINE versichertennummer
  }]
});
```

**DAK Beispiel:**
```typescript
const createDakExampleJson = (): Partial<FormData> => ({
  mitgliedName: 'Mustermann',
  mitgliedVorname: 'Max',
  mitgliedGeburtsdatum: '15.05.1985',
  mitgliedStrasse: 'Musterstraße',
  mitgliedHausnummer: '12a',
  mitgliedPlz: '12345',
  ort: 'Musterstadt',
  mitgliedKvNummer: 'A123456789',
  mitgliedKrankenkasse: 'DAK-Gesundheit',
  familienstand: 'verheiratet',
  telefon: '0123456789',
  email: 'max.mustermann@example.com',
  ehegatte: {
    vorname: 'Maria',
    name: 'Mustermann',
    geburtsdatum: '20.08.1987',
    geschlecht: 'w',
    geburtsname: 'Musterfrau',
    geburtsort: 'Hamburg',
    geburtsland: 'Deutschland',
    staatsangehoerigkeit: 'deutsch',
    bisherigArt: 'mitgliedschaft',
  },
  kinder: [{
    vorname: 'Lisa',
    name: 'Mustermann',
    geburtsdatum: '10.03.2015',
    geschlecht: 'w',
    geburtsort: 'Musterstadt',
    geburtsland: 'Deutschland',
    staatsangehoerigkeit: 'deutsch',
    verwandtschaft: 'leiblich',
  }]
});
```

#### 2. Dynamische Schema-Auswahl im useMemo Hook

Zeile 184-189 anpassen:

```typescript
const exampleJson = useMemo(() => {
  const activeKasse = selectedKrankenkasse || formData.selectedKrankenkasse || '';
  
  let exampleData: Partial<FormData>;
  
  switch (activeKasse) {
    case 'viactiv':
      exampleData = createViactivExampleJson();
      break;
    case 'novitas':
      exampleData = createNovitasExampleJson();
      break;
    case 'dak':
      exampleData = createDakExampleJson();
      break;
    default:
      // Fallback: Generisches Beispiel ohne krankenkassenspezifische Felder
      exampleData = createGenericExampleJson();
  }
  
  return JSON.stringify(exampleData, null, 2);
}, [selectedKrankenkasse, formData.selectedKrankenkasse]);
```

#### 3. "Aktuelle Daten anzeigen" krankenkassenspezifisch filtern

Zeile 425-432 anpassen:

```typescript
const handleShowCurrentData = () => {
  const activeKasse = selectedKrankenkasse || formData.selectedKrankenkasse || '';
  
  // Immer ausgeschlossene Felder
  const baseExclusions = ['unterschrift', 'unterschriftFamilie'];
  
  // Krankenkassenspezifische Ausschlüsse
  let exclusions = [...baseExclusions];
  
  switch (activeKasse) {
    case 'viactiv':
      // VIACTIV braucht kein rundumSicherPaket
      exclusions.push('rundumSicherPaket', 'beginnFamilienversicherung');
      break;
    case 'novitas':
      // Novitas braucht keine Adress-/Geburtsfelder des Mitglieds
      exclusions.push('rundumSicherPaket', 'mitgliedGeburtsort', 'mitgliedGeburtsland', 
                      'mitgliedStrasse', 'mitgliedHausnummer', 'mitgliedPlz');
      break;
    case 'dak':
      exclusions.push('rundumSicherPaket');
      break;
  }
  
  // Felder filtern
  const filteredData = Object.fromEntries(
    Object.entries(formData).filter(([key]) => !exclusions.includes(key))
  );
  
  setJsonInput(JSON.stringify(filteredData, null, 2));
};
```

#### 4. Hinweis-Text im Dialog aktualisieren

Wenn keine Krankenkasse ausgewählt ist, einen Hinweis anzeigen:

```typescript
{!selectedKrankenkasse && !formData.selectedKrankenkasse && (
  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
    <p className="text-sm text-yellow-800 flex items-center gap-2">
      <AlertTriangle className="h-4 w-4" />
      Bitte wählen Sie zuerst eine Krankenkasse aus, um das passende Beispiel-JSON zu sehen.
    </p>
  </div>
)}
```

---

## Zusammenfassung

| Änderung | Beschreibung |
|----------|--------------|
| Neue Beispiel-Funktionen | VIACTIV, Novitas, DAK spezifisch |
| Dynamischer useMemo | Schema-Auswahl basierend auf selectedKrankenkasse |
| Gefilterte aktuelle Daten | Nur relevante Felder pro Krankenkasse |
| Hinweis-Text | Warnung wenn keine Kasse ausgewählt |

---

## Dateien

| Datei | Änderungen |
|-------|------------|
| `src/components/JsonImportDialog.tsx` | 4 neue Beispiel-Funktionen, dynamische Auswahl, gefilterter Export |

