## Ziel
Mauszeiger-Unterschriften komplett ersetzen. Beim PDF-Export wird der Nachname automatisch als Unterschrift in Handschrift-Optik (Caveat) an exakt der gleichen Position eingebettet wie bisher die gezeichnete Signatur. Im Formular wird statt SignaturePad eine Live-Vorschau angezeigt.

## Umfang
- Alle Unterschriftsfelder, alle Kassen (VIACTIV, Novitas, DAK, BKK GS, BIG Plusbonus, Rundum etc.)
- Quelle des Nachnamens pro Signaturfeld:
  - **Mitglied-Unterschrift** → `mitgliedName`
  - **Familienangehörige-Unterschrift** → priorisiert:
    1. Nachname **Ehegatte**, falls Ehegatte vorhanden
    2. sonst Nachname des **ersten Kindes ≥ 16 Jahre** (nach Geburtsdatum berechnet)
    3. sonst → **leer lassen** (keine Signatur einbetten)
  - **BIG Plusbonus Kontoinhaber-Signatur** → `mitgliedName`

## Umsetzung

### 1. Font einbinden
- `bun add @fontsource/caveat`
- `src/main.tsx`: `import '@fontsource/caveat/700.css'`
- `tailwind.config.ts`: `fontFamily.signature: ['Caveat', 'cursive']`

### 2. Neue Utility `src/utils/generateSignature.ts`
- `generateSignatureDataUrl(lastName: string, opts?): string | null`
  - Leerer/whitespace Nachname → `null`
  - Rendert Offscreen-Canvas mit `bold 56px Caveat`, Farbe `#1a365d`, transparenter Hintergrund
  - Auto-Downscale wenn Text zu breit
  - Stellt sicher, dass Caveat geladen ist (`await document.fonts.load(...)` einmalig vor erstem Export)
- `resolveFamilySignatureLastName(formData): string | null`
  - Wenn `spouseEnabled`/`hasSpouse` und `spouseName` vorhanden → spouseName
  - Sonst: ältestes Kind mit Alter ≥ 16 (via `dateUtils`) → Nachname des Kindes
  - Sonst `null`

### 3. Neue Komponente `src/components/SignaturePreview.tsx` (ersetzt SignaturePad-Aufrufe)
- Props: `lastName: string | null`, `label?: string`
- Read-only Box gleiche Höhe wie bisher
- Zeigt Nachname in `font-signature text-4xl text-[#1a365d]` mit Unterlinie
- Fallback wenn `lastName` leer: gedimmter Hinweis „Wird automatisch aus dem Nachnamen erzeugt"
- Familie-Variante: zusätzlicher Hinweis „Ehegatte bzw. Kind ≥ 16 – sonst keine Signatur"

### 4. `SignatureSection.tsx` umbauen
- `SignaturePad` durch `SignaturePreview` ersetzen
- Mitglied-Feld: `lastName={formData.mitgliedName}`
- Familie-Feld: `lastName={resolveFamilySignatureLastName(formData)}`
- `formData.unterschrift*` werden nicht mehr im State befüllt; Felder bleiben im Typ (Abwärtskompatibilität)

### 5. Export-Utils anpassen
Betroffen: `pdfExport.ts`, `viactivExport.ts`, `viactivFamilyExport.ts`, `viactivBonusExport.ts`, `novitasExport.ts`, `dakExport.ts`, `bigPlusbonusExport.ts`

Pro Datei:
- Mitglieds-Signatur: `generateSignatureDataUrl(formData.mitgliedName)`
- Familien-Signatur: `generateSignatureDataUrl(resolveFamilySignatureLastName(formData))`
- BIG Kontoinhaber: `generateSignatureDataUrl(formData.mitgliedName)`
- Wenn Ergebnis `null` → Signatur weglassen (kein Crash, keine leere Box)
- **Position, Größe, Seite bleiben exakt identisch** zu den heutigen Werten

### 6. Validierung (`src/utils/validation.ts`)
- Pflichtprüfungen für `unterschrift` / `unterschriftFamilie` entfernen
- Mitglieds-Nachname ist ohnehin schon Pflicht → ersetzt Unterschriftspflicht

### 7. Import-Dialoge / JSON
- `unterschrift*` aus JSON-Import-Beispielen entfernen
- Typ-Felder bleiben, werden aber ignoriert

### 8. Cleanup
- `src/components/SignaturePad.tsx` löschen
- `bun remove react-signature-canvas`

## Technische Hinweise
- Canvas → PNG-DataURL, damit pdf-lib `embedPng` unverändert funktioniert
- Farbe `#1a365d` matched bisheriges Penstift-Blau → optisch konsistent
- Altersberechnung Kinder über vorhandene `dateUtils`
- Keine PDF-Koordinaten ändern

## Nicht im Scope
- Keine Backend-/DB-Änderung
- Keine Änderung an OCR/AI-Extraction
- Keine Änderung an PDF-Layouts/Positionen