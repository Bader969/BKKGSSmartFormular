
# Plan: Modernes Formular-Redesign ("Navy Trust") + Roadmap

Fokus jetzt: **UI/UX-Redesign**. Backend-Features (Antrags-Records, Login-Tracking, weitere Ideen) sind als Phase 2 skizziert und werden in einem späteren Plan umgesetzt — keine Datenbankänderungen in dieser Iteration. Das bestehende Verhalten (PDF-Export, AI-Capture, Validierung, alle KK-Provider-Regeln) bleibt **unverändert**.

---

## Phase 1 — Redesign (jetzt)

### Design-System "Navy Trust"

Tokens werden in `src/index.css` und `tailwind.config.ts` als HSL-Variablen gesetzt (keine hardcoded Farben in Components, keine Verletzung der Memory-Regeln):

- `--background` Off-White `#f8fafc`
- `--foreground` Deep Navy `#0f1b3d`
- `--primary` `#1e3a5f` / `--primary-foreground` `#e8edf3`
- `--accent` `#3b6fa0` (Fokus, aktive Schritte, Links)
- `--surface` / `--surface-elevated` für Karten in zwei Tiefenstufen
- `--success` ruhiges Teal, `--warning` Bernstein, `--destructive` gedämpftes Rot — alle passend zur Navy-Palette
- Schatten: `--shadow-card`, `--shadow-elevated`, `--shadow-focus-ring` (Navy-getönt)
- Radius-Skala 8/12/16, konsistente Spacing-Skala
- Typografie: **Inter Tight** (Headings) + **Inter** (Body) via `@fontsource` — seriös, sehr lesbar für lange Formulare
- Dark Mode vorbereitet (Tokens gespiegelt), default bleibt Light

`FormSection.tsx` wird auf semantische Tokens umgestellt — die jetzigen hardcoded Hex-Farben (`#f0f4f8`, `#4a6fa5` …) verschwinden, die fünf Varianten (`member` / `spouse` / `child` / `signature` / `info`) bleiben erhalten, werden aber zu Token-Mappings.

### Layout-Shell

- Sticky **Top-Bar** mit App-Titel (dynamisches Header-Label je KK bleibt), Krankenkassen-Picker, User-Menü-Platzhalter, Dark-Mode-Toggle
- Zweispaltiges Desktop-Layout:
  - **Links**: schmale Sidebar mit Schritt-Navigation (Mitglied → Ehegatte → Kinder → Zusatzmodule → Unterschrift → Export). Aktiver Schritt highlighted, erledigte Schritte mit Check, Fehler mit rotem Dot.
  - **Rechts**: aktueller Abschnitt als großzügige Karte mit max. ~720px Lesebreite
- Mobile: Sidebar wird zu einem horizontalen Progress-Stepper oben, Sheet-Drawer für Sprungnavigation
- **Sticky Bottom Action Bar** auf mobile (Speichern/Weiter/Export), auf Desktop dezent rechts unten

### Interaktive Form-Patterns

- **Floating Labels** + animierte Fokus-States (Border-Glow in `--accent`)
- Inline-Validierung mit ruhigem Fade-in der Fehlermeldung, Erfolgs-Checkmark rechts im Feld
- Section-Cards mit subtilem Hover-Lift und Tastatur-Fokus-Ring
- **Auto-Save-Indicator** ("Entwurf gespeichert vor 3 s") — rein lokal (localStorage), kein Backend
- **Smart Disclosure**: optionale Blöcke (z. B. Ehegatte, Kinder, VIACTIV-Familienversicherung) klappen mit Motion-Animation auf/zu, Provider-abhängige Sichtbarkeit bleibt 1:1 erhalten
- **Command-Palette (⌘K)**: schnelles Springen zu Abschnitten, "Antrag exportieren", "JSON-Import öffnen"
- Verbesserte Datei-Upload-Zonen (Drag & Drop, Vorschau-Thumbnails) für Document-Merge & AI-Capture
- Toast-Stack (Sonner) mit konsistenter Navy-Optik
- Reduced-Motion respektieren (`prefers-reduced-motion`)

### Accessibility & Responsiveness

- Tastatur-Navigation durch alle Schritte, sichtbare Fokus-Ringe
- ARIA-Live-Region für Validierungs- und Auto-Save-Meldungen
- Kontrast WCAG AA gegen alle Tokens geprüft
- Breakpoints: 360 / 768 / 1024 / 1440; Formularfelder einspaltig <768, zweispaltig ≥1024
- Touch-Targets ≥ 44 px

### Betroffene Dateien (nur Frontend/Presentation)

- `src/index.css` — neue Token-Schicht
- `tailwind.config.ts` — Token-Mapping, Schatten, Radius
- `src/main.tsx` — `@fontsource/inter`, `@fontsource/inter-tight`
- `src/App.tsx` / `src/pages/Index.tsx` — neue Shell mit Sidebar + Top-Bar
- `src/components/FormSection.tsx` — Token-basiert
- `src/components/FormField.tsx` — Floating Label + Inline-Validation-Style
- `src/components/MemberSection.tsx`, `SpouseSection.tsx`, `ChildrenSection.tsx`, `ViactivSection.tsx`, `BigPlusbonusSection.tsx`, `RundumSicherPaketSection.tsx`, `SignatureSection.tsx` — Layout-/Spacing-Refresh, keine Logik-Änderungen
- `src/components/DocumentMergeDialog.tsx`, `JsonImportDialog.tsx`, `FreitextImportDialog.tsx` — Dialog-Refresh
- `src/components/LoginForm.tsx` — visuell an Navy Trust angepasst
- Neu: `src/components/AppShell.tsx`, `src/components/StepSidebar.tsx`, `src/components/CommandPalette.tsx`, `src/components/AutoSaveIndicator.tsx`

**Nicht angefasst**: alle `src/utils/*Export.ts`, `krankenkassenMapping.ts`, `validation.ts`, `generateSignature.ts`, Edge Function, alle KK-spezifischen Regeln, JSON/Freitext-Import-Logik.

---

## Phase 2 — Backend & Records (späterer Plan)

Nur als Skizze, **wird nicht jetzt umgesetzt** — braucht eigene Freigabe, besonders wegen PII.

### Antrags-Records ("Vollständige Daten verschlüsselt speichern")

- Neue Tabelle `public.applications`: `id`, `user_id`, `krankenkasse`, `status` (draft/exported), `payload_encrypted` (bytea, AES-GCM via pgsodium oder Vault), `payload_iv`, `pdf_count`, `exported_at`, `created_at`, `updated_at`
- RLS: Bearbeiter sieht nur eigene (`auth.uid() = user_id`), Admin sieht alle via `private.has_role(auth.uid(),'admin')`
- Neue Tabelle `public.application_events`: Audit-Log (created/updated/exported/imported) mit `user_id`, `application_id`, `event_type`, `meta`, `created_at` — append-only
- Edge Function für Encrypt/Decrypt, damit Schlüssel nie im Client liegt
- **Wichtig**: bestehende Memory-Regel "No PII persistence" muss ausdrücklich aufgehoben und durch eine neue Regel ("PII nur verschlüsselt, RLS pro Bearbeiter + Admin, Audit-Log Pflicht") ersetzt werden

### UI für Records

- Neue Route `/antraege`: Tabelle mit Filter (KK, Status, Datum, Bearbeiter für Admin), Detail-Drawer mit Entschlüsselung on-demand, Re-Export-Button, Audit-Timeline

### Login & Rollen

- Bestehender Login bleibt, ergänzt um Self-Service Passwort-Reset (`/reset-password`)
- Optional Google-Sign-in (Lovable Cloud managed)
- Admin-Bereich `/admin`: Nutzer-Liste, Rollen-Zuweisung (`user_roles` ist bereits da)

### Kreative Zusatzvorschläge

- **Entwurfs-Versionierung**: jeder Speicherstand als Snapshot, "Vorherige Version wiederherstellen"
- **Vorlagen**: häufige Familienkonstellationen als Template speichern (ohne PII, nur Struktur)
- **Duplikat-Erkennung**: Hash auf KV-Nummer + Geburtsdatum, warnt vor doppeltem Antrag
- **Bearbeiter-Übergabe**: Antrag einem Kollegen zuweisen, mit Kommentar-Thread
- **Statistik-Dashboard** für Admin: Anträge pro KK/Monat, durchschnittliche Bearbeitungszeit
- **Bulk-Export**: alle Anträge einer Woche als ZIP
- **Webhook/Email-Benachrichtigung** bei abgeschlossenem Antrag
- **Mehrsprachigkeit** (DE/EN) vorbereiten
- **PWA-Modus** mit Offline-Entwürfen
- **Audit-Export** als CSV für Compliance

---

## Reihenfolge der Umsetzung (Phase 1)

1. Token-Schicht + Fonts + Tailwind-Config
2. App-Shell (Top-Bar, Sidebar, Bottom-Action-Bar, Responsive)
3. `FormSection` + `FormField` auf neue Tokens
4. Section-Komponenten visuell refreshen (keine Logik)
5. Dialoge & Login-Screen anpassen
6. Command-Palette + Auto-Save-Indicator
7. Accessibility-/Responsive-Pass + Smoke-Test im Preview

Nach Freigabe starte ich mit Schritt 1.
