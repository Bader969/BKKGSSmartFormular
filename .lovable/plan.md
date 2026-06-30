## Ziel
Personen mit eigener Mitgliedschaft (Ehegatte mit `eigeneMitgliedschaft=true` und Kinder ≥15 mit `eigeneMitgliedschaft=true`) erscheinen in der Antragsliste **zusätzlich** als verknüpfte Untereinträge unter dem Hauptantrag — mit eigenem Namen/Vornamen und passender Antragsform-Bezeichnung, aber **ohne** eigenen Export-Status (Status bleibt am Hauptantrag).

## Datenmodell (Migration)

`applications`-Tabelle erweitern:

| Spalte | Typ | Zweck |
|---|---|---|
| `parent_application_id` | `uuid NULL` → `applications.id ON DELETE CASCADE` | Verweis auf Hauptantrag. NULL = Hauptantrag. |
| `person_role` | `text NULL` | `'haupt'` (implizit für NULL), `'ehegatte'`, `'kind'` |
| `person_index` | `int NULL` | Nur bei `kind`: Position im Kinder-Array (1-basiert) |

Sub-Einträge:
- haben **denselben** `payload_encrypted` / `payload_iv` / `payload_hash` wie der Parent (keine Datendoppelung der Klartextfelder — der Payload bleibt einmalig verschlüsselt). Beim Öffnen wird einfach derselbe Datensatz geladen.
- `applicant_name` / `applicant_vorname` werden aus der jeweiligen Person befüllt.
- `antragsform` bekommt einen Suffix, z. B. `BIG Plusbonus (Ehegatte: Max Mustermann)` / `… (Kind 2: Lena Mustermann)`.
- `status` / `pdf_count` / `exported_at` werden **nicht** an Sub-Einträgen gepflegt (bleiben Default `draft` / `0` / `NULL`) — pro User-Wunsch.
- RLS-Policies gelten genauso wie für Parent (Owner + Admin), da `user_id` identisch ist.

## Backend (`supabase/functions/applications-api/index.ts`)

**`action: "save"`** wird erweitert:

1. Wie bisher: Hauptantrag insert/update (mit verschlüsseltem Payload).
2. Danach: Sub-Einträge synchronisieren.
   - Aus dem (noch im Speicher vorhandenen) `payload` werden die Personen mit eigener Mitgliedschaft ermittelt:
     - `payload.ehegatte` wenn `eigeneMitgliedschaft === true` und Name oder Vorname vorhanden.
     - jedes `payload.kinder[i]` wenn `eigeneMitgliedschaft === true` und Name oder Vorname vorhanden.
   - Gewünschter Soll-Zustand wird mit existierenden Sub-Rows (`parent_application_id = <hauptId>`) verglichen und per `upsert`/`delete` abgeglichen (Identität via `person_role` + `person_index`).
   - Sub-Rows referenzieren **denselben** ct/iv/hash wie der Parent.
3. `action: "delete"` braucht keine Änderung — `ON DELETE CASCADE` räumt Sub-Rows mit auf. Beim Löschen eines Sub-Eintrags wird abgelehnt (oder still gelöscht — wir lehnen ab mit `error: "delete_subentry_via_parent"`, damit Konsistenz garantiert bleibt).
4. `action: "decrypt"` funktioniert unverändert (Sub-Row enthält denselben verschlüsselten Payload).
5. `action: "list"` liefert die neuen Spalten mit aus.

## Frontend

**`src/hooks/useApplicationPersistence.ts`**
- Rückgabe-Typ von `list()` um `parent_application_id`, `person_role`, `person_index` ergänzen.

**`src/components/ApplicationDetailDrawer.tsx`** (Typ `ApplicationRow`)
- Felder ergänzen.
- Bei Sub-Eintrag: Hinweis „Untereintrag von Hauptantrag <Name>" anzeigen, „Löschen" deaktivieren, Status-Badge ausblenden (oder „—" anzeigen).

**`src/pages/Applications.tsx`**
- Tabelle behält bestehende Spalten. Zusätzlich:
  - Neue Spalte „Typ" mit Badge „Hauptantrag" / „Ehegatte" / „Kind n".
  - Sub-Einträge werden visuell eingerückt (`pl-6`) und direkt unter ihrem Parent gruppiert (Sortierung: zuerst nach `created_at` des Parents, dann Parent zuerst, dann Sub-Einträge in Reihenfolge ehegatte→kind 1→kind 2…).
  - Status/PDFs-Spalten zeigen für Sub-Einträge „—".
  - Excel-Export übernimmt die neuen Spalten unverändert.
- Suche durchsucht zusätzlich Person-Name/Vorname (ist bereits dadurch abgedeckt, dass `applicant_name/vorname` der Sub-Row die Person enthalten).

## Verhalten beim Speichern (Index.tsx)

Keine Änderung nötig — `save()` wird wie bisher beim Hauptantrag aufgerufen, die Sub-Sync läuft serverseitig.

## Sicherheit / PII
- Klartext-Personennamen landen in `applicant_name` / `applicant_vorname` der Sub-Row — genau wie heute schon beim Hauptantrag (vom User explizit so freigegeben für die Listenanzeige, kein neuer PII-Eintrag).
- Keine zusätzlichen Felder in `application_events.meta`.

## Edge-Cases
- Wird die eigene Mitgliedschaft einer Person entfernt, löscht der Sync die entsprechende Sub-Row.
- Reine Familienversicherung ohne eigene Mitgliedschaft → keine Sub-Rows (Verhalten wie bisher).
- Bei `delete` des Hauptantrags entfernt CASCADE alle Sub-Rows.

## Migration (Skizze)

```sql
ALTER TABLE public.applications
  ADD COLUMN parent_application_id uuid
    REFERENCES public.applications(id) ON DELETE CASCADE,
  ADD COLUMN person_role text,
  ADD COLUMN person_index int;

CREATE INDEX applications_parent_idx
  ON public.applications(parent_application_id);
```

(GRANTs und RLS bleiben unverändert — `user_id` ist auf der Sub-Row identisch mit dem Parent, vorhandene Policies greifen.)
