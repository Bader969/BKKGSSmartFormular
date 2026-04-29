---
name: BIG Plusbonus Integration
description: BIG direkt gesund (Plusbonus) provider — minimal personal+bank form, single-page PDF export
type: feature
---
- Provider value: `big_plusbonus`. Template: `public/big-plusbonus.pdf`. Export util: `src/utils/bigPlusbonusExport.ts`.
- Renders only `MemberSection` + `BigPlusbonusSection` + `SignatureSection` (no spouse/children).
- Required fields: Vorname, Name, Strasse, Hausnr., PLZ, Ort, Geschlecht (m/w/d), Bank: Kontoinhaber, Kreditinstitut, IBAN, BIC, Ort, Datum (TTMMJJ on PDF), Mitglieds-Unterschrift.
- AcroField mapping: `Name`, `Vorname`, `Straße`, `Hausnummer`, `PLZ`, `Ort`, checkboxes `männlich`/`weiblich`/`divers`, `Kontoinhaberin`, `Kreditinstitut`, `IBAN Internationale Bankkontonummer`, `BIC`, `Ort_2`, `Datum TTMMJJ`. Signature drawn at Signatur16 widget (left=301, top=407, w≈240, h≈28) on page 1.
- Geburtsdatum NOT required for big_plusbonus (excluded in Index validation).
- Kontoinhaber auto-syncs with `Vorname Name` (analog to viactivBonusKontoinhaber).
