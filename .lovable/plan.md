## Problem

Beim VIACTIV-Export erscheinen folgende Werte nicht im PDF, obwohl sie im UI korrekt eingegeben sind:

1. **Antragsteller-PDF**: „Arbeitgeber Straße" und „Arbeitgeber Hausnummer" bleiben leer.
2. **Ehepartner-PDF**: Die Jobcenter-Daten (Name „Jobcenter", PLZ, Ort) erscheinen ebenfalls nicht, obwohl `resolveArbeitgeberForSpouse` sie korrekt liefert (Logs bestätigen das).

## Ursache

Eine Inspektion der echten PDF-Felder mit `pypdf` zeigt: **fast alle Textfelder im VIACTIV-Formular sind Comb-Felder** (Flag `1<<24` gesetzt) mit `/MaxLen`. Betroffen u. a.:

```
Name, Vorname, Geburtsdatum, Geburtsort, Geburtsland, Geburtsname,
Straße, Hausnummer, PLZ, Ort, Telefon, E-Mail, Staatsangehörigkeit,
Name des Arbeitgebers, Arbeitgeber Straße, Arbeitgeber Hausnummer,
Arbeitgeber PLZ, Arbeitgeber Ort, Beschäftigt seit, Mitarbeiter-Nr,
Datum Mitgliedschaft, versichert von/bis, Name der letzten Krankenkasse...
```

Der bisherige Fix entfernte die Comb-Flags **nur für `PLZ` und `Arbeitgeber PLZ`**. `form.updateFieldAppearances(helvetica)` regeneriert zwar alle Appearance-Streams, aber bei Comb-Feldern erzwingt das Flag eine zeichenweise Positionierung pro `MaxLen`-Slot. Mit Helvetica (proportional, nicht monospace) führt das in vielen Viewern dazu, dass Werte unsichtbar bleiben oder ausgeschnitten werden — das erklärt, warum:

- nach dem PLZ-Fix die PLZ jetzt erscheint (Flag entfernt),
- aber „Arbeitgeber Straße"/„Hausnummer" weiterhin leer wirken,
- und der gleiche Effekt die Jobcenter-Felder im Ehepartner-PDF unsichtbar macht.

Die Werte sind im PDF gespeichert (sieht man in pypdf), nur die Darstellung fehlt.

## Lösung

In `src/utils/viactivExport.ts`:

### 1) `stripCombFlags` auf alle relevanten Felder anwenden

Statt nur `["PLZ", "Arbeitgeber PLZ"]` eine vollständige Liste aller Comb-Textfelder bereinigen, bevor Werte gesetzt werden. Wichtig: Adress- und Arbeitgeber-Felder + alle Personenfelder, die Texte aus dem UI bekommen.

Liste:

```
"Name", "Vorname", "Geburtsdatum", "Geburtsort", "Geburtsland", "Geburtsname",
"Staatsangehörigkeit",
"Straße", "Hausnummer", "PLZ", "Ort",
"Telefon", "E-Mail",
"Name des Arbeitgebers",
"Arbeitgeber Straße", "Arbeitgeber Hausnummer",
"Arbeitgeber PLZ", "Arbeitgeber Ort",
"Beschäftigt seit",
"Datum Mitgliedschaft", "versichert von (Datum)", "versichert bis (Datum)",
"Name der letzten KrankenkasseKrankenversicherung"
```

`stripCombFlags` löscht je Feld:

- `/MaxLen`
- Comb-Bit (`1<<24`) und DoNotScroll-Bit (`1<<23`) im `/Ff`

Diese Funktion ignoriert bereits fehlende Felder still — Encoding-Varianten (Umlaute „Ã¤" etc.) sollten sie ebenfalls versuchen, analog zu `setTextField`. Wir erweitern `stripCombFlags` so, dass es dieselben Encoding-Fallbacks ausprobiert, bevor es ein Feld als „nicht gefunden" markiert.

### 2) Auf alle drei Erzeuger anwenden

`stripCombFlags(form, ALL_COMB_FIELDS)` wird in allen drei Funktionen direkt nach `pdfDoc.getForm()` aufgerufen:

- `createViactivBeitrittserklaerungPDF` (Antragsteller)
- `createViactivBeitrittserklaerungForSpouse` (Ehepartner)
- `createViactivBeitrittserklaerungForChild` (Kind)

`finalizeAppearances(pdfDoc, form)` mit Helvetica bleibt am Ende — ohne Comb-Flag rendert Helvetica jetzt sauber.

### 3) Logging

Ein zusammenfassendes `console.log` ergänzen, das einmalig die Anzahl der bereinigten Felder ausgibt, damit beim Debuggen klar ist, dass der Schritt lief.

## Was unverändert bleibt

- UI-Komponenten (`MemberSection`, `ViactivSection`, `SpouseSection`).
- `resolveArbeitgeber` / `resolveArbeitgeberForSpouse` — die Daten werden korrekt geliefert, nur die Darstellung war kaputt.
- Andere PDF-Exporte (DAK, BIG, Novitas, BKK GS).
- Dateinamen, Unterschriften, Datumsberechnung.

## Verifikation (im Default-Mode nach Approval)

1. Mit echtem Arbeitgeber (Beschäftigung „beschäftigt") exportieren → Name, Straße, Hausnummer, PLZ, Ort des Arbeitgebers müssen alle sichtbar sein.
2. „ALG II" wählen, Arbeitgeber leer lassen → „Jobcenter" + Mitglied-PLZ/Ort sichtbar.
3. Ehepartner mit eigener Mitgliedschaft + ALG II → im Ehepartner-PDF erscheint „Jobcenter", PLZ und Ort sichtbar.
4. Normale persönliche Daten (Name, Vorname, Geburtsdatum, Adresse, Telefon, E-Mail) bleiben weiterhin sichtbar — sind jetzt sogar zuverlässiger gerendert.
5. PDF in Adobe Acrobat **und** macOS Preview öffnen, um Renderer-Unterschiede auszuschließen.

## Hinweis

Wenn der User eine echte Postanschrift für das Jobcenter (Straße/Hausnummer) wünscht, müssten wir die später als zusätzliche Eingabefelder im UI ergänzen. Aktueller Plan füllt nur Name + PLZ + Ort als Fallback, weil keine Jobcenter-Adresse im Formular hinterlegt ist.
