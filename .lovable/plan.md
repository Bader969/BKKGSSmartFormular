## Problem

In der **VIACTIV-Beitrittserklärung** treten drei zusammenhängende Probleme auf:

1. **PLZ wird nicht in die PDF übertragen** — weder die PLZ des Antragstellers (`PLZ`) noch die PLZ des Arbeitgebers (`Arbeitgeber PLZ`) erscheinen im exportierten PDF, obwohl die Werte im UI vorhanden und (nach KI‑Validierung) sichtbar sind.
2. **Jobcenter‑Fallback unvollständig**: Wenn der Antragsteller ALG II (oder ALG I) bezieht und kein Arbeitgeber eingetragen ist, soll automatisch „Jobcenter" bzw. „Agentur für Arbeit" plus Adresse als Arbeitgeberdaten ins PDF geschrieben werden. Aktuell funktioniert die Auflösung zwar im Code, aber die PLZ landet wegen Problem 1 ebenfalls nicht im Feld.
3. **Ehepartner‑Beitrittserklärung**: Wenn der Ehepartner eine eigene Mitgliedschaft hat und ebenfalls Geld vom Amt bezieht (ALG I/II), müssen seine Arbeitgeberfelder mit denselben Jobcenter‑/Agentur‑Daten gefüllt werden. Aktuell werden die Arbeitgeberfelder beim Ehepartner pauschal leer gelassen.

## Ursachenanalyse

### Zu 1) PLZ‑Felder bleiben leer

Die beiden PLZ‑Felder im PDF‑Template (`PLZ`, `Arbeitgeber PLZ`) sind als **Comb‑Felder** mit speziellen Flags konfiguriert (`/Ff 29360128` bzw. `25165824`, MaxLen 5). pdf‑lib setzt zwar den Wert via `setText(...)`, kann das Appearance‑Stream für Comb‑Felder mit dem Standard‑Font (Courier/Arial im AcroForm) aber nicht zuverlässig regenerieren. Ergebnis: Das Wertfeld ist im PDF gesetzt, wird in Viewern (Preview, Adobe) aber nicht angezeigt.

Lösung: Vor dem Setzen die Comb‑/MaxLen‑Beschränkungen für diese beiden Felder entfernen und nach dem Befüllen `form.updateFieldAppearances()` mit einem eingebetteten Standard‑Font ausführen.

### Zu 2 & 3) Jobcenter‑Fallback

Die bestehende `resolveArbeitgeber`-Funktion deckt nur den Antragsteller ab und löst nicht aus, wenn der User „aus Versehen" ein Feld eingetragen hat. Für den Ehepartner existiert gar keine Auflösung — die Arbeitgeberfelder werden hartkodiert leer gelassen.

## Lösung

### A) PLZ‑Rendering reparieren (`src/utils/viactivExport.ts`)

In `createViactivBeitrittserklaerungPDF`, `…ForSpouse`, `…ForChild`:

- Direkt nach `pdfDoc.getForm()`:
  - Für die Felder `PLZ` und `Arbeitgeber PLZ` die Comb‑Flag und `MaxLen` aus dem AcroField‑Dictionary entfernen (`field.acroField.dict.delete(PDFName.of('MaxLen'))` und Flags via `setFlags`/Bitmaske bereinigen). Das ändert nur das Aussehen, nicht die Position.
- Nach allen `setText`/`setCheckbox`-Aufrufen:
  - Helvetica einbetten (`pdfDoc.embedFont(StandardFonts.Helvetica)`) und `form.updateFieldAppearances(helv)` aufrufen, damit die Werte sicher gerendert werden.
- PLZ‑Werte beim Setzen mit `.trim()` reinigen, um versehentliche Leerzeichen (häufig nach KI‑Validierung) auszuschließen.

### B) Jobcenter‑Fallback erweitern für Antragsteller

`resolveArbeitgeber(formData)` so ändern, dass bei `viactivBeschaeftigung === 'al_geld_1' | 'al_geld_2'` **immer** Jobcenter/Agentur als Arbeitgeber gesetzt wird (auch wenn der User noch alte Arbeitgeberdaten stehen hat). Reihenfolge:

1. Ist `beschaeftigung` ALG I/II → Jobcenter / Agentur für Arbeit + Mitglied‑PLZ + Mitglied‑Ort.
2. Sonst: User‑Arbeitgeberdaten verwenden (wenn vorhanden).
3. Sonst: leer.

### C) Jobcenter‑Fallback für Ehepartner

Neue Helferfunktion `resolveArbeitgeberForSpouse(formData)`:

- Wenn `formData.ehegatte.beschaeftigung === 'al_geld_2'` → Jobcenter + Mitglied‑PLZ/Ort.
- Wenn `'al_geld_1'` → Agentur für Arbeit + Mitglied‑PLZ/Ort.
- Sonst → alle Arbeitgeberfelder leer (wie bisher).

In `createViactivBeitrittserklaerungForSpouse` die hartkodierten Leerwerte durch das Ergebnis dieser Funktion ersetzen (Name, Straße, Hausnummer, PLZ, Ort).

### D) Logging

Bestehende `console.log`-Zeilen für PLZ und Arbeitgeber‑Quelle behalten, damit nach dem Fix im Browser‑Console nachvollziehbar ist, welche Werte gesetzt werden.

## Was bleibt unverändert

- UI‑Komponenten (`MemberSection`, `ViactivSection`, `SpouseSection`) — die Eingaben sind korrekt, nur der Export muss reparieren.
- Andere PDF‑Felder (Name, Adresse, Kontakt, Familienstand, Versicherungsart) bleiben wie gehabt.
- DAK/BIG/Novitas/BKK GS Exporte — nicht betroffen.

## Tests nach Implementation

1. PLZ Antragsteller (z. B. „45356") und PLZ Arbeitgeber (z. B. „44137") eingeben → exportieren → beide PLZ müssen im PDF sichtbar sein.
2. Beschäftigung „ALG II" wählen, Arbeitgeber leer lassen → PDF zeigt „Jobcenter" + Mitglied‑PLZ/Ort.
3. Familienversicherung aktivieren, Ehepartner eigene Mitgliedschaft + ALG II → Ehepartner‑PDF zeigt „Jobcenter" + PLZ/Ort.
4. Beschäftigt mit echtem Arbeitgeber → Werte des Users (nicht Jobcenter) erscheinen.