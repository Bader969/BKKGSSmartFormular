
# Novitas BKK — Extraktion, UI & Bookmarklet-Fixes

## 1) KI-Extraktion (Gemini) für Novitas erweitert

Datei: `supabase/functions/process-insurance-gemini3/index.ts` (`novitasSchema`)

Aktuell liefert das Schema nur Namen/KV-Nr/Kontakt/Ehegatte/Kinder. Deshalb bleiben Geburtsdatum, Adresse, Geschlecht, Beschäftigung, Arbeitgeber und Bank leer. Schema um exakt diese Novitas-Pflichtfelder erweitern:

```
mitgliedGeburtsdatum, mitgliedGeburtsort,
mitgliedStrasse, mitgliedHausnummer, mitgliedPlz, ort,
viactivGeschlecht: "maennlich|weiblich|unbestimmt|divers",
viactivStaatsangehoerigkeit,        // nur intern, UI ausgeblendet
viactivBeschaeftigung: "beschaeftigt|ausbildung|al_geld_2|al_geld_1",
viactivArbeitgeber: { name, strasse, hausnummer, plz, ort },
novitasArbeitsentgelt: "bis_zu_603_Euro|mitte|mehr_als_6450_Euro",
bigBank: { kontoinhaber, iban }
```

Explizite Prompt-Hinweise ergänzen:
- Wenn Leistungen von Jobcenter/Agentur → Name+Anschrift **des Jobcenters/der Agentur** als Arbeitgeber übernehmen.
- Straße+Hausnummer können in einer Zeile stehen — trotzdem beim Extrahieren aufteilen (UI hat getrennte Felder).

## 2) Frontend-Mapping (`krankenkassenMapping.ts`, case `'novitas'`)

Zusätzlich zu Basisdaten auch übernehmen:
- `mitgliedGeburtsdatum`, `mitgliedGeburtsort`
- `mitgliedStrasse`, `mitgliedHausnummer`, `mitgliedPlz`, `ort`
- `viactivGeschlecht`, `viactivBeschaeftigung`, `viactivArbeitgeber`
- `novitasArbeitsentgelt`
- `bigBank` (Kontoinhaber + IBAN)

Merge-Regel: `extractedData.X || currentFormData.X` wie in DAK/BIG.

## 3) UI-Anpassungen (nur Novitas)

- `MemberSection.tsx`: „Geburtsland" für **Hauptmitglied** bei Novitas ausblenden (Feld wird auf Novitas nicht benötigt).
- `NovitasEmployerBank.tsx`: Bank-Sektion auf **nur Kontoinhaber + IBAN** reduzieren (BIC + Kreditinstitut entfernen — auf Novitas irrelevant).
- Beispiel-JSON `createNovitasExampleJson()` an neues Schema anpassen (nur Kontoinhaber+IBAN in bigBank).

## 4) Bookmarklet (`novitasAutofillSource.ts`) — an echte Feldnamen anpassen

Basierend auf den vom User gelieferten HTML-Snippets:

| Feld | Novitas `name` / Typ | Fix |
|---|---|---|
| Status „Ich bin…" | `ng.form0.personen_angabe.Versicherungsart` (Select) | Suchmuster erweitern: `"versicherungsart"`, `"ich bin"`, `"personen angabe"`. Werte matchen Text: „pflichtversicherte", „auszubildende", „arbeitslose … jobcenter", „arbeitslose … agentur" |
| Geschlecht | `ng.form0.personen_angabe.Geschlecht` (Select) | Suchmuster `"personen angabe geschlecht"` ergänzen |
| Bisherige Krankenkasse | `ng.form0.kv.zuletzt_krankenkasse` | Suchmuster `"zuletzt krankenkasse"`, `"kv zuletzt"` ergänzen |
| Anlass Kassenwechsel | `ng.form0.Anlass_Wechsel.anlass` **Radio**, value=`Kuendigung`, Label „Ablauf der Bindungsfrist (12 Monate)" | Von `selectByValueOrText` auf `selectRadioByValueOrLabel(["anlass wechsel","anlass"], ["Kuendigung"], ["ablauf der bindungsfrist","bindungsfrist"], …)` umbauen |
| Vertriebspartner | `ng.form0.send.vertriebspartner` **Radio**, value=`ja` | valueCandidates auf `["ja"]` korrigieren |
| Vermittler-ID | `ng.form0.send.vermittler_id` | Suchmuster `"send vermittler"`, `"vermittler id"` |
| Adresse | 1 Feld Straße+Hausnummer | bleibt kombiniert; Fallback-Fill für „hausnummer" entfernen, damit keine Überschreibungen |

Entfernt (nicht relevant auf Novitas):
- Geburtsname, Geburtsland, Staatsangehörigkeit, Rentenversicherungsnummer, BIC, Kreditinstitut → keine `fill(...)`-Aufrufe mehr, tauchen damit nicht mehr im „Nicht gefunden"-Overlay auf.

## 5) Payload (`novitasAutofillPayload.ts`)

- `person.geburtsname`, `person.geburtsland`, `person.staatsangehoerigkeit`, `person.rentenversicherungsnummer`, `bank.bic`, `bank.kreditinstitut` können bleiben (kein Bookmarklet-Konsument mehr) — optional entfernen für Klarheit. Vorschlag: entfernen, um Payload schlank zu halten.
- Alle Adresse-Fills nutzen weiter die Hauptmitglied-Anschrift (unverändert).

## Technische Details

- Radix Select-Werte für `novitasArbeitsentgelt`: gemappt zu `bis_zu_603_Euro | mitte | mehr_als_6450_Euro` (unverändert).
- Gender-Werte ins Frontend als `viactivGeschlecht` in Novitas-Kompatibilität (`maennlich|weiblich|unbestimmt|divers`) — bereits vorhanden.
- Bookmarklet-Overlay-Zähler bleibt (weniger Felder → korrekter Prozentsatz).

## Nicht enthalten

- Änderung anderer Krankenkassen-Flows.
- Änderung der Excel/Anträge-Liste.
