## Ziel
Auto-Trigger für eigenen Plusbonus statt manueller UI-Checkbox + Mitversicherte nur im Hauptmitglieds-Plusbonus.

## Änderungen

### 1) UI: Checkboxes entfernen (BIG)
- `src/components/SpouseSection.tsx`: Den (in der vorherigen Iteration eingefügten) Amber-Checkbox-Block „Ehegatte hat eigene Mitgliedschaft, nicht familienversichert" für `big_plusbonus` wieder entfernen. Keine BIG-spezifischen Checkboxen im UI.
- `src/components/ChildrenSection.tsx`: Analog den eingefügten Amber-Checkbox-Block pro Kind für `big_plusbonus` entfernen.
- (Keine Änderungen am bestehenden VIACTIV-Verhalten.)

### 2) Auto-Ableitung „eigeneMitgliedschaft" für BIG beim Export
- `src/utils/bigPlusbonusExport.ts` in `exportBigPlusbonus`: Statt `e.eigeneMitgliedschaft` und `k.eigeneMitgliedschaft` zu lesen, verwende für BIG die abgeleitete Bedingung:
  ```
  const hasOwnMembership = (m) =>
    m && (m.eigeneMitgliedschaft === true || m.bisherigArt === 'mitgliedschaft')
        && (m.vorname || m.name);
  ```
- Damit wird beim Ehegatten/Kind automatisch ein eigener Plusbonus-Antrag erzeugt, sobald „bisherige Versicherungsart = Mitgliedschaft" ausgewählt ist. Kein UI-Toggle nötig.

### 3) Mitversicherte nur im Hauptmitglied-Plusbonus
- `buildPlusbonusPdfsForPerson` erhält neuen optionalen Parameter `includeMitversicherte: boolean` (default `false`).
- Chunk-/Loop-Logik: Wenn `includeMitversicherte === false`, dann
  - keine Chunks bilden (`chunks = [[]]`, also genau 1 PDF, ohne Suffix `(Teil N)`),
  - die drei Felder `Name Vorname` / `Name Vorname_2` / `Name Vorname_3` und `Höhe der Police in Euro` (_2/_3) leer lassen.
- In `exportBigPlusbonus`:
  - Mitglied → `includeMitversicherte: true` (bestehendes Verhalten inkl. Chunking).
  - Ehegatte/Kinder mit eigener Mitgliedschaft → `includeMitversicherte: false` (genau 1 PDF, Mitversicherten-Felder leer; SEPA, Versicherungsstatus, Höhe Euro, Versicherungsarten bleiben übernommen).

### 4) `pdfCount` (Index.tsx)
- `partsPerPerson` (Chunks) gilt nur noch fürs Mitglied. Pro „eigene Mitgliedschaft"-Person genau 1 zusätzliches PDF.
- Neue Formel:
  ```
  plusbonusParts = mitgliedChunks + ownMembershipPersons
  ```
  wobei `ownMembershipPersons` = #Spouses/Kinder mit (`eigeneMitgliedschaft` || `bisherigArt === 'mitgliedschaft'`) und vorhandenem Namen.

### 5) Memory-Update
- `mem/features/big-direkt-integration.md`: Regel anpassen:
  - „Eigene Mitgliedschaft → eigener Plusbonus" wird automatisch ausgelöst, wenn `bisherigArt === 'mitgliedschaft'` (oder vorhandenes `eigeneMitgliedschaft`-Flag). Keine separate UI-Checkbox bei BIG.
  - Mitversicherte Angehörige nur im Hauptmitglied-PDF; bei eigenen Plusbonus-PDFs für Ehegatte/Kinder bleiben diese Felder leer und es gibt keine Chunk-Aufteilung dort.

## Nicht im Scope
- Keine Änderungen an FamVers-PDF, an Validation, an Plusbonus-Hauptmitgliedslogik (Chunking >3), an VIACTIV.
