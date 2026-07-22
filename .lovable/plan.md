## Ziel

Bei Novitas BKK soll — analog zur bereits vorhandenen Split-Logik in `novitasSplit.ts` — der **Beschäftigungsstatus** direkt im UI wählbar sein, und wenn das Hauptmitglied „Arbeitslos (Jobcenter)" ist, dürfen **Ehegatte** und **Kinder älter als 15 Jahre** (Alter ≥ 16) **nicht** mehr in den Familienversicherungs-PDF-Antrag geschrieben werden — sie bekommen stattdessen jeweils einen eigenen Novitas-Online-Antrag via Autofill.

## Aktueller Stand (verifiziert)

- `splitNovitasPersons` (in `src/utils/novitasSplit.ts`) markiert Ehegatte + Kinder ≥ 16 bereits als `ownMembership: true`, wenn `deriveNovitasStatus(formData.viactivBeschaeftigung) === 'Arbeitslose_r_Jobcenter'`.
- Für jede dieser Personen wird in `src/pages/Index.tsx` bereits ein eigener `NovitasEmployerBank`-Block gerendert und ein eigener Autofill-Payload gebaut (`novitasAutofillPayload.ts`).
- **Aber:** Der Beschäftigungsstatus des Hauptmitglieds wird bei Novitas nirgends im UI abgefragt (das Feld `viactivBeschaeftigung` wird nur in `ViactivSection` gerendert, die nur bei Viactiv erscheint). Bei Novitas bleibt der Wert dadurch leer, `deriveNovitasStatus` liefert `''`, und die Split-Regel greift nie.
- **Und:** `src/utils/novitasExport.ts` schreibt Ehegatte und alle Kinder unabhängig von `ownMembership` in die Familienversicherungs-PDF — Kinder ≥ 16 und der Ehegatte tauchen aktuell doppelt auf (im FV-PDF *und* im eigenen Online-Antrag).

## Änderungen

### 1) Neue UI-Sektion für Novitas: Beschäftigungsstatus Hauptmitglied
`src/pages/Index.tsx` — im Novitas-Block (dort wo Modus/Bonus/`NovitasEmployerBank` gerendert werden) einen `FormField type="select"` einfügen:
- Label: „Beschäftigungsstatus Hauptmitglied"
- Optionen: `beschaeftigt` (Pflichtversicherter Arbeitnehmer), `ausbildung` (Auszubildender), `al_geld_2` (Arbeitslos – Jobcenter), `al_geld_1` (Arbeitslos – Agentur für Arbeit)
- Bindet an das bestehende Feld `formData.viactivBeschaeftigung` (Feld wird also für Novitas wiederverwendet — keine neue Form-Property nötig).
- Nur sichtbar wenn `selectedKrankenkasse === 'novitas'` **und** `novitasMode === 'familie'` (bei Einzelbeitritt kein Split-Effekt).

### 2) Beschäftigungsstatus pro Kind ≥ 15 im Novitas-Familienmodus
`src/components/ChildrenSection.tsx` — den bereits existierenden Beschäftigungs-Selector (aktuell nur für BIG) zusätzlich rendern, wenn `selectedKrankenkasse === 'novitas'`, `novitasMode === 'familie'`, Hauptmitglied ist Jobcenter (`viactivBeschaeftigung === 'al_geld_2'`) und Alter des Kindes ≥ 16. Darunter ein Hinweistext:
- „Kind ≥ 16 bei Jobcenter-Hauptversichertem → eigene Mitgliedschaft, wird über den Novitas-Online-Antrag ausgefüllt (nicht in die Familienversicherung)."

### 3) Ehegatte-Hinweis in `SpouseSection`
Bei Novitas + `viactivBeschaeftigung === 'al_geld_2'` einen analogen Hinweis unter dem bestehenden Ehegatte-Beschäftigungsfeld anzeigen: „Eigene Mitgliedschaft (Jobcenter-Regel) — wird nicht in die Familienversicherungs-PDF aufgenommen."

### 4) `novitasExport.ts` — eigene Mitgliedschaften aus FV-PDF ausschließen
`src/utils/novitasExport.ts` in der Familienversicherungs-Erzeugung:
- `splitNovitasPersons(formData)` aufrufen.
- Setzen des Ehegatten-Blocks überspringen, wenn der Ehegatte in der Split-Liste `ownMembership: true` hat.
- Kinderliste vor dem 3er-Chunking filtern: nur Kinder behalten, deren zugehöriger `NovitasPerson` **nicht** `ownMembership: true` ist. Bleiben 0 Kinder und Ehegatte ist ausgeschlossen, weiterhin genau 1 PDF (nur Hauptmitglied) erzeugen.

### 5) Validierung / Toasts
`src/pages/Index.tsx` Novitas-Validierung erweitern:
- Wenn `novitasMode === 'familie'`: `viactivBeschaeftigung` ist Pflichtfeld.
- Bereits vorhandene Pflichtprüfung für Arbeitgeber+Arbeitsentgelt+Bank läuft weiter pro `ownMembership`-Person (bereits durch das dynamische Rendering abgedeckt).

## Technische Details

- Kein neues Schema/Feld — `viactivBeschaeftigung` wird bereits von `deriveNovitasStatus` gelesen, deshalb kein Rename.
- Alterslogik bleibt bei ≥ 16 (= „über 15 Jahre alt"), Quelle ist die bestehende `ageInYears`-Funktion in `novitasSplit.ts`.
- Keine Änderungen an `novitasAutofillPayload.ts` oder am Bookmarklet nötig — die Person-Splitting-Logik dort greift automatisch, sobald der Status gesetzt ist.
- Auditlog: `viactivBeschaeftigung` ist bereits Teil von `FormData` und wird beim Speichern mitgeschrieben — keine Zusatzarbeit nötig.

## Nicht Teil dieses Plans

- Änderungen an anderen Kassen (BIG, VIACTIV, DAK, BKK GS).
- Umbenennung `viactivBeschaeftigung` → generisches Feld (aus Konsistenzgründen und um Migrationen zu vermeiden bewusst weggelassen).
- Änderungen am WhatsApp-/E-Mail-Versand.
