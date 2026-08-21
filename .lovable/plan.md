# Zwei CRMs + automatische Übertragung beim Speichern

## Wohin gehen die Daten heute?

Aktuell schreibt die Edge Function `crm-sync` direkt per Service-Role-Key in **ein** CRM-Supabase-Projekt (Secrets `CRM_SUPABASE_URL` / `CRM_SERVICE_ROLE_KEY`) in die Tabellen `customers`, `contracts`, `contract_kv_details`, `contract_family_members`. Ausgelöst wird das nur manuell über die Buttons in der Anträge-Liste ("An CRM übertragen", "Familienmitglieder prüfen/nachtragen", "Kundendaten prüfen/nachtragen"). Ohne Klick landet nichts im CRM.

## Ziel

1. Jeder Antrag bekommt ein CRM-Ziel: **Blitzvox CRM** oder **BeitPlus CRM**.
2. Das Ziel wird automatisch aus dem Vertriebspartner abgeleitet und neben dem VP-Feld sichtbar markiert (überschreibbar).
3. Beim Speichern des Antrags läuft die Übertragung ins richtige CRM automatisch — die Buttons bleiben nur noch als Reparatur-/Nachtrags-Werkzeug.

## Automatische Zuordnung

- VP enthält "Blitzvox" (BA/AD/AM/GH/HZ/JA/EM … Blitzvox) → **Blitzvox CRM**
- VP "Gheith Abojamil" und weitere BeitPlus-VPs → **BeitPlus CRM**
- Unbekannter/freier VP → keine automatische Zuordnung; Auswahl muss manuell getroffen werden, sonst keine Übertragung

Die vollständige BeitPlus-VP-Liste (VP-Code → Beratername im BeitPlus-CRM) trage ich nach, sobald du sie lieferst; bis dahin startet sie mit "Gheith Abojamil".

## UI

- Neben "Vertriebspartner" ein Badge mit dem erkannten Ziel ("→ Blitzvox CRM" / "→ BeitPlus CRM") plus kleines Auswahlfeld zum Übersteuern.
- In der Anträge-Liste eine Spalte/Chip, die zeigt, in welches CRM übertragen wurde (und wann).
- Die bestehenden CRM-Buttons arbeiten künftig pro CRM-Ziel getrennt (jeweils nur die Anträge des jeweiligen Ziels).

## Automatik beim Speichern

Nach jedem erfolgreichen Speichern (Entwurf und Update) ruft das Frontend die Übertragung im Hintergrund auf:
- Anlegen/Aktualisieren von Kunde, Vertrag, KV-Details, Familienmitgliedern — idempotent über `external_ref`, bestehende Werte werden nicht überschrieben.
- Fehler blockieren das Speichern nicht; sie werden protokolliert und in der Liste als "CRM offen" sichtbar, sodass der Nachtrags-Button greift.

## Technische Details

- Migration: neue Spalten `applications.crm_target` (text, nullable) und `applications.crm_target_synced_at`; `crm_synced_at` bleibt für Rückwärtskompatibilität.
- `src/types/form.ts`: neues Feld `crmTarget` ('blitzvox' | 'beitplus' | null), wird mit dem Payload gespeichert.
- `src/utils/crmVp.ts`: neue Funktion `crmTargetForVp(vp)` und getrennte Mappings `BLITZVOX_VP_ADVISOR` / `BEITPLUS_VP_ADVISOR`.
- `supabase/functions/applications-api/index.ts`: `save` nimmt `crm_target` an und schreibt es in die Spalte.
- `supabase/functions/crm-sync/index.ts`: Client-Auswahl je Ziel (`CRM_SUPABASE_URL`/`CRM_SERVICE_ROLE_KEY` für Blitzvox, neue Secrets `BEITPLUS_CRM_SUPABASE_URL`/`BEITPLUS_CRM_SERVICE_ROLE_KEY` für BeitPlus); alle Actions (`direct-push`, `audit/repair-family`, `audit/repair-customers`, `export-sql`) bekommen das Ziel aus dem Antrag statt global.
- `src/hooks/useApplicationPersistence.ts`: nach `save` ein Hintergrund-Invoke von `crm-sync` mit `action: "direct-push"` für den gespeicherten Antrag.
- `src/pages/Index.tsx` + Anträge-Liste: Badge, Override-Select, Statusanzeige.
- Für BeitPlus benötige ich die Supabase-URL und den Service-Role-Key als Secrets — die frage ich beim Umsetzen über den Secret-Dialog ab.
