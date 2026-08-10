# CRM-Übertragung: Anrede + Vollständigkeit aller Attribute

## Problem (im Code geprüft)

1. **Anrede fehlt bei den meisten Kunden.** Die Anrede wird nur aus `viactivGeschlecht` abgeleitet (`crm-sync`, Zeile 153). BIG direkt gesund speichert das Geschlecht aber in `bigGeschlecht`, Ehegatte/Kinder in ihrem eigenen `geschlecht`-Feld. Für BIG-Hauptmitglieder bleibt die Anrede deshalb leer — und damit auch `contract_kv_details.geschlecht`.
2. **Bestehende Kunden werden nie ergänzt.** Wird ein Kunde bei der Duplikatprüfung gefunden, werden keine Felder gesetzt (Anrede, Telefon, E-Mail, Adresse bleiben wie sie sind). Bereits importierte Verträge werden komplett übersprungen (`already_imported`), also wird auch nachträglich nichts korrigiert.
3. **Nicht geprüfte Felder:** `vorherige_kasse_ende` beim Hauptmitglied ist immer `null`, obwohl `bisherigEndeteAm` im Formular existiert.

## Was gemacht wird

### 1. Geschlecht robust ermitteln
Eine gemeinsame Ableitung mit Fallback-Kette pro Person:
- Hauptmitglied: `viactivGeschlecht` → `bigGeschlecht` → `novitasGeschlecht` (falls vorhanden) → Anrede aus vorhandenen Daten
- Ehegatte/Kind: eigenes `geschlecht`-Feld
Mapping: männlich → `Herr`, weiblich → `Frau`, divers/unbestimmt → `Divers`. Ist kein Geschlecht vorhanden, bleibt die Anrede leer (kein Raten).

### 2. Anrede + Geschlecht überall setzen
- `customers.salutation` für Hauptmitglied und jede eigene Mitgliedschaft
- `contract_kv_details.geschlecht` (m/w/d) synchron dazu
- `contract_family_members.geschlecht` für alle Angehörigen
- Gleiche Logik im SQL-Export, damit beide Wege identische Werte liefern

### 3. Neue Aktion „Kundendaten prüfen/nachtragen"
Ein Reparaturlauf über die bereits übertragenen Datensätze, der nur **leere** Felder auffüllt (nie bestehende Werte überschreibt):
- `customers`: Anrede, Telefon, E-Mail, Straße, PLZ, Ort, Geburtsdatum
- `contract_kv_details`: Geschlecht, Familienstand, Geburtsort/-land, Staatsangehörigkeit, KV-Nummer, vorherige Kasse + Enddatum
- `contract_family_members`: fehlende Angehörige (bestehende Logik) und leere Felder in vorhandenen Zeilen
Ergebnis wird als Bericht zurückgegeben (geprüft / ergänzt / unverändert) und in `crm_sync_log` protokolliert.

### 4. Neuimporte vollständiger
- Bei gefundenem Bestandskunden werden leere Felder ebenfalls nachgetragen
- `vorherige_kasse_ende` beim Hauptmitglied aus `bisherigEndeteAm`

### 5. UI
In der Anträge-Liste ein Button **„Kundendaten prüfen/nachtragen"** neben den bestehenden CRM-Buttons, mit Ergebnis-Toast (z. B. „128 geprüft · 96 Anreden ergänzt").

## Technische Details
- Datei: `supabase/functions/crm-sync/index.ts` — neue Helfer `genderOf(payload, person)` und `salutationFor`, neue Actions `audit-customers` / `repair-customers`, Anpassung `writeEntriesDirect` und `buildEntries`
- Datei: `src/pages/Applications.tsx` — Button + Aufruf der neuen Action
- Vor dem Reparaturlauf wird geprüft, welche Werte `customers.salutation` im CRM zulässt (Freitext vs. Enum); passt „Divers" nicht, wird für divers/unbestimmt kein Wert gesetzt statt einen ungültigen zu schreiben.
- Alles idempotent: mehrfaches Ausführen erzeugt keine Duplikate und ändert keine bereits gefüllten Felder.
