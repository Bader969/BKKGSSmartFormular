# BIG Plusbonus – eigene Anträge für Ehegatte/Kinder mit eigener Mitgliedschaft

## Ziel
Wenn in Variante B (`bigFamilienversicherung = true`) der Ehegatte oder ein Kind `eigeneMitgliedschaft = true` hat, wird zusätzlich zum FamVers-Antrag des Mitglieds **ein eigener Plusbonus-Antrag pro solcher Person** erzeugt. SEPA bleibt über alle Anträge identisch. Neue Dateinamen-Konvention für Plusbonus-Anträge.

## Verhalten

1. **Mitglieds-Plusbonus** (bestehend): wird wie bisher erzeugt – Status/Art/Mitversicherte aus dem Hauptformular.
2. **Pro Ehegatte mit `eigeneMitgliedschaft`**: eigener Plusbonus-Antrag. Person als Antragsteller (Vorname/Name/Geburtsdatum/Geschlecht). Adresse = Mitglieds-Adresse. SEPA, Versicherungsstatus, `bigHoeheEuro`, `bigVersicherungsarten`, `bigMitversicherte` werden vom Hauptantrag **übernommen** (gleiche Chunk-Logik bei >3 Mitversicherten).
3. **Pro Kind mit `eigeneMitgliedschaft`**: analog. Adresse vom Mitglied. Geschlecht: Mapping `m→maennlich`, `w→weiblich`, `d→divers`.
4. **SEPA-Mandat-Daten** (`formData.bigBank`, inkl. Kontoinhaber, IBAN, BIC, Kreditinstitut, Ort, Datum) sind in **jedem** generierten Plusbonus-Antrag identisch.
5. **Unterschrift im Plusbonus** der Person: weiterhin Mitglieds-Unterschrift (Kontoinhaber). Keine separate Person-Unterschrift im Plusbonus-PDF.

## Datei-Benennung Plusbonus (neu für **alle** Plusbonus-PDFs)

Format: `Antrag Plusbonus-interaktiv-{Versicherungsbeginn TT.MM.JJJJ}, {Vorname} {Nachname}, {Geburtsdatum TT.MM.JJJJ}.pdf`

- **Versicherungsbeginn** = `getBeginDate()` (heutiger Monat + 3, 1. des Monats) – globale Logik, gleich für alle Anträge.
- **Vorname/Nachname/Geburtsdatum** = die jeweilige Antragsperson (Mitglied bzw. Ehegatte bzw. Kind).
- Bei >3 Mitversicherten Chunks: `… (Teil N).pdf` als Suffix vor `.pdf`.
- Gilt auch in Variante A (nur Mitglied), damit es eine einheitliche Konvention gibt.

## Technische Umsetzung

### `src/utils/bigPlusbonusExport.ts`
- Neue interne Funktion `buildPlusbonusPdfs(formData, antragsperson)` mit `antragsperson = { vorname, name, geburtsdatum, geschlecht: 'maennlich'|'weiblich'|'divers', strasse, hausnummer, plz, ort }`. Erzeugt 1..N PDFs (Chunk-Logik bleibt).
- Bestehende Felder-Befüllung (Name/Vorname/Adresse/Geschlecht) liest aus `antragsperson` statt direkt aus `formData.mitglied*`. SEPA/Status/Art/Mitversicherte/Unterschrift bleiben aus `formData`.
- Neue Filename-Funktion:
  ```
  const beginnStr = formatDateGerman(getBeginDate());        // "01.09.2026"
  const gebStr    = toGerman(antragsperson.geburtsdatum);    // "TT.MM.JJJJ" oder "" wenn leer
  `Antrag Plusbonus-interaktiv-${beginnStr}, ${vorname} ${name}, ${gebStr}${suffix}.pdf`
  ```
- `exportBigPlusbonus(formData)` ruft `buildPlusbonusPdfs` zuerst für das Mitglied auf. In Variante B zusätzlich für jeden Ehegatten/jedes Kind mit `eigeneMitgliedschaft === true`. Reihenfolge: Mitglied → Ehegatte → Kinder.
- Kinder-Geschlecht: `kind.geschlecht` (`m|w|d`) → maennlich/weiblich/divers.

### `src/pages/Index.tsx`
- Keine Order-Änderung. Beim Export-Aufruf nichts zu ändern (Funktion bleibt einheitlich).
- Validierung: Pflichtfeld-Check für Person mit eigener Mitgliedschaft (Vorname, Name, Geburtsdatum, Geschlecht) – bereits durch bestehende FamVers-Validierung abgedeckt.
- `pdfCount` für Toast: anpassen, sodass Mitglieds-Chunks + pro „eigene Mitgliedschaft"-Person die jeweilige Chunk-Anzahl addiert wird (gleiche Chunk-Größe, da Mitversicherte identisch).

### `mem/features/big-direkt-integration.md`
- Abschnitt aktualisieren: neue Filename-Konvention (Plusbonus überall), Regel „eigene Mitgliedschaft → eigener Plusbonus", SEPA identisch über alle Anträge.

## Nicht im Scope
- Keine Änderungen an FamVers-Export, FamVers-Dateinamen, UI, oder Validation-Logik außerhalb des oben Genannten.
