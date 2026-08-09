# GKV → CRM (Vermittlersuite): Import-Schnittstelle

Dieses Portal überträgt GKV-Anträge per HTTP-POST an eine Edge Function im
CRM-Projekt **Vermittler Suite**. Diese Function muss dort einmal angelegt werden.

## Endpoint (im CRM-Projekt zu erstellen)

```
POST https://<CRM>.supabase.co/functions/v1/gkv-import
Header: x-import-secret: <gemeinsames Secret>   (gleicher Wert wie CRM_IMPORT_SECRET hier)
Content-Type: application/json
```

## Request-Body

```json
{
  "source": "gkv-antragsportal",
  "entries": [
    {
      "source": "gkv-antragsportal",
      "application_id": "uuid des Antrags",
      "external_ref": "<application_id>:main",
      "related_to_external_ref": "<application_id>:main",   // nur bei Familienmitgliedern
      "role": "hauptmitglied | ehegatte | kind",
      "own_membership": true,
      "vp_code": "HZ Blitzvox",
      "advisor_name": "Hamza",
      "created_at": "2026-08-09T10:00:00Z",
      "lead_source": "sonstiges",
      "lead_source_detail": "GKV-Kampagne",
      "customer": {
        "salutation": "Herr | Frau | Divers | null",
        "first_name": "…",
        "last_name": "…",
        "birthdate": "YYYY-MM-DD | null",
        "phone": "…", "email": "…",
        "street": "Straße Hausnummer", "zip": "…", "city": "…"
      },
      "contract": {
        "type": "gkv",
        "status": "in_pruefung",
        "provider": "Name der aktuellen Krankenkasse",
        "start_date": "YYYY-MM-DD | null",
        "kv_details": {
          "geschlecht": "m | w | d | null",
          "familienstand": "ledig | verheiratet | getrennt | geschieden | verwitwet | null",
          "geburtsort": "…", "geburtsland": "…",
          "staatsangehoerigkeit": "…",
          "kv_nummer": "…",
          "vorherige_kasse": "…",
          "vorherige_kasse_ende": "YYYY-MM-DD | null"
        }
      },
      "family_members": [
        {
          "relation": "ehegatte | kind",
          "first_name": "…", "last_name": "…", "birthdate": "YYYY-MM-DD | null",
          "versicherungsnummer": "…",
          "geschlecht": "m | w | d | null",
          "verwandtschaft": "leiblich | stief | enkel | pflege | null",
          "geburtsname": "…", "geburtsort": "…", "geburtsland": "…",
          "staatsangehoerigkeit": "…",
          "bisherig_kasse": "…", "bisherig_ende": "YYYY-MM-DD | null",
          "bisherig_art": "mitgliedschaft | familienversicherung | nicht_gesetzlich | null",
          "abweichende_anschrift": "…"
        }
      ]
    }
  ]
}
```

`family_members` ist nur beim Hauptmitglied gesetzt (für `contract_family_members`).
Jedes Familienmitglied kommt zusätzlich als eigener `entry` (eigener Kunde + eigener GKV-Vertrag).

## Erwartete Verarbeitung im CRM (pro `entry`)

1. Secret prüfen (`x-import-secret` gegen `CRM_IMPORT_SECRET`), sonst 401.
2. Berater bestimmen: `profiles.full_name = advisor_name` → `user_id`.
   Dieser Nutzer wird `assigned_to` (Besitzer), `recorded_by` (Erfasser) und
   `advisor_id` (Berater); ebenso `created_by`. Unbekannter Name → Eintrag mit
   Fehler zurückmelden, nicht raten.
3. Kunde suchen (Duplikatprüfung): gleicher `first_name` + `last_name` +
   `birthdate` und – wenn im CRM vorhanden – gleiche Adresse/Kontaktdaten/Anrede.
   - Kein Treffer → `customers` neu anlegen (inkl. `lead_source = 'sonstiges'`,
     `lead_source_detail = 'GKV-Kampagne'`).
   - Treffer → bestehenden Kunden verwenden, keine Felder überschreiben.
4. GKV-Vertrag anlegen: `contracts` mit `type='gkv'`, `status`, `provider`,
   `start_date`, `created_by`. Idempotenz über `details.external_ref`
   (`external_ref` in `details` speichern und vorab prüfen, damit ein erneuter
   Import keine Duplikate erzeugt).
5. `contract_kv_details` (1:1 zum Vertrag) mit `kv_details` füllen.
6. `contract_family_members` aus `family_members` befüllen.
7. Antwort: `200` mit
   `{ "ok": true, "results": [ { "external_ref": "…", "status": "created|existing|skipped|error", "customer_id": "…", "contract_id": "…", "error": "…" } ] }`.

Fehler bitte pro Eintrag melden und mit HTTP 200 antworten, solange der Request
selbst gültig war – so bleiben Teilimporte nachvollziehbar.