
# DAK Familienversicherung Integration

## Zusammenfassung

Integration der DAK Familienversicherung als vierte Krankenkasse in die bestehende App mit speziellem PDF-Mapping, das gesplittete Datumsfelder (T1, M1, J1-J4) verwendet.

---

## 1. Dateien-Änderungen

### 1.1 PDF-Template hinzufügen

| Aktion | Datei |
|--------|-------|
| Kopieren | `user-uploads://FamV-Antrag_Partnervertrieb_17463.pdf` -> `public/dak-familienversicherung.pdf` |

---

### 1.2 Typ-Erweiterung (`src/types/form.ts`)

**Zeile 72 erweitern:**
```typescript
export type Krankenkasse = 'bkk_gs' | 'viactiv' | 'novitas' | 'dak';
```

**Zeile 74-78 erweitern:**
```typescript
export const KRANKENKASSEN_OPTIONS = [
  { value: 'bkk_gs' as Krankenkasse, label: 'BKK GILDEMEISTER SEIDENSTICK' },
  { value: 'viactiv' as Krankenkasse, label: 'VIACTIV Krankenkasse' },
  { value: 'novitas' as Krankenkasse, label: 'Novitas BKK' },
  { value: 'dak' as Krankenkasse, label: 'DAK Familienversicherung' },
] as const;
```

---

### 1.3 Neuer Export (`src/utils/dakExport.ts`)

Erstellen einer neuen Export-Datei mit speziellem Datums-Splitting-Algorithmus:

```typescript
import { PDFDocument } from "pdf-lib";
import { FormData, FamilyMember } from "@/types/form";

// Datum-Splitting für DAK: "01.05.1980" -> { T1: "0", T2: "1", M1: "0", M2: "5", J1: "1", J2: "9", J3: "8", J4: "0" }
const splitDate = (dateStr: string): { T1: string; T2: string; M1: string; M2: string; J1: string; J2: string; J3: string; J4: string } | null => {
  if (!dateStr) return null;
  
  // Format: DD.MM.YYYY oder YYYY-MM-DD
  let day: string, month: string, year: string;
  
  if (dateStr.includes('.')) {
    const parts = dateStr.split('.');
    if (parts.length !== 3) return null;
    [day, month, year] = parts;
  } else if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    [year, month, day] = parts;
  } else {
    return null;
  }
  
  day = day.padStart(2, '0');
  month = month.padStart(2, '0');
  year = year.padStart(4, '0');
  
  return {
    T1: day[0], T2: day[1],
    M1: month[0], M2: month[1],
    J1: year[0], J2: year[1], J3: year[2], J4: year[3]
  };
};
```

**Haupt-Mapping-Logik:**

```text
+------------------+---------------------+---------------------+---------------------+
| Feld             | Ehegatte (Links)    | Kind 1 (Mitte)      | Kind 2 (Rechts)     |
+------------------+---------------------+---------------------+---------------------+
| Vorname          | Vorname 1           | Vorname 2           | Vorname 3           |
| Nachname         | Familienname 1      | Familienname 2      | Familienname 3      |
| Geburtsdatum     | T1..J4              | T3..J8              | T5..J12             |
| Geschlecht       | Weiblich 12, männ.13| weiblich 15, männ.16| weiblich 18, männ.19|
| Straße           | Familienname 4      | Familienname 5      | Familienname 6      |
| PLZ/Ort          | Familienname 7      | Familienname 8      | Familienname 9      |
| Geburtsname      | Familienname 13     | Familienname 14     | Familienname 15     |
| Geburtsort       | Familienname 16     | Familienname 17     | Familienname 18     |
| Geburtsland      | Familienname 19     | Familienname 20     | Familienname 21     |
| Staatsangeh.     | Familienname 22     | Familienname 23     | Familienname 24     |
| Kasse Name       | Familienname 25     | Familienname 26     | Familienname 27     |
| Vorvers. Art     | Kontrollk. 62-65    | Kontrollk. 66-69    | Kontrollk. 70-73    |
| Vorvers. Bis     | T7...               | T8...               | T9...               |
| Name Hauptvers.  | Familienname 31     | Familienname 32     | Familienname 33     |
| Gebdat Hauptvers.| T13...              | T14...              | T15...              |
+------------------+---------------------+---------------------+---------------------+
```

**Kopfdaten (alle Seiten):**
- `Mitglief.Seite 1`, `Mitglief.Seite 2`, `Mitglief.Seite 3` = Vorname + Nachname Hauptmitglied
- `KVNR.Seite 1`, `KVNR.Seite 2`, `KVNR.Seite 3` = KV-Nummer
- `Geburtsdatum.Seite 1.` = Geburtsdatum Hauptmitglied (DD.MM.YYYY)

**Hardcoded-Felder:**
- `Kontrollkästchen 1` = true (Beginn meiner Mitgliedschaft)
- `Textfeld 418` = Nachname Hauptmitglied (Unterschrift)
- `Textfeld 419` = Nachname Ehegatte (falls vorhanden)
- `Kontrollkästchen 261` = true (Ehegatte Einkünfte, falls Ehegatte vorhanden)

**Blacklist (NICHT befüllen):**
- Familienname 10, 11, 12 (Rentenversicherungsnummer)
- Familienname 28, 29, 30 (Anschrift der Kasse)
- Kontrollkästchen 56, 57, 58 (Befreiung Versicherungspflicht)
- Seite 2 komplett (Einkünfte, Schulbesuch)
- Familienname 147, 149, 150, 151, 152, 153 (Einkünfte Seite 3)

**Multi-PDF bei >2 Kindern:**
- PDF unterstützt nur 2 Kinder-Spalten pro Formular
- Bei 3+ Kindern: Automatisch weitere PDFs erstellen
- Kopfdaten (Hauptmitglied + Ehegatte) bleiben in jedem PDF erhalten

---

### 1.4 Index.tsx Anpassungen

**Neue Imports (Zeile 15):**
```typescript
import { exportDAKFamilienversicherung } from '@/utils/dakExport';
```

**Validierung ergänzen (nach Zeile 137):**
```typescript
// DAK-spezifische Validierung
else if (formData.selectedKrankenkasse === 'dak') {
  if (!formData.mitgliedKvNummer) {
    toast.error('Bitte geben Sie die KV-Nummer ein.');
    return;
  }
  if (!formData.mitgliedKrankenkasse) {
    toast.error('Bitte geben Sie den Namen der Krankenkasse ein.');
    return;
  }
  // Geburtsdatum ist bei DAK erforderlich (Split-Felder)
  if (!formData.mitgliedGeburtsdatum) {
    toast.error('Bitte geben Sie das Geburtsdatum des Mitglieds ein.');
    return;
  }
}
```

**Export-Logic ergänzen (nach Zeile 217):**
```typescript
// DAK Export
else if (formData.selectedKrankenkasse === 'dak') {
  const numberOfPDFs = Math.max(1, Math.ceil(formData.kinder.length / 2)); // Nur 2 Kinder pro PDF!
  toast.info(`Es werden ${numberOfPDFs} DAK Familienversicherungs-PDF(s) erstellt...`);
  await exportDAKFamilienversicherung(formData);
  toast.success('DAK Familienversicherung erfolgreich exportiert!');
}
```

**Sektion-Rendering (nach Zeile 388):**
```typescript
{/* DAK spezifische Sektionen */}
{formData.selectedKrankenkasse === 'dak' && (
  <>
    <SpouseSection formData={formData} updateFormData={updateFormData} />
    <ChildrenSection formData={formData} updateFormData={updateFormData} />
  </>
)}
```

**Info-Text Update (Zeile 301):**
```typescript
{formData.selectedKrankenkasse === 'dak' 
  ? 'Es wird die DAK Familienversicherung erstellt.'
  : formData.selectedKrankenkasse === 'novitas' 
    ? ...
```

---

### 1.5 FamilyMemberForm.tsx Anpassungen

Versichertennummer bei DAK ausblenden (ähnlich wie Novitas):

```typescript
{selectedKrankenkasse !== 'novitas' && selectedKrankenkasse !== 'dak' && (
  // Versichertennummer-Feld
)}
```

---

## 2. Technische Details

### 2.1 Datums-Splitting Helper

Die Funktion `setDateFields` füllt alle 8 Felder eines Datums:

```typescript
const setDateFields = (prefix: string, dateStr: string) => {
  const split = splitDate(dateStr);
  if (!split) return;
  
  setTextField(`Geburtsdatum ${prefix}1`, split.T1);
  setTextField(`Geburtsdatum ${prefix}2`, split.T2);
  setTextField(`Geburtsdatum M${num}1`, split.M1);
  setTextField(`Geburtsdatum M${num}2`, split.M2);
  setTextField(`Geburtsdatum J${num}1`, split.J1);
  setTextField(`Geburtsdatum J${num}2`, split.J2);
  setTextField(`Geburtsdatum J${num}3`, split.J3);
  setTextField(`Geburtsdatum J${num}4`, split.J4);
};
```

### 2.2 Geburtsdatum-Feldnamen-Mapping

| Person         | T-Felder   | M-Felder   | J-Felder        |
|----------------|------------|------------|-----------------|
| Ehegatte       | T1, T2     | M1, M2     | J1-J4           |
| Kind 1         | T3, T4     | M3, M4     | J5-J8           |
| Kind 2         | T5, T6     | M5, M6     | J9-J12          |
| Vorvers Eheg.  | T7, T10    | M7, M10    | J13, J16, J19, J22 |
| Vorvers Kind1  | T8, T11    | M8, M11    | J14, J17, J20, J23 |
| Vorvers Kind2  | T9, T12    | M9, M12    | J15, J18, J21, J24 |
| Hauptvers Eheg.| T13, T16   | M13, M16   | J25, J28, J31, J34 |
| Hauptvers K1   | T14, T17   | M14, M17   | J26, J29, J32, J35 |
| Hauptvers K2   | T15, T18   | M15, M18   | J27, J30, J33, J36 |

### 2.3 Vorversicherungsart Checkboxen

| Art                    | Ehegatte | Kind 1 | Kind 2 |
|------------------------|----------|--------|--------|
| Gesetzlich Mitglied    | 62       | 66     | 70     |
| Familienversichert     | 63       | 67     | 71     |
| Privat versichert      | 64       | 68     | 72     |
| Nicht versichert       | 65       | 69     | 73     |

---

## 3. Datei-Übersicht

| Datei | Änderung |
|-------|----------|
| `public/dak-familienversicherung.pdf` | NEU - PDF-Template kopieren |
| `src/types/form.ts` | 'dak' zu Krankenkasse-Type hinzufügen |
| `src/utils/dakExport.ts` | NEU - Export-Logik mit Datums-Splitting |
| `src/pages/Index.tsx` | Validierung, Export-Call, UI-Sektionen |
| `src/components/FamilyMemberForm.tsx` | Versichertennummer bei DAK ausblenden |

---

## 4. Besonderheiten

1. **Nur 2 Kinder pro PDF**: Im Gegensatz zu anderen Krankenkassen (3 Kinder) unterstützt DAK nur 2 Kinder-Spalten

2. **Gesplittete Datumsfelder**: Jedes Datum wird in 8 separate Felder aufgeteilt (T1, T2, M1, M2, J1-J4)

3. **Kopfdaten auf allen Seiten**: Name, KVNR und Geburtsdatum des Hauptmitglieds müssen auf Seite 1, 2 und 3 identisch befüllt werden

4. **Ehegatte separat auf Seite 3**: Wenn Ehegatte vorhanden, zusätzliche Felder auf Seite 3 (Familienname 154, Geburtsdatum T53...J108)

5. **Automatische Feldübernahme**: Bei jedem Angehörigen werden Name und Geburtsdatum des Hauptversicherten in die entsprechenden Felder (Familienname 31-33, Geburtsdatum T13-15) eingetragen

