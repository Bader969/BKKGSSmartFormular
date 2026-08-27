# BeitPlus: Versand über antraege@beitplus.de + eigener WhatsApp-Empfänger

## Ziel

Der Versand richtet sich nach dem Ziel-CRM des Antrags:

| Ziel-CRM | E-Mail-Absender | WhatsApp-Empfänger |
| --- | --- | --- |
| BlitzVox | Gmail (wie bisher) | BlitzVox-Gruppe (wie bisher) |
| BeitPlus | antraege@beitplus.de über das bestehende BeitPlus-Postfach | 4917676897062 |

Inhalte, Betreffregeln, Dateinamen mit `(Vorname Nachname)`, die 5-Zeilen-Nachricht, Gruppen-Aufteilung für eigene Mitgliedschaften, "Nur diese senden" und "Nur per WhatsApp" bleiben unverändert.

## Bestehende BeitPlus-Einrichtung nutzen statt neu aufsetzen

Im BeitPlus-CRM existiert bereits ein vollständiges Postfach: Resend-Versand mit den Absender-Aliassen (u. a. `antraege@beitplus.de`), der Inbound-Webhook, die Tabellen `emails` / `email_attachments` und der Storage-Bucket `email-attachments`. Genau in diese Struktur schreiben wir mit.

Ablauf pro E-Mail bei Ziel-CRM BeitPlus:

1. Anhänge (PDFs und Fotos) werden in den BeitPlus-Bucket `email-attachments` hochgeladen.
2. Die E-Mail geht mit demselben Resend-Konto ab, Absender `Beit Plus <antraege@beitplus.de>` und `Reply-To` identisch — also exakt wie eine im CRM verfasste E-Mail.
3. Danach wird im CRM eine Zeile in `emails` angelegt (`direction: outbound`, `status: sent`, `sender_email: antraege@beitplus.de`, Betreff, Text/HTML, Empfänger, `provider_message_id`, `sent_at`) plus die zugehörigen `email_attachments`-Zeilen.

Damit erscheint jede von hier verschickte Antrags-E-Mail im BeitPlus-Postfach unter "Gesendet", inklusive Anhängen — und Antworten der Krankenkasse landen über den bestehenden Inbound-Webhook automatisch im selben Verlauf (gleiche Message-ID-Kette).

Nichts muss im BeitPlus-CRM neu eingerichtet werden. Benötigt wird hier nur derselbe Resend-Zugang als Secret (`RESEND_API_KEY`); die Zugangsdaten zum BeitPlus-Backend sind für die CRM-Übertragung schon hinterlegt.

## Ablauf im Sendedialog

- Der Dialog kennt das Ziel-CRM des Antrags (Feld "Ziel-CRM" bzw. automatisch aus dem Vertriebspartner).
- Sichtbarer Hinweis: "Versand über antraege@beitplus.de (BeitPlus-Postfach) · WhatsApp an 4917676897062" bzw. "Versand über Gmail · WhatsApp an BlitzVox-Gruppe".
- Ohne erkennbares Ziel-CRM bleibt der bisherige Weg (Gmail + BlitzVox-Gruppe) aktiv.
- Fehler (z. B. Resend-Ablehnung) erscheinen als Toast mit Klartextmeldung; das Speichern/der restliche Versand bleibt davon unberührt.

## Technische Details

- Neue Edge Function `send-application-email-beitplus`:
  - JWT-Prüfung wie in `send-application-email`; Body wie bisher (`to/cc/bcc`, `subject`, `body`, `attachments[{filename, mimeType, base64}]`, `application_id`, `person_*`).
  - Verbindung zum BeitPlus-Supabase über die vorhandenen Secrets (`BEITPLUS_CRM_SUPABASE_URL`, Service-Role bzw. `BEITPLUS_CRM_EMAIL`/`BEITPLUS_CRM_PASSWORD`) — dieselbe Client-Logik wie in `crm-sync`.
  - Upload der Anhänge nach `email-attachments` unter `outbound/<uuid>/<dateiname>`.
  - Resend-Versand über `POST https://api.resend.com/emails` mit `RESEND_API_KEY`, `from: "Beit Plus <antraege@beitplus.de>"`, `text` + einfaches HTML (wie die Gmail-Variante), `attachments` als Base64.
  - Protokollierung in `emails` + `email_attachments` im BeitPlus-CRM (Werte wie oben), zusätzlich das gewohnte Audit-Event `emailed` (mit `via: 'beitplus'`) in `application_events` dieses Projekts, damit Status/Zeitstempel in der Anträge-Liste unverändert funktionieren.
  - Größenprüfung: max. 24 MB Anhänge, sonst `attachments_too_large`.
- `src/components/SendEmailDialog.tsx`:
  - Neues Prop `crmTarget?: CrmTarget | null`, in `src/pages/Index.tsx` mit `formData.crmTarget ?? crmTargetForVp(formData.vertriebspartner)` befüllt.
  - `const emailFn = crmTarget === 'beitplus' ? 'send-application-email-beitplus' : 'send-application-email'` an beiden Aufrufstellen ("Alle senden" und "Nur diese senden").
  - `WA_CHAT_ID` wird zur Funktion `waChatId(crmTarget)`: `beitplus` → `4917676897062@s.whatsapp.net`, sonst `120363309092314738@g.us`. PDF-Auswahl, Dateiname und Textzeilen bleiben gleich.
  - Info-Zeile im Dialogkopf über den aktiven Versandweg.
- `supabase/functions/send-whatsapp-summary/index.ts` bleibt unverändert (Ziel kommt per `chatId`).
- Deployment der neuen Function nach der Umsetzung; `RESEND_API_KEY` wird über den Secret-Dialog abgefragt.

## Nicht Teil der Änderung

Gmail-Versand für BlitzVox, Betreff-/Body-Vorlagen, PDF-Erzeugung, CRM-Datenübertragung, Inbound-Webhook im BeitPlus-CRM.
