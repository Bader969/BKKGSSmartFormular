## Phase 8 — Bankdaten zentralisieren, FamVers-Filter, Policen-Randomisierung

### 1. EigenePlusbonusBlock — Bankdaten entfernen
`src/components/EigenePlusbonusBlock.tsx`
- Komplettes Grid mit Kontoinhaber V/N, Kreditinstitut, IBAN, BIC, Ort, Datum entfernen.
- Hinweistext ersetzen durch: „Bankdaten/SEPA werden aus dem Hauptantrag (Abschnitt *Zahlungsempfänger\*in*) übernommen und gelten für alle Anträge."
- Beibehalten: Status, Höhe in Euro, Versicherungsarten.

`src/types/form.ts`
- Optional: Feld `bank` in `EigenePlusbonusDaten` als optional kennzeichnen (oder ganz entfernen — wird durch Hauptbank überschrieben).
- `createEmptyEigenePlusbonus`: bank-Defaults bleiben für Abwärtskompatibilität, werden aber nicht mehr verwendet.

`src/utils/bigPlusbonusExport.ts`
- `buildPlusbonusPdfsForPerson`: `bank` immer aus `formData.bigBank` lesen (Override entfernen).
- Plusbonus-Unterschrift (alle PDFs inkl. Ehegatte/Kinder mit eigener Mitgliedschaft) wird aus `formData.bigBank.kontoinhaberNachname` erzeugt — eine einzige Signatur, zentral.
- Override-Parameter und `personSignatureDataUrl` entfernen.

### 2. Mitversicherte-Namensfeld nicht für eigene Mitgliedschaften
`src/pages/Index.tsx` (Auto-Sync von `bigMitversicherte`) und/oder `BigPlusbonusSection`:
- Beim Aufbau/Sync der Liste „Gilt auch für folgende mitversicherte Angehörige" Personen mit `eigeneMitgliedschaft === true` ausschließen (Ehegatte + Kinder).
- Falls die Liste manuell befüllt wird: beim Wechsel auf eigene Mitgliedschaft entsprechende Mitversicherten-Einträge automatisch entfernen.
- Mitversicherte sind ausschließlich Familienversicherte.

### 3. Höhe der Police — Random 200–245 + Auto-Summe
`src/utils/bigRandom.ts` (neu, klein):
- `randomPoliceBetrag(): string` → ganzzahlig zwischen 200 und 245, formatiert als `"NNN"` (oder `"NNN,00"` — siehe offene Frage unten; defaultmäßig ohne Nachkommastellen, deutsche Komma-Schreibweise konsistent zur bestehenden „Höhe in Euro").

`src/components/BigPlusbonusSection.tsx`
- Beim `addMitversichert`: Initialwert `hoehePolice = randomPoliceBetrag()` statt leer.
- Bei bestehenden Einträgen mit leerem Wert beim Mount/Sync automatisch befüllen.

`src/pages/Index.tsx` (neuer `useEffect` für BIG):
- Sobald `bigMitversicherte` ändert oder bigBlock aktiv ist:
  - Summiere alle nummerisch geparsten `hoehePolice` der Mitversicherten.
  - Addiere eine weitere Zufallszahl `randomPoliceBetrag()` (für das Mitglied selbst) — stabil persistiert in neuem Feld `bigHoeheEuroSelfRandom`, damit sich der Wert nicht bei jedem Render ändert.
  - Schreibe Gesamt in `formData.bigHoeheEuro` (z. B. `"895"`).
- `bigHoeheEuroSelfRandom` initial einmalig setzen, wenn leer.

### 4. Memory-Update
`mem/features/big-direkt-integration.md`
- SEPA-Bankdaten: zentral aus Hauptantrag, eine Unterschrift, gilt für alle Plusbonus-PDFs (Mitglied, Ehegatte, Kinder).
- Mitversicherte-Liste: nur Familienversicherte.
- Policenhöhen: Random 200–245 je Position; Gesamtsumme automatisch in „Höhe in Euro" inkl. Eigenanteil.

### Offene Frage
Soll der Zufallswert eine **ganze Zahl** (210, 215, 225 …) sein, oder mit Nachkommastellen (z. B. 217,43 €)? Dein Beispiel `210 + 215 + 225 + 245 = 895` deutet auf ganze Zahlen — ich plane mit ganzen Zahlen, sag Bescheid, falls anders gewünscht.

### Geänderte Dateien
- `src/components/EigenePlusbonusBlock.tsx`
- `src/components/BigPlusbonusSection.tsx`
- `src/utils/bigPlusbonusExport.ts`
- `src/utils/bigRandom.ts` (neu)
- `src/types/form.ts`
- `src/pages/Index.tsx`
- `mem/features/big-direkt-integration.md`
