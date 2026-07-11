## Ziel
Zwei zusammenhängende Erweiterungen:
1. Im Sende-Dialog jede Gruppe (Hauptmitglied, Ehegatte, Kind) einzeln nachsenden können — nicht nur „alle auf einmal".
2. In der Anträge-Liste zusätzlich zum Export-Status auch anzeigen, ob per E-Mail bzw. an die WhatsApp-Gruppe erfolgreich gesendet wurde (ja/nein), pro Person.

## Analyse (relevanter Ist-Zustand)
- `application_events.event_type` hat einen CHECK, der **nur** `created, updated, exported, opened, decrypted, deleted` erlaubt. Die Edge-Functions `send-application-email` und `send-whatsapp-summary` versuchen bereits `emailed` bzw. `whatsapp_sent` einzufügen, aber der Insert schlägt still fehl (try/catch schluckt den CHECK-Fehler). Deshalb existiert bis heute **keine** Audit-Zeile für E-Mail-/WhatsApp-Versand — die geplante Statusanzeige braucht dies als Datenquelle.
- `applications-api` `list` liefert bisher pro Antrag u. a. `status, pdf_count, source` — aber keine Aggregation über `application_events`.
- `SendEmailDialog` sendet in `handleSend` alle Gruppen in einer Schleife. Ein einzelnes Nachsenden ist nur möglich, indem man alle anderen Gruppen manuell deaktiviert.

## Änderungen

### 1) Migration — erlaubte Event-Typen erweitern
`application_events_event_type_check` neu setzen auf:
`created, updated, exported, opened, decrypted, deleted, emailed, whatsapp_sent, whatsapp_intake`.
(`whatsapp_intake` wird bereits von `whatsapp-intake` benutzt — auch legalisieren.)

### 2) `supabase/functions/send-application-email/index.ts`
- Neuen optionalen Payload-Feldern akzeptieren: `person_role` (`"main" | "spouse" | "kind"`), `person_index` (number), `person_label` (string, z. B. „Ehegatte – Mahasen Alhamad").
- Beim Audit-Insert `meta` erweitern:
  ```
  { to_domain, attachments, gmail_id, person_role, person_index, person_label, subject }
  ```
- Fehlermeldungen bei Audit-Insert nicht nur `console.error`, sondern auch im Response-Body als optionales `audit_error` zurückgeben (nur zur Diagnose, ändert `ok:true` nicht).

### 3) `supabase/functions/send-whatsapp-summary/index.ts`
- Selbe Erweiterung: `person_role`, `person_index`, `person_label` in `meta`.

### 4) `src/components/SendEmailDialog.tsx`
- `SendGroup` bekommt Felder `personRole: 'main'|'spouse'|'kind'` und `personIndex?: number`.
- Neue Helferfunktion `sendGroup(g)` extrahieren, die genau **eine** Gruppe versendet (E-Mail + optional WhatsApp), inkl. Toast + Console-Log.
- Pro Gruppen-Card im UI einen kleinen Button „Nur diese senden" (rechts oben in der Gruppe) — sendet nur diese Gruppe, lässt den Dialog offen.
- Bestehender Fuß-Button „Senden" bleibt und iteriert weiterhin alle Gruppen via `sendGroup`.
- `person_role/index/label` werden bei jedem Aufruf mitgeschickt, damit Audit-Events sauber zugeordnet sind.

### 5) `supabase/functions/applications-api/index.ts` (Aktion `list`)
- Nach dem Laden der Anträge zusätzlich alle `application_events` mit `event_type IN ('emailed','whatsapp_sent')` für diese IDs holen.
- Pro Antragszeile in der Response ergänzen:
  - `emailed_at`: letztes `emailed`-Event für die Kombination `(application_id, person_role, person_index)`
  - `whatsapp_sent_at`: analog
- Zuordnung:
  - Hauptantrag-Zeile ⇒ Events mit `meta.person_role='main'` **oder ohne person_role** (Legacy-Fallback).
  - Sub-Zeile Ehegatte ⇒ `meta.person_role='spouse'`.
  - Sub-Zeile Kind ⇒ `meta.person_role='kind'` und `meta.person_index = row.person_index`.

### 6) `src/components/ApplicationDetailDrawer.tsx` / `src/pages/Applications.tsx`
- `ApplicationRow` um `emailed_at?: string | null` und `whatsapp_sent_at?: string | null` erweitern.
- In `Applications.tsx` zwei neue Spalten:
  - „E-Mail" — grüner Haken + Datum (kurz) wenn `emailed_at`, sonst grauer Strich.
  - „WhatsApp" — analog aus `whatsapp_sent_at`.
- Excel-Export ebenfalls um die zwei Felder ergänzen.
- Im Detail-Drawer im Header eine kleine Info-Zeile: „Zuletzt per E-Mail gesendet: …" bzw. „WhatsApp: …".

## Technische Details
- Migration verwendet `ALTER TABLE ... DROP CONSTRAINT` + neuen CHECK. Keine GRANT-Änderung nötig (bestehende Tabelle).
- `application_events` ist append-only (Trigger vorhanden) — Statusermittlung erfolgt einfach über MAX(created_at) je Kombination.
- Keine Änderung an Verschlüsselung, RLS oder Formularlogik.
- WhatsApp-Gruppe (Empfänger) unverändert — nur das Audit wird per Person granularer.

## Betroffene Dateien
- neue Migration (CHECK-Constraint erweitern)
- `supabase/functions/send-application-email/index.ts`
- `supabase/functions/send-whatsapp-summary/index.ts`
- `supabase/functions/applications-api/index.ts`
- `src/components/SendEmailDialog.tsx`
- `src/components/ApplicationDetailDrawer.tsx`
- `src/pages/Applications.tsx`

## Nicht betroffen
- PDF-Exportlogik, Krankenkassen-Mapping, Import-Dialoge, Formular-Sync-Logik.
