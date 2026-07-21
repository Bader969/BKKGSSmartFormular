
## Ziel

Im UI (bei Krankenkasse = Novitas BKK) alle Pflichtfelder aus dem hochgeladenen Novitas-HTML-Formular sowie die zusätzlich genannten Felder (KV-Nummer, Familienstand, Telefon, komplette Arbeitgeberdaten außer „Beschäftigt seit", Bankverbindung) erfassbar machen. Diese Felder müssen sowohl in die Zwischenablage/Bookmarklet-Payload einfließen als auch beim „Entwurf speichern" 1:1 im verschlüsselten Applications-Datensatz landen.

## Feld-Inventar aus der hochgeladenen Novitas-Form

Aus `form-page_class_blockform-group_cla.txt` extrahierte Feldnamen (`ng.form0.*`), aufgeteilt in Rollen:

- Mitglied: `mitglied.Beginndatum` (auto), `mitglied.Versicherungsart` (aus Beschäftigung abgeleitet)
- Person: `Vorname`, `Name`, `Geschlecht`, `Geburtsdatum`, `Geburtsort`, `Strasse`, `PLZ`, `Ort`, `Telefonnummer`, `E_Mail_Adresse`, `Familienstand`, `Krankenversicherungsnummer`, `Rentenversicherungsnummer`
- Bisherige KV: `zuletzt_krankenkasse`, `zuletzt_versichert` (bool), `zuletzt_versichert_vom` (leer), `zuletzt_versichert_bis` (auto)
- Anlass: `Anlass_Wechsel.anlass` = `Ablauf_Bindungsfrist` (fix)
- AG: `Name_Arbeitgeber`, `Strasse_Arbeitgeber`, `PLZ_Arbeitgeber`, `Ort_Arbeitgeber`, `Arbeitsentgeld`, `beschaeftigt_seit` (letzteres bewusst NICHT ins UI)
- Bank: `bankverbindung.kontoinhaber`, `bankverbindung.IBAN`
- Weitere: `weitere_angaben.fami` (nur wenn Modus „Familie" ✓), `weitere_angaben.mwm`
- Vertrieb (fix): `send.KEV=1`, `send.mitarbeiter=1393`, `send.vertriebspartner=011062257459`

## UI-Änderungen (nur bei `selectedKrankenkasse === 'novitas'`)

`src/components/MemberSection.tsx`
- Aktuell für Novitas ausgeblendet: Geburtsdatum, Geburtsort, Adresse. Diese Blöcke wieder sichtbar & pflichtig machen (Novitas erwartet sie).
- Zusätzlich neues Pflichtfeld „Rentenversicherungsnummer" (`mitgliedRentenversicherungsnummer`).
- Für Novitas ein explizites Feld „Geschlecht" (Dropdown: männlich/weiblich/unbestimmt/divers) — mappt intern auf `viactivGeschlecht` (Wiederverwendung, kein neues Feld nötig, aber Option „unbestimmt" ergänzen).

Neue Sektion `NovitasEmployerBankSection` (nur bei Novitas) — nach dem Ehegatte/Kinder-Block und vor der Unterschrift:
- Arbeitgeber (Novitas-relevant): Name, Straße, Hausnummer, PLZ, Ort, **Arbeitsentgelt (monatlich, EUR)**. Kein „Beschäftigt seit"-Feld.
- Auto-Prefill wenn Beschäftigung = Jobcenter/AgenturArbeit → Name „Jobcenter …" / „Agentur für Arbeit …", Adresse = Mitgliedsadresse; bleibt editierbar.
- Bankverbindung: Kontoinhaber, IBAN (schreibt/liest `formData.bigBank.kontoinhaber` und `.iban`, damit keine Feld-Duplikate zwischen Krankenkassen entstehen).

Bei Antragsvariante „Familienversicherung" gibt es diese AG/Bank-Sektion **einmal für das Hauptmitglied** und zusätzlich für jede Person mit eigener Mitgliedschaft (Ehegatte + Kinder ≥ 16 wenn Jobcenter). Für die Sub-Personen werden AG-Daten in `formData.ehegatte`/`formData.kinder[i]` gespeichert:
- Zwei neue Felder pro `FamilyMember`: `novitasArbeitgeber?: ArbeitgeberDaten`, `novitasArbeitsentgelt?: string`.
- Bank wird pro Sub-Person ebenfalls neu erfasst: `novitasBank?: { kontoinhaber, iban }` (fallback auf `formData.bigBank`).

## Datenmodell (`src/types/form.ts`)

Neue Felder auf `FormData`:
- `mitgliedRentenversicherungsnummer: string`
- `novitasArbeitsentgelt: string` (Hauptmitglied, monatlich EUR)

Neue optionale Felder auf `FamilyMember`:
- `rentenversicherungsnummer?: string`
- `novitasArbeitgeber?: ArbeitgeberDaten`
- `novitasArbeitsentgelt?: string`
- `novitasBank?: { kontoinhaber: string; iban: string }`

`createInitialFormData` / `createEmptyFamilyMember` entsprechend initialisieren (leere Strings / `undefined`).

## Autofill-Payload (`src/utils/novitasAutofillPayload.ts`)

Payload-Interface erweitern:
- `person.rentenversicherungsnummer: string`
- `arbeitgeber.arbeitsentgeltMonatlich: string`
- Für Sub-Personen: AG- und Bank-Daten aus deren eigenen Feldern lesen, sonst Fallback auf Hauptmitglied.

Werte-Auflösung pro Rolle:
- `main`: `formData.mitgliedRentenversicherungsnummer`, `formData.viactivArbeitgeber`, `formData.novitasArbeitsentgelt`, `formData.bigBank`.
- `ehegatte`/`kind`: `person.rentenversicherungsnummer`, `person.novitasArbeitgeber ?? formData.viactivArbeitgeber`, `person.novitasArbeitsentgelt ?? formData.novitasArbeitsentgelt`, `person.novitasBank ?? formData.bigBank`.

## Bookmarklet (`src/bookmarklets/novitasAutofillSource.ts`)

Neue Selektoren/Mappings ergänzen:
- `personen_angabe.Rentenversicherungsnummer` ← `person.rentenversicherungsnummer`
- `ag.Arbeitsentgeld` ← `arbeitgeber.arbeitsentgeltMonatlich`
- Sicherstellen, dass `bankverbindung.kontoinhaber`, `bankverbindung.IBAN` gesetzt werden.

## Validierung (`src/pages/Index.tsx`, Novitas-Zweig)

Bei Novitas als Pflicht prüfen:
- Geburtsdatum, Geburtsort, Straße, Hausnummer, PLZ, Ort
- Rentenversicherungsnummer (Format-Check: 1 Buchstabe + 9 Ziffern + 1 Buchstabe, sonst Warnung)
- Arbeitgeber (Name/Straße/PLZ/Ort/Arbeitsentgelt), außer die Sub-Person hat keine eigene Mitgliedschaft
- Bank (Kontoinhaber, IBAN)

## Entwurf-Speicherung / Audit

`useApplicationPersistence.save()` sendet bereits das gesamte `formData` an die Edge-Funktion `applications-api`, wo es AES-GCM-verschlüsselt in `applications.payload_ct` abgelegt wird. Da die neuen Felder Teil von `FormData` werden, landen sie automatisch verschlüsselt im Datensatz — kein Migrationsbedarf. Zusätzlich wird ein `application_events`-Eintrag `created`/`updated` geschrieben (Meta bleibt PII-frei). Kein Feld-für-Feld-Event nötig; der komplette Payload ist über „Entschlüsseln" jederzeit einsehbar.

Kein DB-Schema-Change. Keine Änderung am Grant-/RLS-Setup.

## Technische Details (kurz)

Betroffene Dateien:

```text
src/types/form.ts                          neue FormData/FamilyMember-Felder
src/components/MemberSection.tsx           Novitas-Felder wieder einblenden + RVNR
src/components/SpouseSection.tsx           RVNR-Feld + optionale AG/Bank bei eig. MS
src/components/FamilyMemberForm.tsx        RVNR + optionale AG/Bank bei eig. MS
src/components/NovitasEmployerBank.tsx     NEU: AG-/Bank-Block für Novitas
src/pages/Index.tsx                        Block einbinden, Validierung
src/utils/novitasAutofillPayload.ts        neue Payload-Felder + Sub-Person-Fallbacks
src/bookmarklets/novitasAutofillSource.ts  Mapping RVNR + Arbeitsentgeld + Bank
src/components/JsonImportDialog.tsx        Beispiel-JSON um neue Felder ergänzen
```

Kein neues Secret, keine Migration, keine Edge-Function-Änderung.
