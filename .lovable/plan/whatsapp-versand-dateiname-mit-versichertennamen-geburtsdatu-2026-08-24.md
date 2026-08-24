# WhatsApp-Versand: Dateiname mit Versichertennamen + Geburtsdatum in der Nachricht

## Was sich ändert

1. **PDF-Dateiname enthält den Namen des Versicherten (in runden Klammern)**
   - `Zusammenfassung_Mitgliedsantrag(Farah Toumeh).pdf`
   - `novitas-bkk forms(Ahmad Almohammad).pdf`
   - Gilt nur für den WhatsApp-Versand an die Gruppe; E-Mail-Anhänge und Exporte bleiben unverändert.
   - Der Name kommt aus der jeweiligen Sende-Gruppe (Hauptmitglied, Ehegatte oder Kind mit eigener Mitgliedschaft), sodass jede eigene Mitgliedschaft ihren eigenen Namen im Dateinamen trägt.
   - Ist kein Name vorhanden, bleibt der Dateiname unverändert (kein leeres Klammerpaar).
   - Bei VIACTIV wird der bestehende BE-Dateiname weiterhin verwendet und nur der Name in Klammern ergänzt, falls er nicht schon enthalten ist.

2. **Nachricht hat jetzt fünf Zeilen (Geburtsdatum neu)**
   ```text
   11.08.2026        (Sendedatum)
   Farah Toumeh      (Vorname Nachname)
   01.11.1985        (Geburtsdatum)
   Big direkt        (Krankenkasse, bei Novitas-Bonus mit "400€")
   HZ Blitzvox       (Vertriebspartner)
   ```
   - Reihenfolge exakt wie im Beispiel: Datum, Name, Geburtsdatum, Krankenkasse, Vertriebspartner.
   - Geburtsdatum wird immer als TT.MM.JJJJ ausgegeben (auch wenn intern JJJJ-MM-TT gespeichert ist).
   - Fehlt ein Wert (z. B. kein Geburtsdatum), wird die Zeile weggelassen statt leer gesendet.

## Technische Umsetzung

- `src/components/SendEmailDialog.tsx`
  - `buildWaTextLines(...)`: Signatur um `geburtsdatum` erweitern (bereits in `SendGroup.person` vorhanden), Zeilenreihenfolge auf Datum → Name → Geburtsdatum → Krankenkasse → VP umstellen; kleine Helper-Funktion zur Normalisierung des Datumsformats.
  - Neue Helper-Funktion `withPersonSuffix(filename, vorname, name)`: fügt `(Vorname Nachname)` vor der Dateiendung ein, idempotent (kein doppeltes Anhängen).
  - Im WhatsApp-Block wird `pdfFilename` durch `withPersonSuffix(waFilenameOverride || summary.filename, ...)` ersetzt.
- Keine Änderungen an der Edge Function `send-whatsapp-summary` nötig — sie übernimmt Dateiname und Textzeilen unverändert vom Client (Audit-Log protokolliert den neuen Dateinamen automatisch mit).
