# WhatsApp → App Auto-Intake (Entwurf in Anträge)

Ziel: WHAPI-Webhook → neue Edge-Function `whatsapp-intake` → App puffert Nachrichten, erkennt 3-Punkt-Trenner, führt OCR aus, speichert **verschlüsselten Entwurf** in Anträge. Du prüfst in der App und klickst Senden.

## Flow

```text
WHAPI Webhook (chat) ──► whatsapp-intake (Edge Function)
                              │
                              ├─► Puffer-Tabelle: rohe Nachrichten pro Chat
                              │
                              └─► bei 2. "..."-Trenner:
                                    - Block zwischen den Trennern extrahieren
                                    - Text parsen (Name, Datum, Betrag+Kasse, VP, Telefon, E-Mail)
                                    - Media von WHAPI laden (base64)
                                    - process-insurance-gemini3 aufrufen (OCR)
                                    - FormData bauen + verschlüsseln
                                    - in `applications` speichern (status='draft', source='whatsapp')
                                    - Event `whatsapp_intake` loggen
                              │
Du in Anträge ──► Entwurf öffnen ──► prüfen ──► PDF exportieren ──► E-Mail (fest gemappt) ──► Senden
```

## Warum Puffer + Trenner-Erkennung
Nachrichten kommen einzeln und in variabler Reihenfolge. Die App braucht State pro Chat, um zwischen zwei `.`-`.`-`.`-Sequenzen zu bündeln. Reine Stateless-Verarbeitung reicht nicht.

## Änderungen

### 1. Neue Tabelle `whatsapp_inbox_messages` (Puffer)
- Felder: `chat_id`, `wa_message_id`, `type` (text|image|pdf|dot|phone|email|header), `text`, `media_url`, `media_mime`, `received_at`, `processed_at`, `block_id` (uuid, nach Erkennung gesetzt).
- RLS: kein Client-Zugriff (nur service_role via Edge Function).

### 2. Neue Tabelle `krankenkasse_email_map`
- `krankenkasse` (unique), `email`, `cc`, `label`.
- Admin-UI in Einstellungen zum Pflegen (BKK GS, BIG, VIACTIV, DAK, Novitas …).
- RLS: nur Admins schreiben, Authenticated lesen.

### 3. Kleine Erweiterung `applications`
- `source` text default `'manual'` (`manual` | `whatsapp`)
- `intake_meta` jsonb (WhatsApp chat_id, message_ids, parse-warnings)

### 4. Neue Edge-Function `whatsapp-intake` (`verify_jwt=false`)
- Auth: Header `X-Intake-Secret` gegen `WHATSAPP_INTAKE_SECRET` (via `add_secret` beim Umsetzen).
- Nimmt WHAPI-Payload (single message oder batch), speichert im Puffer.
- Klassifiziert jede Nachricht:
  - Nur `.` → `dot`
  - Regex Telefon → `phone`
  - Regex E-Mail → `email`
  - Mehrzeilig mit Datum + Kassen-Keyword → `header`
  - `image/*`, `application/pdf` → media
- Nach jedem Insert: prüft, ob im Chat zwei komplette `...`-Trenner (jeweils 3 Punkte in Folge) vorliegen und dazwischen mind. 1 Media + 1 Header.
- Wenn ja → Block-Verarbeitung asynchron (im selben Function-Call, aber non-blocking Response an WHAPI).

### 5. Block-Verarbeitung (in derselben Function, ausgelagerte Helper-Datei intern)
1. Header parsen:
   - Zeile 1: `Vorname Nachname`
   - Zeile mit `dd.mm.yyyy` → Antragsbeginn/Signaturdatum
   - Zeile mit Kassen-Keyword (`BKK GS`, `BIG`, `VIACTIV`, `DAK`, `Novitas`) → `selectedKrankenkasse` + Fuzzy-Match
   - Zeile mit Betrag (`300€`) → optionales `bonusBetrag`
   - Zeile mit VP-Kürzel (Abgleich gegen `VERTRIEBSPARTNER_OPTIONS`) → `vertriebspartner`
2. Telefon-/E-Mail-Nachrichten aus dem Block → `telefon`, `email`.
3. Media von WHAPI ziehen (`GET /messages/{id}/download` oder direkte Media-URL, mit WHAPI-Token als Secret).
4. `process-insurance-gemini3` mit Bildern + `selectedKrankenkasse` aufrufen → Extrakt.
5. `applyKrankenkassenMapping` + Insurance-Number-Normalisierung anwenden.
6. Header-Werte über OCR-Werte legen (Name/Datum/Kasse/VP/Telefon/E-Mail sind autoritativ aus WhatsApp).
7. `applications` insert via bestehender `applications-api` Logik (Payload verschlüsselt mit `APPLICATIONS_ENCRYPTION_KEY`), `status='draft'`, `source='whatsapp'`, `intake_meta` befüllt.
8. Puffer-Zeilen als `processed_at=now()` markieren und mit `block_id` verknüpfen (nicht löschen → Rückverfolgbarkeit; TTL-Cleanup optional später).

### 6. UI: Anträge-Liste
- Badge „WhatsApp" bei `source='whatsapp'`.
- Filter „Nur WhatsApp-Entwürfe".
- Warnungshinweise aus `intake_meta.warnings` (z.B. „Kasse nicht sicher erkannt", „Telefon fehlt").

### 7. UI: Empfänger-Mapping-Editor
- Neue Seite `/settings/email-mapping` (Admin).
- CRUD auf `krankenkasse_email_map`.
- `SendEmailDialog` vorbelegt `to`/`cc` anhand `selectedKrankenkasse`.

## Secrets (beim Umsetzen anfordern)
- `WHATSAPP_INTAKE_SECRET` (via `generate_secret`, 48+ Zeichen).
- `WHAPI_TOKEN` (Bearer-Token für Media-Download, via `add_secret`).

## WHAPI-Konfiguration (du machst manuell in WHAPI, nach Deployment)
1. In WHAPI-Dashboard Webhook eintragen:
   `POST https://<edge-function-url>/whatsapp-intake`
2. Custom Header hinzufügen: `X-Intake-Secret: <Wert von WHATSAPP_INTAKE_SECRET>`
3. Events: `messages` (text, image, document).
4. Filter auf die eine Ziel-Chat-ID/-Gruppe (damit keine fremden Chats ankommen).

## Warum ohne Make
Make wäre nur ein zusätzlicher Hop. WHAPI kann direkt an die Edge Function posten, alles Weitere (Puffern, Trenner, OCR, Verschlüsselung, Antrags-Insert) läuft ohnehin in deiner App. Ein Hop weniger = weniger Latenz, kein zusätzliches Abo, DSGVO-technisch weniger Auftragsverarbeiter.

Optional später: Make als Fallback-Retry oder für spätere Kanäle (Telegram, E-Mail-Intake) — Struktur bleibt gleich (immer POST auf `whatsapp-intake`).

## Technische Details

- **Idempotenz**: `wa_message_id` unique in `whatsapp_inbox_messages` → doppelte WHAPI-Zustellungen werden verworfen. Block-Erkennung nur einmal pro Trenner-Paar dank `block_id`.
- **Zeitfenster**: Block schließt spätestens 10 min nach letztem Trenner; ältere unvollständige Blöcke werden per Cron-Cleanup (pg_cron optional, später) verworfen.
- **Reihenfolge-Toleranz**: Parser prüft alle Nachrichten im Block gegen alle Regex-Klassifikatoren, kein positionsabhängiger Parse.
- **Media-Größe**: WHAPI liefert URLs; wir streamen direkt an `process-insurance-gemini3` als base64 (bestehender Pfad). Kein DB-/Storage-Persist der Bilder (bleibt bei „no PII persistence"-Regel).
- **Fehler**: Bei Parse-/OCR-Fehlern wird trotzdem ein Draft mit Warnungen erzeugt (nichts geht verloren), Fehlerdetails in `application_events`.
- **Sicherheit**: `verify_jwt=false` + Shared Secret Header + optional IP-Allowlist (WHAPI-IPs) im Function-Code.
- **Kein Auto-Mail**: Kein Aufruf von `send-application-email` aus der Intake-Function. Du behältst 100%-Kontrolle wie gewünscht.
