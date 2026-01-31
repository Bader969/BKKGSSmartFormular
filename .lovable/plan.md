

# DAK Familienversicherung PDF Export - 13 Korrekturen (AKTUALISIERT)

## Korrektur zu Punkt 12

**WICHTIG:** Der Ehegatte soll in **ALLEN** PDF-Teilen erscheinen, nicht nur im ersten!

---

## Uebersicht der zu behebenden Probleme

| Nr | Problem | Korrektur |
|----|---------|-----------|
| 1 | Geburtsdatum Mitglied auf allen Seiten | Alle 3 Seiten befuellen |
| 2 | Beginn Familienversicherung | Textfeld 1 automatisch berechnen |
| 3 | Familienstand Checkboxen | Kontrollkaestchen 6-9 |
| 4 | Kind Verwandtschaft | Kontrollkaestchen 21-28 |
| 5 | Vorversicherung Mapping | Korrigiertes Mapping 62-72/79 |
| 6 | Ehegatte Name Page 3 | Vorname → 154, Nachname → 155 |
| 7 | Ehegatte verwandt mit Kindern | Kontrollkaestchen 256/257 |
| 8 | Ehegatte gesetzlich versichert | Kontrollkaestchen 258/259 + Familienname 156 |
| 9 | Unterschrift Datum | Textfeld 417 (heutiges Datum) |
| 10 | Telefon | Textfeld 420 |
| 11 | Email | Textfeld 421 |
| **12** | **Ehegatte in allen PDFs** | **Ehegatte in JEDEM PDF-Teil eintragen** |
| 13 | Unterschriften als Bild | Signatur-Bild einbetten |

---

## Technische Details

### Datei: `src/utils/dakExport.ts`

---

### 1. Geburtsdatum Mitglied auf allen Seiten

Aktuell wird nur ein Feld gesetzt. Laut CSV gibt es das Feld `Geburtsdatum.Seite 1.` auf allen drei Seiten. Da PDF-Lib Felder mit gleichem Namen zusammen behandelt, sollte dies automatisch funktionieren. Falls nicht, muss geprueft werden ob die Feldnamen identisch sind.

---

### 2. Beginn Familienversicherung (Textfeld 1)

In `fillHardcodedFields` hinzufuegen:

```typescript
// Beginn Familienversicherung automatisch berechnen
const dates = calculateDates();
setTextField('Textfeld 1', dates.beginDate);
```

---

### 3. Familienstand Checkboxen

In `fillHardcodedFields` hinzufuegen:

```typescript
// Familienstand des Mitglieds
setCheckbox('Kontrollkästchen 6', formData.familienstand === 'ledig');
setCheckbox('Kontrollkästchen 7', formData.familienstand === 'verheiratet');
setCheckbox('Kontrollkästchen 8', formData.familienstand === 'getrennt');
setCheckbox('Kontrollkästchen 9', formData.familienstand === 'verwitwet');
```

---

### 4. Kind Verwandtschaft Checkboxen

Interface erweitern:

```typescript
interface PersonFieldMapping {
  // ... bestehende Felder
  verwandtschaftLeibl?: string;
  verwandtschaftEnkel?: string;
  verwandtschaftStief?: string;
  verwandtschaftPflege?: string;
}
```

Mappings hinzufuegen:

```typescript
const CHILD1_FIELDS: PersonFieldMapping = {
  // ... bestehende Felder
  verwandtschaftLeibl: 'Kontrollkästchen 21',
  verwandtschaftEnkel: 'Kontrollkästchen 22',
  verwandtschaftStief: 'Kontrollkästchen 23',
  verwandtschaftPflege: 'Kontrollkästchen 24',
};

const CHILD2_FIELDS: PersonFieldMapping = {
  // ... bestehende Felder
  verwandtschaftLeibl: 'Kontrollkästchen 25',
  verwandtschaftEnkel: 'Kontrollkästchen 26',
  verwandtschaftStief: 'Kontrollkästchen 27',
  verwandtschaftPflege: 'Kontrollkästchen 28',
};
```

In `fillPersonFields` hinzufuegen:

```typescript
// Verwandtschaft (nur fuer Kinder)
if (mapping.verwandtschaftLeibl) {
  setCheckbox(mapping.verwandtschaftLeibl, member.verwandtschaft === 'leiblich');
  setCheckbox(mapping.verwandtschaftEnkel!, member.verwandtschaft === 'enkel');
  setCheckbox(mapping.verwandtschaftStief!, member.verwandtschaft === 'stief');
  setCheckbox(mapping.verwandtschaftPflege!, member.verwandtschaft === 'pflege');
}
```

---

### 5. Vorversicherung Mapping korrigieren

CHILD2_FIELDS Korrektur (79 statt 73):

```typescript
const CHILD2_FIELDS: PersonFieldMapping = {
  // ...
  vorversNicht: 'Kontrollkästchen 70',
  vorversPrivat: 'Kontrollkästchen 71',
  vorversFamilie: 'Kontrollkästchen 72',
  vorversGesetzlich: 'Kontrollkästchen 79', // ACHTUNG: 79, nicht 73!
};
```

Alle Mappings korrigieren (Reihenfolge: gar nicht, privat, familienversichert, eigene):

```typescript
const SPOUSE_FIELDS: PersonFieldMapping = {
  vorversNicht: 'Kontrollkästchen 62',
  vorversPrivat: 'Kontrollkästchen 63',
  vorversFamilie: 'Kontrollkästchen 64',
  vorversGesetzlich: 'Kontrollkästchen 65',
};

const CHILD1_FIELDS: PersonFieldMapping = {
  vorversNicht: 'Kontrollkästchen 66',
  vorversPrivat: 'Kontrollkästchen 67',
  vorversFamilie: 'Kontrollkästchen 68',
  vorversGesetzlich: 'Kontrollkästchen 69',
};
```

---

### 6. Ehegatte Vorname/Nachname getrennt auf Seite 3

In `fillSpouseOnPage3` aendern:

```typescript
// AKTUELL (falsch):
setTextField('Familienname 154', `${ehegatte.vorname} ${ehegatte.name}`.trim());

// NEU (korrekt):
setTextField('Familienname 154', ehegatte.vorname);
setTextField('Familienname 155', ehegatte.name);
```

---

### 7. Ehegatte verwandt mit Kindern

In `fillSpouseOnPage3` hinzufuegen:

```typescript
const setCheckbox = (fieldName: string, checked: boolean) => {
  try {
    const field = form.getCheckBox(fieldName);
    if (checked) field.check(); else field.uncheck();
  } catch (e) { console.warn(`Checkbox ${fieldName} not found`); }
};

// Ehegatte verwandt mit Kindern
setCheckbox('Kontrollkästchen 256', ehegatte.isEhegatteVerwandt === true);
setCheckbox('Kontrollkästchen 257', ehegatte.isEhegatteVerwandt === false);
```

---

### 8. Ehegatte gesetzlich versichert

In `fillSpouseOnPage3` hinzufuegen:

```typescript
// Ehegatte ist Mitglied einer gesetzlichen Krankenkasse?
const ehegatteIstMitglied = ehegatte.bisherigArt === 'mitgliedschaft';
setCheckbox('Kontrollkästchen 258', ehegatteIstMitglied);
setCheckbox('Kontrollkästchen 259', !ehegatteIstMitglied);

// Krankenkasse Name (wenn ja)
if (ehegatteIstMitglied) {
  setTextField('Familienname 156', ehegatte.bisherigBestandBei || formData.ehegatteKrankenkasse || '');
}
```

---

### 9. Unterschrift Datum

In `fillHardcodedFields` hinzufuegen:

```typescript
const today = new Date();
const datumHeute = `${today.getDate().toString().padStart(2, '0')}.${(today.getMonth() + 1).toString().padStart(2, '0')}.${today.getFullYear()}`;
setTextField('Textfeld 417', datumHeute);
```

---

### 10. Telefon

In `fillHardcodedFields` hinzufuegen:

```typescript
setTextField('Textfeld 420', formData.telefon);
```

---

### 11. Email

In `fillHardcodedFields` hinzufuegen:

```typescript
setTextField('Textfeld 421', formData.email);
```

---

### 12. Ehegatte in ALLEN PDFs (KORRIGIERT)

**Aktuelle Logik (Zeile 435):**
```typescript
if (pdfIndex === 0 && formData.ehegatte.name) {
  fillPersonFields(form, formData.ehegatte, SPOUSE_FIELDS, formData, dates);
  fillSpouseOnPage3(form, formData);
}
```

**Neue Logik - Ehegatte in JEDEM PDF:**
```typescript
// Ehegatte in ALLEN PDFs eintragen (nicht nur im ersten)
if (formData.ehegatte.name) {
  fillPersonFields(form, formData.ehegatte, SPOUSE_FIELDS, formData, dates);
  fillSpouseOnPage3(form, formData);
}
```

Die Bedingung `pdfIndex === 0` wird entfernt, sodass der Ehegatte in jedem generierten PDF-Teil erscheint.

---

### 13. Unterschriften als Bild statt Text

Neue Funktion hinzufuegen:

```typescript
const embedSignature = async (
  pdfDoc: PDFDocument,
  signatureData: string,
  x: number,
  y: number,
  pageIndex: number
): Promise<void> => {
  if (!signatureData) return;

  try {
    const base64Data = signatureData.split(',')[1];
    const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    let image;
    if (signatureData.includes('image/png')) {
      image = await pdfDoc.embedPng(imageBytes);
    } else {
      image = await pdfDoc.embedJpg(imageBytes);
    }
    
    const pages = pdfDoc.getPages();
    const page = pages[pageIndex];
    
    const aspectRatio = image.width / image.height;
    let width = 100;
    let height = width / aspectRatio;
    if (height > 30) {
      height = 30;
      width = height * aspectRatio;
    }
    
    page.drawImage(image, { x, y, width, height });
  } catch (error) {
    console.warn('Signatur konnte nicht eingebettet werden:', error);
  }
};
```

In `fillHardcodedFields` die Text-Unterschriften entfernen:

```typescript
// ENTFERNEN:
setTextField('Textfeld 418', formData.mitgliedName);
setTextField('Textfeld 419', formData.ehegatte.name);
```

In `exportDAKFamilienversicherung` nach dem Befuellen, vor dem Speichern:

```typescript
// Unterschriften als Bilder einbetten (Seite 3 = Index 2)
if (formData.unterschrift) {
  await embedSignature(pdfDoc, formData.unterschrift, 185, 493, 2);
}
if (formData.ehegatte.name && formData.unterschriftFamilie) {
  await embedSignature(pdfDoc, formData.unterschriftFamilie, 375, 493, 2);
}
```

---

## Zusammenfassung der Aenderungen

| Zeile | Aenderung |
|-------|-----------|
| 70-101 | PersonFieldMapping Interface erweitern (Verwandtschaft) |
| 104-131 | SPOUSE_FIELDS Vorversicherung korrigieren |
| 134-161 | CHILD1_FIELDS Verwandtschaft + Vorvers. hinzufuegen |
| 164-191 | CHILD2_FIELDS Verwandtschaft + Vorvers. (79!) |
| 193-311 | fillPersonFields: Verwandtschaft-Logik |
| 341-379 | fillHardcodedFields: Beginn, Familienstand, Datum, Tel, Email |
| 381-413 | fillSpouseOnPage3: Name trennen, Verwandt, Mitglied KK |
| NEU | embedSignature Funktion |
| 435-438 | Ehegatte in ALLEN PDFs (pdfIndex === 0 entfernen) |
| Nach 465 | Signaturen als Bild einbetten |

---

## Dateien

| Datei | Aenderungen |
|-------|-------------|
| `src/utils/dakExport.ts` | Alle 13 Korrekturen |

