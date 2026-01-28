

# Korrekturen für VIACTIV: Ehegatte-BE Felder + Bonus-PDF Unterschriften

## Zusammenfassung der drei Probleme

1. **Ehegatte-Beitrittserklärung**: Fehlende Felder für Geburtsland und Beschäftigungsstatus
2. **Bonus-PDF Unterschrift-Position**: Unterschrift ist zu hoch positioniert (siehe Bilder)
3. **Ehegatte-BE Unterschrift**: Ehegatte soll mit eigener Unterschrift (`unterschriftFamilie`) unterschreiben

---

## Technische Änderungen

### 1. Datenmodell erweitern

**Datei: `src/types/form.ts`**

Das `FamilyMember`-Interface benötigt ein neues Feld für den Beschäftigungsstatus des Ehegatten:

| Neues Feld | Typ | Beschreibung |
|------------|-----|--------------|
| `beschaeftigung` | `ViactivBeschaeftigung` | Beschäftigungsstatus des Ehegatten |

In `createEmptyFamilyMember()` wird dieses Feld mit leerem String initialisiert.

---

### 2. UI-Komponente erweitern

**Datei: `src/components/ViactivSection.tsx`**

In der Ehegatte-Sektion werden zwei neue Felder hinzugefügt:

#### A) Geburtsland-Feld (separates Feld neben Geburtsort)

Aktuell ist "Geburtsort / Geburtsland" ein kombiniertes Feld. Es wird aufgeteilt in:
- **Geburtsort** (Text-Feld)
- **Geburtsland** (Dropdown mit Länderauswahl)

Dies ermöglicht eine saubere Trennung für den PDF-Export.

#### B) Beschäftigungsstatus-Feld (Dropdown)

Neues Dropdown-Feld mit den gleichen Optionen wie beim Hauptmitglied:
- Ich bin beschäftigt
- Ich bin in Ausbildung
- Ich beziehe Rente
- Ich bin freiwillig versichert
- Ich studiere
- Ich beziehe AL-Geld I
- Ich beziehe AL-Geld II
- Ich habe einen Minijob
- Ich bin selbstständig
- Einkommen über Grenze

**Position:** Nach "Staatsangehörigkeit" in einer neuen Zeile mit:
- Geburtsland (Dropdown)
- Beschäftigungsstatus (Dropdown)

---

### 3. Ehegatte-Beitrittserklärung Export korrigieren

**Datei: `src/utils/viactivExport.ts`**

Änderungen in der Funktion `createViactivBeitrittserklaerungForSpouse`:

#### A) Geburtsland separat setzen

```
Aktuell:
- Parst "Geburtsort, Geburtsland" aus einem kombinierten Feld

Neu:
- Geburtsort: ehegatte.geburtsort
- Geburtsland: ehegatte.geburtsland (ISO-Code)
```

#### B) Beschäftigungsstatus-Checkboxen setzen

```
Aktuell (Zeilen 368-379):
- Alle Checkboxen werden auf false gesetzt

Neu:
- Die Checkboxen werden basierend auf ehegatte.beschaeftigung gesetzt
```

#### C) Unterschrift vom Ehegatten verwenden

```
Aktuell (Zeile 410-411):
- Verwendet formData.unterschrift (Hauptmitglied)

Neu:
- Verwendet formData.unterschriftFamilie (Ehegatte-Unterschrift)
```

---

### 4. Bonus-PDF Unterschrift-Position korrigieren

**Datei: `src/utils/viactivBonusExport.ts`**

Basierend auf den hochgeladenen Bildern ist die Unterschrift ca. 40-50 Pixel zu hoch. Die Unterschrift muss tiefer positioniert werden, um neben dem Datum-Feld zu erscheinen.

#### Aktuelle Positionen:

| PDF-Typ | X | Y | Problem |
|---------|---|---|---------|
| Bonus-Erwachsene | 310 | 718 | Zu hoch |
| Bonus-Kinder | 310 | 675 | Zu hoch |

#### Korrigierte Positionen:

| PDF-Typ | X | Y (neu) | Anpassung |
|---------|---|---------|-----------|
| Bonus-Erwachsene | 310 | 760 | +42 Pixel nach unten |
| Bonus-Kinder | 310 | 720 | +45 Pixel nach unten |

Die Y-Koordinate wird erhöht, weil PDF-lib die Y-Achse von unten nach oben misst. Um die Unterschrift visuell tiefer zu positionieren, muss der Wert in `height - y` größer sein, also `y` größer werden.

---

## Dateien-Übersicht

| Datei | Änderung |
|-------|----------|
| `src/types/form.ts` | +1 Feld in `FamilyMember` Interface (`beschaeftigung`) |
| `src/components/ViactivSection.tsx` | +2 Felder (Geburtsland-Dropdown, Beschäftigung-Dropdown) |
| `src/utils/viactivExport.ts` | Geburtsland separat, Beschäftigung-Checkboxen, Ehegatte-Unterschrift |
| `src/utils/viactivBonusExport.ts` | Unterschrift-Positionen korrigieren |

---

## Detaillierte Änderungen

### 1. FamilyMember Interface (`src/types/form.ts`)

```typescript
export interface FamilyMember {
  // ... bestehende Felder ...
  
  // Neues Feld für VIACTIV Ehegatte-BE
  beschaeftigung: ViactivBeschaeftigung;
}
```

In `createEmptyFamilyMember()`:
```typescript
beschaeftigung: '',
```

---

### 2. ViactivSection UI (`src/components/ViactivSection.tsx`)

Die Ehegatte-Sektion wird erweitert. Nach "Geburtsname" und "Geburtsort" kommt eine neue Zeile:

```text
+------------------------------------------+
| Ehegatte-Sektion (erweitert)             |
+------------------------------------------+
| Name* | Vorname* | Geburtsdatum | Geschlecht |
| [___] | [______] | [__________] | [________] |
|                                          |
| Geburtsname | Geburtsort | Staatsang.    |
| [_________] | [________] | [__________]  |
|                                          |
| Geburtsland* | Beschäftigungsstatus*     | <-- NEU
| [Dropdown]   | [Dropdown]                |
+------------------------------------------+
```

---

### 3. Ehegatte-BE Export (`src/utils/viactivExport.ts`)

#### Zeile 325-330 (Geburtsort/Geburtsland):
```typescript
// Aktuell:
const geburtsortParts = (spouse.geburtsort || "").split(",");
const geburtsort = geburtsortParts[0]?.trim() || "";
const geburtsland = geburtsortParts[1]?.trim() || spouse.geburtsland || "";

// Neu:
setTextField("Geburtsort", spouse.geburtsort || "");
setTextField("Geburtsland", spouse.geburtsland || "");
```

#### Zeile 368-379 (Beschäftigungsstatus):
```typescript
// Neu: Checkboxen basierend auf ehegatte.beschaeftigung
setCheckbox("Ich bin beschäftigt", spouse.beschaeftigung === "beschaeftigt");
setCheckbox("Ich bin in Ausbildung", spouse.beschaeftigung === "ausbildung");
setCheckbox("Ich beziehe Rente", spouse.beschaeftigung === "rente");
// ... etc.
```

#### Zeile 410-411 (Unterschrift):
```typescript
// Aktuell:
if (formData.unterschrift) {
  await embedSignature(pdfDoc, formData.unterschrift, 180, 735, 0);
}

// Neu:
if (formData.unterschriftFamilie) {
  await embedSignature(pdfDoc, formData.unterschriftFamilie, 180, 735, 0);
}
```

---

### 4. Bonus-PDF Unterschrift-Position (`src/utils/viactivBonusExport.ts`)

#### Zeile 244-246 (Bonus-Erwachsene):
```typescript
// Aktuell:
await embedSignature(pdfDoc, signatureData, 310, 718, 0);

// Neu:
await embedSignature(pdfDoc, signatureData, 310, 760, 0);
```

#### Zeile 302-304 (Bonus-Kinder):
```typescript
// Aktuell:
await embedSignature(pdfDoc, signatureData, 310, 675, 0);

// Neu:
await embedSignature(pdfDoc, signatureData, 310, 720, 0);
```

---

## Zusammenfassung der Unterschriften-Logik

| PDF-Typ | Unterschrift von |
|---------|-----------------|
| **Hauptmitglied BE** | `formData.unterschrift` |
| **Ehegatte BE** | `formData.unterschriftFamilie` |
| **Hauptmitglied Bonus** | `formData.unterschrift` |
| **Ehegatte Bonus** | `formData.unterschriftFamilie` |
| **Kinder Bonus** | `formData.unterschrift` (Hauptmitglied unterschreibt) |

