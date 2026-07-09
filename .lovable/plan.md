# WhatsApp-Versand nach E-Mail

Nach jeder erfolgreich versendeten E-Mail-Gruppe im `SendEmailDialog` wird zusätzlich eine WhatsApp-Sequenz an die feste Gruppe `120363309092314738@g.us` gesendet.

## Sequenz pro Sende-Gruppe

Jede Zeile = eigene WhatsApp-Nachricht, in dieser Reihenfolge:

```text
<Zusammenfassung_Mitgliedsantrag.pdf>
<Vorname Name
Erstellungsdatum
Krankenkasse
Vertriebspartner>
.
.
.
```

- Erstellungsdatum = heutiges Datum, Format `dd.MM.yyyy`.
- Krankenkasse-Label (ohne Betrag):
  - `big_plusbonus` → `Bigdirekt gesund`
  - `viactiv` → `VIACTIV`
  - `novitas` → `Novitas BKK`
  - `dak` → `DAK`
  - `bkk_gs` → `BKK GILDEMEISTER SEIDENSTICKER`
- Vertriebspartner = `formData.vertriebspartner` (Zeile weglassen, wenn leer).

## PDF-Auswahl

Für jede Sende-Gruppe wird die Datei gesendet, deren Dateiname (case-insensitive) mit `Zusammenfassung_Mitgliedsantrag` beginnt und die in der Gruppe als aktiver Anhang (`include=true`) vorhanden ist. Ist keine solche Datei angehängt → WA-Versand für diese Gruppe wird übersprungen (Toast-Hinweis).

## Auslöser (UI)

Im `SendEmailDialog` neue Checkbox „Auch per WhatsApp an Gruppe senden" unterhalb der Sende-Gruppen, standardmäßig aktiv. Nach jeder erfolgreich per E-Mail versendeten Gruppe wird — falls Checkbox aktiv und Zusammenfassungs-PDF vorhanden — die WA-Sequenz ausgelöst. WA-Fehler blockieren den E-Mail-Erfolg nicht, werden aber als Toast angezeigt.

## Neue Edge Function `send-whatsapp-summary`

- JWT-verifiziert (wie `send-application-email`).
- Body: `{ application_id?: string, chatId: string, pdfBase64: string, pdfFilename: string, textLines: string[] }`.
- Nutzt bestehende Env `WHAPI_TOKEN` und die WHAPI-REST-API.
- Ablauf (sequenziell, `await` zwischen den Calls für stabile Reihenfolge):
  1. Dokument (PDF, base64, `filename = pdfFilename`)
  2. Text `textLines.join('\n')`
  3. `.` als Text (3×)
- Fehler → HTTP 502 mit Details.
- Audit-Event `whatsapp_sent` in `application_events` (nur Metadaten: `chat_id`, `filename`, keine Inhalte).

## Frontend-Änderungen (`SendEmailDialog.tsx`)

- Neuer State `sendToWhatsApp` (default `true`) + Checkbox.
- In `handleSend` nach jeder erfolgreichen E-Mail:
  - Zusammenfassungs-PDF der Gruppe finden.
  - Falls vorhanden + Checkbox aktiv: `supabase.functions.invoke('send-whatsapp-summary', …)` mit den gebauten `textLines`.

## Nicht Teil des Plans

- Keine Änderungen an WhatsApp-Intake, E-Mail-Logik oder Persistierung.
- Keine Konfigurations-UI für Chat-ID (fest verdrahtet).
