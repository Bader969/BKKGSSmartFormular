

# VIACTIV Kinder mit eigener Mitgliedschaft - Implementierungsplan

## Zusammenfassung der Anforderung

Neue Logik fuer VIACTIV Kinder-Export:

1. **Kinder >= 15 Jahre mit eigener Mitgliedschaft** (automatisch oder manuell):
   - Eigene Beitrittserklarung (BE)
   - Bonus fuer Erwachsene (170 Euro)
   - NICHT in Familienversicherung eintragen

2. **Kinder < 15 Jahre**:
   - In Familienversicherung eintragen
   - Bonus fuer Kinder (110 Euro)

3. **Automatische Erkennung**:
   - Wenn Hauptmitglied ALG II bezieht UND Kind >= 15 Jahre → Kind bekommt eigene Mitgliedschaft

---

## Technische Aenderungen

### Phase 1: Datenmodell erweitern

**Datei:** `src/types/form.ts`

Neues Feld `eigeneMitgliedschaft` zu `FamilyMember` hinzufuegen:

```typescript
export interface FamilyMember {
  // ... bestehende Felder
  eigeneMitgliedschaft: boolean;  // NEU: Kind hat eigene Mitgliedschaft
}
```

Und in `createEmptyFamilyMember()`:

```typescript
export const createEmptyFamilyMember = (): FamilyMember => ({
  // ... bestehende Felder
  eigeneMitgliedschaft: false,  // NEU
});
```

---

### Phase 2: UI-Anpassung (ViactivSection)

**Datei:** `src/components/ViactivSection.tsx`

#### 2.1 Hilfsfunktion fuer Altersberechnung hinzufuegen

```typescript
const calculateAge = (geburtsdatum: string): number => {
  if (!geburtsdatum) return 0;
  
  let birthDate: Date | null = null;
  
  // ISO format: YYYY-MM-DD
  if (geburtsdatum.includes('-')) {
    const parts = geburtsdatum.split('-');
    if (parts.length === 3) {
      birthDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
  }
  // German format: TT.MM.JJJJ
  else if (geburtsdatum.includes('.')) {
    const parts = geburtsdatum.split('.');
    if (parts.length === 3) {
      birthDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
  }
  
  if (!birthDate) return 0;
  
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};
```

#### 2.2 Automatische Erkennung bei ALG II + Kind >= 15

In der Kinder-Sektion, nach dem Geburtsdatum-Feld:

```typescript
// Automatische Logik: ALG II + Kind >= 15 = eigene Mitgliedschaft
useEffect(() => {
  formData.kinder.forEach((kind, index) => {
    const age = calculateAge(kind.geburtsdatum);
    const isAlgII = formData.viactivBeschaeftigung === 'al_geld_2';
    
    // Nur automatisch setzen wenn Kind >= 15 UND Hauptmitglied ALG II
    if (isAlgII && age >= 15 && !kind.eigeneMitgliedschaft) {
      updateKind(index, { eigeneMitgliedschaft: true });
    }
  });
}, [formData.viactivBeschaeftigung, formData.kinder]);
```

#### 2.3 Checkbox fuer manuelle Auswahl "Eigene Mitgliedschaft"

Nach dem Verwandtschaftsverhaltnis-Feld, neuen Block hinzufuegen:

```typescript
{/* Eigene Mitgliedschaft Option - nur fuer Kinder >= 15 anzeigen */}
{calculateAge(kind.geburtsdatum) >= 15 && (
  <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
    <div className="flex items-center space-x-3">
      <Checkbox
        id={`viactiv-kind${index}-eigene-mitgliedschaft`}
        checked={kind.eigeneMitgliedschaft}
        onCheckedChange={(checked) => 
          updateKind(index, { eigeneMitgliedschaft: checked === true })
        }
      />
      <Label 
        htmlFor={`viactiv-kind${index}-eigene-mitgliedschaft`} 
        className="text-sm font-medium cursor-pointer"
      >
        Kind hat eigene Mitgliedschaft (nicht familienversichert)
      </Label>
    </div>
    {formData.viactivBeschaeftigung === 'al_geld_2' && (
      <p className="text-xs text-amber-700 mt-2">
        <strong>Automatisch aktiviert:</strong> Da Sie ALG II beziehen und das Kind 15+ Jahre alt ist, 
        benoetigt das Kind eine eigene Mitgliedschaft.
      </p>
    )}
    <p className="text-xs text-muted-foreground mt-2">
      Bei eigener Mitgliedschaft wird eine separate Beitrittserklaerung und Bonus-Erwachsene (170 Euro) erstellt.
      Das Kind wird nicht in die Familienversicherung eingetragen.
    </p>
  </div>
)}
```

#### 2.4 Info-Banner bei ALG II Auswahl

Nach dem Beschaeftigungsstatus-Dropdown:

```typescript
{formData.viactivBeschaeftigung === 'al_geld_2' && formData.kinder.some(k => calculateAge(k.geburtsdatum) >= 15) && (
  <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
    <p className="text-sm text-amber-800">
      <strong>Hinweis ALG II:</strong> Kinder ab 15 Jahren benoetigen bei ALG II-Bezug 
      eine eigene Mitgliedschaft. Diese werden automatisch mit eigener Beitrittserklaerung exportiert.
    </p>
  </div>
)}
```

---

### Phase 3: Export-Logik anpassen

#### 3.1 Neue Funktion: Beitrittserklaerung fuer Kind

**Datei:** `src/utils/viactivExport.ts`

Neue Funktion hinzufuegen (aehnlich wie `createViactivBeitrittserklaerungForSpouse`):

```typescript
/**
 * Erstellt eine Beitrittserklaerung fuer ein Kind mit eigener Mitgliedschaft
 */
export const createViactivBeitrittserklaerungForChild = async (
  formData: FormData, 
  kind: FamilyMember,
  kindIndex: number
): Promise<Uint8Array> => {
  const pdfUrl = "/viactiv-beitrittserklaerung.pdf";
  const existingPdfBytes = await fetch(pdfUrl).then((res) => res.arrayBuffer());
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const form = pdfDoc.getForm();
  
  const helpers = createPDFHelpers(form);
  const { setTextField, setCheckbox } = helpers;

  // === AUTOMATISCH AUSGEFUELLT ===
  const datumMitgliedschaft = getDatumMitgliedschaft();
  setTextField("Datum Mitgliedschaft", datumMitgliedschaft);
  
  const versichertBis = getVersichertBis();
  setTextField("versichert bis (Datum)", versichertBis);
  
  setCheckbox("Mein Versicherungsstatus ist unveraendert", true);
  setCheckbox("Datenschutz- und werberechliche Einwilligungserklaerung", true);

  // === PERSOENLICHE DATEN DES KINDES ===
  setTextField("Name", kind.name);
  setTextField("Vorname", kind.vorname);
  
  const geburtsdatumFormatted = formatInputDate(kind.geburtsdatum);
  setTextField("Geburtsdatum", geburtsdatumFormatted);
  
  setTextField("Geburtsort", kind.geburtsort || "");
  setTextField("Geburtsland", kind.geburtsland || "");
  setTextField("Geburtsname", kind.geburtsname || kind.name);
  
  const staatsangehoerigkeitVoll = getNationalityName(kind.staatsangehoerigkeit) || kind.staatsangehoerigkeit || "deutsch";
  setTextField("Staatsangehoerigkeit", staatsangehoerigkeitVoll);

  // === GESCHLECHT ===
  setCheckbox("weiblich", kind.geschlecht === "w");
  setCheckbox("maennlich", kind.geschlecht === "m");
  setCheckbox("divers", kind.geschlecht === "d" || kind.geschlecht === "x");

  // === ADRESSE (vom Hauptmitglied) ===
  setTextField("Strasse", formData.mitgliedStrasse || "");
  setTextField("Hausnummer", formData.mitgliedHausnummer || "");
  setTextField("PLZ", formData.mitgliedPlz || "");
  
  if (kind.abweichendeAnschrift) {
    setTextField("Ort", kind.abweichendeAnschrift);
  } else {
    setTextField("Ort", formData.ort || "");
  }
  
  // === KONTAKT (vom Hauptmitglied) ===
  setTextField("Telefon", formData.telefon || "");
  setTextField("E-Mail", formData.email || "");

  // === FAMILIENSTAND (Kind ist ledig) ===
  setCheckbox("ledig", true);
  setCheckbox("verheiratet", false);
  setCheckbox("Lebenspartnerschaft", false);

  // === BESCHAEFTIGUNGSSTATUS (Kind - in der Regel nicht beschaeftigt) ===
  // Alle Checkboxen leer lassen da Kind normalerweise nicht beschaeftigt

  // === BISHERIGE VERSICHERUNGSART ===
  // Kind war familienversichert
  setCheckbox("pflichtversichert", false);
  setCheckbox("privat", false);
  setCheckbox("freiwillig versichert", false);
  setCheckbox("nicht gesetzl. versichert", false);
  setCheckbox("familienversichert", true);
  setCheckbox("Zuzug aus dem Ausland", false);

  // === BISHERIGE KRANKENKASSE ===
  setTextField("Name der letzten KrankenkasseKrankenversicherung", kind.bisherigBestandBei || formData.mitgliedKrankenkasse || "");

  // === FAMILIENANGEHOERIGE MITVERSICHERN (nein fuer Kind) ===
  setCheckbox("Familienangehoerige sollen mitversichert werden", false);

  // === DATUM UND UNTERSCHRIFT ===
  const today = new Date();
  const datumHeute = formatDateGermanWithDots(today);
  setTextField("Datum und Unterschrift", datumHeute);

  // Unterschrift: Hauptmitglied unterschreibt fuer Kind
  if (formData.unterschrift) {
    await embedSignature(pdfDoc, formData.unterschrift, 180, 735, 0);
  }

  return await pdfDoc.save();
};
```

#### 3.2 Export-Funktion erweitern

In `exportViactivBeitrittserklaerung`:

```typescript
export const exportViactivBeitrittserklaerung = async (formData: FormData): Promise<void> => {
  try {
    const today = new Date();
    const datumForFilename = formatDateGermanWithDots(today);
    
    // 1. Hauptmitglied BE exportieren
    const pdfBytes = await createViactivBeitrittserklaerungPDF(formData);
    const nachname = formData.mitgliedName || 'Nachname';
    const vorname = formData.mitgliedVorname || 'Vorname';
    const filename = `Viactiv_${nachname}, ${vorname}_BE_${datumForFilename}.pdf`;
    downloadPDF(pdfBytes, filename);

    // 2. Ehegatte BE (wenn eigene Mitgliedschaft)
    if (formData.viactivFamilienangehoerigeMitversichern && 
        formData.ehegatte.name && 
        formData.ehegatte.bisherigArt === 'mitgliedschaft') {
      const spousePdfBytes = await createViactivBeitrittserklaerungForSpouse(formData);
      const spouseFilename = `Viactiv_${formData.ehegatte.name}, ${formData.ehegatte.vorname}_BE_${datumForFilename}.pdf`;
      downloadPDF(spousePdfBytes, spouseFilename);
    }

    // 3. NEU: Kinder BE (wenn eigene Mitgliedschaft)
    if (formData.viactivFamilienangehoerigeMitversichern) {
      for (let i = 0; i < formData.kinder.length; i++) {
        const kind = formData.kinder[i];
        if (kind.name && kind.eigeneMitgliedschaft) {
          console.log(`VIACTIV: Erstelle Beitrittserklaerung fuer Kind ${kind.vorname} ${kind.name} mit eigener Mitgliedschaft`);
          
          const kindPdfBytes = await createViactivBeitrittserklaerungForChild(formData, kind, i);
          const kindFilename = `Viactiv_${kind.name}, ${kind.vorname}_BE_${datumForFilename}.pdf`;
          downloadPDF(kindPdfBytes, kindFilename);
        }
      }
    }
  } catch (error) {
    console.error("Error exporting VIACTIV Beitrittserklaerung:", error);
    throw error;
  }
};
```

---

### Phase 4: Familienversicherung-Export anpassen

**Datei:** `src/utils/viactivFamilyExport.ts`

Kinder mit eigener Mitgliedschaft aus der Familienversicherung ausschliessen:

```typescript
export const exportViactivFamilienversicherung = async (formData: FormData): Promise<void> => {
  if (!formData.viactivFamilienangehoerigeMitversichern) {
    console.log("Familienversicherung nicht aktiviert, kein PDF erstellt");
    return;
  }

  // NEU: Nur Kinder OHNE eigene Mitgliedschaft in Familienversicherung eintragen
  const familienversicherteKinder = formData.kinder.filter(kind => !kind.eigeneMitgliedschaft);
  
  // Wenn keine Kinder mehr fuer Familienversicherung UND kein Ehegatte, kein PDF erstellen
  if (familienversicherteKinder.length === 0 && !formData.ehegatte.name) {
    console.log("Keine familienversicherten Angehoerigen, kein PDF erstellt");
    return;
  }

  const numberOfPDFs = Math.max(1, Math.ceil(familienversicherteKinder.length / 3));
  
  // ... Rest der Funktion mit familienversicherteKinder statt formData.kinder
};
```

---

### Phase 5: Bonus-Export anpassen

**Datei:** `src/utils/viactivBonusExport.ts`

Logik fuer Kinder mit eigener Mitgliedschaft:

```typescript
export const exportViactivBonusPDFs = async (formData: FormData): Promise<number> => {
  let count = 0;

  try {
    // 1. Hauptmitglied - immer Erwachsene (170 Euro)
    // ... bestehende Logik

    // 2. Ehegatte
    // ... bestehende Logik

    // 3. Kinder - NEU: Unterscheidung nach eigener Mitgliedschaft
    if (formData.viactivFamilienangehoerigeMitversichern && formData.kinder.length > 0) {
      for (const kind of formData.kinder) {
        if (!kind.name || !kind.vorname) continue;
        
        const age = calculateAge(kind.geburtsdatum);
        
        // NEU: Kind mit eigener Mitgliedschaft = IMMER Erwachsenen-Bonus
        if (kind.eigeneMitgliedschaft) {
          console.log(`VIACTIV Bonus: Kind ${kind.vorname} ${kind.name} hat eigene Mitgliedschaft -> Erwachsenen-Bonus`);
          const kindPdfBytes = await createBonusErwachsenePDF(
            formData,
            kind.vorname,
            kind.name,
            kind.geburtsdatum,
            kind.versichertennummer,
            formData.unterschrift,
          );
          const kindFilename = generateBonusFilename(kind.name, kind.vorname, kind.geburtsdatum);
          downloadPDF(kindPdfBytes, kindFilename);
        } 
        // Unter 15 und familienversichert = Kinder-Bonus
        else if (age < 15) {
          const kindPdfBytes = await createBonusKinderPDF(formData, kind, formData.unterschrift);
          const kindFilename = generateBonusFilename(kind.name, kind.vorname, kind.geburtsdatum);
          downloadPDF(kindPdfBytes, kindFilename);
        }
        // 15+ und familienversichert = Erwachsenen-Bonus (wie bisher)
        else {
          const kindPdfBytes = await createBonusErwachsenePDF(
            formData,
            kind.vorname,
            kind.name,
            kind.geburtsdatum,
            kind.versichertennummer,
            formData.unterschrift,
          );
          const kindFilename = generateBonusFilename(kind.name, kind.vorname, kind.geburtsdatum);
          downloadPDF(kindPdfBytes, kindFilename);
        }
        count++;
      }
    }

    return count;
  } catch (error) {
    console.error("VIACTIV Bonus Export error:", error);
    throw error;
  }
};
```

---

### Phase 6: Export-Zusammenfassung in Index.tsx

**Datei:** `src/pages/Index.tsx`

Toast-Nachricht aktualisieren:

```typescript
if (formData.viactivFamilienangehoerigeMitversichern) {
  const kinderMitEigenerMitgliedschaft = formData.kinder.filter(k => k.eigeneMitgliedschaft).length;
  const familienversicherteKinder = formData.kinder.length - kinderMitEigenerMitgliedschaft;
  
  const numberOfFamilyPDFs = familienversicherteKinder > 0 || formData.ehegatte.name 
    ? Math.max(1, Math.ceil(familienversicherteKinder / 3)) 
    : 0;
  
  const hasSpouseWithOwnMembership = formData.ehegatte.name && formData.ehegatte.bisherigArt === 'mitgliedschaft';
  const numberOfBEs = 1 + (hasSpouseWithOwnMembership ? 1 : 0) + kinderMitEigenerMitgliedschaft;
  const numberOfBonusPDFs = 1 + (formData.ehegatte.name ? 1 : 0) + formData.kinder.length;
  
  toast.info(`Es werden ${numberOfBEs} BE(s), ${numberOfFamilyPDFs} Familienversicherungs-PDF(s) und ${numberOfBonusPDFs} Bonus-PDF(s) erstellt...`);
  
  await exportViactivBeitrittserklaerung(formData);
  await exportViactivFamilienversicherung(formData);
  await exportViactivBonusPDFs(formData);
}
```

---

## Zusammenfassung der Dateiaenderungen

| Datei | Aenderungen |
|-------|-------------|
| `src/types/form.ts` | Neues Feld `eigeneMitgliedschaft` in FamilyMember |
| `src/components/ViactivSection.tsx` | UI fuer eigene Mitgliedschaft, automatische ALG II Erkennung |
| `src/utils/viactivExport.ts` | Neue Funktion `createViactivBeitrittserklaerungForChild`, Export-Logik erweitern |
| `src/utils/viactivFamilyExport.ts` | Kinder mit eigener Mitgliedschaft ausschliessen |
| `src/utils/viactivBonusExport.ts` | Logik fuer Kinder mit eigener Mitgliedschaft |
| `src/pages/Index.tsx` | Toast-Nachricht aktualisieren |

---

## Export-Logik Uebersicht

| Situation | Beitrittserklaerung | Familienversicherung | Bonus |
|-----------|---------------------|----------------------|-------|
| Kind < 15, familienversichert | Nein | Ja | Kinder (110 Euro) |
| Kind >= 15, familienversichert | Nein | Ja | Erwachsene (170 Euro) |
| Kind >= 15, eigene Mitgliedschaft | Ja | Nein | Erwachsene (170 Euro) |
| ALG II + Kind >= 15 | Ja (automatisch) | Nein | Erwachsene (170 Euro) |

