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

## 4. Security, Auth-Flow & RLS

### 4.1 Authentication flow (step-by-step)

The app is a **closed, invite-only internal tool**. There is no public signup, no OAuth provider, no email confirmation link, no password-reset self-service. Every account is provisioned by an admin.

#### 4.1.1 Client-side session bootstrap

1. `src/main.tsx` mounts `<App/>`, which wraps every protected route in `<RequireAuth>` (`src/components/RequireAuth.tsx`). Public routes: `/` (Index), `/trust`.
2. `RequireAuth` mounts and immediately does two things **in parallel** on purpose (the order matters — Supabase JS best practice):
   - Registers an `onAuthStateChange` listener. Whenever the session changes (sign in, sign out, token refresh), it updates local `session` state and, if the session is cleared, resets the allow-list decision to `null`.
   - Calls `supabase.auth.getSession()` to hydrate the initial session from `localStorage`. `client.ts` configures `persistSession: true`, `autoRefreshToken: true`, `storage: localStorage`.
3. If no session → `<LoginForm/>` is rendered (full-screen).
4. If a session exists → a **second effect** invokes the edge function `auth-check-allowlist` (see 4.1.3). Until the response arrives, a “Prüfe Zugriff…” placeholder is shown. If the response is not `{ allowed: true }` the client calls `supabase.auth.signOut()` and re-renders `<LoginForm/>`.

#### 4.1.2 Login (`src/components/LoginForm.tsx`)

1. User submits `email` + `password`.
2. `supabase.auth.signInWithPassword({ email, password })`. Bad credentials → generic “Ungültige E-Mail oder Passwort”.
3. On success, `supabase.functions.invoke('auth-check-allowlist')` runs a **second gate**.
4. If not allowed → `supabase.auth.signOut()` + inline error “Dieses Konto ist nicht für den Zugriff freigegeben.”
5. If allowed → `onLogin?.()` fires. `RequireAuth` re-renders with the protected tree.

There is **no** UI for signup or password reset — the copy explicitly says “Passwort vergessen? Bitte an einen Administrator wenden.”

#### 4.1.3 Allow-list edge function (`supabase/functions/auth-check-allowlist/index.ts`)

- Reads `Authorization: Bearer <access_token>` from the request.
- Verifies the user with an anon-key client bound to that token (`auth.getUser()`).
- Uses the service-role client to `SELECT` from `allowed_emails` with an `ILIKE` match on `user.email` (case-insensitive).
- Returns `{ allowed: !!data }`. Never returns the DB row itself — only a boolean.
- Error branches: `no_token` (401), `no_user` (401), `lookup_error` (500), `exception` (500). No PII in logs.

The allow-list is **defense in depth**: even if a bad actor obtains a Supabase-issued session, they cannot enter protected routes unless their email is in `allowed_emails`. Admin CRUD on the list is done via `admin-users-api` (see 4.3).

#### 4.1.4 Server-side session validation in edge functions

Every non-webhook function follows the same pattern:

```ts
const auth = req.headers.get("Authorization") ?? "";           // must be Bearer <jwt>
const userClient = createClient(URL, ANON, { global: { headers: { Authorization: auth } } });
const { data: { user } } = await userClient.auth.getUser();    // re-validates against Auth server
```

- `applications-api`, `admin-users-api`, `auth-check-allowlist`, `send-application-email`: JWT required.
- `process-insurance-gemini3`: JWT required **or** trusted service-role token (used by `whatsapp-intake` server-to-server).
- `whatsapp-intake`: JWT **not** required. Auth is via header `X-Intake-Secret` = `WHATSAPP_INTAKE_SECRET`, or query param `?s=`/`?secret=`. Admin “rescan” actions additionally accept a valid admin JWT.

Functions never trust user id from request bodies; they read it from the JWT (`user.id`).

#### 4.1.5 Role model

Roles are stored in `public.user_roles(user_id, role app_role)`, **never** on `profiles`. This is enforced by the RLS strategy (see 4.2) — `profiles` has no role column at all.

The security-definer function `private.has_role(_user_id uuid, _role app_role)` is used by every admin-gated policy. It is `SECURITY DEFINER`, `STABLE`, `SET search_path = public` (bytes-level: `private` schema per current DB layout) and prevents recursive RLS.

Assignment happens in two places:
- On sign-up: DB trigger `handle_new_user` inserts `('<uid>', 'user')` in `public.user_roles` and a matching `profiles` row.
- Admin promotion: `admin-users-api` action `set_admin` inserts / deletes the `admin` role.

Client hook `src/hooks/useUserRole.ts` reads the role once per mount and exposes `{ isAdmin, loading }`. It is used for cosmetic UI gating only (never for security enforcement).

#### 4.1.6 Route protection (frontend)

`src/App.tsx`:

| Route | Wrapper | Access rule |
|---|---|---|
| `/` | none | Public — the form page itself. Uses local state only for anonymous form filling. |
| `/trust` | none | Public — trust/legal marketing page. |
| `/antraege` | `RequireAuth` | Signed-in + allow-listed. |
| `/admin` | `RequireAuth` | Signed-in + allow-listed. `Admin.tsx` additionally uses `useUserRole` and shows a “nicht berechtigt” state if not admin. |
| `/empfaenger` | `RequireAuth` | Signed-in + allow-listed. Admin-only ops in the edge function, not the route. |
| `/big-autofill-setup` | `RequireAuth` | Signed-in + allow-listed. |
| `*` | none | `NotFound`. |

Route protection is **advisory** — the authoritative gate is always the edge function + RLS. A logged-in non-admin can visit `/admin` and the page will render, but any admin-only API call fails with 403.

---

### 4.2 RLS policies — line-by-line

All tables live in `public` and have `ROW LEVEL SECURITY ENABLED`. `admin_audit` and `application_events` are additionally **append-only** via `BEFORE UPDATE/DELETE` triggers that `RAISE EXCEPTION`. GRANTs are set on `authenticated` / `service_role`; `anon` is **not granted** on any user-facing table.

Legend for the `USING` (`qual`) and `WITH CHECK` columns below is exactly what `pg_policies` returned.

#### 4.2.1 `admin_audit`

| Policy | CMD | USING | WITH CHECK |
|---|---|---|---|
| `Admins view admin_audit` | SELECT | `private.has_role(auth.uid(), 'admin')` | — |

- No INSERT/UPDATE/DELETE policy → clients cannot write. Only the service-role edge function `admin-users-api` inserts rows (bypasses RLS via service role). `prevent_admin_audit_modification` trigger blocks UPDATE/DELETE for everyone.
- Logic: only admins can read the audit trail. Regular users cannot even see that entries exist.

#### 4.2.2 `allowed_emails`

| Policy | CMD | USING | WITH CHECK |
|---|---|---|---|
| `Admins manage allowed_emails` | ALL | `private.has_role(auth.uid(), 'admin')` | `private.has_role(auth.uid(), 'admin')` |

- Single `FOR ALL` policy: admins do everything, everyone else sees nothing. Non-admins cannot even check whether their own email is on the list; they must go through `auth-check-allowlist` which uses the service role.

#### 4.2.3 `application_events` (append-only audit log)

| Policy | CMD | USING | WITH CHECK |
|---|---|---|---|
| `Users view own events or admin all` | SELECT | `(auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin')` | — |

- Only SELECT is exposed. INSERT happens exclusively via `applications-api` / `send-application-email` / `whatsapp-intake` under service role. `prevent_application_events_modification` trigger blocks UPDATE and DELETE unconditionally.
- Users only see events they authored; admins see everything.
- `meta` MUST NOT contain PII — enforced by convention in the code (see `mem://features/encrypted-applications-storage.md`).

#### 4.2.4 `application_recipients` (Krankenkassen email routing table)

| Policy | CMD | USING | WITH CHECK |
|---|---|---|---|
| `auth read recipients` | SELECT | `true` | — |
| `admin ins recipients` | INSERT | — | `private.has_role(auth.uid(), 'admin')` |
| `admin upd recipients` | UPDATE | `private.has_role(auth.uid(), 'admin')` | `private.has_role(auth.uid(), 'admin')` |
| `admin del recipients` | DELETE | `private.has_role(auth.uid(), 'admin')` | — |

- Every authenticated user can read (`true`) because the form-sending UI needs the addresses.
- Writes are admin-only. The USING clause on UPDATE prevents an admin from overwriting a row and then re-reading it as a non-admin — irrelevant here since read is `true`, but consistent with the pattern.

#### 4.2.5 `applications` (encrypted payload store)

| Policy | CMD | USING | WITH CHECK |
|---|---|---|---|
| `Users can view own applications or admin all` | SELECT | `(auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin')` | — |
| `Users insert own applications` | INSERT | — | `auth.uid() = user_id` |
| `Users update own applications or admin` | UPDATE | `(auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin')` | `(auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin')` |
| `Users delete own applications or admin` | DELETE | `(auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin')` | — |

- Owner-or-admin for all four verbs. INSERT `WITH CHECK` is stricter than SELECT/UPDATE — a user cannot insert a row with a foreign `user_id` even if they are admin; admins insert only via the service role.
- The `payload_encrypted` / `payload_iv` bytes are meaningless without `APPLICATIONS_ENCRYPTION_KEY` (server-only). RLS alone is not the confidentiality layer; encryption is.

#### 4.2.6 `email_templates`

| Policy | CMD | USING | WITH CHECK |
|---|---|---|---|
| `auth read templates` | SELECT | `true` | — |
| `admin ins templates` | INSERT | — | `private.has_role(auth.uid(), 'admin')` |
| `admin upd templates` | UPDATE | `private.has_role(auth.uid(), 'admin')` | `private.has_role(auth.uid(), 'admin')` |
| `admin del templates` | DELETE | `private.has_role(auth.uid(), 'admin')` | — |

- Same shape as `application_recipients`. All authenticated users can read templates (needed to fill the Send-Email dialog); only admins mutate.

#### 4.2.7 `profiles`

| Policy | CMD | USING | WITH CHECK |
|---|---|---|---|
| `Users can view own profile` | SELECT | `(auth.uid() = id) OR private.has_role(auth.uid(), 'admin')` | — |
| `Users can insert own profile` | INSERT | — | `auth.uid() = id` |
| `Users can update own profile` | UPDATE | `auth.uid() = id` | `auth.uid() = id` |

- No DELETE policy → profiles cannot be removed by users. Admin-initiated deletion goes through `auth.admin.deleteUser` (service role) which cascades via the FK from `profiles.id → auth.users(id) ON DELETE CASCADE`.
- Admin can read every profile (used for the “owner email” column in the applications list) but cannot silently rewrite someone else’s profile.

#### 4.2.8 `user_roles`

| Policy | CMD | USING | WITH CHECK |
|---|---|---|---|
| `Users can view own roles` | SELECT | `(user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin')` | — |
| `Admins manage roles` | ALL | `private.has_role(auth.uid(), 'admin')` | `private.has_role(auth.uid(), 'admin')` |

- The pair is intentional: the `FOR ALL` policy covers all verbs for admins; the `FOR SELECT` policy adds a strictly-narrower read path for the owner. Postgres unions permissive policies with OR, so an owner can read their own row and an admin can read/write all rows.
- Because reads go through `has_role`, which is `SECURITY DEFINER`, there is no infinite-recursion risk.

#### 4.2.9 `whatsapp_inbox_messages`

| Policy | CMD | USING | WITH CHECK |
|---|---|---|---|
| `deny all authenticated` | ALL | `false` | `false` |

- Deliberately locked. The only writer/reader is `whatsapp-intake` under the service role. No end-user UI touches this table directly. Ingested messages are transient buffer data used to detect closed “…” blocks.

#### 4.2.10 Cross-cutting notes

- `service_role` bypasses RLS everywhere by design; every edge function that uses it re-implements the ownership check in code (`applications-api` filters `list` manually to `user_id === user.id` unless admin; `decrypt` returns 403 unless owner or admin).
- All admin-gated policies go through `private.has_role`, so demoting an admin instantly revokes access without a re-login (checked per query).

---

### 4.3 Role-based access control in edge functions

Beyond RLS, the following server-side checks exist:

- `admin-users-api`: first statement after JWT validation is a `user_roles` lookup; `403 forbidden` if the caller is not admin. All actions (list/create/set_password/set_admin/set_allowed/delete_user/list_allowed/add_allowed/remove_allowed) are admin-only. `set_admin` blocks self-demotion; `delete_user` blocks self-delete.
- `applications-api`: `decrypt`/`list` allow admin visibility across all users; `save` is always scoped to `auth.uid()`; `delete` allows admin cascade but refuses to delete sub-entries directly.
- `send-application-email`: any signed-in user can send (there is no admin gate) but attachments size is capped at ~32 MB base64 and `to`/`cc`/`bcc` are validated with a strict email regex.
- `whatsapp-intake` rescan actions additionally verify the caller is an admin via `hasAdminAuthorization` even though the shared secret is also accepted.

---

## 5. AI Integrations, Webhooks & External Services

### 5.1 Gemini prompts and OCR pipeline (`process-insurance-gemini3`)

Endpoint (internal): `POST {SUPABASE_URL}/functions/v1/process-insurance-gemini3`
Upstream: `POST https://ai.gateway.lovable.dev/v1/chat/completions` (Lovable AI Gateway, OpenAI-compatible).

#### 5.1.1 Request shape (from callers)

```jsonc
{
  "mode": "familienversicherung_und_rundum" | "nur_rundum" | "member" | ...,
  "selectedKrankenkasse": "viactiv" | "big_plusbonus" | "novitas" | "dak" | "bkk_gs" | "",
  "text": "optional context string",
  "images": [{ "base64": "...", "mimeType": "image/jpeg" | "image/png" | "application/pdf" }],
  "fastOcr": false
}
```

- `text` and `images` are both optional individually but at least one is required (400 `Text oder Bilder/PDFs sind erforderlich`).
- `images` accepts PDFs too — the array is split into `imageFiles` and `pdfFiles` and both are passed to Gemini as `image_url` data URLs (Gemini 2.5 Pro handles PDF bytes natively via that channel).

#### 5.1.2 Model selection

```ts
model: hasVisualContent && !fastOcr ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash"
max_tokens: 8192
```

- **Pro** for image/PDF OCR (best quality, slower).
- **Flash** for text-only extraction or when `fastOcr: true` — used by WhatsApp intake to stay under the 60 s gateway timeout on multi-image blocks.

#### 5.1.3 Prompt architecture

Two prompts are concatenated into a single `system` message:

1. **Krankenkasse-specific prompt** from `getSchemaForKrankenkasse(kasse, mode)` returning `{ schema, prompt }`. There are 5 named prompts and 2 default prompts (`defaultFamilySchema` / `defaultRundumOnlySchema`). Each is a hard-typed extraction spec in German (see lines 360–486 of `process-insurance-gemini3/index.ts` for full text — reproduced verbatim in the source, do not paraphrase):
   - `viactiv` — Beitrittserklärung + Familienversicherung. Requires ISO country codes, `viactivGeschlecht`, `viactivBeschaeftigung`, `viactivVersicherungsart`, employer block, bonus program fields, spouse + children with `versichertennummer`.
   - `big_plusbonus` — Multi-card scan handling (eGK + bank card + ID). Explicitly warns not to confuse card types. Requires `bigBank` SEPA block (`kontoinhaberVorname`, `kontoinhaberNachname`, `kreditinstitut`, `iban`, `bic`).
   - `novitas` — Familienversicherung only. Explicitly forbids member address / birthdate. Uses plaintext country strings instead of ISO codes.
   - `dak` — Familienversicherung. Max 2 children per PDF (matches downstream export constraint).
   - default → generic family or “nur Rundum” schema.
2. **Role-detection prompt** (constant, lines 558–581). Rules:
   - Target person from context text = `mitglied*`.
   - Adults (≥18 y) at same address / same surname → `ehegatte`. Set gender.
   - Minors → `kinder[]` with `verwandtschaft` = `leiblich` unless explicit.
   - Never return only member when siblings/spouse are visible.
   - `familienstand` → `verheiratet` if spouse detected.
   - KVNR format enforced as `[A-Z]\d{9}`. Never write member KVNR into person KVNR fields or vice versa. Never confuse KVNR with IBAN/BIC.

The user message is either:
- Text-only: `Extrahiere die Versicherungsdaten aus folgendem Text:\n\n${text}`
- With visual content: a `content` array — first a text turn with `Kontext zur Zielperson und zum Antrag:\n${text}\n\n…`, then N × `image_url` items for each JPG/PNG/PDF.

#### 5.1.4 Response handling

- `finish_reason` is checked — `length` / `max_tokens` throws “KI-Antwort wurde abgeschnitten. Bitte mit weniger Dokumenten erneut versuchen.” to prevent silent truncation.
- Content parse: try `JSON.parse(content)` first; fall back to a regex `\{[\s\S]*\}` slice (Gemini occasionally wraps JSON in prose despite the “only JSON” instruction).
- `normalizeInsuranceNumbersInPayload` runs post-parse:
  - Detects KVNRs anywhere in the payload via `MAIN_NUMBER_ALIASES` (12 aliases) and `PERSON_NUMBER_ALIASES` (9 aliases) plus a fuzzy key match (`kvnr`, `kvnummer`, `versichertennummer`, …).
  - Character corrections for OCR errors: first char `0→O, 1→I, 5→S, 8→B`; remaining digits `O/Q/D→0, I/L→1, Z→2, S→5, B→8, G→9`.
  - Strips labels (`KVNR`, `KV-Nr`, `Versicherten-Nr`, etc.) and non-alphanumerics, uppercases, then scans a 10-char sliding window.
  - Writes canonical value to `payload.mitgliedKvNummer` **and** `payload.mitgliedVersichertennummer` so both consumers work.
- Error mapping: `429` → German rate-limit message; `402` → Guthaben erschöpft; other non-2xx → generic 500. **AI content is never logged** (comment at line 680–682) because it contains PII.
- No files persisted — comment at line 703 documents the ephemeral-processing rule matching `mem://features/ai-document-capture/core-system`.

### 5.2 WHAPI webhook (`whatsapp-intake`)

`verify_jwt = false` (no JWT). Auth is `X-Intake-Secret` header matching `WHATSAPP_INTAKE_SECRET`, or `?s=`/`?secret=` query fallback. Health check on `GET`/`HEAD` returns `{ ok: true, service: "whatsapp-intake" }` without auth.

#### 5.2.1 WHAPI configuration expected

- Webhook URL: `https://<project>.functions.supabase.co/whatsapp-intake?s=<WHATSAPP_INTAKE_SECRET>` (the query fallback is used because WHAPI cannot always set arbitrary headers on health checks).
- Events subscribed: incoming messages (text, image, document, audio/voice/ptt).
- Chat filter: `WHATSAPP_ALLOWED_CHAT_ID` env — messages from any other chat are dropped after normalization. Set to empty to accept everything.
- Media download uses `Authorization: Bearer WHAPI_TOKEN` against the `media_url` WHAPI returns.

#### 5.2.2 Payload normalization

`extractMessages(payload)` accepts either `{ messages: [...] }` or a bare array. Per message it produces an `IntakeMsg` of type `dot | phone | email | header | text | image | pdf | audio` via `classifyText`:

- `dot` — matches `^\s*\.\s*$` (single dot, whitespace allowed).
- `email` — RFC-lite regex.
- `phone` — 7+ digit-ish string that is not a date.
- `header` — contains a `dd.mm.yyyy`(-ish) date **and** a Krankenkasse keyword (`BKK GS`, `BIG`/`big direkt`, `VIACTIV`, `DAK`, `NOVITAS`).
- `text` — anything else.
- Media types map from `type=image/document/audio/voice/ptt` and pull `link|url|media_url`, `mime_type`.

Documents with `mime_type = application/pdf` become `pdf`; anything else in the `document` bucket is treated as `image`.

#### 5.2.3 Buffer + block detection (`findClosedBlocks`)

Every ingested message is upserted into `whatsapp_inbox_messages` with a unique index on `wa_message_id` (`ignoreDuplicates: true`).

A **separator** is three consecutive `dot` messages (extra dots collapse into the same triplet; a non-dot resets the streak). A **block** is the content between two complete separator triplets. Rules for a block to be processed:

- Must contain at least one processable media row (`image`/`pdf`/`audio`).
- Must contain at least one context row (`header`/`text`/`audio`).
- None of the rows must be already `processed_at`.

Atomic claim: `UPDATE ... SET block_id = <new_uuid> WHERE id IN (...) AND block_id IS NULL RETURNING id`. If fewer rows come back than requested, another concurrent invocation already claimed the block → skip. Stale-claim recovery: if content is already claimed but was received > 90 s ago and never processed, reuse the existing `block_id` and continue.

Separator dots are updated in a **second** query so that adjacent blocks can share the same separator triplet — critical for the case where a user sends `msg…msg…msg` without repeating the trailing dots.

#### 5.2.4 Per-header grouping (`splitByHeader`)

- If multiple headers are present **and** all media appears **before** the first header, the media is treated as shared evidence and copied into every group.
- Otherwise media rows go with the most recently seen header (or the first group if no header preceded them).

#### 5.2.5 Header parsing (`parseHeader`)

Extracts vorname, name, datum, krankenkasse, `krankenkasseLabel`, vertriebspartner (one of 12 hard-coded VP codes: `BA Blitzvox`, `EM BA Blitzvox`, `GH Blitzvox`, `EM GH Blitzvox`, `AM`, `EM AM`, `MO`, `EM MO`, `AD`, `EM AD`, `HZ`, `EM HZ` — all `... Blitzvox`), betrag (matches `\d+[.,]?\d* €`). Emits `warnings[]` for any missing mandatory field.

The “name line” heuristic: first line that is neither a date nor a Krankenkasse keyword nor a VP nor starts with a digit. Splits on whitespace — first token = vorname, rest = name.

#### 5.2.6 Audio transcription

Runs before OCR. Endpoint: `POST https://ai.gateway.lovable.dev/v1/chat/completions`.

- Model: `google/gemini-2.5-flash`.
- Payload: single user turn with a text prompt (“Transkribiere diese WhatsApp-Sprachnachricht … Gib nur den gesprochenen Inhalt zurück”) plus an `input_audio` part.
- Format: derived from MIME (`mpeg/mp3→mp3`, `mp4/m4a→m4a`, `wav`, `webm`, `aac`, `flac`, else `ogg`).
- `max_tokens: 2048`. Failures push non-fatal German warnings; block still processes with whatever else it has.

Transcripts are appended to the OCR context text (never sent as a system prompt) and searched for phone / email regex fallbacks.

#### 5.2.7 OCR fan-out (`callOcr`)

- Chunks images into groups of `CHUNK = 6` to stay under gateway timeout limits.
- `fastOcr` is `true` when `batch.length > 4`, forcing Gemini flash instead of pro (documented reason: 504-Timeout avoidance).
- Per chunk: 2 attempts with 2 s backoff. Retry only on `502`/`503`/`504`. AbortController with `110_000 ms` timeout per attempt.
- Calls `process-insurance-gemini3` server-to-server with `Authorization: Bearer <SERVICE_ROLE_KEY>` — the target function recognizes this and skips the JWT-claims check (`isTrustedServerCall` branch).
- Merges chunk outputs (later chunks overwrite earlier keys only when non-empty). `improvedImages` is dropped.

#### 5.2.8 Persistence and auto-derivations

After OCR:

- `payload.familienstand = "verheiratet"` if spouse detected and no value set.
- `bigFamilienversicherung = true` + default `bigMitgliedBeschaeftigt = "beschaeftigt"` for BIG with family.
- `viactivFamilienangehoerigeMitversichern = true` for VIACTIV with family.
- `mode = "familienversicherung_und_rundum"` for BKK GS with family when no explicit mode.

Then the payload is encrypted (same AES-GCM-256 + SHA-256 hash logic as `applications-api`), and one row per group is inserted into `applications` with `source = 'whatsapp'`, `user_id = <first admin user>` (resolved by `resolveOwnerUserId`). `intake_meta` records `chat_id, block_id, person_index/count, message_ids, warnings, betrag, ocr_fields, image_count` — deliberately no PII beyond what is required for correlation.

An `application_events` row `whatsapp_intake` is inserted per person with the same non-PII meta.

Finally, `whatsapp_inbox_messages.processed_at = now()` for all rows in the block, so they cannot be re-processed unless a `rescan_block_id` admin call resets them.

#### 5.2.9 Rescan / recovery endpoints

- `POST ?rescan_block_id=<uuid>` — admin only (JWT). Re-runs a block with a fresh `block_id` without touching `processed_at`.
- `POST ?rescan_unprocessed=1&chat_id=<id>` — admin only. Re-scans the buffer of a chat for still-closed unprocessed blocks.

#### 5.2.10 Response contract to WHAPI

The handler returns `200` **immediately** after buffering rows. The block scan runs via `EdgeRuntime.waitUntil(scan)` in the background. This avoids WHAPI’s aggressive retry policy on slow responses, which otherwise causes duplicate ingestion + duplicate OCR + duplicate drafts.

### 5.3 Gmail connector and MIME assembly (`send-application-email`)

Uses Lovable’s **Standard Connector Gateway** for Google Mail — no direct OAuth. Requires two env vars:

- `LOVABLE_API_KEY` — bearer for the connector gateway.
- `GOOGLE_MAIL_API_KEY` — connection API key linking the workspace’s Gmail connection.

Endpoint used: `https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/...` (Gmail REST API proxied through the gateway). Headers on every gateway call:
```
Authorization: Bearer <LOVABLE_API_KEY>
X-Connection-Api-Key: <GOOGLE_MAIL_API_KEY>
```

#### 5.3.1 Flow

1. JWT-validate the caller (`auth.getUser()`).
2. Validate request body: `to`, `subject`, `attachments[]` required; all recipients across `to/cc/bcc` must match the email regex; total base64 size ≤ 32 MB (413 otherwise).
3. Best-effort profile lookup `GET .../users/me/profile` → uses `emailAddress` as the `From:` header. Failures are non-fatal.
4. Build the raw MIME message and base64url-encode it.
5. `POST .../users/me/messages/send` with `{ raw: <base64url> }`.
6. On success, insert an `application_events` row `emailed` with `{ to_domain, attachments, gmail_id }` — **domain only**, never the local part.

#### 5.3.2 MIME structure

`multipart/mixed` outer boundary, containing:

- `multipart/alternative` body part with:
  - `text/plain; charset=UTF-8` base64-encoded (the user’s plain text).
  - `text/html; charset=UTF-8` base64-encoded — HTML is generated by wrapping the plain body in a fixed styled `<pre>`-like `<body style="…white-space:pre-wrap">`, with `&/</>` escaped. There is intentionally no rich HTML editor.
- One MIME part per attachment: `Content-Type: <mime>; name="<encoded>"`, `Content-Disposition: attachment; filename="<encoded>"`, `Content-Transfer-Encoding: base64`.

Headers assembled: `From, To, Cc, Bcc, Reply-To (=From), Date, Message-ID (<uuid>@mail.gmail.com), Subject (RFC 2047 encoded-word if non-ASCII), MIME-Version, Content-Type`. Boundary strings are randomized per message (`----mixed_<rand>`, `----alt_<rand>`).

#### 5.3.3 Base64url streaming encoder (`MimeBase64UrlEncoder`)

A hand-rolled streaming encoder — motivation: attachments can be several MB each; naive `btoa(entireString)` blows up memory and hits Deno’s per-string cap. The encoder:

- Buffers a `carry` string of length < 3 across calls so 3-byte boundaries are respected.
- Slices input in 32766-byte chunks (multiple of 3) and calls `btoa` per chunk.
- Applies base64→base64url transform (`+→-`, `/→_`) at each chunk.
- On `finish()`, flushes the carry and strips trailing `=` padding.

This is one of the load-bearing workarounds in the codebase; see §6.

#### 5.3.4 Error surfaces returned to the client

- `500 gmail_not_configured` — either secret missing.
- `401 unauthorized` — no/invalid JWT.
- `400 invalid_json | no_recipient | invalid_email | no_subject | no_attachments`.
- `413 attachments_too_large`.
- `200 { error: "gmail_scope_missing" }` — Gmail returned 403 “insufficient permission”. Returned as 200 so the client can show a specific UX for reconnecting scopes rather than a hard fail.
- `502 gmail_send_failed` — any other upstream failure. Response bodies are truncated to 500 chars before logging.

### 5.4 Other external services

- **Lovable AI Gateway** — used from `process-insurance-gemini3` (chat completions with images/PDFs) and `whatsapp-intake` (audio transcription). No other providers.
- **Supabase Auth / PostgREST / Storage** — the standard Lovable Cloud stack. No storage buckets are configured (see project info); files never leave request memory.
- **BIG direkt browser autofill** (`src/bookmarklets/bigAutofillSource.ts` + `/big-autofill-setup` route) — a bookmarklet that reads local export JSON and fills the BIG portal form. Not a network integration.
- **WHAPI** — outbound only to download media (no send-message calls yet).
- No Stripe / Paddle / Twilio / analytics providers are wired in.

---

## 6. Edge Cases, Workarounds & Technical Debt

### 6.1 Load-bearing workarounds

1. **Immediate 200 to WHAPI + `waitUntil` background scan** (`whatsapp-intake` §5.2.10). Without this, WHAPI’s short webhook timeout causes retries → duplicate ingestion → duplicate drafts. Every code path that mutates buffer state must remain idempotent because of this.
2. **Atomic block-claim with stale-recovery** (`processRowsAsBlock` lines 484–531). Concurrent webhook invocations racing on the same block are resolved by an update-with-`IS NULL` filter; blocks stuck > 90 s (crashed prior invocation) are recoverable.
3. **Separator dots claimed in a second query**, not part of the all-or-nothing claim. Otherwise every block after the first is skipped because its opening separator was already claimed by the previous block. This is subtle and documented in the code comments.
4. **`fastOcr` fallback to Gemini flash for batches > 4** (`callOcr`). Motivation: the Lovable AI Gateway’s ~60 s upstream limit causes 504s on 6+ image OCR at Pro tier. Chunking + model downgrade traded quality for reliability.
5. **KVNR OCR correction table** (`process-insurance-gemini3` lines 21–48). Gemini returns human-readable OCR errors (`O`↔`0`, `I`↔`1`, etc.). We correct only positions where the KVNR grammar `^[A-Z]\d{9}$` requires it — first char must be a letter, remaining must be digits. Sliding-window search over the compact string picks up KVNRs embedded in labels.
6. **Alias fuzzy match for KVNR fields**. Different Krankenkassen use different field names (`kvnr`, `versichertennummer`, `mitgliedsnummer`, `egkNummer`, …). We normalize all of them and always write the canonical value to *both* `mitgliedKvNummer` and `mitgliedVersichertennummer` because different downstream exporters read different keys.
7. **Streaming base64url encoder for Gmail MIME** (`send-application-email`). Needed because Deno chokes on multi-MB single-string `btoa`. Hand-rolled 32 KB chunker with carry buffer.
8. **Regex-fallback JSON extraction** (`process-insurance-gemini3` line 691). Gemini occasionally wraps JSON in narration despite “only JSON” in the prompt. Fallback slices from the first `{` to the last `}`.
9. **`finish_reason` truncation guard** (line 671). Silent `length` truncation would produce syntactically-valid but semantically-broken JSON (dropped `kinder[]` entries), so we explicitly throw a German error and force the user to reduce the batch.
10. **`bigBank` shape**: BIG SEPA fields go into a nested object because the PDF exporter binds a whole SEPA block at once; Gemini is prompted to place them there directly (see BIG prompt).
11. **Novitas: explicitly forbid member address / birthdate** in the prompt. The Novitas Familienversicherung PDF doesn’t have those fields, and Gemini was hallucinating them into unused keys, poisoning the review UI. The prompt suppresses them at the source.
12. **DAK “max 2 children per PDF”** hard-coded in the prompt. The downstream exporter can only place two children per document; more children require a second PDF (handled in `dakExport.ts`).
13. **Sub-application sync** (`syncSubEntries` in `applications-api`). When a spouse or child has `eigeneMitgliedschaft = true`, we materialize a **separate `applications` row** per person, pointed at the same encrypted payload via `parent_application_id`. This is how the “per-person export” UI works. The sync is diff-based: desired keys are `role#index`, existing rows are updated in place, missing rows inserted, stale rows deleted. Delete of a sub-entry via the API is blocked (`delete_subentry_via_parent`) so sub-entries always mirror the parent.
14. **`private` schema for `has_role`**. RLS policies reference `private.has_role(...)` (not `public.has_role(...)`). Keep the schema in mind when adding new policies.

### 6.2 Data & schema gotchas

- **`application_events.meta` is a magnet for PII regressions.** The rule (encoded in memory `mem://features/encrypted-applications-storage`) is: only `krankenkasse`, `pdf_count`, structural counts, WhatsApp meta (chat/block/message ids, warnings). Any future code that logs anything from the decrypted payload here breaks the compliance posture. The `prevent_application_events_modification` trigger cannot fix bad inserts after the fact.
- **`applications.payload_hash` is for dedup only** — never displayed. Currently there is **no unique index** on it, so dedup is advisory. If the WhatsApp intake ever re-processes a block (rescan), you get a fresh application row even if the payload is identical.
- **`whatsapp_inbox_messages` unique index** is on `wa_message_id` alone, so if WHAPI ever reuses ids across chats (it should not) rows would be swallowed silently.
- **`applications` has 21 columns and no partial indexes.** `list` limits to 500 rows and orders by `updated_at`. At scale this will need pagination + indexed filtering on `(user_id, updated_at)` and `(parent_application_id)`.
- **Owner of WhatsApp-ingested drafts** is “the first admin user found.” If the first admin is removed, new WhatsApp drafts silently fail with the warning `Kein Admin-User als Owner gefunden`. Fix: explicit `WHATSAPP_OWNER_USER_ID` env.

### 6.3 Encryption caveats

- `APPLICATIONS_ENCRYPTION_KEY` is stretched via `SHA-256` into a 256-bit AES-GCM key. Rotating the secret **breaks all historical rows** — there is no re-encryption tooling. Treat it as write-once.
- IV is 12 random bytes per row (correct GCM usage), but stored in a separate `payload_iv` column as `bytea` (Postgres hex format). If a future migration ever consolidates into a single blob, the hex-parse code (`hexToBytes` handling `\x` prefix) needs to move too.
- The same encryption/canonicalization logic is duplicated between `applications-api` and `whatsapp-intake`. Any change (canonicalization rules, IV length, algorithm) must be made in both. There is no shared `_shared/` module.

### 6.4 Frontend workarounds worth knowing

- `RequireAuth` intentionally sets `session` synchronously from `onAuthStateChange` **and** calls `getSession()` to bootstrap — the Supabase JS best-practice order. Do not reorder or drop either.
- `useUserRole` re-queries `user_roles` on every mount; it does not subscribe to changes. If an admin is promoted while their tab is open they must reload.
- The `Applications` list in the client relies on the edge-function-returned `isAdmin` boolean rather than `useUserRole` (single source of truth for that view; avoids double auth check).
- `LoginForm` shows a generic German error for bad credentials to avoid user enumeration. The allow-list rejection message is distinguishable, however — a determined attacker could tell a valid-but-not-allowed email from a bad password. Acceptable trade-off given the closed-user model.

### 6.5 Unfinished / thin areas

- **No password-reset UI.** By design (`Passwort vergessen? → Admin kontaktieren`). If self-service reset is ever added it must include a `/reset-password` route with `updateUser({ password })` and `emailRedirectTo` configured, plus a public route exception.
- **No email verification** — new users are created with `email_confirm: true` by admins.
- **No Google/Apple OAuth** wired even though Lovable Cloud supports it — the app is intentionally closed.
- **No storage buckets.** All uploads live in request memory only. If someone later adds `storage.uploads` for “paste this later” convenience, the ephemeral-processing rule (`mem://features/ai-document-capture/core-system`) is broken.
- **Bookmarklet source (`src/bookmarklets/bigAutofillSource.ts`)** is compiled by hand to a distributable string on `/big-autofill-setup`. There is no build-time verification that the source parses cleanly; changes must be tested manually in a real browser bookmark.
- **`whatsapp-intake` health check** returns `200 { ok: true }` for `GET` **without** auth. This is deliberate so WHAPI’s “Check webhook” succeeds, but it also lets anyone probe the endpoint. Any information disclosure beyond “this URL is a whatsapp intake” must never be added to that response.
- **No retry-with-backoff around `send-application-email`.** A transient Gmail 5xx surfaces as `502 gmail_send_failed` and the user must click again.
- **Audit search / filtering UI.** `application_events` is inserted from many paths but only rendered as a per-application timeline in `ApplicationAuditTimeline.tsx`. There is no global admin “who did what across the system” view.
- **`admin_audit`** is written by `admin-users-api` for user-management actions but is not exposed via any UI at all — inspection requires DB access.

### 6.6 Known local-dev pitfalls

- **`.env`** must contain `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`. These are Lovable-managed; do not edit `src/integrations/supabase/client.ts` (auto-generated).
- Edge-function secrets required to run the full app: `APPLICATIONS_ENCRYPTION_KEY`, `LOVABLE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_URL`, plus (optional per feature) `GOOGLE_MAIL_API_KEY`, `WHAPI_TOKEN`, `WHATSAPP_INTAKE_SECRET`, `WHATSAPP_ALLOWED_CHAT_ID`. On Lovable Cloud, `SUPABASE_SERVICE_ROLE_KEY` and the DB password are not available to end users; local dev with `supabase start` must provide its own.
- WhatsApp intake requires a running (or reachable) Supabase functions endpoint because it calls `process-insurance-gemini3` via `${SUPABASE_URL}/functions/v1/...` — during local dev both functions must be served (`supabase functions serve`).
- Gmail connector calls hit `connector-gateway.lovable.dev`, which is Lovable-hosted. There is no local mock; disable the Send-Email dialog in local dev or stub the fetch.

---

*End of Sections 4–6.*

Workarounds — duplizierter `insuranceNumbers.ts`, Legacy
`react-signature-canvas`, tolerante `tsconfig`, doppeltes Toaster-System,
Angular-Material-Autofill-Grenzen, Doppel-DDL-Migration `20260626110313`,
Auto-DELETE-Trigger-Entfernung, VP-Persistenz nur lokal etc.).
