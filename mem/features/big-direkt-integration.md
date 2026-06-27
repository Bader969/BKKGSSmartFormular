---
name: BIG direkt Integration
description: BIG direkt gesund — Plusbonus alone OR Plusbonus + Familienversicherung (toggle), shared form, two PDFs
type: feature
---
- Provider value: `big_plusbonus` (sole BIG dropdown entry). Templates: `public/big-plusbonus.pdf` + `public/big-familienversicherung.pdf`. Export utils: `src/utils/bigPlusbonusExport.ts`, `src/utils/bigFamversExport.ts`.
- UI toggle `bigFamilienversicherung` in `BigPlusbonusSection`. Off → Variante A (Plusbonus alone, abgespecktes Formular). On → Variante B: Member zeigt volle Felder (Geburtsdatum, Geburtsort/-land, KV-Nr, KK, Familienstand, Telefon, E-Mail) und `SpouseSection` + `ChildrenSection` werden eingeblendet. Beim Export werden in B beide PDFs erzeugt.
- PDF Naming: Plusbonus unverändert (`BIG-Plusbonus_Name_Vorname.pdf`). Familienversicherung: `Zusammenfassung_Familienversicherung Vorname Nachname, TT.MM.JJJJ.pdf` (Geburtsdatum Mitglied). Bei >3 Kindern: ` (Teil N)` Suffix.
- Pflichtfelder Variante B: Mitglied (KV-Nr, Familienstand, KK, Telefon, E-Mail, Geburtsdatum), Ehegatte (Beginn FamVers auto, Geburtsdatum, Geschlecht, Versichertennr., bisherige KK + Enddatum), Kinder je (Beginn auto, Geburtsdatum, Geschlecht, Verwandtschaft, Versichertennr.), und für Angehörige ohne RV-Nr.: Geburtsname/-ort/-land/Staatsangehörigkeit.
- Auto-Fill Variante B: `bisherigBestehtWeiterBei = 'BIG direkt gesund'`, `abgeleitetVon = Vorname+Name Mitglied` (Kinder), Erreichbarkeit=Mobil, bisher selbst versichert (Mitglied), Anlass = "Beginn meiner Mitgliedschaft", Beginn FamVers = +3 Monate (1. des Monats), bisherige Vers endete = Monatsende davor.

## Variante A (Plusbonus alone)
- Renders only `MemberSection` + `BigPlusbonusSection` + `SignatureSection` (no spouse/children).
- Required fields: Vorname, Name, Strasse, Hausnr., PLZ, Ort, Geschlecht (m/w/d), Bank: Kontoinhaber, Kreditinstitut, IBAN, BIC, Ort, Datum (TTMMJJ on PDF), Mitglieds-Unterschrift.
- HIDDEN in MemberSection for big_plusbonus: Geburtsdatum/Geburtsort/Geburtsland, KV-Nummer, Name der Krankenkasse, Familienstand, Telefon, E-Mail, plus the "Automatisch ausgefüllte Angaben" info block.
- Optional UI blocks (BigPlusbonusSection): Versicherungsstatus radio (`Neuabschluss`/`bestehende Zusatzversicherung`), `Höhe in Euro`, 4 Versicherungsart checkboxes (privateZusatz, berufsunfaehigkeit, unfall, grundfaehigkeit), up to 3 mitversicherte Angehörige (Name Vorname + Höhe der Police).
- AcroField mapping: `Name`, `Vorname`, `Straße`, `Hausnummer`, `PLZ`, `Ort`, gender checkboxes `männlich`/`weiblich`/`divers`, bank: `Kontoinhaberin`, `Kreditinstitut`, `IBAN Internationale Bankkontonummer`, `BIC`, `Ort_2`, `Datum TTMMJJ`. Status: `Neuabschluss`, `bestehende Zusatzversicherung`, `Euro`. Arten: `private Zusatzversicherung im Sinne von  22 sowie  16` (double spaces!), `Berufsunfähigkeitsversicherung`, `Unfallversicherung`, `Grundfähigkeitsversicherung`. Mitversicherte: `Name Vorname`/`Name Vorname_2`/`Name Vorname_3` and `Höhe der Police in Euro`(_2/_3). Signature drawn at Signatur16 widget (left=301, top=407, w≈240, h≈28) on page 1.
- Geburtsdatum NOT required for big_plusbonus (excluded in Index validation). Phone/Email mandatory rule from core memory does NOT apply to big_plusbonus (form has no contact section).
- Export uses encoding/whitespace fallback when looking up AcroFields (umlauts, double-space, broken UTF-8 like `Ã¤`).
- Kontoinhaber auto-syncs with `Vorname Name` (analog to viactivBonusKontoinhaber).

## Variante B (FamVers + Plusbonus)
- AcroField mapping `bigFamversExport.ts` per CSV-Layout. Spalten: Partner=`08X`/`11X`/`18X`, Kind1=`08X+1`/`11X+5`/`18X+6`, etc. Radios mit Wertindex pro Group:
  - `074_Familienstand`: 0=ledig, 1=verheiratet, 2=LPartG, 3=verwitwet, 4=getrennt, 5=geschieden
  - `076_Versicherung` (Mitglied bisher): 0=selbst, 1=fami, 2=nicht_gesetzlich
  - `078_Anlass`: 0=Beginn, 1=Sonstiges, 2=Geburt, 3=Heirat, 4=Beendigung
  - `068_Erreichbarkeit`: 0=Festnetz, 1=Mobil
  - Geschlecht Partner (`083_…`): m=0, x=1, w=2, d=3
  - Geschlecht Kind1/2/3 (`090/098/106_…`): m=0, x=1, d=2, w=3 (Reihenfolge weicht von Partner ab!)
  - Verwandtschaft (`092/100/108_…`): 0=leiblich, 1=stief, 2=pflege, 3=enkel
  - Bisherige Vers Partner/Kind (`112/117/122/127_…`): 0=selbst, 1=fami, 2=nicht
- Signatur-Widgets (PDFSignature) auf Seite 2 werden NICHT als AcroFields gesetzt, sondern als Bild gezeichnet:
  - Mitglied → x=313, y=249, w=252, h=14
  - Ehegatte → x=44, y=227, w=252, h=12 (links unten)
  - Kind ≥15 (ältestes) → x=313, y=226, w=252, h=14
- Multi-PDF: >3 Kinder → mehrere PDFs (`Teil 1`, `Teil 2`, …) analog Novitas.
