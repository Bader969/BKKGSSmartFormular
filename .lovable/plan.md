# Excel-Export der Antragsliste verschlanken + Geburtsdatum

## Ziel
Der Excel-Export ("Als Excel exportieren") enthält nur noch relevante Spalten und zusätzlich das Geburtsdatum jeder Person.

## Zu entfernende Spalten
- Nr. (Nummerierung, Spalte A)
- Typ (Hauptantrag/Ehegatte/Kind, Spalte B)
- Status (Exportiert/Entwurf, Spalte D)
- PDFs (Spalte E)
- E-Mail gesendet (Spalte F)
- WhatsApp gesendet (Spalte G)
- CRM übertragen (Spalte H)
- Aktualisiert (Spalte I)

## Verbleibende Spalten (neue Reihenfolge)
1. Krankenkasse (ausgeschriebener Name, siehe unten)
2. Erstellt
3. VP
4. Bearbeiter
5. Name
6. Vorname
7. **Geburtsdatum (NEU)**
8. Antragsform

## Krankenkassen-Benennung im Export
Statt der internen Kürzel werden die vollständigen Namen geschrieben:
- `big` → Big Direkt Gesund
- `novitas` → Novitas BKK
- `viactiv` → Viactiv
- `dak` → DAK

## Zeilen im Export (alle Mitgliedschaften)
Exportiert werden – bei **allen** Krankenkassen – der Hauptantrag sowie jede weitere Person mit eigener Mitgliedschaft (Ehegatte / Kinder als eigene Zeile mit eigenem Namen und Geburtsdatum). Familienversicherte Personen erscheinen nicht als eigene Zeile. Grundlage bleibt die bestehende Gruppierung der Liste; der Export nutzt genau diese Zeilen (inklusive aktiver Filter).


## Neue Spalte: Geburtsdatum
Das Geburtsdatum steht aktuell nur im verschlüsselten Payload – die Listenansicht sieht es nicht. Daher:

1. **Neue DB-Spalte** `applicant_geburtsdatum` (text) auf `applications`.
2. **applications-api (save)**: Beim Speichern wird das Geburtsdatum je nach Rolle aus dem Payload extrahiert und als Metadatum gespeichert:
   - Hauptantrag → `payload.geburtsdatum`
   - Ehegatte → `payload.ehegatte.geburtsdatum`
   - Kind n → `payload.kinder[n-1].geburtsdatum`
3. **applications-api (list)**: Spalte `applicant_geburtsdatum` mit ausliefern.
4. **Excel-Export** (`src/pages/Applications.tsx`): Spalten wie oben reduzieren, `Geburtsdatum: r.applicant_geburtsdatum ?? ""` ergänzen.

## Hinweis zu Bestandsdaten
Bestehende Anträge haben noch kein Geburtsdatum in den Metadaten (Payloads sind verschlüsselt). Die Spalte ist bei alten Anträgen zunächst leer und füllt sich automatisch beim nächsten Speichern des Antrags. Alle neuen Anträge haben sofort ein Geburtsdatum.

## Technische Details
- Dateien: `src/pages/Applications.tsx` (Export-Funktion `handleExportXlsx`), `supabase/functions/applications-api/index.ts` (save + list), neue Migration für die Spalte inkl. `GRANT`.
- Die sichtbare Tabellen-Ansicht in der App bleibt unverändert – nur der Excel-Export wird angepasst.
