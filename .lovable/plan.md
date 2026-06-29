# Plan: E-Mail-Versand der Anträge via Gmail

## Übersicht
Nach dem Generieren der PDFs erscheint ein neuer Button „Per E-Mail senden". Ein Dialog zeigt automatisch befüllten Betreff, Empfänger und Nachrichtentext (alles editierbar) sowie eine Liste der Anhänge. Beim Bestätigen wird die Mail über das zentrale Firmen-Gmail (via Gmail-Connector) verschickt. Im Antrags-Audit wird das Senden als Event protokolliert.

## 1. Gmail-Anbindung
- Gmail-Connector verbinden (`standard_connectors--connect` mit `google_mail`). Der Workspace-Inhaber wählt einmalig das zentrale Firmen-Gmail.
- Versand erfolgt server-seitig in einer neuen Edge Function `send-application-email` über den Connector-Gateway (`/google_mail/gmail/v1/users/me/messages/send`) mit `LOVABLE_API_KEY` + `GOOGLE_MAIL_API_KEY`.
- Erforderlicher Scope: `gmail.send`. Falls beim ersten Sende-Versuch ein 403 „insufficient scopes" kommt, fordert der Client einen Reconnect mit dem fehlenden Scope an.

## 2. Empfänger-Verwaltung (neue Seite `/empfaenger`)
Da du die Adressen später eintragen willst, lege ich eine kleine Verwaltungsseite an (nur für Admins sichtbar). Pro Krankenkasse + Antragsform wird eine Empfänger-Adresse gespeichert.

Neue Tabelle `public.application_recipients`:
- `id uuid pk`
- `krankenkasse text` (z.B. `big_plusbonus`, `viactiv`, `dak`, `novitas`, `bkk_gs`)
- `antragsform text` (optional: z.B. `plusbonus`, `familienversicherung`, `bonus` — leer = gilt für alle)
- `recipient_email text`
- `cc text` / `bcc text` (optional)
- `created_at`, `updated_at`
- RLS: nur Admins lesen/schreiben (über `has_role(auth.uid(),'admin')`); explizite `GRANT`s an `authenticated` + `service_role`.

UI: einfache Tabelle (Krankenkasse, Antragsform, E-Mail, CC) mit „Hinzufügen/Bearbeiten/Löschen". Verlinkt aus der Admin-Navigation.

## 3. Anhänge-Logik (getrennte PDFs)
Beim Klick auf „Per E-Mail senden" werden im Browser folgende Anhänge erzeugt (mit existierender PDF-Benennung pro Krankenkasse):

- **Plusbonus** (falls aktiv) → eine PDF, z.B. `Mustermann_Max_01.01.1990_Plusbonus.pdf`
- **Familienversicherung** (falls aktiv) → eine PDF, z.B. `Mustermann_Max_01.01.1990_Familienvers.pdf`
- **Bonus** (VIACTIV, falls aktiv) → eine PDF
- **Dokumente.pdf** (falls hochgeladene Bilder/PDFs vorhanden) → alle Uploads via `createCombinedPdf` zu einer PDF zusammengeführt, Benennung z.B. `Mustermann_Max_01.01.1990_Dokumente.pdf`

Jede PDF wird als separater Anhang (base64) an die Edge Function übergeben.

## 4. Betreff- & Nachrichtenvorlage (editierbar)
Automatisch generiert pro Antragsform — Beispiele:

- BIG nur Plusbonus: `Mustermann, Max, 01.01.1990 (Plusbonus)`
- BIG Plusbonus + Familienvers.: `Mustermann, Max, 01.01.1990 (Plusbonus + Familienversicherung)`
- VIACTIV Beitritt+Bonus+Famvers: `Mustermann, Max, 01.01.1990 (Beitritt + Familienversicherung + Bonus)`

Standard-Nachrichtentext (anpassbar, editierbar im Dialog, mit Platzhaltern `{name}`, `{vorname}`, `{geburtsdatum}`, `{antragsform}`, `{bearbeiter}`):

```
Sehr geehrte Damen und Herren,

anbei finden Sie den/die Antrag/Anträge für {vorname} {name}, geboren am {geburtsdatum}.
Angefügt: {antragsform}.

Mit freundlichen Grüßen
{bearbeiter}
```

Vorlagen werden in einer neuen Tabelle `public.email_templates` gehalten (Felder: `name`, `subject_template`, `body_template`, `is_default`). Admin kann sie auf `/empfaenger` mitpflegen. Im Versand-Dialog sind Betreff + Text vorausgefüllt und frei änderbar.

## 5. Versand-Dialog (`SendEmailDialog`)
Neuer Button im PDF-Export-Bereich von `src/pages/Index.tsx` neben den Download-Buttons: **„Per E-Mail senden"** (deaktiviert, solange Pflichtfelder/VP/Geburtsdatum fehlen oder kein Empfänger hinterlegt ist).

Dialog-Inhalt:
- **An:** vorausgefüllt aus `application_recipients` (editierbar), CC/BCC optional
- **Betreff:** vorausgefüllt (editierbar)
- **Nachricht:** Textarea, vorausgefüllt (editierbar)
- **Anhänge:** Liste mit Dateinamen + Größe + Checkbox zum Ab-/Anwählen
- Button **„Senden"** → ruft `send-application-email` Edge Function auf

Nach Erfolg: Toast, Antrag bekommt Event `emailed`, Status bleibt `exported`.

## 6. Edge Function `send-application-email`
Input (vom Client, mit JWT):
```ts
{
  application_id: string,
  to: string, cc?: string, bcc?: string,
  subject: string, body: string,
  attachments: Array<{ filename: string, mimeType: string, base64: string }>
}
```
Ablauf:
1. JWT prüfen, User laden.
2. Empfänger-Validierung (E-Mail-Format, max. Anhangsgröße ~25 MB Gmail-Limit).
3. RFC-2822-Nachricht mit `multipart/mixed` zusammenbauen (Headers, Body als `text/plain`, Anhänge base64-encoded mit Content-Disposition).
4. Base64url-encoden, an Gmail-Gateway `POST /users/me/messages/send` mit `{ raw }`.
5. Bei Erfolg: `application_events` Insert `{ event_type: 'emailed', meta: { krankenkasse, pdf_count, to_domain } }` (keine PII, nur die Domain des Empfängers für Audit).
6. Bei 403 insufficient_scopes → Fehler `gmail_scope_missing` zurück; Client zeigt Hinweis zum Reconnect.

CORS-Header inkludiert; generische Fehler-Slugs (keine PII in Logs).

## 7. Audit/Liste-Erweiterung
- `application_events` bekommt neuen `event_type: 'emailed'`.
- `ApplicationDetailDrawer` zeigt Sende-Events in der Timeline (mit Empfänger-Domain, nicht voller Adresse).
- Optional: in der Anträge-Liste neue Statusbadge „📧 Versendet" wenn ein `emailed`-Event existiert (kann ich gleich mit einbauen).

## Technische Details

### Neue/geänderte Dateien
- **Neu:** `supabase/functions/send-application-email/index.ts`
- **Neu:** `supabase/migrations/<ts>_email_recipients_and_templates.sql` (Tabellen + RLS + GRANTs)
- **Neu:** `src/pages/EmailSettings.tsx` (Verwaltung Empfänger + Vorlagen, Admin-only)
- **Neu:** `src/components/SendEmailDialog.tsx`
- **Neu:** `src/utils/buildEmailAttachments.ts` (sammelt die einzelnen PDFs analog zur bestehenden Export-Logik)
- **Neu:** `src/utils/emailTemplate.ts` (Platzhalter-Ersetzung)
- **Geändert:** `src/pages/Index.tsx` (neuer „Per E-Mail senden"-Button + Dialog)
- **Geändert:** `src/App.tsx` (Route `/empfaenger`)
- **Geändert:** `src/components/ApplicationDetailDrawer.tsx` (Email-Events anzeigen)
- **Geändert:** `src/integrations/supabase/types.ts` (auto)

### Connector
- `google_mail` Connector wird beim Build verknüpft (`standard_connectors--connect`); danach stehen `LOVABLE_API_KEY` und `GOOGLE_MAIL_API_KEY` als Env-Vars in Edge Functions zur Verfügung. Keine manuellen Secrets nötig.

### Wichtige Hinweise
- **Ein Absender für alle Bearbeiter:** Alle Mails kommen aus dem zentralen Gmail-Konto; der Name des Bearbeiters steht im Nachrichtentext (Platzhalter `{bearbeiter}`). Im Gmail-„Gesendet"-Ordner sind alle Versendungen sichtbar.
- **Anhangsgröße:** Gmail erlaubt ~25 MB pro Mail. Bei größeren Uploads zeigt der Dialog eine Warnung.
- **DSGVO/PII:** Empfänger-Domains landen im Audit, keine kompletten Mailadressen oder Antragsinhalte in Logs.

## Was ich noch von dir brauche
- Verknüpfung des zentralen Firmen-Gmails über den Connector (Klick beim Build-Schritt).
- Empfänger-Adressen kannst du danach jederzeit unter `/empfaenger` selbst pflegen.
