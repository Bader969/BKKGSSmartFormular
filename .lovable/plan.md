

# VIACTIV Bonus-PDFs: Vollständige Implementierung

## Zusammenfassung

Diese Implementierung fügt VIACTIV Bonus-PDF-Exporte für Erwachsene (170€) und Kinder (110€) hinzu. Das Kontoinhaber-Feld wird automatisch mit dem Namen des Hauptmitglieds synchronisiert, kann aber manuell überschrieben werden.

---

## Geplante Änderungen

### 1. PDF-Templates in public-Ordner kopieren

Die beiden hochgeladenen PDF-Vorlagen werden kopiert:
- `public/viactiv-bonus-erwachsene.pdf`
- `public/viactiv-bonus-kinder.pdf`

---

### 2. Datenmodell erweitern

**Datei: `src/types/form.ts`**

Drei neue Felder im FormData-Interface hinzufügen:

| Neues Feld | Typ | Beschreibung |
|------------|-----|--------------|
| `viactivBonusVertragsnummer` | string | Antrags-/Vertragsnummer (wird überall eingetragen) |
| `viactivBonusIBAN` | string | Eigenes IBAN-Feld für Bonus-PDFs |
| `viactivBonusKontoinhaber` | string | Kontoinhaber (synchronisiert mit Hauptmitglied) |

In `createInitialFormData()` werden diese mit leeren Werten initialisiert.

---

### 3. UI-Komponente erweitern

**Datei: `src/components/ViactivSection.tsx`**

#### A) Neue "VIACTIV Bonus-Programm" Sektion

Position: Nach der "Familienversicherung" Checkbox, vor den Familienangaben

Drei Felder in einem Grid:
- **Antrags-/Vertragsnummer** (Pflichtfeld)
- **Kontoinhaber** (synchronisiert mit `mitgliedVorname mitgliedName`, kann überschrieben werden)
- **IBAN** (Pflichtfeld)

Die Synchronisationslogik für den Kontoinhaber:
1. Initial: Leer
2. Wenn `mitgliedVorname` oder `mitgliedName` sich ändert UND das Feld noch leer ist oder dem alten Wert entspricht → automatisch aktualisieren
3. Wenn manuell geändert → Synchronisation unterbrechen (wie bei Arzt-Ort)

#### B) Versichertennummer-Felder hinzufügen

In der **Ehegatte-Sektion** (nach "Abweichende Anschrift"):
- Neues Feld: "Versichertennummer" für `formData.ehegatte.versichertennummer`

In der **Kinder-Sektion** (nach "Abweichende Anschrift" pro Kind):
- Neues Feld: "Versichertennummer" für `kind.versichertennummer`

---

### 4. Automatische Kontoinhaber-Synchronisation

**Datei: `src/pages/Index.tsx`**

In der `updateFormData`-Funktion wird folgende Logik hinzugefügt:

```
Wenn mitgliedVorname oder mitgliedName sich ändert:
  Wenn viactivBonusKontoinhaber leer ist 
     ODER viactivBonusKontoinhaber === alter Hauptmitglied-Name:
    → Setze viactivBonusKontoinhaber = neuer Hauptmitglied-Name
```

Dies ermöglicht:
- Automatische Befüllung beim ersten Eingeben des Namens
- Manuelle Überschreibung, die erhalten bleibt

---

### 5. Neue Export-Datei erstellen

**Neue Datei: `src/utils/viactivBonusExport.ts`**

#### Hauptfunktionen

| Funktion | Beschreibung |
|----------|-------------|
| `calculateAge(geburtsdatum)` | Berechnet Alter aus Geburtsdatum (ISO oder TT.MM.JJJJ) |
| `isChild(geburtsdatum)` | Prüft ob Person unter 15 Jahre alt ist |
| `formatDateGerman(isoDate)` | Konvertiert ISO zu TT.MM.JJJJ |
| `formatStartDate(date)` | Formatiert Startdatum als JJJJ-MM-TT für Dateinamen |
| `embedSignature(pdfDoc, signatureBase64, x, y, width, height)` | Bettet Unterschrift-Bild ein |
| `createBonusErwachsenePDF(...)` | Erstellt Bonus-Erwachsene PDF |
| `createBonusKinderPDF(...)` | Erstellt Bonus-Kinder PDF |
| `exportViactivBonusPDFs(formData)` | Hauptexport-Funktion, gibt Anzahl zurück |

#### PDF-Feldmapping Bonus-Erwachsene

| PDF-Feld | Quelle |
|----------|--------|
| Verzicht 1 | `true` (immer angekreuzt) |
| Verzicht 2 | `true` (immer angekreuzt) |
| Antragsnummer | `viactivBonusVertragsnummer` |
| Antragsnummer 2 | `viactivBonusVertragsnummer` |
| Versicherungsnummer | Person-Versichertennummer |
| Vorname | Person-Vorname |
| Nachname | Person-Nachname |
| Geburtsdatum | TT.MM.JJJJ |
| Kontoinhaberin | `viactivBonusKontoinhaber` |
| IBAN | `viactivBonusIBAN` |
| Datum Unterschrift | Heutiges Datum (TT.MM.JJJJ) |

#### PDF-Feldmapping Bonus-Kinder

| PDF-Feld | Quelle |
|----------|--------|
| Verzicht 1 | `true` (immer angekreuzt) |
| Verzicht 2 | `true` (immer angekreuzt) |
| Antragsnummer | `viactivBonusVertragsnummer` |
| Antragsnummer 2 | `viactivBonusVertragsnummer` |
| Versicherungsnummer | `mitgliedVersichertennummer` (Hauptmitglied) |
| Vorname | `mitgliedVorname` (Hauptmitglied) |
| Nachname | `mitgliedName` (Hauptmitglied) |
| Versicherungsnummer_2 | `kind.versichertennummer` |
| Vorname_2 | `kind.vorname` |
| Nachname_2 | `kind.name` |
| Geburtsdatum Kind | Kind-Geburtsdatum TT.MM.JJJJ |
| Kontoinhaberin | `viactivBonusKontoinhaber` |
| IBAN | `viactivBonusIBAN` |
| Datum Unterschrift | Heutiges Datum (TT.MM.JJJJ) |

#### Unterschriften-Logik

| PDF für | Unterschrift von |
|---------|-----------------|
| Hauptmitglied | `formData.unterschrift` |
| Ehegatte | `formData.unterschriftFamilie` |
| Alle Kinder | `formData.unterschrift` (Hauptmitglied) |

Unterschrift wird als Bild neben dem "Datum Unterschrift"-Feld platziert:
- Bonus-Erwachsene: X=310, Y=718 (basierend auf Datum-Position 245.8, 730.8)
- Bonus-Kinder: X=310, Y=675 (basierend auf Datum-Position 246.9, 687.5)

#### Alterslogik

```
Alter = (Heute - Geburtsdatum) in Jahren
Wenn Alter >= 15: Bonus-Erwachsene (170€)
Wenn Alter < 15: Bonus-Kinder (110€)
```

#### Dateibenennungs-Konvention

Format: `Startdatum_Nachname, Vorname_geb. Datum.pdf`

Beispiele:
- `2026-04-01_Mustermann, Max_01.01.1990.pdf`
- `2026-04-01_Mustermann, Lisa_15.05.2015.pdf`

Das Startdatum ist das berechnete Mitgliedschafts-Startdatum (+3 Monate, 1. des Folgemonats).

---

### 6. Export-Integration

**Datei: `src/pages/Index.tsx`**

#### Validierung hinzufügen (vor VIACTIV-Export)

Neue Validierungen für VIACTIV:
- `viactivBonusVertragsnummer` muss ausgefüllt sein
- `viactivBonusIBAN` muss ausgefüllt sein
- `viactivBonusKontoinhaber` muss ausgefüllt sein

#### Export-Aufruf

Nach dem bestehenden VIACTIV BE und Familienversicherung Export:

```typescript
import { exportViactivBonusPDFs } from '@/utils/viactivBonusExport';

// Bonus-PDFs exportieren
const bonusCount = await exportViactivBonusPDFs(formData);
```

#### Toast-Nachricht aktualisieren

Die Toast-Nachricht wird erweitert, um die Anzahl der Bonus-PDFs anzuzeigen:
- "Es werden X Beitrittserklärung(en), Y Familienversicherungs-PDF(s) und Z Bonus-PDF(s) erstellt..."

---

## Export-Szenarien

### Szenario 1: Nur Mitglied (ohne Familienversicherung)
- 1x Beitrittserklärung
- 1x Bonus-Erwachsene (Mitglied)

### Szenario 2: Mit Ehegatte
- 1-2x Beitrittserklärung (je nach Ehegatte-Status)
- 1x Familienversicherung
- 1x Bonus-Erwachsene (Mitglied)
- 1x Bonus je nach Alter (Ehegatte)

### Szenario 3: Mit Ehegatten und Kindern
- 1-2x Beitrittserklärung
- 1+ Familienversicherung
- 1x Bonus-Erwachsene (Mitglied)
- 1x Bonus je nach Alter (Ehegatte)
- Pro Kind: 1x Bonus je nach Alter

---

## Technische Details

### Dateien-Übersicht

| Datei | Aktion |
|-------|--------|
| `public/viactiv-bonus-erwachsene.pdf` | Neu (Template kopieren) |
| `public/viactiv-bonus-kinder.pdf` | Neu (Template kopieren) |
| `src/types/form.ts` | +3 Felder, createInitialFormData erweitern |
| `src/components/ViactivSection.tsx` | +Bonus-Sektion, +Versichertennummer-Felder |
| `src/utils/viactivBonusExport.ts` | Neue Datei |
| `src/pages/Index.tsx` | +Kontoinhaber-Sync, +Validierung, +Export-Integration |

### Abhängigkeiten

Die neue Export-Datei verwendet:
- `pdf-lib` (bereits installiert)
- Bestehende Patterns aus `viactivExport.ts` und `viactivFamilyExport.ts`

