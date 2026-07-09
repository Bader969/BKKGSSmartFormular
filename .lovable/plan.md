## Fixes für VIACTIV — Arbeitgeber + Kinder-BE + WhatsApp

### 1) Arbeitgeber-Felder werden nicht vollständig in die BE geschrieben

Ursache in `src/utils/viactivExport.ts` → `resolveArbeitgeber` / `resolveArbeitgeberForSpouse`:
Sobald `viactivBeschaeftigung === "al_geld_2"` (oder `"al_geld_1"`) gesetzt ist, überschreibt der Fallback **immer** die vom User eingetragenen Arbeitgeberdaten. Ergebnis: `Name` wird pauschal auf `"Jobcenter"` gesetzt (statt „Jobcenter Kiel"), `Straße`/`Hausnummer` gehen verloren, `PLZ`/`Ort` werden mit `mitgliedPlz`/`ort` überschrieben — auch wenn im UI (Screenshot 1) explizit „Postfach / 7007 / 24170 / Kiel" eingetragen wurde.

Fix:
- `resolveArbeitgeber` / `resolveArbeitgeberForSpouse` umbauen zu einem **Merge**: User-Eingaben (`viactivArbeitgeber.*`) haben Vorrang; die ALG-Defaults (`"Jobcenter"` bzw. `"Agentur für Arbeit"` und `mitgliedPlz`/`ort`) füllen **nur leere Felder**.
- Gilt für alle vier BE-Varianten (Mitglied, Ehegatte, Kind — siehe Punkt 2).

### 2) Kind-BE (≥15, eigene Mitgliedschaft) — Arbeitgeber vom Hauptantragsteller übernehmen

In `createViactivBeitrittserklaerungForChild` fehlen aktuell:
- Beschäftigungsstatus-Checkboxen
- Arbeitgeber-Textfelder

Neu (analog zur Ehegatten-Logik):
- Wenn Kind eigene Mitgliedschaft hat, wird der **Beschäftigungsstatus des Hauptantragstellers** (`formData.viactivBeschaeftigung`) auf das Kind angewendet (alle Checkboxen: `Ich bin beschäftigt`, `ich beziehe AL-Geld I`, `ich beziehe AL-Geld II`, `ich studiere`, `Ich bin in Ausbildung`, `Minijob`, `selbstständig`, `rente`, `freiwillig_versichert`, `einkommen_ueber_grenze`).
- Arbeitgeberdaten werden über dieselbe (in Punkt 1 gefixte) `resolveArbeitgeber(formData)` gezogen und in `Name des Arbeitgebers`, `Arbeitgeber Straße/Hausnummer/PLZ/Ort`, `Beschäftigt seit` geschrieben.
- Familienstand bleibt `ledig`; bisherige Versicherung bleibt `familienversichert`.

### 3) WhatsApp-Versand: bei VIACTIV die BE senden statt „Zusammenfassung_Mitgliedsantrag"

In `src/components/SendEmailDialog.tsx` → `handleSend` (WhatsApp-Block):
- Aktuell wird der Anhang gesucht via `filename.toLowerCase().startsWith('zusammenfassung_mitgliedsantrag')`.
- Neue Regel: **pro Sende-Gruppe** (Hauptmitglied, Ehegatte-Variante-B, Kind-Variante-B) die zugehörige Datei auswählen.
  - `formData.selectedKrankenkasse === 'viactiv'`: Anhang mit Prefix `viactiv_` **und** Segment `_be_` (Beispiel: `Viactiv_Lahham, Mohammad Kamel_BE_30.06.2026.pdf`), der zur Person der Gruppe gehört (Name+Vorname im Dateinamen). Fällt keine person-spezifische BE, fällt keine BE für die Gruppe → info-Toast + skip.
  - Sonst (BIG etc.): bisheriges Verhalten (`zusammenfassung_mitgliedsantrag`) beibehalten.
- Für VIACTIV wird künftig auch **pro Kind mit eigener Mitgliedschaft** eine eigene Sende-Gruppe benötigt (analog zur bestehenden BIG-Variante-B-Logik). Der `groups`-`useMemo`-Block wird für `selectedKrankenkasse === 'viactiv'` erweitert: Ehegatte mit eigener Mitgliedschaft und Kinder mit `eigeneMitgliedschaft` bekommen jeweils eine eigene Gruppe, deren `auto`-Anhänge nach Prefix `viactiv_` + Namensmatch gefiltert werden.

### Betroffene Dateien
- `src/utils/viactivExport.ts` — Merge-Logik in `resolveArbeitgeber` / `resolveArbeitgeberForSpouse`; Beschäftigung + Arbeitgeber in `createViactivBeitrittserklaerungForChild`.
- `src/components/SendEmailDialog.tsx` — VIACTIV-BE-Auswahl im WhatsApp-Block; zusätzliche Sende-Gruppen für Ehegatte/Kind mit eigener Mitgliedschaft bei VIACTIV.

### Nicht geändert
- Betreff/Body-Templates, E-Mail-Versand, Persistenz, Edge Function `send-whatsapp-summary`, Krankenkassen-Labels für WhatsApp.
