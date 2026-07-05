# KVSmart — Antragsplattform Familienversicherung / Zusatzprodukte

> Vollständige technische Dokumentation des Ist-Zustands zur Übernahme in eine
> lokale Entwicklungsumgebung. Sprache absichtlich gemischt DE/EN, weil das
> Domänen-Vokabular (Krankenkasse, Familienversicherung, Rundum-Sicher-Paket,
> Beitrittserklärung, Plusbonus …) deutsch ist und die Feldnamen im Code
> ebenfalls deutsch sind.

Diese Datei deckt in diesem Teil **Sektionen 1–3** ab
(Architektur & Stack · Frontend/UI · Backend/DB/Supabase). Sektionen
4 (Security & RLS), 5 (AI / Webhooks / externe Services) und 6
(Edge Cases / Workarounds / Tech Debt) folgen im nächsten Antwortblock —
bitte einfach "weiter" antworten.

---

## 1. Architektur & Core Tech Stack

### 1.1 High-level Überblick

Die Anwendung ist eine **rein clientseitige React SPA** (Vite + TypeScript),
die pro Krankenkasse (BKK GILDEMEISTER SEIDENSTICKER, VIACTIV, Novitas BKK,
DAK, BIG direkt gesund) einen individuellen "Smart Formular"-Workflow rendert
und daraus **fertig ausgefüllte PDF-Anträge** erzeugt (AcroForm-Ausfüllung
mit `pdf-lib`, ergänzt durch `jspdf` für frei generierte Dokumente wie das
Rundum-Sicher-Paket).

Serverseitige Logik läuft ausschließlich in **Supabase Edge Functions (Deno)**:

| Function | Zweck |
| --- | --- |
| `applications-api` | AES-GCM-256 Ver-/Entschlüsselung der Anträge, Audit-Events |
| `admin-users-api` | Admin-CRUD auf Nutzer, Rollen, `allowed_emails` |
| `auth-check-allowlist` | Vor-Login-Check gegen `public.allowed_emails` |
| `send-application-email` | Versand fertiger PDFs via Gmail-Connector (RFC-2822 MIME) |
| `process-insurance-gemini3` | OCR-/Struktur-Extraktion aus Ausweis/eGK/Meldebescheinigung mit Google Gemini 2.5 (via Lovable AI Gateway) |
| `whatsapp-intake` | WHAPI-Webhook: puffert Nachrichten pro Chat, erkennt "…"-Trenner (3 Punkte × 2), ruft OCR und legt Draft an |

Die Datenbank (Supabase Postgres) speichert **niemals Klartext-PII** in den
Antragsspalten: Payloads sind AES-GCM-verschlüsselt mit einem Schlüssel, der
ausschließlich im Edge-Function-Secret `APPLICATIONS_ENCRYPTION_KEY` lebt.

### 1.2 Frontend-Framework & Build

- **React 18.3** + **TypeScript 5.8** (kein SSR, kein Next.js).
- **Vite 5.4** mit `@vitejs/plugin-react-swc` (SWC statt Babel — schnellerer
  Refresh, schlankere Chunks). Dev-Server auf Port 8080 (`vite.config.ts`).
- `lovable-tagger` als Vite-Plugin ausschließlich im `development`-Mode
  (Component-Tagging für die Lovable-Editor-UI, im Build entfernt).
- Path-Alias `@/*` → `./src/*` (`vite.config.ts` + `tsconfig.json`).
- TSConfig ist bewusst tolerant: `strictNullChecks: false`,
  `noUnusedLocals: false`, `noImplicitAny: false`, `allowJs: true`.
  Motivation: schneller iterativer Feature-Bau über Monate; wir erkaufen uns
  Laufzeit-Robustheit durch Zod-Schemas in AI-Antworten und harte
  Runtime-Guards in `validation.ts`.

### 1.3 Styling

- **Tailwind CSS 3.4** mit `tailwindcss-animate` und
  `@tailwindcss/typography`.
- **shadcn/ui** (radix-Primitives) — vollständig kopiert in
  `src/components/ui/*` (Accordion, Alert-Dialog, Button, Calendar, Card,
  Command, Dialog, Drawer, DropdownMenu, Form, Input, Label, Popover,
  RadioGroup, ScrollArea, Select, Separator, Sheet, Sidebar, Skeleton,
  Sonner, Switch, Tabs, Textarea, Toast, Toggle, Tooltip …). Nichts
  automatisch nachgezogen — wir modifizieren die Komponenten direkt.
- Design-Tokens in `src/index.css` als CSS-Variablen; Dark-Mode via
  `next-themes` + eigenem `useTheme`-Hook (`src/hooks/useTheme.ts`).
- Schriften self-hosted über `@fontsource/*` (Inter, Inter-Tight, Caveat) —
  Caveat wird für Signatur-Rendering (`generateSignature.ts`) genutzt.

### 1.4 Router & Layout

`react-router-dom@6`, Definition in `src/App.tsx`:

| Route | Component | Schutz |
| --- | --- | --- |
| `/` | `pages/Index.tsx` (Haupt-Formular) | öffentlich — Login-Gate intern |
| `/trust` | `pages/Trust.tsx` | öffentlich |
| `/antraege` | `pages/Applications.tsx` | `RequireAuth` |
| `/admin` | `pages/Admin.tsx` | `RequireAuth` + Admin-Check |
| `/empfaenger` | `pages/EmailSettings.tsx` | `RequireAuth` + Admin |
| `/big-autofill-setup` | `pages/BigAutofillSetup.tsx` | `RequireAuth` |
| `*` | `pages/NotFound.tsx` | — |

`RequireAuth` prüft `supabase.auth.getSession()`, zeigt Loading-State und
rendert bei fehlender Session `LoginForm`.

### 1.5 Kritische Dependencies (warum vorhanden)

| Paket | Grund |
| --- | --- |
| `pdf-lib` | AcroForm-Manipulation aller Krankenkassen-Original-PDFs |
| `jspdf` | Neuerzeugung des Rundum-Sicher-Paket-Blattes (freies Layout) |
| `@supabase/supabase-js@2.89` | Auth + `supabase.functions.invoke` |
| `@tanstack/react-query@5` | Provider gesetzt, tatsächlich nur punktuell im Admin genutzt — Rest ist manuelles `useState`/`useEffect` |
| `react-hook-form` + `@hookform/resolvers` + `zod` | Punktuell (Freitext-Import validiert Zod-Schemas) |
| `sonner` + `@radix-ui/react-toast` | Zweigleisige Toasts: Sonner für schnelle Success/Error, shadcn für Aktions-Toasts |
| `lucide-react` | Icon-Set |
| `date-fns@3` | Datumsformatierung; `dateUtils.ts` kapselt DD.MM.YYYY ↔ YYYY-MM-DD |
| `xlsx` | Antragsliste (Admin) als Excel |
| `next-themes` | Dark/Light/System |
| `@types/react-signature-canvas` | Nur Types — Laufzeit-Signature wird aus Klartext + Caveat-Font gerendert (Tech-Debt-Kandidat) |
| `vaul` | Drawer (`ApplicationDetailDrawer`) |
| `cmdk` | Command-Palette Basis für Länder-Auto-Complete |

### 1.6 Projekt-/Ordnerstruktur

```text
.
├── ARCHITECTURE.md
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig*.json
├── mem/                     Projekt-Memory (Rules)
├── public/                  favicon, robots, placeholder
├── src/
│   ├── App.tsx              Router + Provider
│   ├── main.tsx             Font-Imports + Root-Render
│   ├── index.css            Tailwind + CSS-Token
│   ├── App.css              Legacy globals
│   ├── bookmarklets/
│   │   └── bigAutofillSource.ts
│   ├── components/          Feature-Komponenten
│   │   └── ui/              shadcn-Kopien
│   ├── hooks/
│   ├── integrations/supabase/  Auto-Gen (client.ts, types.ts) — nicht editieren
│   ├── lib/utils.ts         cn()
│   ├── pages/               Route-Level
│   ├── types/form.ts        Zentrale FormData/Enums (Herzstück)
│   └── utils/               Business-Logik (kein React)
├── supabase/
│   ├── config.toml          whatsapp-intake: verify_jwt=false
│   ├── functions/           6 Edge Functions
│   └── migrations/          15 SQL-Migrationen
```

---

## 2. Frontend & User Interface — 100 % Feature-Coverage

### 2.1 Globales State-Modell (`src/types/form.ts`)

Die gesamte Antrags-Session ist **ein einziges `FormData`-Objekt** in
`pages/Index.tsx` (`useState`). Enthält u. a.:

- `mode`: `'familienversicherung_und_rundum' | 'nur_rundum'`
- `selectedKrankenkasse`: `'bkk_gs' | 'viactiv' | 'novitas' | 'dak' | 'big_plusbonus' | ''`
  — steuert **jede** nachfolgende UI-Sektion, jede Validierung und jeden
  Export. Vor der Auswahl sind alle Sektionen ausgeblendet (Core Rule
  "Krankenkasse-first").
- Mitglied-Block: Name, Vorname, Geburtsdatum, Geburtsort, Geburtsland,
  Straße, Hausnummer, PLZ, KV-Nummer, Krankenkasse (Freitext), Telefon,
  E-Mail, Familienstand.
- `ehegatte`: `FamilyMember` + `ehegatteKrankenkasse`.
- `kinder: FamilyMember[]`.
- `rundumSicherPaket`: IBAN, Kontoinhaber, Zeitraum, Ärzte pro Person, zwei
  Zusatzversicherungen, Jahresbeitrag, zwei Datenschutz-Checkboxen.
- `viactiv*`-Block: Geschlecht (weiblich/männlich/divers), Beschäftigung
  (10 Optionen), Versicherungsart (6 Optionen), Arbeitgeber-Objekt,
  Bonus-Programm-Felder (Vertragsnummer, IBAN, Kontoinhaber),
  Staatsangehörigkeit.
- `big*`-Block: Geschlecht, `bigBank` (Kontoinhaber Vor-/Nachname,
  Kreditinstitut, IBAN, BIC, Ort, Datum), Versicherungsstatus (neuabschluss/
  bestehend), `bigHoeheEuro` (Gesamtsumme), `bigHoeheEuroSelfRandom`
  (persistierter Zufallswert 200–245 € für Eigenanteil des Hauptmitglieds
  — `utils/bigRandom.ts`), `bigVersicherungsarten` (4 Booleans),
  `bigMitversicherte[]`, `bigFamilienversicherung` (Variante A/B-Toggle),
  `bigMitgliedBeschaeftigt` ('beschaeftigt' | 'arbeitslos').
- `unterschrift` / `unterschriftFamilie`: Klartextnamen, aus denen die
  Signatur-Bitmap generiert wird.
- `vertriebspartner`: Preset (`utils/vertriebspartner.ts`) oder Freitext,
  persistiert in `localStorage[VP_STORAGE_KEY]`.

`FamilyMember` trägt Stammdaten + "bisherige Versicherung"-Historie
(`bisherigArt` ∈ {mitgliedschaft, familienversicherung, nicht_gesetzlich},
`bisherigEndeteAm`, `bisherigBestandBei`, `bisherigVorname/Nachname`,
`bisherigBestehtWeiter`, `bisherigBestehtWeiterBei`) + `familienversichert`,
`eigeneMitgliedschaft` (VIACTIV → separate Beitrittserklärung; BIG →
eigenes Plusbonus-PDF) + optional `eigenePlusbonus`
(`BigVersicherungsstatus` + `BigVersicherungsarten` + Beitragshöhe).

`createInitialFormData()`: heutiges `datum`, `beginnFamilienversicherung`
auf letzten Tag des Monats vor "heute + 3 Monate" (3-Monats-Vorlauf, s.
Memory `logic/viactiv-date-logic`). Nested-Objekte über
`createEmpty*()`-Factories.

### 2.2 Routen im Detail

#### `/` — Index (Haupt-Formular)

Datei: `src/pages/Index.tsx` (~1056 Zeilen). Layout:

1. **Header** mit Logo (Sparkles-Icon), dynamischem Titel (Memory
   `ui/header-dynamic-labels`).
2. **Auth-Gate**: `authLoading` → Spinner; ohne Session → `LoginForm`.
3. **Krankenkassen-Radio** (`KRANKENKASSEN_OPTIONS`). Solange leer bleibt
   der Rest ausgeblendet.
4. **Modus-Radio** (`familienversicherung_und_rundum` vs `nur_rundum`) —
   nur für BKK GS sichtbar (andere Kassen fahren "nur
   Familienversicherung" oder eigene Bahn stumm).
5. **Vertriebspartner** Select + Freitext-Fallback (persistiert).
6. **MemberSection**, **SpouseSection**, **ChildrenSection**.
7. **Provider-spezifische Zusatzsektionen**:
   - VIACTIV → `ViactivSection` (Beschäftigung, Versicherungsart,
     Arbeitgeber, Bonus-Programm; "Beschäftigt seit"-Feld ist entfernt
     laut Memory `viactiv/employment-fields`).
   - BIG → `BigPlusbonusSection` (Bank, Status, Höhe, Versicherungsarten,
     Mitversicherte inkl. `EigenePlusbonusBlock`, Variante-A/B-Toggle).
   - Modus `familienversicherung_und_rundum` → `RundumSicherPaketSection`.
8. **SignatureSection**: Text-Input Mitglied + Live-Preview via
   `generateSignature.ts`; optional Familien-Signatur.
9. **Action-Bar**: Speichern, JSON-Import, Freitext-Import, PDF-Export,
   Dokumente zusammenfügen, E-Mail versenden, Antragsliste, Admin (nur
   `isAdmin`), Empfänger (nur Admin), Logout.

**Automatiken** (Effects in `Index.tsx`):

- Bei `selectedKrankenkasse === 'big_plusbonus'` +
  `bigFamilienversicherung` wird `bigMitversicherte` aus Ehegatte + Kindern
  ohne `eigeneMitgliedschaft` rekonstruiert. Reihenfolge Ehegatte → Kinder;
  Format `"Nachname, Vorname"`. Bereits gesetztes `hoehePolice` bleibt
  erhalten.
- KV-Nummer wird `onBlur` per `normalizeInsuranceNumber()` normalisiert
  (Groß, führender Buchstabe, OCR-Verwechsler `0↔O`, `1↔I`, `5↔S`, `8↔B`).
- `sessionStorage.loadedApplication` wird beim Mount ausgelesen (Deep-Link
  aus `/antraege`).
- `vpMode` synchronisiert Preset vs Custom bei externer Änderung
  (JSON-Import, geladener Antrag).
- Kein globaler `beforeunload`-Guard — der Nutzer wird via UI-Warnung
  gebeten zu speichern (kein Auto-Save wegen Kryptokosten).

#### `/antraege` — Applications

`src/pages/Applications.tsx`. Datenquelle: `applications-api` (verb `list`).
User sieht eigene Anträge; Admin alle.

- Tabelle: Antragsteller (`applicant_vorname` + `applicant_name` — Klartext
  neben verschlüsseltem Payload, damit die Liste ohne Key rendert),
  Krankenkasse, `antragsform`, Vertriebspartner, Status, `updated_at`.
- Aktionen:
  - **Öffnen** → `applications-api` `action:'get'` → serverseitig
    entschlüsseln → `sessionStorage.loadedApplication` → Navigation `/`.
  - **Detail-Drawer** (`ApplicationDetailDrawer`, `vaul`): Meta +
    Sub-Personen + "BIG online ausfüllen"-Buttons pro Person (Haupt,
    Ehegatte, Kind), Payload wird pro Klick neu berechnet
    (Sub-Payload: Person = Ehegatte/Kind, Adresse/Bank vom Haupt-Mitglied,
    `geburtsname = mitgliedName` als Fallback).
  - **Audit-Timeline** (`ApplicationAuditTimeline`) — liest
    `application_events`.
  - **Löschen** (Admin oder Owner).
- **Excel-Export** via `xlsx` — nur Meta, kein PII.

#### `/admin`

`src/pages/Admin.tsx`. Guard: `RequireAuth` + `useUserRole().isAdmin`
(client-seitige Weiterleitung; Server prüft Rolle erneut in `admin-users-api`).

- Nutzerliste (`profiles ⨝ user_roles`).
- Rolle togglen: setzt/entfernt `user_roles.role='admin'`.
- `allowed_emails` verwalten (Add/Remove; `citext` → Case-Insensitive).
- Jede Aktion → `admin_audit`-Zeile (append-only Trigger, keine PII).

#### `/empfaenger` — EmailSettings

Tabellen `email_templates` + `application_recipients`. Admin-only-CUD;
`authenticated` liest (Templates/Empfänger sind kein Geheimnis).
Templates verwenden `{{placeholder}}`, die im `SendEmailDialog` via
`utils/emailTemplate.ts` ersetzt werden.

#### `/big-autofill-setup`

`src/pages/BigAutofillSetup.tsx`. Erzeugt on-the-fly ein Bookmarklet aus
`src/bookmarklets/bigAutofillSource.ts` (String-Konkatenation +
`javascript:`-URI-Encoding), das der Nutzer per Drag-and-Drop in die
Lesezeichen-Leiste zieht. Zweck: Ausfüllen des BIG-direkt-Online-Antrags
(mehrstufiger Angular-Material-Wizard).

#### `/trust`

Statische Datenschutz-/Trust-Seite (AES-GCM, RLS, Append-Only-Audit,
No-PII-Logging).

#### `*`

`NotFound` mit Link zurück nach `/`.

### 2.3 UI-Komponenten (feature-level)

- **MemberSection**: Reihenfolge **Vorname → Name** (Core Rule).
  Geburtsort/-Land: Land wird beim Extract aus Ort abgeleitet (Memory
  `logic/birth-location-derivation`). KV-Nummer normalisiert `onBlur`.
  BKK GS: PLZ → Ort-Autocomplete.
- **SpouseSection**: `FamilyMemberForm` mit Ehegatten-Feldern
  (Verwandtschaft irrelevant → hidden). Toggle "eigene Mitgliedschaft":
  VIACTIV → separate BE (`viactivExport.ts` + `viactivFamilyExport.ts`);
  BIG → eigenes Plusbonus-PDF + `EigenePlusbonusBlock`.
- **ChildrenSection**: dynamische Liste + "Kind hinzufügen". Für Kinder
  < 15 wird der `eigeneMitgliedschaft`-Toggle ausgeblendet (Memory
  `viactiv/child-membership-logic-v2`).
- **FamilyMemberForm**: reusable, propagiert Änderungen über
  `onChange(patch)`. Enthält die "bisherige Versicherung"-Historie
  (bedingt sichtbar).
- **RundumSicherPaketSection**: IBAN-Validierung (`validation.ts`),
  Ärzte-Liste synchron zu Kinderliste, Zusatzversicherung-Dropdowns
  (`ZUSATZVERSICHERUNG_OPTIONS`), Jahresbeitrag-Freitext, zwei
  Datenschutz-Checkboxen (beide Pflicht für Export).
- **ViactivSection**: Radios + Select für Beschäftigung; "beschäftigt"
  macht ganzen Arbeitgeber-Block sichtbar + required.
- **BigPlusbonusSection**: Variante-A/B-Toggle,
  `bigMitgliedBeschaeftigt`-Radio steuert Familie familienversichert vs
  eigene Mitgliedschaft (Memory `big-direkt-integration`).
  Auto-Compute Gesamtsumme = `bigHoeheEuroSelfRandom` +
  Σ(`bigMitversicherte[i].hoehePolice`).
- **JsonImportDialog**: Klebt JSON (Format pro Krankenkasse dynamisch,
  Memory `data-import-logic/provider-context-awareness`), Zod-Validation,
  Merge in `FormData`, Signatur-Datum auf heute.
- **FreitextImportDialog**: Copy-Paste-Feld; ruft
  `process-insurance-gemini3` mit `input_type: 'text'`; Mapping via
  `applyKrankenkassenMapping`.
- **DocumentMergeDialog**: PDFs + Bilder → ein PDF (`pdf-lib`). **Kein**
  Auto-Crop, keine Enhancements (Memory `features/document-merging`).
  Naming-Konvention pro Provider (Memory
  `constraints/pdf-naming-conventions`), inkl. Multi-Part-Splitting
  `_Teil2`.
- **SendEmailDialog**: Template-Auswahl, Live-Vorschau, Attachment-Auswahl
  aus soeben generierten PDFs, ruft `send-application-email` (Base64).
- **SignatureSection/SignaturePreview**: Canvas-basiert (Font "Caveat" +
  Baseline-Jitter), Ergebnis als PNG-DataURL an die Exporter.
- **CopyBlockButton**: One-Line-Summary + Copy (Memory
  `data-import-logic/ui-and-copy-blocks`).
- **ApplicationDetailDrawer**: Vaul-Drawer, "BIG online ausfüllen" pro
  Person (Payload in `localStorage.bigAutofillPayload`).
- **ThemeToggle** / **NavLink**: kosmetisch.

### 2.4 Hooks

- `useApplicationPersistence` — Wrapper um `applications-api`
  (`save`, `markExported`, `saving`). Debouncing beim Aufrufer.
- `useUserRole` — liest `user_roles`, exponiert `isAdmin`, `isUser`,
  `loading`.
- `useTheme` — Wrapper um `next-themes` mit Initial-Sync auf System.
- `use-toast`, `use-mobile` — shadcn-Standards.

### 2.5 Validierung (`src/utils/validation.ts`)

Vor jedem Export:

- `isValidIBAN`, `isValidBIC`, `isValidPLZ`, `isValidEmail`,
  `isValidPhone`.
- `isValidInsuranceNumber` (siehe 3.3).
- `validateMandatoryContacts(formData)` — Telefon + E-Mail sind global
  Pflicht (Core Rule).
- `validateAddress(formData)` — provider-abhängig (Memory
  `constraints/address-validation-and-export`).
- `validateBigVariant(formData)` — Variante A vs B unterschiedliche
  Pflichtfelder.

Fehler → `sonner.error(…)`; kritische Fehler blockieren den Export.

### 2.6 UX-Feinheiten

- Datumsfelder toggeln zwischen HTML `type=date` (YYYY-MM-DD) und Klartext
  DD.MM.YYYY (`dateUtils.ts`) — VIACTIV verlangt DE-Format im PDF, andere
  ISO.
- `insuranceNumbers.ts` hat eine identische Kopie in
  `process-insurance-gemini3/index.ts` (Deno kann kein Frontend-Modul
  importieren — s. Sektion 6).
- Country-Autocomplete via `cmdk` + `utils/countries.ts` (deutscher Name +
  ISO-Code); Mapping-Logik in Memory `logic/country-code-mapping`.
- Dark-Mode-Toggle im Header.
- Sonner + shadcn-Toaster parallel im Einsatz (Sonner für Import-Feedback,
  shadcn für Aktions-Toasts).

---

## 3. Backend, Datenbank & Supabase-Integration

### 3.1 Schema-Übersicht (`public`)

| Tabelle | Rolle |
| --- | --- |
| `profiles` | 1:1 zu `auth.users`, Anzeige-Name + E-Mail |
| `user_roles` | Rollen (`admin`/`user`) — Enum `app_role` |
| `allowed_emails` | Whitelist für Registrierung (`citext`) |
| `admin_audit` | Append-only Log von Admin-Aktionen |
| `applications` | Verschlüsselte Antrags-Payloads + Meta |
| `application_events` | Append-only Antrags-Timeline |
| `application_recipients` | E-Mail-Empfänger pro Krankenkasse × Antragsform |
| `email_templates` | Betreff/Body mit `{{platzhalter}}` |
| `whatsapp_inbox_messages` | WHAPI-Puffer (nur `service_role`) |

**Enums:** `public.app_role = ('admin','user')`.

**Schemas:**

- `public` — Data-API sichtbar.
- `private` — `has_role()`-Wrapper, nur `authenticated`/`service_role`.
- `extensions` — `citext`, `pgcrypto`.

### 3.2 Tabellen im Detail

#### `applications`

```text
id                     uuid PK
user_id                uuid NOT NULL → auth.users(id) ON DELETE CASCADE
krankenkasse           text NOT NULL      -- 'bkk_gs' | 'viactiv' | ...
status                 text NOT NULL CHECK IN ('draft','exported') DEFAULT 'draft'
payload_encrypted      bytea NOT NULL     -- AES-GCM-256 Ciphertext
payload_iv             bytea NOT NULL     -- 12-Byte IV
payload_hash           text NOT NULL      -- SHA-256 des canonical JSON (Dedupe)
pdf_count              integer NOT NULL DEFAULT 0
exported_at            timestamptz
last_opened_at         timestamptz
created_at             timestamptz NOT NULL DEFAULT now()
updated_at             timestamptz NOT NULL DEFAULT now()
vertriebspartner       text
applicant_name         text   -- Klartext, damit Liste ohne Key rendert
applicant_vorname      text
antragsform            text   -- 'familienversicherung' | 'beitritt' | 'plusbonus' | ...
parent_application_id  uuid → applications(id) ON DELETE CASCADE
person_role            text   -- 'main' | 'spouse' | 'child'
person_index           int    -- Index bei Kindern
source                 text NOT NULL DEFAULT 'manual'   -- 'manual' | 'whatsapp'
intake_meta            jsonb NOT NULL DEFAULT '{}'      -- z.B. WHAPI block_id
```

Indizes: `user_id`, `krankenkasse`, `payload_hash`, `parent_application_id`,
`source`. Unique-Index
`(parent_application_id, person_role, person_index)` wo
`parent_application_id IS NOT NULL`.

Trigger: `update_applications_updated_at` (BEFORE UPDATE →
`update_updated_at_column`).

#### `application_events`

`event_type` ∈ `'created','updated','exported','opened','decrypted','deleted'`.
`meta jsonb`: **keine PII**, nur `krankenkasse`, `pdf_count`, strukturelle
Counts. Trigger `application_events_no_update` bleibt aktiv;
`application_events_no_delete` wurde in Migration `20260703143443`
**entfernt**, damit `ON DELETE CASCADE` von `applications` sauber die Events
wegräumt.

#### `whatsapp_inbox_messages`

```text
id            uuid PK
chat_id       text NOT NULL
wa_message_id text NOT NULL UNIQUE
type          text NOT NULL   -- 'dot' | 'phone' | 'email' | 'header' | 'text' | 'image' | 'pdf' | 'audio'
text          text
media_url     text
media_mime    text
block_id      uuid            -- Gruppierung zwischen zwei "..."-Trennern
processed_at  timestamptz
received_at   timestamptz DEFAULT now()
created_at    timestamptz DEFAULT now()
```

RLS: **nur** `deny all authenticated` — Zugriff ausschließlich über
`service_role` in der Edge Function.

#### `admin_audit`

Append-only via Trigger `prevent_admin_audit_modification` auf UPDATE +
DELETE. `meta` enthält keine PII, nur `old_role`, `new_role`,
`email_added` o. ä.

#### `allowed_emails`

`email citext PRIMARY KEY` (automatisch case-insensitiv). Nur
Admin-Policy für alle CRUD.

#### `application_recipients`, `email_templates`

Lesbar für alle `authenticated`; CUD nur Admins.

### 3.3 Funktionen & Trigger

| Funktion | Zweck |
| --- | --- |
| `private.has_role(uuid, app_role) → boolean` | Security-Definer, nur `authenticated`/`service_role` — vermeidet RLS-Rekursion |
| `public.update_updated_at_column()` | Standard-`updated_at`-Trigger |
| `public.handle_new_user()` | AFTER INSERT auf `auth.users` → seedet `profiles` + `user_roles.role='user'` |
| `public.prevent_application_events_modification()` | Exception bei UPDATE (DELETE-Trigger entfernt) |
| `public.prevent_admin_audit_modification()` | Exception bei UPDATE/DELETE |

Rechte-Sperren:

- `has_role`: `EXECUTE` nur `authenticated`, `service_role`.
- `handle_new_user`, `update_updated_at_column`: `EXECUTE REVOKED FROM
  PUBLIC, anon, authenticated` — laufen nur als Trigger-Owner.

### 3.4 Migrations-Chronik

1. `20260617200150` — Enum `app_role`, `profiles`, `user_roles`,
   `has_role`, RLS-Policies, `handle_new_user`, Admin-Seed
   (`tarifygb@gmail.com`).
2. `20260617200202` — `private.has_role` + `DROP public.has_role`,
   Policies umgehängt.
3. `20260621171324` — Admin-Passwort-Reset.
4. `20260626092933` — `applications` + `application_events` +
   Append-only-Trigger.
5. `20260626110313` — Historische Wiederholung der `applications`-DDL
   (idempotent).
6. `20260627144804` — `allowed_emails`, `admin_audit`, Extensions in
   Extensions-Schema, finales Admin-Passwort.
7. `20260627155703/711/160243` — Klein-Fixes (Extension-Schema, Passwort).
8. `20260629180208` — `applications`: `vertriebspartner`, `applicant_name`,
   `applicant_vorname`, `antragsform`.
9. `20260630222108` — Sub-Anträge: `parent_application_id`, `person_role`,
   `person_index`, Unique-Index.
10. `20260703130659` — `whatsapp_inbox_messages` + `source` + `intake_meta`.
11. `20260703130711` — Deny-All-Policy für `whatsapp_inbox_messages`.
12. `20260703140818` — Cleanup vorhandener WhatsApp-Drafts + Inbox-Reset.
13. `20260703143443` — `application_events_no_delete` entfernt.

### 3.5 Frontend ↔ Backend

- **Auth**: `supabase.auth.signInWithPassword` (LoginForm), Session in
  `localStorage`.
- **Direkte Table-Reads**: `profiles`, `user_roles`, `allowed_emails`,
  `application_recipients`, `email_templates`, `application_events`
  (RLS filtert). **Keine Realtime-Subscriptions.**
- **Writes auf `applications`**: **nur** über `applications-api`
  (Server hat den Encryption-Key). Verben (Body-Feld `action`):
  `save`, `get`, `list`, `delete`, `markExported`.
- **`admin-users-api`**: `list_users`, `set_role`,
  `add_allowed_email`, `remove_allowed_email`, `delete_user`
  (Server prüft Admin-Rolle via `service_role`-Client).
- **`auth-check-allowlist`**: LoginForm ruft vor Signup
  (`{email}` → `{allowed: boolean}`); nur wenn `true`, wird Registrierung
  angeboten.
- **`send-application-email`**: `SendEmailDialog` schickt
  `{ to, cc, bcc, subject, body, attachments[{filename,mimeType,base64}] }`.
- **`process-insurance-gemini3`**: `FreitextImportDialog` schickt
  `{ input_type, payload }` und erhält strukturiertes JSON.
- **`whatsapp-intake`**: kein Client-Aufruf — WHAPI-Webhook mit Header
  `X-Intake-Secret`.

---

Bitte mit **"weiter"** antworten für Sektion 4 (Auth-Flow + RLS pro Tabelle
Zeile für Zeile), Sektion 5 (Gemini-Modellversion + Prompt-Details,
WHAPI-Webhook-Format, Gmail-Connector-MIME) und Sektion 6 (bekannte
Workarounds — duplizierter `insuranceNumbers.ts`, Legacy
`react-signature-canvas`, tolerante `tsconfig`, doppeltes Toaster-System,
Angular-Material-Autofill-Grenzen, Doppel-DDL-Migration `20260626110313`,
Auto-DELETE-Trigger-Entfernung, VP-Persistenz nur lokal etc.).
