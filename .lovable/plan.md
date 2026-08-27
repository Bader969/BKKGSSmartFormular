# BIG direkt: Arbeitgeber- bzw. Jobcenter-Daten (wie Novitas/VIACTIV)

Ziel: Auch bei BIG direkt gesund werden Beschäftigungs- und Arbeitgeberdaten erfasst — bei Beschäftigung Name **und Anschrift** des Arbeitgebers, bei Leistungsbezug Name (und Anschrift) von **Jobcenter / Agentur für Arbeit**. Gilt für Einzelperson (Variante A) und Familie (Variante B), inklusive jeder Person mit eigener Mitgliedschaft (Ehegatte / Kind ≥ 15).

Wichtiger Hinweis: Die BIG-PDFs (`big-plusbonus.pdf`, `big-familienversicherung.pdf`) enthalten **keine** Arbeitgeber-Felder. Die Daten werden daher erfasst, gespeichert (Audit/Entwurf), im Antragsdetail angezeigt und in das **BIG-Online-Autofill** (Zwischenablage + Bookmarklet) übernommen — genau der Weg, über den bei BIG die eigenen Mitgliedschaften online ausgefüllt werden.

## 1. Beschäftigungsstatus erweitern

- Der heutige BIG-Toggle „Beschäftigt (SGB I) / Arbeitslos (SGB II)" bleibt fachlich erhalten, wird aber um eine feinere Auswahl analog Novitas ergänzt:
  - Pflichtversicherter Arbeitnehmer
  - Auszubildender
  - Arbeitslos – Jobcenter (AL-Geld II)
  - Arbeitslos – Agentur für Arbeit (AL-Geld I)
- Die bestehende Ableitungslogik (arbeitslos → eigene Mitgliedschaft für Ehegatte und Kinder ≥ 15; beschäftigt → familienversichert außer eigene Beschäftigung) bleibt unverändert; die neuen Werte werden auf `beschaeftigt`/`arbeitslos` abgebildet.

## 2. Neuer Formularblock „Arbeitgeber bzw. Jobcenter/Agentur für Arbeit"

- Wird nur bei BIG angezeigt, direkt nach dem Antrags-Varianten-/Beschäftigungsblock.
- Felder: Name der Stelle (Arbeitgeber oder Behörde), Straße, Hausnummer, PLZ, Ort. „Beschäftigt seit" bleibt ausgeblendet (bestehende VIACTIV-Vorgabe).
- Beschriftung und Hilfetext richten sich nach dem Status: bei Beschäftigung „Name und Anschrift des Arbeitgebers", bei Leistungsbezug „Name und Anschrift des Jobcenters / der Agentur für Arbeit".
- Ein Block für das Hauptmitglied plus je ein eigener Block pro Person mit eigener Mitgliedschaft (Ehegatte, Kinder ≥ 15) — mit Übernahme-Button „Angaben vom Hauptmitglied übernehmen".
- Pflichtprüfung: Name der Stelle ist erforderlich, sobald ein Beschäftigungsstatus gewählt ist; Anschrift ist erforderlich (analog Novitas), sonst Hinweis beim Absenden/Export.

## 3. Autofill & Anzeige

- Das BIG-Autofill-Payload wird um einen `arbeitgeber`-Block erweitert (Name, Straße, Hausnummer, PLZ, Ort, plus Status). Bei Untereinträgen (Ehegatte/Kind) werden die personenbezogenen Daten verwendet, mit Rückfall auf das Hauptmitglied.
- Das Bookmarklet füllt die entsprechenden Felder im BIG-Online-Formular (Arbeitgeber/Stelle, Straße, Hausnummer, PLZ, Ort) und meldet sie wie gewohnt im Overlay als gefüllt/nicht gefunden. Version des Bookmarklets wird erhöht, damit die Setup-Seite zum Neu-Anlegen des Lesezeichens auffordert.
- Freitext-/JSON-Import und die KI-Extraktion übernehmen Arbeitgeber- bzw. Jobcenter-Angaben in dieselben Felder, wenn sie in den Unterlagen stehen.

## Technische Details

- `src/types/form.ts`: `bigArbeitgeber?: ArbeitgeberDaten` auf `FormData`; pro `FamilyMember` `bigArbeitgeber?: ArbeitgeberDaten` (Wiederverwendung des bestehenden `ArbeitgeberDaten`-Typs, `createEmptyArbeitgeberDaten`). Feineren Status als `bigBeschaeftigungsstatus` speichern, `bigMitgliedBeschaeftigt` weiterhin abgeleitet setzen.
- Neue, wiederverwendbare Komponente (angelehnt an `NovitasEmployerBank`, aber ohne Bank/Arbeitsentgelt), eingebunden in `src/pages/Index.tsx` im BIG-Zweig; Personen-Ermittlung über die bestehende BIG-Ableitung (`eigeneMitgliedschaft`).
- `src/bookmarklets/bigAutofillSource.ts`: `BigAutofillPayload` um `arbeitgeber` erweitern, Fill-Aufrufe mit Musterlisten (`arbeitgeber`, `firma`, `dienststelle`, `jobcenter`, `strasse`, `hausnummer`, `plz`, `ort`) im Arbeitgeber-Abschnitt ergänzen.
- `src/components/ApplicationDetailDrawer.tsx`: Arbeitgeberdaten je Kontext (Haupt/Ehegatte/Kind) in das Payload schreiben und im Detail anzeigen.
- `src/utils/validation.ts` bzw. BIG-Validierung in `Index.tsx`: Pflichtfelder ergänzen. PDF-Export-Dateien bleiben unverändert.
- Memory `mem/features/big-direkt-integration.md` um den neuen Block ergänzen.
