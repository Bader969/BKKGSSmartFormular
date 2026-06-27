
# BIG direkt — Familienversicherung (Zusammenfassung_Familienversicherung)

Leeres Template liegt jetzt vor. Implementierung kann komplett ausgeführt werden.

## Konzept

BIG direkt arbeitet ab jetzt – analog zu BKK GS – mit **einem einzigen UI-Formular** und zwei Export-Varianten:

- **Variante A — Plusbonus allein** (Einzelperson): nur die heutige Plusbonus-PDF.
- **Variante B — Familienantrag + Plusbonus**: zusätzlich `Zusammenfassung_Familienversicherung.pdf`.

Provider-Key `big_plusbonus` bleibt der einzige Eintrag für BIG. Im BIG-Bereich gibt es einen Toggle „Auch Familienversicherung beantragen“, der die zusätzlichen Felder/Sektionen aktiviert. Alle vorhandenen Sync- und Auto-Fill-Mechaniken (Mitglied → Ehegatte/Kinder, KK-Name, Adresse, Datum) wirken in beiden Varianten.

## UI (Variante B aktiv)

- Neuer Schalter `bigFamilienversicherung` im BIG-Bereich.
- `MemberSection` blendet die heute für `big_plusbonus` versteckten Felder wieder ein: Geburtsdatum, Geburtsort, Geburtsland, KV-Nummer, Name bisherige KK, Familienstand, Telefon, E-Mail.
- `SpouseSection` und `ChildrenSection` werden eingeblendet (Logik wie Novitas/DAK).
- Globaler Sync (KV-Nr, Adresse, KK-Name → Familie) greift.

## Pflichtfelder (Variante B)

- **Mitglied**: Vorname, Name, Adresse, Telefon, E-Mail, KV-Nummer, Familienstand, Name bisherige KK.
- **Ehegatte** (wenn angelegt): Beginn FamVers, Geburtsdatum, Geschlecht (m/w/x/d), Versichertennr., Enddatum bisherige Vers., Art der bisherigen Vers.
- **Kinder** (je Kind): Beginn FamVers, Geburtsdatum, Geschlecht, Verwandtschaft (leiblich/Stief/Pflege/Enkel), Versichertennr.
- **Angehörige ohne Rentenversicherungsnr.**: Geburtsname, Geburtsort, Geburtsland, Staatsangehörigkeit.
- Plusbonus-Felder bleiben wie heute Pflicht.

## Auto-Fill

- „Bisherige Versicherung besteht weiter bei: **BIG direkt gesund**“ für alle Angehörigen voreingetragen.
- „Name + Vorname Mitglied (Ableitung der FamVers)“ für Kinder = Vorname + Name des Mitglieds.
- Ort + Datum der Mitglied-Unterschrift aus Adresse / Heute.
- Geburtsland aus Geburtsort (bestehende Logik).

## PDF-Naming

`Zusammenfassung_Familienversicherung <Vorname> <Nachname>, <TT.MM.JJJJ>.pdf` (Geburtsdatum des Mitglieds). Plusbonus-PDF behält seinen aktuellen Namen.

## Validierung & Export

- `validation.ts`: zusätzlicher Block, der nur bei `bigFamilienversicherung === true` greift.
- Neue Util `src/utils/bigFamversExport.ts` mit komplettem AcroField-Mapping aus der CSV:
  - Seite 1: Mitglied (066/067/068/070-074/078/080), Familienstand-Radio, „bisher selbst/familienversichert/nicht“-Radio, Anlass-Radio, Ehegatte+3 Kinder-Spalten (082-130 Block) mit Beginn/Name/Vorname/Geburtsdatum/Geschlecht-Radio/Verwandtschaft-Radio/„nicht verwandt“-Checkbox/bisher-Enddatum/Art-Radio/abgeleitet-von-Name/weiter-bei.
  - Seite 2: sonstige Angaben (131-177 Block), Versichertennummern + Rentenvers.-Nr. + Geburtsname/-ort/-land/Staatsang. (183-206), Ort/Datum (207/208) + Unterschriften-Widgets (208/209/210).
- Encoding-/Whitespace-Fallback (Umlaute, doppelte Leerzeichen, kaputtes UTF-8) wie bei `bigPlusbonusExport`.
- Signatur-Widgets: Mitglied → `208_Unterschriftsfeld 2`, Ehegatte → `210_Unterschriftsfeld 2`, Kind ≥15 → `209_Unterschriftsfeld 2` (Koordinaten aus CSV).
- Beim Export werden in Variante B beide PDFs nacheinander erzeugt und in den bestehenden Download-/Merge-Flow gegeben.

## Technical Details

- Template: leeres PDF wird nach `public/big-familienversicherung.pdf` kopiert und per `fetch` geladen (wie andere Templates).
- Neuer Flag im `FormData`: `bigFamilienversicherung: boolean` (default false).
- `applyKrankenkassenMapping` für `big_plusbonus` so erweitern, dass bei aktiver Familienvers. auch `ehegatte`, `kinder`, Geburtsdaten, KV-Nr gemappt werden.
- Memory: bestehende Datei `mem/features/big-plusbonus-integration.md` umbenennen/erweitern zu `mem/features/big-direkt-integration.md` mit beiden Varianten, Naming, Pflichtfeldern und AcroField-Mapping; Index aktualisieren.
- JSON-Import & Freitext-Import-Beispiele für BIG entsprechend ergänzen (Familienfelder).
