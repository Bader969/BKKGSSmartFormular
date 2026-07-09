# Auto-Scanner Pipeline für Dokumenten-Upload

Erweitere den bestehenden `DocumentMergeDialog` um einen automatischen Dokumenten-Scanner (Kantenerkennung → interaktives Zuschneiden → Perspektiv-Korrektur → "Magic Color" → PDF).

## Scope

- Nur Bilder (JPG/PNG/WEBP) durchlaufen die neue Pipeline.
- PDFs im Upload bleiben unverändert und werden wie bisher am Ende zusammengemergt.
- Bestehender Zusammenführungs-Flow (`createCombinedPdf` in `src/utils/pdfUtils.ts`) wird für die verarbeiteten Bilder ersetzt; die PDF-Merge-Logik selbst bleibt.

## Architektur

```text
Upload Bild
   → loadOpenCV() (lazy, einmalig)
   → detectDocument(imgEl) → 4 Punkte (TL,TR,BR,BL) oder Fallback = Bildkorners
   → State: UploadedImage { file, previewUrl, corners, natWidth, natHeight }
   → <ScannerCard> zeigt Bild + <CornerOverlay> (SVG, 4 draggable handles)
   → onDragEnd → State-Update der corners
Klick "Als PDF zusammenfassen"
   → für jedes Bild: warpPerspective + magicColorFilter → Canvas → JPEG DataURL
   → createCombinedPdf(processedImages + originalPDFs) → Download
```

## Neue / geänderte Dateien

### `public/opencv/opencv.js` (neu, statisches Asset)
- OpenCV.js-Build (`opencv.js` + `opencv_wasm.wasm`) unter `public/opencv/` ablegen.
- Über `<script>`-Tag lazy geladen (nicht via Vite-Import, damit WASM korrekt aufgelöst wird).
- Größe ~8MB → nur laden, wenn Dialog geöffnet wird.

### `src/utils/opencvLoader.ts` (neu)
- `loadOpenCV(): Promise<typeof cv>` — Singleton, injiziert `<script src="/opencv/opencv.js">`, resolved wenn `cv.onRuntimeInitialized` feuert.
- Verhindert Doppelladen.

### `src/utils/documentScanner.ts` (neu)
Kern-Logik, komplett mit expliziten `.delete()`-Aufrufen in `try/finally`.

- `detectDocumentCorners(imgEl: HTMLImageElement): Corner[4]`
  1. `cv.imread` → src
  2. `cvtColor` GRAY
  3. `GaussianBlur` (5×5)
  4. `Canny` (75, 200)
  5. `findContours` (RETR_EXTERNAL, CHAIN_APPROX_SIMPLE)
  6. Contours nach Fläche sortieren, für die Top-5: `approxPolyDP` (epsilon = 0.02 × Perimeter). Erste mit 4 Vertices + Fläche > 10% Bildfläche → gewinnt.
  7. Punkte auf TL/TR/BR/BL sortieren (Summen/Differenzen der Koordinaten).
  8. Fallback: Bildecken.
  9. Alle Mats + MatVector im `finally` `.delete()`.

- `warpAndEnhance(imgEl, corners): HTMLCanvasElement`
  - `getPerspectiveTransform` → A4-Ratio-Zielgröße (Breite = max(TL-TR, BL-BR), Höhe = Breite × √2).
  - `warpPerspective` → warped Mat.
  - **Magic Color**:
    - `bilateralFilter(9, 75, 75)`.
    - `split` in BGR.
    - Pro Kanal: `morphologyEx(MORPH_CLOSE, 21×21 Kernel)` → background.
    - `divide(channel, bg, dst, 255)` → shadow-frei.
    - `merge` → RGB → `cvtColor` HSV.
    - HSV split, `equalizeHist` auf V, S × 1.2 (mit clamp 0–255), merge → RGB.
  - `imshow` auf hidden canvas.
  - Sämtliche Mats/MatVectors deleten.

### `src/components/CornerOverlay.tsx` (neu)
- SVG-Overlay absolute über `<img>`, `viewBox` = natWidth/natHeight, `preserveAspectRatio="none"`, um mit `object-fit: fill` zu matchen.
- 4 `<circle>` Handles + `<polygon>` Verbindung.
- Pointer-Events: `onPointerDown/Move/Up` mit `setPointerCapture`, umgerechnet in natürliche Bildkoordinaten via `getBoundingClientRect`.
- Props: `corners`, `natWidth`, `natHeight`, `onChange(corners)`.

### `src/components/DocumentMergeDialog.tsx` (geändert)
- Beim Upload für Bilder: `loadOpenCV()` (Spinner "Erkenne Ränder…"), dann `detectDocumentCorners`, corners in State.
- Preview-Grid ersetzt: pro Bild kleine Karte mit `<img>` + `<CornerOverlay>`. PDFs unverändert.
- "Als PDF zusammenfassen": Spinner-Text "Verarbeite Seite X/Y…". Loop:
  - Bilder → `warpAndEnhance` → `canvas.toDataURL('image/jpeg', 0.92)` → base64.
  - Aufruf `createCombinedPdf` mit den verarbeiteten Bildern + Original-PDFs (Reihenfolge beibehalten).
- Cleanup: temporäre Canvases nach Nutzung verworfen.

### `src/utils/pdfUtils.ts` (minimal geändert)
- Kein Umbau nötig: die verarbeiteten Bilder werden als `FileForPdf` (mit `mimeType: 'image/jpeg'`) übergeben; A4-Layout bleibt.

## Speicher-Regeln (WASM)
- Jede in `documentScanner.ts` erzeugte `cv.Mat` / `cv.MatVector` / `cv.Scalar` bekommt eine lokale Variable und wird in `finally` `.delete()` aufgerufen — auch bei Fehlern.
- Loop-lokale Mats (z. B. pro Contour) sofort nach Nutzung deleten.
- Kein `cv.Mat` verlässt die Pipeline-Funktion (nur Canvas/Corners).

## Loading-/Fehlerzustände
- OpenCV-Ladevorgang: globaler kleiner Status im Dialog ("Scanner wird geladen…").
- Detection pro Bild: Overlay-Spinner auf der Karte.
- Batch-Verarbeitung: Button zeigt "Verarbeite X/Y".
- Fehler in Detection/Warp → Fallback = Original-Bild einfügen, `toast.error` mit Dateiname, Verarbeitung läuft weiter.

## Abhängigkeiten
- Keine npm-Installation für OpenCV (WASM als Static-Asset).
- `jspdf` und `pdf-lib` sind bereits vorhanden.
- Neu: OpenCV.js-Datei (~8MB) unter `public/opencv/` (User muss ich einmal ablegen lassen, oder wir laden von einem CDN — siehe offene Frage).

## Offene technische Entscheidung
OpenCV.js liefern über:
- (a) `public/opencv/opencv.js` selbst gehostet (empfohlen, offlinefähig, keine externen Requests).
- (b) CDN `https://docs.opencv.org/4.x/opencv.js` (einfacher, aber external + langsam).

Standard im Plan: **(a) selbst gehostet**. Beim Implementieren lade ich die Datei via `curl` in `public/opencv/`.

## Nicht Teil des Plans
- Keine Änderung an bestehenden PDF-Export-Utilities für Kassenformulare.
- Keine Persistierung der Scans (bleibt ephemer, wie AI-Capture).
- Keine Backend-Änderungen.