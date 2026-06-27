# Phase 2.1 — Internes Tool: kein Self-Service, nur Admin-verwaltete Accounts

Zum Passwort: Ich kann es technisch nicht "verraten". Passwörter werden in der Auth-Datenbank ausschließlich als gesalzener Hash (bcrypt/scrypt) gespeichert — selbst der Projektbesitzer sieht nur den Hash, nie den Klartext. Was ich tun kann: **das Passwort für ein bestimmtes Konto neu setzen** (du gibst mir den neuen Wert vor, ich schreibe ihn via Admin-API in `auth.users`). Das ersetzt den bisherigen Reset-per-E-Mail-Flow vollständig.

---

## Ziele

1. Keine Self-Service-Passwort-Resets mehr. Login-Seite zeigt nur E-Mail + Passwort.
2. Keine offene Registrierung. Nur Admins legen Nutzer an / setzen Passwörter / löschen Nutzer.
3. **Allow-List** für E-Mails: Login schlägt fehl, wenn die Adresse nicht auf der Liste steht — auch wenn das Passwort korrekt wäre.
4. Admin-Dashboard bekommt Nutzer­verwaltung (Anlegen, Passwort setzen, Allow-List pflegen, Sperren, Löschen).

---

## 1. Entfernen (Self-Service raus)

- `src/pages/ResetPassword.tsx` löschen.
- Route `/reset-password` in `src/App.tsx` entfernen.
- "Passwort vergessen?"-Link + `handleReset` in `src/components/LoginForm.tsx` entfernen.
- In `supabase/config.toml` Sign-ups deaktivieren (`disable_signup: true`) via `configure_auth`. `auto_confirm_email` bleibt aktiv, damit Admin-erstellte Accounts sofort nutzbar sind.

## 2. Allow-List (DB + Enforcement)

### Neue Tabelle `public.allowed_emails`
- Spalten: `email citext primary key`, `note text`, `created_by uuid`, `created_at timestamptz`.
- RLS: SELECT/INSERT/UPDATE/DELETE nur für `private.has_role(auth.uid(),'admin')`.
- GRANTs: `authenticated` (für Admin-UI), `service_role` (für Edge Function).

### Enforcement — zwei Schichten
1. **Auth-Hook (Before-Sign-in-Trigger)**: Funktion `auth.before_signin_check_allowlist` (security definer) prüft beim Sign-in, ob die E-Mail in `allowed_emails` steht; sonst Fehler. *Falls die installierte Supabase-Version Hooks nicht zulässt, Fallback siehe 2.*
2. **Fallback im Client + RequireAuth**: Nach erfolgreichem `signInWithPassword` ruft `RequireAuth`/`LoginForm` Edge Function `auth-check-allowlist` (service_role) auf. Liefert sie `false`, wird sofort `supabase.auth.signOut()` ausgeführt und ein Fehler angezeigt — der User landet **nie** in einer geschützten Route. Außerdem prüft `RequireAuth` bei jedem Mount erneut.

## 3. Admin-Dashboard erweitern (`src/pages/Admin.tsx`)

Neuer Tab/Section "Nutzerverwaltung":
- **Liste** aller Profile (vorhanden) + Spalte "Allow-List ✓/✗".
- **Nutzer anlegen**: Modal mit E-Mail + Initialpasswort + optional Admin-Rolle.
  → Edge Function `admin-users-api` (service_role) erstellt den Auth-User (`auth.admin.createUser`), trägt E-Mail in `allowed_emails` ein, optional `user_roles`-Eintrag.
- **Passwort setzen**: Button pro Nutzer → Edge Function `admin-users-api` `action: "set_password"` ruft `auth.admin.updateUserById`.
- **Sperren**: Edge Function entfernt Eintrag aus `allowed_emails` (User-Datensatz und Anträge bleiben erhalten) und/oder `auth.admin.updateUserById({ ban_duration })`.
- **Löschen**: `auth.admin.deleteUser` (kaskadiert auf `profiles`/`user_roles`/`applications` über bestehende FK).
- **Allow-List ohne Account**: separate Sub-Section, um Adressen vorab freizugeben (z. B. wenn ein neuer Bearbeiter sich später selbst anmelden soll — entfällt hier, ist aber sauber vorbereitet).

Alle Admin-Aktionen schreiben `application_events`-ähnliche Audit-Einträge in eine neue Tabelle `public.admin_audit` (`actor_id`, `target_user_id`, `action`, `meta`).

## 4. Edge Function `admin-users-api`

- `verify_jwt = true`.
- Erste Aktion: prüft via `private.has_role(caller, 'admin')` — sonst 403.
- Actions: `create_user`, `set_password`, `set_admin`, `set_allowed`, `delete_user`, `list_users` (kombiniert `auth.admin.listUsers` + `profiles` + `user_roles` + `allowed_emails`).
- Schreibt `admin_audit`-Einträge.
- Loggt keine Passwörter, keine E-Mail-Bodies — nur User-ID + Action.

## 5. Edge Function `auth-check-allowlist`

- Tiny: nimmt JWT, holt `auth.uid()` + zugehörige `email`, prüft `allowed_emails`, gibt `{ allowed: boolean }`.
- Wird von `RequireAuth` und direkt nach Login aufgerufen.

## 6. Bestehendes Konto reparieren

Sobald du den Plan freigibst, setze ich im selben Zug ein neues Passwort für `tarifygb@gmail.com` (du nennst mir den Wert oder ich generiere einen zufälligen 20-Zeichen-String und zeige ihn dir einmalig) und trage die E-Mail in `allowed_emails` + `user_roles`(admin) ein. Damit kommst du wieder rein, ohne Reset-Mail.

---

## Technische Details (kompakt)

- Migration-Reihenfolge: `allowed_emails` → GRANTs → RLS → Policies → `admin_audit` → ggf. Auth-Hook-Funktion.
- `auto_confirm_email: true`, `disable_signup: true`, `password_hibp_enabled: true` via `configure_auth`.
- Google-Sign-in **nicht** aktivieren (passt nicht zu reinem Allow-List-Intern-Tool).
- Memory-Updates: neue Regel `mem://constraints/internal-only-no-self-service` (kein Self-Service-Reset, Allow-List Pflicht, Nutzer nur via Admin), Security-Memory aktualisieren.

## Reihenfolge

1. Self-Service entfernen (Datei/Route/Link/Config).
2. Migration `allowed_emails` + `admin_audit` + RLS + GRANTs.
3. Edge Functions `admin-users-api` + `auth-check-allowlist`.
4. `RequireAuth` + `LoginForm` um Allow-List-Check erweitern.
5. Admin-UI: Nutzer anlegen / Passwort setzen / sperren / Allow-List.
6. Account `tarifygb@gmail.com` reparieren (neues Passwort + Allow-List).
7. Memory + Security-Memory aktualisieren, Linter laufen lassen.

## Offen — eine Frage vor dem Start

Soll ich für `tarifygb@gmail.com` ein **von dir vorgegebenes neues Passwort** setzen, oder soll ich ein **zufälliges starkes Passwort generieren** und dir hier einmalig im Chat anzeigen?
