
# Phase 2 — Backend, Records, Login-Tracking + Dark-Mode-Toggle

Bestehende Geschäftslogik (PDF-Export, KK-Mapping, Validierung, AI-Capture, Signaturen) bleibt **unverändert**. Memory-Regel "No PII persistence" wird durch eine neue Regel ersetzt: *PII nur AES-GCM-verschlüsselt, RLS pro Bearbeiter + Admin, Audit-Log Pflicht, Klartext nie in DB-Spalten*.

---

## 1. Dark-Mode-Toggle (klein, sofort)

- Neuer Hook `src/hooks/useTheme.ts`: liest `localStorage.theme` ("light" | "dark" | "system"), respektiert `prefers-color-scheme`, setzt `class="dark"` auf `<html>`.
- Neue Komponente `src/components/ThemeToggle.tsx`: Sun/Moon-Icon-Button (lucide), Dropdown mit Light / Dark / System.
- Einbindung in die sticky Top-Bar in `src/pages/Index.tsx` (rechts neben User-Menü-Platzhalter).
- Tokens sind bereits in `src/index.css` für `.dark` definiert — keine weiteren Style-Änderungen nötig.

---

## 2. Datenbank (Migration)

### Tabelle `public.applications`
Felder (Domain): `user_id`, `krankenkasse`, `status` (`draft` / `exported`), `payload_encrypted` (bytea), `payload_iv` (bytea), `payload_hash` (text, SHA-256 für Duplikat-Erkennung), `pdf_count`, `exported_at`, `last_opened_at`.
- RLS: SELECT/UPDATE/DELETE wenn `auth.uid() = user_id` ODER `private.has_role(auth.uid(),'admin')`; INSERT nur eigene.
- Standard-GRANTs für `authenticated` + `service_role`, kein `anon`.
- `updated_at`-Trigger.

### Tabelle `public.application_events` (Audit-Log, append-only)
Felder: `application_id`, `user_id`, `event_type` (`created` / `updated` / `exported` / `opened` / `decrypted` / `deleted`), `meta` (jsonb, **keine PII**), `ip_hash`, `user_agent`.
- RLS: SELECT eigene + Admin; INSERT nur via Edge Function (service_role).
- Kein UPDATE/DELETE — Trigger blockiert.

### Verschlüsselungsschlüssel
Master-Key als neuer Secret `APPLICATIONS_ENCRYPTION_KEY` (32-Byte base64). Wird beim Anlegen der Edge Function angefragt (`add_secret`-Tool). Nie im Client, nie in DB-Spalten, nie geloggt.

---

## 3. Edge Functions

- `applications-save` — nimmt JSON-Payload + `krankenkasse` + optional `application_id` entgegen, verifiziert User-Session, verschlüsselt mit AES-GCM-256 (Web Crypto), schreibt Row, schreibt `created`/`updated`-Event.
- `applications-load` — gibt **Liste** ohne Klartext zurück (nur Metadaten).
- `applications-decrypt` — entschlüsselt eine einzelne Row on-demand, schreibt `decrypted`-Event, gibt Klartext nur in der Response zurück (nie in DB).
- `applications-mark-exported` — nach erfolgreichem PDF-Export Status setzen + `exported`-Event + `pdf_count`.
- Alle: `verify_jwt = true` in `supabase/config.toml`, Logs schreiben **keine** PII (Lehre aus `pii_logged_edge_fn`).

---

## 4. Frontend — neue Route `/antraege`

- `src/pages/Applications.tsx`: Tabelle (TanStack-frei, native `<table>` + shadcn `Table`), Spalten *KK · Status · Erstellt · Zuletzt geöffnet · PDFs · Bearbeiter (nur Admin)*, Filter (KK / Status / Datum / Suche), Pagination.
- `src/components/ApplicationDetailDrawer.tsx`: shadcn Sheet, "Entschlüsseln & öffnen"-Button → ruft `applications-decrypt`, lädt Formular im read-only-Vorschau-Mode oder "In Editor laden" (füllt Index-Page-State).
- `src/components/ApplicationAuditTimeline.tsx`: vertikale Timeline aus `application_events`.
- Admin-only Spalte "Bearbeiter" + Filter, gesteuert via `useUserRole`-Hook.

### Integration in bestehende Formular-Seite (`src/pages/Index.tsx`)
- Neuer "Speichern"-Button in der sticky Bottom-Bar → ruft `applications-save` (Draft).
- Bestehender Export-Flow ruft nach erfolgreichem PDF zusätzlich `applications-mark-exported` (kein Eingriff in Export-Utils selbst, nur ein neuer Wrapper-Hook `useApplicationPersistence`).
- Auto-Save-Indicator (aus Phase 1) wird optional auf Cloud-Save umgeschaltet, sobald eingeloggt.

---

## 5. Login & Rollen

- `src/pages/ResetPassword.tsx` (öffentliche Route) + "Passwort vergessen"-Link in `LoginForm`.
- Optional Google-Sign-in einschalten (`configure_social_auth`).
- `src/pages/Admin.tsx` (nur Admin): Nutzerliste aus `profiles`, Rollen-Toggle via `user_roles`, Audit-Übersicht aller Anträge, CSV-Export-Button.
- `src/hooks/useUserRole.ts` für UI-Gating.

---

## 6. Navigation / Shell

- Top-Bar bekommt: Logo · Formular · Anträge · (Admin) · ThemeToggle · User-Menü (Email, Logout).
- `App.tsx`: neue Routen `/antraege`, `/antraege/:id`, `/admin`, `/reset-password`. Geschützte Routen via Wrapper `<RequireAuth>`.

---

## 7. Technische Details (für Review)

- Krypto: WebCrypto `AES-GCM`, 256 Bit, 12-Byte IV pro Row, Key aus Secret (`crypto.subtle.importKey`).
- `payload_hash` = SHA-256 über kanonisches JSON → Duplikat-Warnung im UI ("Ähnlicher Antrag existiert bereits").
- `application_events.meta` darf nur enthalten: `krankenkasse`, `pdf_count`, `field_count_changed`, niemals Namen/Daten.
- Edge-Function-Logs nur `application_id`, `event_type`, `status_code` — keine Body-Inhalte, keine User-Eingaben.
- Memory-Update: `mem://constraints/pii-no-persistence` entfernen, neu anlegen `mem://features/encrypted-applications-storage` mit den oben genannten Regeln.

---

## 8. Reihenfolge der Umsetzung

1. Dark-Mode-Toggle (Hook + Komponente + Top-Bar-Slot)
2. Migration `applications` + `application_events` + Trigger + RLS + GRANTs
3. Secret `APPLICATIONS_ENCRYPTION_KEY` anlegen (über add_secret-Tool)
4. Edge Functions `applications-save` / `-load` / `-decrypt` / `-mark-exported`
5. `useApplicationPersistence`-Hook + Save-Button + Mark-Exported-Wrapper
6. Route `/antraege` + Detail-Drawer + Audit-Timeline
7. `ResetPassword` + Google-Sign-in optional
8. Admin-Bereich + Rollen-Verwaltung
9. Memory-Update + DB-Linter-Check + Smoke-Test im Preview

---

## Kreative Zusatzideen (optional, Freigabe pro Punkt)

- **Entwurfs-Versionierung**: jeder Save als Snapshot in `application_versions` (verschlüsselt), Restore-Button.
- **Vorlagen** (strukturbasiert, keine PII): Familienkonstellation speichern.
- **Bearbeiter-Übergabe** mit Kommentar-Thread.
- **Statistik-Dashboard** Admin: Anträge pro KK/Monat, Ø Bearbeitungsdauer.
- **Bulk-Export** als ZIP, **CSV-Audit-Export** für Compliance.
- **PWA + Offline-Entwürfe** (IndexedDB, später beim nächsten Online-Sync verschlüsseln).
- **Webhook/E-Mail** bei abgeschlossenem Antrag.
- **i18n** DE/EN vorbereiten.

Nach Freigabe starte ich mit Schritt 1 (Dark-Mode-Toggle), dann Schritt 2 (Migration).
