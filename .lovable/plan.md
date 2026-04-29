# VIACTIV Beitrittserklärung – Korrekturen

## Probleme

1. **Geburtsdatum** wird nach KI-Validierung im UI angezeigt, aber beim PDF-Export NICHT in das Feld `Geburtsdatum` geschrieben.
2. **Arbeitgeber-PLZ** wird im UI eingegeben, aber NICHT in das PDF-Feld `Arbeitgeber PLZ` exportiert.
3. **Jobcenter-Logik fehlt**: Wenn der Kunde keinen Arbeitgeber hat (z. B. ALG II / ALG I), sollen automatisch die Daten von Jobcenter / Agentur für Arbeit in die Arbeitgeber-Felder geschrieben werden.

## Ursachenanalyse

### Geburtsdatum
`formatInputDate()` in `src/utils/viactivExport.ts` splittet nur an `-` (HTML date input → `YYYY-MM-DD`). Die KI liefert oft `TT.MM.JJJJ` (laut Schema), das wird unverändert zurückgegeben und teilweise vom PDF-Textfeld nicht akzeptiert (Format-Erwartung TTMMJJJJ ohne Punkte). Außerdem fehlt jegliche Robustheit für gemischte Formate.

### Arbeitgeber-PLZ
Das Feld heißt im PDF korrekt `Arbeitgeber PLZ` und wird in `viactivExport.ts` (Zeile 257) gesetzt. Das eigentliche Problem: Bei Beschäftigungsstatus ≠ `beschaeftigt` (z. B. `al_geld_2`) ist `formData.viactivArbeitgeber.plz` typischerweise leer, und der UI-Block "Arbeitgeber" wird oft nicht ausgefüllt → leerer String → kein PDF-Wert. Dazu kommt: Wenn der User ALG I / ALG II bezieht, wird im UI vermutlich gar kein Arbeitgeber erfasst, dadurch bleiben PLZ + alle Arbeitgeberfelder leer.

(Wenn die PLZ trotz Eingabe nicht erscheint, prüft der Fix außerdem PDF-Field-Encoding-Varianten konsistent.)

## Lösung

### 1. `src/utils/viactivExport.ts` – `formatInputDate` robust machen

Akzeptiert jetzt:
- `YYYY-MM-DD` → `TTMMJJJJ`
- `TT.MM.JJJJ` → `TTMMJJJJ`
- `TT/MM/JJJJ` → `TTMMJJJJ`
- alles andere → leerer String, damit ungültige Werte nicht ins PDF wandern

```ts
const formatInputDate = (dateStr: string): string => {
  if (!dateStr) return "";
  const s = dateStr.trim();
  // YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}${m[2]}${m[1]}`;
  // TT.MM.JJJJ oder TT/MM/JJJJ
  m = s.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
  if (m) return `${m[1]}${m[2]}${m[3]}`;
  return "";
};
```

Damit wird `Geburtsdatum` zuverlässig als `TTMMJJJJ` ausgefüllt – an allen Stellen (Mitglied, Ehegatte BE, Kind BE, `Beschäftigt seit`).

### 2. Jobcenter-/Agentur-für-Arbeit-Fallback für Arbeitgeber

Neue Helferfunktion in `viactivExport.ts`, die je nach Beschäftigungsstatus die Arbeitgeber-Felder auflöst:

```ts
const resolveArbeitgeber = (formData: FormData) => {
  const ag = formData.viactivArbeitgeber;
  const hasArbeitgeber = !!(ag?.name || ag?.strasse || ag?.plz);
  if (hasArbeitgeber) return ag;

  // Fallback Jobcenter / Agentur für Arbeit
  if (formData.viactivBeschaeftigung === 'al_geld_2') {
    // ALG II → Jobcenter (PLZ + Ort = Wohnort des Mitglieds)
    return {
      name: 'Jobcenter',
      strasse: '',
      hausnummer: '',
      plz: formData.mitgliedPlz || '',
      ort: formData.ort || '',
      beschaeftigtSeit: '',
    };
  }
  if (formData.viactivBeschaeftigung === 'al_geld_1') {
    // ALG I → Agentur für Arbeit
    return {
      name: 'Agentur für Arbeit',
      strasse: '',
      hausnummer: '',
      plz: formData.mitgliedPlz || '',
      ort: formData.ort || '',
      beschaeftigtSeit: '',
    };
  }
  return ag;
};
```

In `createViactivBeitrittserklaerungPDF` wird statt direkt `formData.viactivArbeitgeber` der Rückgabewert dieser Funktion verwendet:

```ts
const ag = resolveArbeitgeber(formData);
setTextField("Name des Arbeitgebers", ag.name || "");
setTextField("Arbeitgeber Straße", ag.strasse || "");
setTextField("Arbeitgeber Hausnummer", ag.hausnummer || "");
setTextField("Arbeitgeber PLZ", ag.plz || "");
setTextField("Arbeitgeber Ort", ag.ort || "");
setTextField("Beschäftigt seit", formatInputDate(ag.beschaeftigtSeit) || "");
```

### 3. Verbesserte Logs für Debugging

Beim Setzen von `Geburtsdatum` und `Arbeitgeber PLZ` zusätzlich den Roh-Inputwert loggen, um zukünftige Probleme schneller zu finden:

```ts
console.log("VIACTIV Geburtsdatum raw:", formData.mitgliedGeburtsdatum,
            "→ formatted:", geburtsdatumFormatted);
console.log("VIACTIV Arbeitgeber PLZ:", ag.plz, "Quelle:",
            hasArbeitgeber ? "User" : `Fallback (${formData.viactivBeschaeftigung})`);
```

## Betroffene Datei

| Datei | Änderungen |
|-------|------------|
| `src/utils/viactivExport.ts` | `formatInputDate` robuster, neue `resolveArbeitgeber` Hilfsfunktion, Verwendung in BE-Hauptmitglied (Spouse-/Child-BE bleiben unverändert, da dort kein Arbeitgeber relevant ist), zusätzliche Logs |

## Übersicht Verhalten Arbeitgeber-Felder im PDF

| Beschäftigung | Arbeitgeber befüllt? | PDF-Inhalt Arbeitgeber-Felder |
|---|---|---|
| `beschaeftigt` | Ja (Pflicht) | Eingaben aus UI |
| `al_geld_1` | leer | Name = "Agentur für Arbeit", PLZ/Ort = Wohnsitz Mitglied |
| `al_geld_2` | leer | Name = "Jobcenter", PLZ/Ort = Wohnsitz Mitglied |
| sonstiges | leer | leer (keine Änderung) |
| beliebig | befüllt | Eingaben aus UI (Vorrang vor Fallback) |
