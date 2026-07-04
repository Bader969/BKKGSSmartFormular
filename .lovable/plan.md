
## Woran es liegt

Im Screenshot: 2/21 Felder befüllt, nur „Vorname" ging durch — obwohl der BIG-Wizard auf Schritt 1 („Wie lautet Ihr Name?") die Felder Anrede, Vorname, Nachname, Geburtsname zeigt. Vier reale Ursachen, plus eine Erwartungs­frage:

1. **„name" matcht auch „Vorname"** — im Bookmarklet enthält das Nachname-Muster `["nachname","name","familienname"]`. Da `findField` mit `indexOf` gegen den zusammengesetzten Label-/Wrapper-Text sucht und der Vorname-Wrapper den Text „Vorname (Pflichtangabe)" enthält, matched das lose Muster `name` bereits das Vorname-Feld. Nachname wird deshalb nie gefunden → leer. Gleiche Klasse Fehler betrifft „geburtsname" (matcht ebenfalls Vorname / Nachname), „ort" (matcht „Vorname/Nachname"/„Geburtsort"), „bank" (matcht „Bankleitzahl"/„IBAN-Wrapper"), „tel" usw.
2. **Anrede ist ein `<mat-select>`, kein Radiogruppe** — im BIG-Formular ist Anrede ein Angular-Material-Dropdown („keine Angabe"). Das Bookmarklet ruft `clickRadio`, findet keine `mat-radio-group` und meldet „nicht gefunden". Gleiches gilt für Familienstand, Geschlecht, Staatsangehörigkeit-Land, Geburtsland.
3. **`geburtsname` wird immer leer geschickt** — in `ApplicationDetailDrawer.handleBigOnlineAusfuellen` steht `geburtsname: ""` fest verdrahtet. Laut deiner Vorgabe soll Geburtsname = Nachname sein (für alle Anträge).
4. **Untereinträge (Ehegatte/Kind mit eigener Mitgliedschaft) haben keinen „BIG online ausfüllen"-Button** — `isBig` wird durch `!isSub` explizit ausgeschlossen. Deshalb kannst du für sie nichts in die Zwischenablage kopieren.
5. **Erwartungsklärung**: Der BIG-Antrag ist ein 10-Schritt-Wizard. Felder wie Geburtsdatum, Adresse, Telefon, Bank etc. existieren im DOM erst, wenn du auf dem entsprechenden Schritt bist. Nach jedem „Weiter" muss das Bookmarklet erneut geklickt werden — das ist so vorgesehen und wird im Overlay-Hinweis erklärt. Die aktuelle Anzeige „13 nicht gefunden" ist also **zum großen Teil normal** und wird auf den Folge­schritten aufgelöst; wichtig sind auf Schritt 1 nur Anrede/Vorname/Nachname/Geburtsname, und die drei fehlenden sind die echten Bugs.

## Umsetzung

### 1) `src/bookmarklets/bigAutofillSource.ts` — robusteres Matching
- `findField`: statt `indexOf` **wortweises Matching** einführen. Muster in Tokens splitten und nur zählen, wenn alle Tokens als eigenständige Wörter im Haystack vorkommen (Regex mit `\b`, umgesetzt gegen den mit Leerzeichen normalisierten String, z. B. `` ` ${haystack} `.includes(` ${token} `) ``). Damit matcht `nachname` nicht mehr innerhalb von `vorname` und `ort` nicht mehr innerhalb von `vorname/geburtsort`.
- Zusätzlich **Prioritäts-Signale**: `formcontrolname`, `name`, `id`, `data-testid` deutlich stärker gewichten als der Wrapper-Text (Wrapper nur als Fallback verwenden, wenn kein Attribut-Match zieht). Kandidatensuche zweistufig: erst Attribut-Match, dann Label-Match.
- Muster präzisieren:
  - Nachname: `["nachname","familienname","surname","lastname"]` (kein bloßes „name" mehr).
  - Geburtsname: `["geburtsname","birthname"]`.
  - Ort: `["wohnort","ort ","stadt","city"]` mit Kontext-Ausschluss von „geburt".
  - Straße/Hausnummer/PLZ analog verschärfen.
- **`mat-select`-Support** ergänzen: neue Helper `setMatSelect(patterns, optionTexts, label)` — findet das umschließende `mat-form-field`/`mat-select`, klickt den Trigger, wartet kurz auf das Overlay (`.cdk-overlay-container mat-option`), und klickt die passende Option per Textvergleich. Für Anrede/Familienstand/Geschlecht/Land wird zuerst `setMatSelect` versucht, dann als Fallback `clickRadio`.
- Overlay-Text minimal ergänzen: Hinweis, dass Felder für Folge­schritte normal sind.

### 2) `src/components/ApplicationDetailDrawer.tsx` — Payload vervollständigen
- `geburtsname`: default = `mitgliedName` (Nachname), falls kein separater Wert existiert.
- Für Untereinträge (`isSub`) den BIG-Button **freischalten**, wenn die Person eine eigene Mitgliedschaft hat:
  - `isBig` neu berechnen: `application?.krankenkasse === "big_plusbonus"` (ohne `!isSub`).
  - `handleBigOnlineAusfuellen`: wenn `application.person_role === "ehegatte"`, Payload aus `f.ehegatte` bauen (Vorname/Name/Geburtsdatum/Geburtsort/Adresse falls vorhanden; Nachname → Geburtsname). Wenn `application.person_role === "kind"`, aus `f.kinder[application.person_index]` bauen. Adresse/Bank/Kontakt vom Hauptantrag übernehmen, wenn beim Sub-Datensatz nichts eigenes hinterlegt ist.
  - Button-Label für Subs: „BIG online ausfüllen (Ehegatte)" bzw. „(Kind N)".

### 3) `src/bookmarklets/bigAutofillSource.ts` — Payload-Typ erweitern
- `BigAutofillPayload.mitglied.geburtsname` bleibt optional, aber der Payload-Builder liefert jetzt immer einen Wert.

## Nicht Teil des Plans
- Automatisches „Weiter"-Klicken oder Multi-Step-Automatisierung im BIG-Wizard (bleibt manuell, so wie die Einrichtungsseite es beschreibt).
- Änderungen am WhatsApp-Intake / an der PDF-Erzeugung.

## Verifikation
- Build ok.
- Manuell: BIG-Antrag öffnen → „BIG online ausfüllen" → Wizard Schritt 1 (Name): Anrede-Select gesetzt, Vorname, Nachname, Geburtsname (= Nachname) gefüllt. Nach „Weiter" Bookmarklet erneut → Geburtsdatum/Ort werden gefüllt.
- Untereintrag Ehegatte mit eigener Mitgliedschaft öffnen → Button sichtbar → Zwischenablage enthält Ehegatten-Daten, nicht die des Hauptantrags.
