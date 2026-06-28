## BIG direkt — UI/Logic Anpassungen

### 1. Reihenfolge der Abschnitte (Variante zuerst)
- In `src/pages/Index.tsx` für Provider `big_plusbonus` den Abschnitt **„Antrags-Variante"** (Toggle `bigFamilienversicherung`) als **ersten** Block rendern — vor `MemberSection`, `SpouseSection`, `ChildrenSection`, `BigPlusbonusSection`, `SignatureSection`.
- Dazu `BigPlusbonusSection` aufsplitten: ein neuer kleiner Block **`BigVarianteSection`** (nur der Toggle) wird ganz oben gerendert; der Rest von `BigPlusbonusSection` (Geschlecht, Versicherungsstatus, Versicherungsart, Mitversicherte, Bank) bleibt an seiner aktuellen Position unten.
- Variante A (Toggle aus): Reihenfolge → Variante → Member → BigPlusbonus → Signatur (Spouse/Children ausgeblendet, wie heute).
- Variante B (Toggle an): Variante → Member (volle Felder) → Spouse → Children → BigPlusbonus → Signatur.

### 2. „Mitversicherte Angehörige" — unbegrenzt + Multi-PDF Split
- Limit von 3 in `BigPlusbonusSection` entfernen (Button immer sichtbar, keine `>= 3` Sperre, keine „max. 3" im Titel).
- In `src/utils/bigPlusbonusExport.ts`: Wenn mehr als 3 Mitversicherte vorhanden → **mehrere Plusbonus-PDFs** generieren, jeweils mit max. 3 Mitversicherten (Felder `Name Vorname` / `_2` / `_3` und `Höhe der Police in Euro` / `_2` / `_3`). Alle anderen Mitglieds-/Bank-/Versicherungsdaten in jedem Teil identisch.
- Dateiname-Schema analog Novitas/BIG-FamVers: `BIG-Plusbonus_Name_Vorname (Teil 1).pdf`, `(Teil 2).pdf`, … nur wenn >3; bei ≤3 unverändert ohne Suffix.

### 3. Auto-Fill der Mitversicherten bei Variante B
- Wenn `bigFamilienversicherung === true`, werden die Namenfelder automatisch aus Ehegatte + Kindern befüllt (in der Reihenfolge: Ehegatte zuerst, dann Kinder 1..N). Fehlt der Ehegatte (kein Name/Vorname vorhanden) → Liste besteht nur aus Kindern.
- Format pro Eintrag: `"Nachname, Vorname"` (leere Einträge übersprungen).
- Verhalten: Die Auto-Fill-Liste **überschreibt** das `bigMitversicherte`-Array, solange Variante B aktiv ist und sich Ehegatte/Kinder-Namen ändern; `hoehePolice` bleibt manuell editierbar und wird beim Sync für vorhandene Einträge an gleicher Position beibehalten.
- Implementiert via `useEffect` in `Index.tsx` (oder in `BigPlusbonusSection`) mit Abhängigkeiten auf Ehegatten-/Kindernamen und `bigFamilienversicherung`.
- Wenn der Toggle wieder auf A wechselt, bleibt der zuletzt gesyncte Stand stehen (manuell editierbar).

### 4. SEPA — Kreditinstitut & BIC optional
- In `BigPlusbonusSection`: `required` von `Kreditinstitut` und `BIC` entfernen.
- In `src/utils/validation.ts` (BIG-Block) die Pflichtprüfung für `bigBank.kreditinstitut` und `bigBank.bic` entfernen. `kontoinhaber`, `iban`, `ort`, `datum` bleiben Pflicht.

### 5. Memory-Update
- `mem/features/big-direkt-integration.md`: Reihenfolge der Abschnitte, „Mitversicherte unbegrenzt + Multi-PDF Split (>3 → Teil 1/2/…)", Auto-Fill-Regel aus Familie (Ehegatte zuerst, dann Kinder), neue Pflichtfeld-Liste SEPA (ohne Kreditinstitut/BIC) ergänzen. Alte „max. 3"-Aussage entfernen.

### Betroffene Dateien
- `src/components/BigPlusbonusSection.tsx` (Split + Limit weg + required weg)
- neu: kleiner `BigVarianteSection` (oder Export des Toggle-Blocks aus obiger Datei)
- `src/pages/Index.tsx` (Render-Reihenfolge + Auto-Fill-Effect)
- `src/utils/bigPlusbonusExport.ts` (Multi-PDF Chunking + Filename-Suffix)
- `src/utils/validation.ts` (SEPA-Pflichtfelder anpassen)
- `mem/features/big-direkt-integration.md`
