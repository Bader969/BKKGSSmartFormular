---
name: BIG Plusbonus Integration
description: BIG direkt gesund (Plusbonus) provider — minimal personal+bank form, single-page PDF export
type: feature
---
- Provider value: `big_plusbonus`. Template: `public/big-plusbonus.pdf`. Export util: `src/utils/bigPlusbonusExport.ts`.
- Renders only `MemberSection` + `BigPlusbonusSection` + `SignatureSection` (no spouse/children).
- Required fields: Vorname, Name, Strasse, Hausnr., PLZ, Ort, Geschlecht (m/w/d), Bank: Kontoinhaber, Kreditinstitut, IBAN, BIC, Ort, Datum (TTMMJJ on PDF), Mitglieds-Unterschrift.
- HIDDEN in MemberSection for big_plusbonus: Geburtsdatum/Geburtsort/Geburtsland, KV-Nummer, Name der Krankenkasse, Familienstand, Telefon, E-Mail, plus the "Automatisch ausgefüllte Angaben" info block.
- Optional UI blocks (BigPlusbonusSection): Versicherungsstatus radio (`Neuabschluss`/`bestehende Zusatzversicherung`), `Höhe in Euro`, 4 Versicherungsart checkboxes (privateZusatz, berufsunfaehigkeit, unfall, grundfaehigkeit), up to 3 mitversicherte Angehörige (Name Vorname + Höhe der Police).
- AcroField mapping: `Name`, `Vorname`, `Straße`, `Hausnummer`, `PLZ`, `Ort`, gender checkboxes `männlich`/`weiblich`/`divers`, bank: `Kontoinhaberin`, `Kreditinstitut`, `IBAN Internationale Bankkontonummer`, `BIC`, `Ort_2`, `Datum TTMMJJ`. Status: `Neuabschluss`, `bestehende Zusatzversicherung`, `Euro`. Arten: `private Zusatzversicherung im Sinne von  22 sowie  16` (double spaces!), `Berufsunfähigkeitsversicherung`, `Unfallversicherung`, `Grundfähigkeitsversicherung`. Mitversicherte: `Name Vorname`/`Name Vorname_2`/`Name Vorname_3` and `Höhe der Police in Euro`(_2/_3). Signature drawn at Signatur16 widget (left=301, top=407, w≈240, h≈28) on page 1.
- Geburtsdatum NOT required for big_plusbonus (excluded in Index validation). Phone/Email mandatory rule from core memory does NOT apply to big_plusbonus (form has no contact section).
- Export uses encoding/whitespace fallback when looking up AcroFields (umlauts, double-space, broken UTF-8 like `Ã¤`).
- Kontoinhaber auto-syncs with `Vorname Name` (analog to viactivBonusKontoinhaber).
