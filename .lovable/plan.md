## Befunde

**Form:** BIG Plusbonus (`bigPlusbonusExport.ts`). Andere Kassen sind nicht betroffen.

### 1. Unteres „Ort, Datum" bleibt leer
Die PDF hat zwei separate Felder am unteren Rand:
- `Ort_3` (rect ≈ [32, 212, 197, 224])
- `Datum TTMMJJ_2` (rect ≈ [206, 212, 285, 224])

Diese werden im Export aktuell nicht befüllt – nur die oberen Bank-Felder `Ort_2` / `Datum TTMMJJ`. Deshalb erscheinen die unteren Felder leer.

### 2. Unterschrift sitzt an der falschen Stelle
Das Widget `Signatur16` (Unterschrift Kontoinhaber*in) hat in der PDF die Koordinaten `[301, 406, 562, 418]` (PDF-Koordinaten, Ursprung unten links). Aktuell wird mit `y = pageHeight - 407 - 12 = 423` gezeichnet → die Signatur landet eine Zeile höher, nämlich über der BIC-Zeile. Korrekt wäre `y = 406` (= Rect.y des Widgets). Genau das zeigt das Bild.

### 3. PDF ist nicht mehr bearbeitbar (keine AcroFields)
`bigPlusbonusExport.ts` ruft am Ende `form.flatten()` auf. Das brennt alle Formularfelder als statische Grafik ein und entfernt sie als interaktive Felder. **Andere Kassen** (Novitas, DAK, VIACTIV …) **flatten NICHT** – die bleiben bearbeitbar. Das Verhalten ist also nur in BIG so.

## Plan – nur `src/utils/bigPlusbonusExport.ts`

1. **Untere Ort/Datum-Felder befüllen**
   - `setText(form, 'Ort_3', formData.ort)`
   - `setText(form, 'Datum TTMMJJ_2', toDDMMJJ(formData.datum))`

2. **Signatur-Position korrigieren**
   - `Signatur16`-Rect direkt verwenden:
     - `left = 301`, `bottom-y = 406`, Zielhöhe `~12 pt` (Widget-Höhe), Breite max `≈ 260 pt`
   - Image vertikal mittig im Widget platzieren, statt mit `pageHeight - top - fieldHeight` zu rechnen.
   - Höhe ggf. leicht erhöhen (bis ~18 pt) damit die Caveat-Schrift gut lesbar bleibt, aber bei `y = 406` zentriert.

3. **Optional: zweite Unterschrift am Antragsende** (`Signatur17`, „Stempel oder Unterschrift Vermittler*in"): bleibt **leer**, ist die Vermittler-Signatur (analog zu BKK-Regel „Brokersignatur entfernt"). Keine Änderung.

4. **`form.flatten()` entfernen**
   - Zeile `form.flatten();` löschen, damit die exportierte PDF wie bei allen anderen Kassen bearbeitbare AcroFields behält.
   - Die per `page.drawImage` eingebettete Caveat-Unterschrift bleibt sichtbar (sie ist Teil des Page-Contents, nicht des Widgets).

## Nicht im Scope
- Keine Änderung an anderen Krankenkassen-Exports (alle bereits ohne `flatten()`, AcroFields bleiben dort erhalten).
- Keine Änderung am UI, an Validierung oder am Daten-Modell.
- Keine Änderung an der Signatur-Erzeugung selbst (Caveat / `generateSignature.ts`).
