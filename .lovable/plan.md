# BeitPlus: Versand über antraege@beitplus.de + eigener WhatsApp-Empfänger

## Ziel

Der Versand richtet sich künftig nach dem Ziel-CRM des Antrags:

| Ziel-CRM | E-Mail-Absender | WhatsApp-Empfänger |
| --- | --- | --- |
| BlitzVox | Gmail (wie bisher) | BlitzVox-Gruppe (wie bisher) |
| BeitPlus | antraege@beitplus.de über Resend | 4917676897062 |

Inhalte, Betreffregeln, Dateinamen mit `(Vorname Nachname)`, die 5-Zeilen-Nachricht, Gruppen-Aufteilung für eigene Mitgliedschaften, "Nur diese senden" und "Nur per WhatsApp" bleiben unverändert. Es ändern sich nur Absender und WhatsApp-Ziel.

## Was du vorbereiten musst

- Resend-Zugang wird über den Connector-Dialog verbunden (erscheint im Chat).
- In Resend muss die Domain **beitplus.de** verifiziert sein, sonst weist Resend den Absender `antraege@beitplus.de` ab. Falls noch nicht verifiziert, zeigen wir eine klare Fehlermeldung im Sendedialog an.

## Ablauf im Sendedialog

- Der Dialog erhält das Ziel-CRM des Antrags (aus dem Feld "Ziel-CRM" bzw. automatisch aus dem Vertriebspartner abgeleitet).
- Sichtbarer Hinweis im Dialog: "Versand über antraege@beitplus.de · WhatsApp an 4917676897062" bzw. "Versand über Gmail · WhatsApp an BlitzVox-Gruppe".
- Ist kein Ziel-CRM erkennbar, bleibt der bisherige Weg (Gmail + BlitzVox-Gruppe) aktiv.
- Anhänge (PDF-Dateien und Fotos) gehen bei beiden Wegen identisch mit; Resend unterstützt Anhänge.

## Technische Details

- Neue Edge Function `send-application-email-resend`:
  - JWT-Prüfung wie in `send-application-email`.
  - Sendet über den Resend-Connector-Gateway (`POST /emails`) mit `from: "BeitPlus Anträge <antraege@beitplus.de>"`, `reply_to` identisch, `to`/`cc`/`bcc`, `subject`, `text` + `html`, `attachments` als `{ filename, content: base64 }`.
  - Größenprüfung: Resend-Limit ~40 MB Gesamtnachricht; wir begrenzen wie bisher auf 24 MB Anhänge und geben `attachments_too_large` zurück.
  - Schreibt das gleiche `application_events`-Audit-Event `emailed` (mit `via: 'resend'`) wie die Gmail-Variante, damit Status/Zeitstempel in der Anträge-Liste unverändert funktionieren.
  - Fehlerfälle (Domain nicht verifiziert, 403) werden mit Resend-Status und -Text zurückgegeben und im Dialog als Toast angezeigt.
- `src/components/SendEmailDialog.tsx`:
  - Neues Prop `crmTarget?: CrmTarget | null` (aus `src/utils/crmVp.ts`), in `src/pages/Index.tsx` mit `formData.crmTarget ?? crmTargetForVp(formData.vertriebspartner)` befüllt.
  - `const emailFn = crmTarget === 'beitplus' ? 'send-application-email-resend' : 'send-application-email'` an allen Aufrufstellen (Alle senden + "Nur diese senden").
  - `WA_CHAT_ID` wird zu einer Funktion: `beitplus` → `4917676897062@s.whatsapp.net`, sonst `120363309092314738@g.us`. Nur die `chatId` im `send-whatsapp-summary`-Aufruf ändert sich; PDF-Auswahl, Dateiname und Textzeilen bleiben gleich.
  - Kleiner Info-Text im Dialogkopf über den aktiven Versandweg.
- `supabase/functions/send-whatsapp-summary/index.ts` bleibt unverändert (Ziel kommt schon per `chatId`).
- Deployment der neuen Function nach der Umsetzung.

## Nicht Teil der Änderung

Gmail-Versand für BlitzVox, Betreff-/Body-Vorlagen, PDF-Erzeugung, CRM-Übertragung.
