## Ziel
BKK GILDEMEISTER SEIDENSTICK (Familienversicherung + Rundum-Sicher-Paket) wieder als auswählbare Krankenkasse im Dropdown freischalten.

## Status quo
- Komplette BKK-GS-Logik ist im Code noch vorhanden und funktionsfähig:
  - `src/pages/Index.tsx` rendert bei `selectedKrankenkasse === 'bkk_gs'` weiterhin Modus-Auswahl, `MemberSection`, `SpouseSection`, `ChildrenSection` und `RundumSicherPaketSection`.
  - Export-Pfade (`exportFilledPDF`, `exportRundumSicherPaketOnly`) und Validierungen bleiben unangetastet.
- Einziger Blocker: In `src/types/form.ts` ist die Option `bkk_gs` im Array `KRANKENKASSEN_OPTIONS` auskommentiert ("Temporär versteckt"), daher erscheint sie nicht im Auswahl-Dropdown.

## Änderung
1. `src/types/form.ts`: Auskommentierte Zeile entfernen und `bkk_gs` als erste Option im Array `KRANKENKASSEN_OPTIONS` wieder einfügen:
   ```ts
   { value: 'bkk_gs' as Krankenkasse, label: 'BKK GILDEMEISTER SEIDENSTICK' },
   ```

## Nicht Teil dieses Plans
- Keine Änderung an Export-Utilities, Validierung, UI-Sektionen oder PDF-Templates.
- Keine Änderung an anderen Krankenkassen.

## Verifizierung
- Im Dropdown erscheint "BKK GILDEMEISTER SEIDENSTICK".
- Nach Auswahl werden Modus-Auswahl, Spouse/Children (im Modus „Familienversicherung + Rundum") und `RundumSicherPaketSection` sichtbar; Export erzeugt wie früher Familienversicherungs- und Rundum-PDFs.
