## Ziel
Die Versichertennummer/KVNR soll nach OCR-Extraktion und JSON-Import zuverlässig im richtigen UI-Feld landen:
- Hauptmitglied: `mitgliedKvNummer` und synchron `mitgliedVersichertennummer`
- Ehegatte: `ehegatte.versichertennummer`
- Kinder: `kinder[n].versichertennummer`

Wichtig: Eine OCR kann fachlich nie mathematisch „100 % garantieren“, aber ich baue Schutzmechanismen ein, damit erkannte Nummern nicht mehr durch falsche JSON-Feldnamen, Formatierung oder Mapping verloren gehen und ungültige/fehlende Nummern sichtbar auffallen.

## Umsetzung
1. **Zentrale Nummern-Normalisierung einführen**
   - Neue Utility-Funktion für Versichertennummern/KVNR:
     - Leerzeichen, Bindestriche, Doppelpunkte entfernen
     - Großschreibung erzwingen
     - typische OCR-Verwechslungen in Nummernstellen korrigieren, z. B. `O → 0`, `I/l → 1`, `S → 5`, sofern passend
     - deutsches Format bevorzugen: `1 Buchstabe + 9 Ziffern`
   - Alias-Felder einsammeln, z. B. `kvnr`, `kvNummer`, `versichertennummer`, `versicherungsnummer`, `mitgliedsnummer`, `krankenversichertennummer`.

2. **OCR-Edge-Funktion härten**
   - Prompt und JSON-Schema für alle Krankenkassen ergänzen:
     - Hauptmitglied immer als `mitgliedKvNummer`
     - Ehegatte/Kinder immer als `versichertennummer`, wenn ein eigenes Kartenbild/eine eigene eGK vorhanden ist
   - Besonders bei BIG: Schema aktuell erwähnt Familien-KVNR im Prompt, enthält aber keine `versichertennummer`-Felder für Ehegatte/Kinder. Das wird ergänzt.
   - Nach der KI-Antwort serverseitig normalisieren, bevor die Daten an die UI zurückgehen.
   - Wenn eine Nummer im falschen Alias-Feld kommt, wird sie in das richtige Feld verschoben.

3. **JSON-Import korrigieren**
   - Beide Importwege vereinheitlichen:
     - Dokument/OCR-Import
     - manueller JSON-Import
     - Freitext-Import
   - Vor `setFormData` immer die zentrale Normalisierung anwenden.
   - Danach erst krankenkassenspezifisches Mapping ausführen.
   - `mitgliedKvNummer` wird immer zusätzlich nach `mitgliedVersichertennummer` synchronisiert.

4. **Mapping absichern**
   - `applyKrankenkassenMapping` so erweitern, dass es nicht nur exakt `versichertennummer` akzeptiert, sondern auch Alias-Felder.
   - Bestehende Werte werden nur überschrieben, wenn die neue Nummer gültig/normalisierbar ist oder das aktuelle Feld leer ist.
   - Vorname/Name-Reihenfolge bleibt unverändert.

5. **UI-Feedback bei fehlender oder ungültiger Nummer**
   - Nach OCR/Import eine klare Warnung anzeigen, wenn:
     - eine eGK/KVNR erwartet wurde, aber keine gültige Nummer importiert werden konnte
     - eine Nummer ungültig wirkt und deshalb nicht sicher übernommen wurde
   - Keine stillen Fehler mehr: Der Nutzer sieht sofort, welche Person geprüft werden muss.

6. **Validierung angleichen**
   - `validateKvNummer` und `validateVersichertennummer` nutzen dieselbe Normalisierung.
   - Eingaben mit Leerzeichen oder kleinen Buchstaben werden akzeptiert und sauber validiert.

7. **Gezielte Tests/Prüfung**
   - Testfälle für typische Importvarianten:
     - `mitgliedKvNummer: "a 123 456 789"`
     - `kvnr: "A-123-456-789"`
     - `ehegatte.mitgliedsnummer`
     - `kinder[0].versicherungsnummer`
     - OCR-Verwechslungen wie `A12345O789`
   - Sichtprüfung: Importdaten landen in den richtigen UI-Feldern für Hauptmitglied, Ehegatte und Kinder.

## Technische Details
Betroffene Dateien voraussichtlich:
- `supabase/functions/process-insurance-gemini3/index.ts`
- `src/utils/krankenkassenMapping.ts`
- `src/components/JsonImportDialog.tsx`
- `src/components/FreitextImportDialog.tsx`
- `src/utils/validation.ts`
- optional neue Utility-Datei, z. B. `src/utils/insuranceNumbers.ts`

## Ergebnis
Nach der Änderung gehen erkannte Versichertennummern/KVNR nicht mehr verloren, nur weil die KI oder ein JSON-Import andere Feldnamen/Formatierungen liefert. Fehlende oder unsichere Nummern werden aktiv gemeldet statt unbemerkt leer zu bleiben.