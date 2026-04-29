## Ziel

Neue Krankenkasse **"BIG direkt gesund (Plusbonus)"** als zusätzliche Option im Krankenkassen-Dropdown integrieren. Eigenes Formular mit minimalem Eingabe-Set + PDF-Export gegen die hochgeladene Vorlage `Antrag_Plusbonus-interaktiv-_2026-2.pdf`.

## Pflichtfelder (laut Anforderung)

Mitglied:
- Vorname, Name, Straße, Hausnummer, PLZ, Ort
- Geschlecht (männlich / weiblich / divers)

Zahlungsempfänger*in (Bankdaten):
- Kontoinhaber*in
- Kreditinstitut
- IBAN
- BIC
- Ort (für Unterschrift Bankdaten)
- Datum (TTMMJJ)
- **Unterschrift Kontoinhaber** — auf der gleichen Ebene wie das Datum

Mitglieds-Daten werden aus der bereits existierenden `MemberSection` wiederverwendet (Vorname, Name, Adresse). Geschlecht und Bankdaten kommen in einer neuen `BigPlusbonusSection`. Für die Unterschrift wird die bereits erfasste Mitglieds-Unterschrift wiederverwendet (gleicher Pad wie alle anderen KK).

## Field-Mapping (CSV → PDF AcroFields)

Aus `Antrag_Plusbonus-interaktiv-_2026-fields-2.csv` ergibt sich folgendes Mapping (alle relevanten Felder befinden sich auf Seite 1):

| PDF-Feld | Quelle FormData |
|---|---|
| `männlich` / `weiblich` / `divers` (Checkbox) | `bigGeschlecht` |
| `Name` | `mitgliedName` |
| `Vorname` | `mitgliedVorname` |
| `Straße` | `mitgliedStrasse` |
| `Hausnummer` | `mitgliedHausnummer` |
| `PLZ` | `mitgliedPlz` |
| `Ort` | `ort` |
| `Kontoinhaberin` | `bigBank.kontoinhaber` |
| `Kreditinstitut` | `bigBank.kreditinstitut` |
| `IBAN Internationale Bankkontonummer` | `bigBank.iban` |
| `BIC` | `bigBank.bic` |
| `Ort_2` | `bigBank.ort` |
| `Datum TTMMJJ` | `bigBank.datum` (TTMMJJ-Format) |
| `Signatur16` | Mitglieds-Unterschrift als Bild (selbe Ebene wie `Datum TTMMJJ`) |

**Optional/automatisch leer gelassen** (laut Anforderung nicht Pflicht, daher nicht erfasst und nicht ausgefüllt):
- `Beginn der Mitgliedschaft möglich`, `undefined`
- `Neuabschluss` / `bestehende Zusatzversicherung`, `Euro`, `Name Vorname*`, `Höhe der Police*`
- Alle Versicherungstyp-Checkboxes (`private Zusatzversicherung…`, `Berufsunfähigkeitsversicherung`, `Unfallversicherung`, `Grundfähigkeitsversicherung`)
- `Ort_3`, `Datum TTMMJJ_2`, `Signatur17` (zweiter Unterschriftsblock unten — nicht angefordert)

## Umsetzungsschritte

1. **PDF-Vorlage einbinden**
   - `user-uploads://Antrag_Plusbonus-interaktiv-_2026-2.pdf` → `public/big-plusbonus.pdf` kopieren.

2. **Typen erweitern** (`src/types/form.ts`)
   - Krankenkasse-Typ: `'big_plusbonus'` ergänzen, in `KRANKENKASSEN_OPTIONS` neuen Eintrag `{ value: 'big_plusbonus', label: 'BIG direkt gesund (Plusbonus)' }`.
   - Neuer Typ `BigGeschlecht = 'maennlich' | 'weiblich' | 'divers' | ''`.
   - Neues Interface `BigBankDaten { kontoinhaber, kreditinstitut, iban, bic, ort, datum }` + `createEmptyBigBankDaten()`.
   - `FormData` um `bigGeschlecht: BigGeschlecht` und `bigBank: BigBankDaten` erweitern; Defaults in `createInitialFormData` setzen (Datum = heute im TTMMJJ-Format, Ort = leer, Kontoinhaber = `Vorname Name` Sync analog Bonus-Logik).

3. **Neue UI-Komponente** `src/components/BigPlusbonusSection.tsx`
   - Abschnitt "Geschlecht" (Radio: männlich / weiblich / divers).
   - Abschnitt "Zahlungsempfänger*in": Kontoinhaber, Kreditinstitut, IBAN, BIC, Ort, Datum (date input).
   - Hinweis: Unterschrift = Mitglieds-Unterschrift aus `SignatureSection`.

4. **Index integrieren** (`src/pages/Index.tsx`)
   - `getHeaderTitle` / `getHeaderSubtitle`: Fall `big_plusbonus` → "BIG direkt gesund Formular" / "BIG direkt gesund – Plusbonus".
   - Im Sektionen-Block: bei `selectedKrankenkasse === 'big_plusbonus'` die `MemberSection` (existierend) + neue `BigPlusbonusSection` + `SignatureSection` rendern (keine Ehegatte/Kinder).
   - Validierung: Vorname, Name, Strasse, Hausnummer, PLZ, Ort, `bigGeschlecht`, alle 6 Bankfelder, Unterschrift.
   - Export-Branch: `await exportBigPlusbonus(formData)` + Toast.

5. **Export-Utility** `src/utils/bigPlusbonusExport.ts`
   - Lädt `/big-plusbonus.pdf` via pdf-lib, holt Form, setzt Textfelder & Checkboxen wie im Mapping oben.
   - Datum in TTMMJJ-Format konvertieren (Helper).
   - Unterschrift als PNG-Bild via `embedPng` einbetten und positioniert über das `Signatur16`-Widget legen (`x≈301, y≈407, w≈261, h≈12` — Koordinaten aus CSV; pdf-lib Y ist von unten gemessen → `pageHeight - top - height` umrechnen, analog `dakExport.ts`).
   - `form.flatten()` und Download als `BIG-Plusbonus_<Nachname>_<Vorname>.pdf`.

6. **Header-Label-Memory** aktualisieren falls nötig (Core-Memory bereits abgedeckt durch dynamische Header).

## Dateien

| Datei | Änderung |
|---|---|
| `public/big-plusbonus.pdf` | NEU (Kopie der Vorlage) |
| `src/types/form.ts` | Typen + Defaults |
| `src/components/BigPlusbonusSection.tsx` | NEU |
| `src/utils/bigPlusbonusExport.ts` | NEU |
| `src/pages/Index.tsx` | Dropdown-Eintrag, Header, Render-Branch, Validierung, Export-Aufruf |

## Hinweise

- Keine PII-Speicherung, keine zusätzlichen Krankenkassen-spezifischen Imports — folgt bestehendem Pattern (VIACTIV/DAK/Novitas).
- Vorname steht weiterhin vor Name (Core-Memory eingehalten).
- Pflichtkontakte (Telefon/Email) sind per Core-Memory mandatorisch — werden hier ebenfalls validiert.
