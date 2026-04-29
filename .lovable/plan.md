## Ziel

BIG direkt gesund (Plusbonus) Formular vervollständigen — fehlende UI-Felder ergänzen, irrelevante Felder ausblenden und alle übrigen PDF-AcroFields aus der Vorlage korrekt füllen.

## Probleme & Korrekturen

### 1. Irrelevante Felder bei BIG ausblenden (UI)

Im `MemberSection` werden zurzeit auch bei `big_plusbonus` folgende Felder gerendert, die nicht gebraucht werden:
- Geburtsdatum, Geburtsort, Geburtsland
- KV-Nummer, Name der Krankenkasse
- Familienstand, Telefon, E-Mail

Diese Blöcke werden bei `selectedKrankenkasse === 'big_plusbonus'` ausgeblendet (analog zur bestehenden Novitas-Logik). Validierung in `Index.tsx` für diese Felder bei BIG entfernen (Telefon/Email-Pflicht aus Core-Memory wird hier explizit für BIG aufgehoben, da der Antrag sie nicht enthält).

Adresse (Straße/Hausnr./PLZ/Ort) bleibt sichtbar.

### 2. Fehlende UI-Bereiche in `BigPlusbonusSection`

Folgende neue Eingabeblöcke hinzufügen:

**a) Versicherungsstatus (Neuabschluss / bestehende Zusatzversicherung)**
- Radio-Gruppe: Neuabschluss / bestehende Zusatzversicherung
- Höhe in Euro (Textfeld)

**b) Versicherungsart (Mehrfachauswahl, 4 Checkboxen)**
- private Zusatzversicherung im Sinne von §22 sowie §16
- Berufsunfähigkeitsversicherung
- Unfallversicherung
- Grundfähigkeitsversicherung

**c) "Gilt auch für folgende mitversicherte Angehörige" (bis zu 3 Einträge)**
- Pro Eintrag: Name Vorname + Höhe der Police in Euro
- Add/Remove-Buttons (max. 3)

### 3. Typen erweitern (`src/types/form.ts`)

Im `FormData` ergänzen:
```typescript
bigVersicherungsstatus: 'neuabschluss' | 'bestehend' | '';
bigHoeheEuro: string;
bigVersicherungsarten: {
  privateZusatz: boolean;
  berufsunfaehigkeit: boolean;
  unfall: boolean;
  grundfaehigkeit: boolean;
};
bigMitversicherte: Array<{ nameVorname: string; hoehePolice: string }>; // max 3
```
Defaults in `createInitialFormData` setzen (alle leer/false, leeres Array).

### 4. PDF-Mapping erweitern (`src/utils/bigPlusbonusExport.ts`)

Zusätzliche AcroFields aus der CSV mappen:

| PDF-Feld | Quelle |
|---|---|
| `Neuabschluss` (Checkbox) | `bigVersicherungsstatus === 'neuabschluss'` |
| `bestehende Zusatzversicherung` (Checkbox) | `bigVersicherungsstatus === 'bestehend'` |
| `Euro` (Textfeld) | `bigHoeheEuro` |
| `private Zusatzversicherung im Sinne von  22 sowie  16` (Checkbox) | `bigVersicherungsarten.privateZusatz` |
| `Berufsunfähigkeitsversicherung` (Checkbox) | `bigVersicherungsarten.berufsunfaehigkeit` |
| `Unfallversicherung` (Checkbox) | `bigVersicherungsarten.unfall` |
| `Grundfähigkeitsversicherung` (Checkbox) | `bigVersicherungsarten.grundfaehigkeit` |
| `Name Vorname` / `Höhe der Police in Euro` | `bigMitversicherte[0]` |
| `Name Vorname_2` / `Höhe der Police in Euro_2` | `bigMitversicherte[1]` |
| `Name Vorname_3` / `Höhe der Police in Euro_3` | `bigMitversicherte[2]` |

Hinweis: Feldnamen in der CSV haben Encoding-Eigenheiten (Umlaute, doppelte Spaces "von  22"). Beim `setText`/`setCheck` einen Fallback-Mechanismus einbauen, der mehrere Schreibweisen probiert (mit/ohne Umlaute, einfache vs. doppelte Spaces) — analog zur Encoding-Fallback-Logik in `viactivExport.ts`.

### 5. Validierung & Index-Anpassung

In `Index.tsx` für `big_plusbonus`:
- KV-Nummer/Krankenkasse/Familienstand/Telefon/Email NICHT validieren
- Geburtsdatum bereits ausgeschlossen — bleibt so
- Optional: keine Pflichtvalidierung für Versicherungsstatus/-art/Mitversicherte (User-Wahl, nicht zwingend laut Aufgabe)

## Dateien

| Datei | Änderung |
|---|---|
| `src/types/form.ts` | Neue Felder + Defaults |
| `src/components/MemberSection.tsx` | `big_plusbonus` zu Hide-Conditions hinzufügen (Geburtsdaten, KV/KK, Familienstand/Tel/Email-Block) |
| `src/components/BigPlusbonusSection.tsx` | Neue Blöcke: Neuabschluss/bestehend + Euro, 4 Versicherungsart-Checkboxen, Mitversicherte-Liste |
| `src/utils/bigPlusbonusExport.ts` | Zusätzliche Mappings + Encoding-Fallback-Helper |
| `src/pages/Index.tsx` | Validierung für BIG bereinigen |
| `mem/features/big-plusbonus-integration.md` | Memory aktualisieren (neue Felder + ausgeblendete Bereiche) |

## Hinweise

- Adresse, Geschlecht, Bankdaten, Unterschrift bleiben Pflicht (wie bisher).
- Vorname vor Name bleibt erhalten.
- Keine PII-Persistenz, keine zusätzlichen API-Calls.
