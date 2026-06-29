## Ziel
Antragsliste erweitern um VP, Bearbeiter (Anzeigename), Name, Vorname, Antragsform; Aktions-Spalte entfernen; Suche & XLSX-Export anpassen. VP als Pflichtfeld im Editor erfassen.

## Änderungen

### 1. Datenbank-Migration (`applications`-Tabelle)
Neue Spalten (alle nullable für Bestandsdaten):
- `vertriebspartner TEXT` — z. B. „AM Blitzvox"
- `applicant_name TEXT` — Nachname Hauptmitglied (Klartext)
- `applicant_vorname TEXT` — Vorname Hauptmitglied (Klartext)
- `antragsform TEXT` — abgeleitete Variante (siehe unten)

RLS bleibt unverändert (gleiche Policies decken die neuen Spalten). Keine GRANT-Änderung nötig.

Hinweis zur Encryption-Memory: Diese vier Spalten werden bewusst im Klartext geführt, da sie ausschließlich für die Antragsliste benötigt werden. Verschlüsselter `payload` bleibt unverändert.

### 2. Edge Function `applications-api`
- `save`-Action akzeptiert zusätzlich `vertriebspartner`, `applicant_name`, `applicant_vorname`, `antragsform` und schreibt sie als Klartext-Spalten (sowohl bei Insert als auch Update).
- `list`-Action gibt diese Spalten zusätzlich zurück und liefert `display_name` aus `profiles` mit (`userDisplayNames`-Map analog zu `userEmails`).

### 3. Client: VP-Pflichtfeld im Formular
- Neues Feld in `formData`: `vertriebspartner: string`.
- Neuer Bereich oben im Editor (in `src/pages/Index.tsx`) mit `Select` (Combobox: vorgegebene Liste + Option „Eigener VP"). Vorgaben:
  - BA / EM BA / GH / EM GH / AM / EM AM / MO / EM MO / AD / EM AD / HZ / EM HZ — jeweils „Blitzvox".
  - Bei „Eigener VP" → freies Textfeld.
- Letzte Auswahl in `localStorage` (`lastVertriebspartner`) speichern und beim Start vorbelegen.
- Export-Buttons werden disabled, solange VP leer ist; bei Klick mit leerem VP Toast „Bitte Vertriebspartner auswählen".

### 4. Antragsform-Ableitung
Helper `deriveAntragsform(formData)` in neuer Datei `src/utils/antragsform.ts`:
- BIG: „Plusbonus + Familienvers." | „Plusbonus" | „Familienvers."
- VIACTIV: Kombination aus „Beitritt" / „Familienvers." / „Bonus" je nach exportierten Teilen
- Novitas: „Familienvers."
- DAK: „Familienvers."

Wird beim `save`/`markExported`-Aufruf mitgegeben.

### 5. Persistenz-Hook (`useApplicationPersistence`)
- `save({ applicationId, formData })` extrahiert `vertriebspartner`, `applicant_name` (= `formData.mitgliedName`), `applicant_vorname` (= `formData.mitgliedVorname`), `antragsform` und sendet sie an die Edge Function.

### 6. Antragsliste (`src/pages/Applications.tsx`)
Spalten (neue Reihenfolge):
`Krankenkasse | Status | PDFs | Aktualisiert | Erstellt | VP | Bearbeiter | Name | Vorname | Antragsform`
- Aktions-Spalte entfernen; ganzer Row klickbar (bereits vorhanden).
- „Bearbeiter" zeigt `display_name` (Fallback: E-Mail).
- Suche erweitern: Krankenkasse, VP, Bearbeiter (Name + E-Mail), Name, Vorname, Antragsform.

### 7. XLSX-Export
- Neuer Button „Als Excel exportieren" oben rechts neben Filtern.
- Nutzt bestehendes `xlsx`-Paket falls vorhanden, sonst Installation von `xlsx` via `bun add xlsx`.
- Exportiert die aktuell gefilterten Zeilen mit denselben Spalten.

### 8. ApplicationRow-Type & Drawer
- `ApplicationRow`-Type um neue Felder erweitern.
- `ApplicationDetailDrawer` zeigt VP + Antragsteller-Name als zusätzliche Badges/Info.

## Technische Details
- Display-Name kommt aus `profiles.display_name` (Spalte existiert bereits, siehe `handle_new_user`-Trigger).
- VP-Liste als Konstante in `src/utils/vertriebspartner.ts`.
- Bestandsdaten ohne neue Felder erscheinen mit „—" in der Liste.