## Ziel
BIG direkt gesund (Variante B = Plusbonus + Familienversicherung) soll abhängig vom Beschäftigungsstatus des Hauptmitglieds entscheiden, ob Ehegatte/Kinder familienversichert oder eigenständig versichert werden, und für eigenständig Versicherte separate Plusbonus-Anträge erzeugen.

## Neue Felder & UI

### 1. Beschäftigungs-Frage (Hauptmitglied) — neu
- Neues Feld `bigMitgliedBeschaeftigt: 'beschaeftigt' | 'arbeitslos' | ''` in `FormData` (Default `''`).
- UI: in `BigPlusbonusSection` (mode `'variante'`), direkt unter dem FamVers-Toggle und nur sichtbar wenn `bigFamilienversicherung = true`. Radio-Frage:
  - „Ist das Hauptmitglied beschäftigt (SGB I, AfA-Leistungsbezieher) oder arbeitslos (SGB II, Jobcenter)?"
  - Optionen: „Beschäftigt" / „Arbeitslos".
- Pflichtfeld in Validation, sobald Variante B aktiv ist.

### 2. Eigene Mitgliedschaft für Kinder — fehlt bisher
- In `ChildrenSection` (für BIG, Variante B) Checkbox „Eigene Mitgliedschaft" pro Kind ergänzen (analog VIACTIV `ViactivSection`). Schreibt auf `kind.eigeneMitgliedschaft`.
- Ehegatte erhält keinen sichtbaren Toggle; sein Status wird ausschließlich vom Beschäftigungsstatus abgeleitet (s. u.).

### 3. Auto-Sync abhängig vom Beschäftigungsstatus
Neuer `useEffect` in `Index.tsx` (nur BIG, Variante B):
- `beschaeftigt` → setze für Ehegatte und alle Kinder: `eigeneMitgliedschaft = false`, `bisherigArt = 'familienversicherung'`.
- `arbeitslos` → setze für Ehegatte und alle Kinder: `eigeneMitgliedschaft = true`, `bisherigArt = 'mitgliedschaft'`.
- Sync greift bei Statuswechsel und beim Hinzufügen neuer Kinder.

## Export-Anpassungen

### `src/utils/bigFamversExport.ts`
- Kinder mit `eigeneMitgliedschaft === true` werden aus dem FamVers-PDF entfernt (vor `slice`-Chunking):
  - `const eligibleChildren = (formData.kinder || []).filter(k => !k.eigeneMitgliedschaft);`
- Ehegatte bleibt in JEDEM Fall im FamVers-PDF eingetragen (auch bei eigener Mitgliedschaft) — keine Filterung.
- Chunk-/Teil-Logik basiert dann auf `eligibleChildren`.

### `src/utils/bigPlusbonusExport.ts`
- Bestehende Schleife für eigene Plusbonus-PDFs (Ehegatte/Kind mit `eigeneMitgliedschaft || bisherigArt === 'mitgliedschaft'`) bleibt unverändert; sie greift jetzt korrekt via Auto-Sync für beide Fälle.

### `src/pages/Index.tsx` — PDF-Anzahl-Anzeige
- Counter für „Familienvers."-PDFs muss jetzt nur familienversicherte Kinder zählen (`kinder.length - kinderMitEigenerMitgliedschaft`) — bereits so vorhanden, prüfen/anpassen.

## Validation
- Bei BIG Variante B: `bigMitgliedBeschaeftigt` Pflicht.
- Keine weiteren Pflichtfeld-Änderungen (Ehegatte bleibt voll erforderlich, Kinder ebenso).

## Reihenfolge & Datei-Outputs (Variante B, arbeitslos, Beispiel: Ehegatte + 2 Kinder)
1. Plusbonus Mitglied (mit Mitversicherten).
2. Plusbonus Ehegatte (eigene Mitgliedschaft).
3. Plusbonus Kind 1, Plusbonus Kind 2.
4. Zusammenfassung_Familienversicherung: enthält Ehegatte + 0 Kinder (alle Kinder ausgefiltert).

Bei „beschäftigt": nur (1) Plusbonus Mitglied + (4) FamVers mit Ehegatte + allen Kindern.

## Betroffene Dateien
- `src/types/form.ts` — Feld `bigMitgliedBeschaeftigt`.
- `src/components/BigPlusbonusSection.tsx` — Radio in `varianteBlock`.
- `src/components/ChildrenSection.tsx` — Checkbox „Eigene Mitgliedschaft" für BIG.
- `src/pages/Index.tsx` — Auto-Sync `useEffect` + Validation.
- `src/utils/bigFamversExport.ts` — Kinder-Filter `!eigeneMitgliedschaft`.
- `mem/features/big-direkt-integration.md` — Memory-Update zu neuer Logik.