---
name: Überschreibbare Automatik-Daten
description: Versicherungsbeginn, Ende der bisherigen Versicherung und Antragsdatum sind automatisch, aber pro Antrag manuell überschreibbar
type: feature
---
Alle Datumsautomatiken laufen zentral über `resolveFormDates(formData)` in `src/utils/dateUtils.ts`.

- Overrides im FormData: `versicherungsbeginnManuell`, `bisherigeVersicherungEndeManuell`, `antragsdatumManuell` (ISO, leer = automatisch).
- Defaults: Beginn = 1. des Monats +3 Monate, Ende = Tag davor, Antragsdatum = heute.
- Gilt für ALLE Krankenkassen und alle Ausgaben: PDF-Exporte (BIG, VIACTIV inkl. Bonus/FV, Novitas, DAK, BKK GS), Dateinamen mit Datum und Autofill-Payloads.
- UI: `src/components/AutoDateFields.tsx` (Sektion „Termine (automatisch)" vor den Mitgliedsdaten) — Felder sind gesperrt und werden per Schloss-Button zum Bearbeiten entsperrt bzw. auf automatisch zurückgesetzt.
