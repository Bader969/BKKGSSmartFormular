# Novitas BKK – Externes Autofill + Personenauswahl

Ziel: Auf `novitas-bkk.de/formulare/kundenservice?...&f.send.mitarbeiter=1393` per Ein-Klick alle Pflichtfelder + Kontakt/AG/Bank ausfüllen, parallel im eigenen Antrag befüllen; einzelne Person oder Familienversicherung wählbar; Kinder ≥16 & Ehegatte bei Jobcenter → eigene Mitgliedschaft.

## Umfang der zu befüllenden Felder (extern + intern)

Pflicht (*), zusätzlich immer: KV-Nummer, Familienstand, Telefon, alle Arbeitgeberdaten außer „Beschäftigt seit", Bankverbindung.

Feste Werte:
- Versicherungsbeginn: 1. des Monats +3 Kalendermonate (heute Referenz-„today")
- Zuletzt versichert **bis**: letzter Tag des Monats vor Versicherungsbeginn; **vom** bleibt leer
- Anlass Kassenwechsel: „Ablauf der Bindungsfrist (12 Monate)"
- Vertriebspartner: „Ich bin Vertriebspartner", Vermittler-ID `011062257459`
- Familienangehörige-Checkbox „Ja, Fragebogen zusenden": nur wenn Modus = Familienversicherung
- Status (Ich bin…): einer von `pflichtversicherter_Arbeitnehmer`, `Auszubildender`, `Arbeitslose_r_Jobcenter`, `Arbeitslose_r_AgenturArbeit`

## Arbeitgeber-Logik

- Beschäftigt / Ausbildung → reguläre AG-Daten (Name + Anschrift) aus dem Formular, **ohne** „Beschäftigt seit".
- Status = **Jobcenter** (kein Arbeitgeber im klassischen Sinne) → das Jobcenter wird als „Arbeitgeber" eingetragen: Name des Jobcenters + vollständige Anschrift (Straße, Hausnr., PLZ, Ort). Gilt für Hauptmitglied wie für jede eigenständige Mitgliedschaft (Ehegatte / Kind ≥16), die selbst Jobcenter-Leistungen bezieht.
- Status = Agentur für Arbeit → analog Agentur-Adresse als AG-Feld, falls vorhanden; sonst leer lassen.
- Bei Einzelperson-Modus greift die Logik pro ausgewählter Person unabhängig.

## Änderungen

### 1. Modus-Umschaltung (Novitas)
`src/pages/Index.tsx` (Novitas-Zweig): Toggle „Einzelperson" vs. „Familienversicherung". Bei Einzelperson werden Ehegatte/Kinder-Sektionen ausgeblendet; Autofill/Export nutzen nur das Hauptmitglied. Toggle in `FormData` als `novitasMode: 'einzeln' | 'familie'`.

### 2. Auto-Split bei Jobcenter
Neuer Helper `src/utils/novitasSplit.ts`: wenn `familie`-Modus und Hauptmitglied-Status = Jobcenter, dann Ehegatte + jedes Kind ≥16 Jahre = **eigene Mitgliedschaft**; Kinder <16 bleiben familienversichert. Verwendet in Antragslisten-Split und im Autofill-Payload.

### 3. Autofill-Bookmarklet
Neu: `src/bookmarklets/novitasAutofillSource.ts` (Struktur wie `bigAutofillSource.ts`, Vanilla-JS-IIFE, aus Zwischenablage).
- Payload-Typ: `novitas-autofill/v1`
- Selektor-Strategie primär über `name="ng.form0.mitglied.<Feld>"` / `id`-Präfix `novitas-form-*`, Labels als Fallback (wortweises Matching wie im BIG-Bookmarklet)
- Setter: nativer value-Setter + `input`/`change`/`blur` (Angular-kompatibel)
- `<select>`: `option value` setzen; Datum als `YYYY-MM-DD`
- Checkbox „Familienangehörige-Fragebogen": nur bei `mode: 'familie'`
- Vertriebspartner-Radio „Ich bin Vertriebspartner" + Vermittler-ID `011062257459`
- Statusfeld inkl. Jobcenter-/Agentur-Optionen
- Arbeitgeber-Block: bei Jobcenter Jobcenter-Name+Anschrift statt AG-Daten
- Overlay-Statusmeldung wie bei BIG

Setup-Seite analog `BigAutofillSetup.tsx` → `NovitasAutofillSetup.tsx`, Route in `App.tsx`.

### 4. Copy-Button + JSON-Payload
`src/components/ApplicationDetailDrawer.tsx`: bei `krankenkasse === 'novitas'` Button „Novitas online ausfüllen" pro Person (Haupt + jede eigene Mitgliedschaft aus Split). Kopiert JSON in Zwischenablage, öffnet Novitas-Formular-URL im neuen Tab.

Neue Datei `src/utils/novitasAutofillPayload.ts`: baut `NovitasAutofillPayload` aus `FormData` + gewählter Person inkl. berechneter Daten (Beginn, „bis"), Status-Mapping, AG-Daten (inkl. Jobcenter-Fallback), Bank.

### 5. JSON-Import Beispiel
`src/components/JsonImportDialog.tsx`: `createNovitasExampleJson()` erweitern um Pflichtfelder + KV-Nr, Familienstand, Telefon, AG-Daten (ohne „Beschäftigt seit"), Bankverbindung, `novitasMode`, Beispielzeile mit Jobcenter als „Arbeitgeber".

## Technische Details

- **Datum-Berechnung**: `getBeginDate` / `getEndDate` aus `dateUtils.ts`.
- **Status-Ableitung** aus vorhandenem Beschäftigungsstatus (VIACTIV-kompatibel).
- **Jobcenter-AG-Mapping**: eigene Felder `jobcenterName`, `jobcenterStrasse`, `jobcenterHausnummer`, `jobcenterPlz`, `jobcenterOrt` bereits vorhanden bzw. neu — Payload greift bei Status=Jobcenter darauf zu, sonst auf `arbeitgeber*`-Felder.
- **Bookmarklet-Build**: bestehende `buildBookmarkletHref`-Logik wiederverwenden.
- **Keine Persistenz sensibler Daten**: Payload bleibt Clipboard-only.

## Betroffene Dateien
- `src/types/form.ts` (`novitasMode`, ggf. Jobcenter-AG-Felder)
- `src/pages/Index.tsx` (Modus-Toggle Novitas)
- `src/utils/novitasSplit.ts` (neu)
- `src/utils/novitasAutofillPayload.ts` (neu)
- `src/bookmarklets/novitasAutofillSource.ts` (neu)
- `src/pages/NovitasAutofillSetup.tsx` (neu) + Route in `src/App.tsx`
- `src/components/ApplicationDetailDrawer.tsx` (Copy-Button pro Person)
- `src/components/JsonImportDialog.tsx` (Novitas-Beispiel erweitern)

## Nicht betroffen
- PDF-Export, RLS, Verschlüsselung, andere Krankenkassen, E-Mail/WhatsApp-Versand.
