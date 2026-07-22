## Ziel
Novitas-Autofill-Bookmarklet und Payload so anpassen, dass nur wirklich relevante Felder gemeldet/befüllt werden und die drei bekannten Bugs (bisherige KK, Anlass, Vermittler-ID, kombinierte Straße+Hausnummer) verschwinden.

## Änderungen (nur Novitas BKK)

### 1) `src/utils/novitasAutofillPayload.ts`
- Entfernen aus dem Payload-Typ und Aufbau:
  - `person.geburtsname`
  - `person.geburtsland`
  - `person.staatsangehoerigkeit`
  - `person.rentenversicherungsnummer`
  - `bank.bic`, `bank.kreditinstitut`
- Adresse und Arbeitgeber-Adresse als **kombinierter String** ins Payload schreiben:
  - Neues Feld `adresse.strasseHausnummer = "<strasse> <hausnummer>".trim()`
  - Neues Feld `arbeitgeber.strasseHausnummer` analog
  - `strasse` / `hausnummer` einzeln entfallen im Payload
- Bank vereinfachen auf `{ kontoinhaber, iban }`

### 2) `src/bookmarklets/novitasAutofillSource.ts`
- Sämtliche `fill(...)`- bzw. `selectByValueOrText(...)`-Aufrufe zu den entfernten Feldern (Geburtsname, Staatsangehörigkeit, Geburtsland, Rentenversicherungsnummer, BIC, Kreditinstitut) **komplett entfernen** — damit erscheinen sie weder unter "Nicht gefunden" noch unter "Kein Wert vorhanden".
- **Bisherige Krankenkasse** (`ng.form0.kv.zuletzt_krankenkasse`): Muster ergänzen um `"zuletzt krankenkasse"`, `"kv zuletzt krankenkasse"`, `"bei der krankenkasse"` und der Fallback-Label-Match auf "bei der krankenkasse" schärfen. Nach erfolgreichem `findField` das eindeutige `name="ng.form0.kv.zuletzt_krankenkasse"` bevorzugen (per direkter `document.querySelector('input[name="ng.form0.kv.zuletzt_krankenkasse"]')` vor der Generic-Suche versuchen).
- **Anlass Kassenwechsel** (Radio `value="Kuendigung"`, `name="ng.form0.Anlass_Wechsel.anlass"`): direktes `document.querySelector('input[name="ng.form0.Anlass_Wechsel.anlass"][value="Kuendigung"]')` mit anschließendem `.click()` vor dem generischen `selectRadioByValueOrLabel` als Fast-Path einbauen.
- **Vertriebspartner + Vermittler-ID** (`ng.form0.send.vertriebspartner` = "ja" → dann `ng.form0.send.vermittler_id`): Radio direkt per Selector klicken, kurzes `await new Promise(r=>setTimeout(r,300))` warten, damit das bedingt gerenderte Input erscheint, dann per Selector `input[name="ng.form0.send.vermittler_id"]` mit `011062257459` befüllen.
- **Adresse Mitglied**: statt getrennt Straße/Hausnummer nur noch `adresse.strasseHausnummer` in das Feld schreiben, das per Selector `input[name="ng.form0.adresse.strasse"]` (Fast-Path) bzw. Muster `"strasse"` gefunden wird. Keinen separaten Hausnummer-Fill mehr.
- **Adresse Arbeitgeber**: analog `arbeitgeber.strasseHausnummer` in ein Feld schreiben (Fast-Path + Muster `"arbeitgeber strasse"`), separaten AG-Hausnummer-Fill entfernen.

### 3) Keine Änderungen an der UI
Die deutschen Formularfelder in unserer App bleiben unverändert (Straße/Hausnummer weiterhin getrennt eingegeben) — die Kombination passiert ausschließlich im Payload-Builder für Novitas.

## Nicht Teil dieses Plans
- Änderungen an anderen Kassen (BIG, VIACTIV, DAK, BKK GS)
- Änderungen an Extraktion / KI-Mapping
- Änderungen an E-Mail-/WhatsApp-Versand
