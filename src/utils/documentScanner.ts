// Document scanner pipeline built on OpenCV.js (WASM).
// All cv.Mat / cv.MatVector allocations are freed explicitly — the JS GC
// does NOT reclaim WASM heap memory.

import { loadOpenCV, type OpenCV } from "./opencvLoader";

export interface Point {
  x: number;
  y: number;
}

export type Corners = [Point, Point, Point, Point]; // TL, TR, BR, BL

const DETECTION_MAX_DIMENSION = 1100;
const WARP_MAX_DIMENSION = 1800;
const OUTPUT_MAX_WIDTH = 1500;

interface PreparedImageSource {
  source: HTMLImageElement | HTMLCanvasElement;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
}

function safeDelete(obj: unknown) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (obj as any)?.delete?.();
  } catch {
    /* ignore */
  }
}

function prepareImageSource(
  img: HTMLImageElement,
  maxDimension: number
): PreparedImageSource {
  const naturalWidth = img.naturalWidth || img.width;
  const naturalHeight = img.naturalHeight || img.height;
  const largest = Math.max(naturalWidth, naturalHeight);

  if (largest <= maxDimension) {
    return {
      source: img,
      width: naturalWidth,
      height: naturalHeight,
      scaleX: 1,
      scaleY: 1,
    };
  }

  const scale = maxDimension / largest;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(naturalHeight * scale));

  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    throw new Error("Canvas konnte nicht initialisiert werden");
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return {
    source: canvas,
    width: canvas.width,
    height: canvas.height,
    scaleX: canvas.width / naturalWidth,
    scaleY: canvas.height / naturalHeight,
  };
}

function orderCorners(pts: Point[]): Corners {
  // Sort by (x + y) → TL smallest, BR largest.
  // Sort by (x - y) → TR largest, BL smallest.
  const sums = pts.map((p) => p.x + p.y);
  const diffs = pts.map((p) => p.x - p.y);
  const tl = pts[sums.indexOf(Math.min(...sums))];
  const br = pts[sums.indexOf(Math.max(...sums))];
  const tr = pts[diffs.indexOf(Math.max(...diffs))];
  const bl = pts[diffs.indexOf(Math.min(...diffs))];
  return [tl, tr, br, bl];
}

export function defaultCorners(width: number, height: number): Corners {
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
}

/**
 * Detect the largest 4-vertex contour in the image and return its corners
 * ordered TL, TR, BR, BL. Falls back to the image corners if nothing usable
 * is found.
 */
export async function detectDocumentCorners(
  img: HTMLImageElement
): Promise<Corners> {
  const cv: OpenCV = await loadOpenCV();
  const naturalWidth = img.naturalWidth || img.width;
  const naturalHeight = img.naturalHeight || img.height;
  const prepared = prepareImageSource(img, DETECTION_MAX_DIMENSION);
  const width = prepared.width;
  const height = prepared.height;
  const imgArea = width * height;

  let src: unknown, gray: unknown, blurred: unknown, edged: unknown;
  let contours: unknown, hierarchy: unknown;
  const contourEntries: { contour: unknown; area: number }[] = [];
  try {
    src = cv.imread(prepared.source);
    gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    blurred = new cv.Mat();
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    edged = new cv.Mat();
    cv.Canny(blurred, edged, 75, 200);

    contours = new cv.MatVector();
    hierarchy = new cv.Mat();
    cv.findContours(
      edged,
      contours,
      hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE
    );

    // Gather (index, area) for all contours and sort desc.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cs = contours as any;
    const count: number = cs.size();
    for (let i = 0; i < count; i++) {
      const c = cs.get(i);
      try {
        const area = cv.contourArea(c);
        contourEntries.push({ contour: c, area });
      } catch {
        safeDelete(c);
      }
    }
    contourEntries.sort((a, b) => b.area - a.area);

    let found: Corners | null = null;
    for (let k = 0; k < Math.min(8, contourEntries.length); k++) {
      const { contour: c, area } = contourEntries[k];
      if (area < imgArea * 0.1) continue;
      const peri = cv.arcLength(c, true);
      const approx = new cv.Mat();
      try {
        cv.approxPolyDP(c, approx, 0.02 * peri, true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const a = approx as any;
        if (a.rows === 4) {
          const pts: Point[] = [];
          for (let r = 0; r < 4; r++) {
            const x = a.data32S[r * 2];
            const y = a.data32S[r * 2 + 1];
            pts.push({ x, y });
          }
          found = orderCorners(pts);
          break;
        }
      } finally {
        safeDelete(approx);
      }
    }

    if (!found) return defaultCorners(naturalWidth, naturalHeight);

    return found.map((p) => ({
      x: Math.max(0, Math.min(naturalWidth, p.x / prepared.scaleX)),
      y: Math.max(0, Math.min(naturalHeight, p.y / prepared.scaleY)),
    })) as Corners;
  } finally {
    for (const { contour } of contourEntries) safeDelete(contour);
    safeDelete(hierarchy);
    safeDelete(contours);
    safeDelete(edged);
    safeDelete(blurred);
    safeDelete(gray);
    safeDelete(src);
  }
}

function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Warp the quad defined by `corners` to a top-down A4 canvas and apply the
 * "Magic Color" filter (shadow removal + ink pop).
 * Returns a canvas containing the enhanced image.
 */
export async function warpAndEnhance(
  img: HTMLImageElement,
  corners: Corners
): Promise<HTMLCanvasElement> {
  const cv: OpenCV = await loadOpenCV();
  const prepared = prepareImageSource(img, WARP_MAX_DIMENSION);

  const [tl, tr, br, bl] = corners.map((p) => ({
    x: p.x * prepared.scaleX,
    y: p.y * prepared.scaleY,
  })) as Corners;
  const widthPx = Math.max(distance(tl, tr), distance(bl, br));
  // A4 ratio (portrait)
  let dstW = Math.round(widthPx);
  if (dstW < 900) dstW = 900;
  if (dstW > OUTPUT_MAX_WIDTH) dstW = OUTPUT_MAX_WIDTH;
  const dstH = Math.round(dstW * Math.SQRT2);

  let src: unknown,
    dst: unknown,
    M: unknown,
    srcTri: unknown,
    dstTri: unknown,
    smoothed: unknown,
    hsv: unknown,
    outRgba: unknown;
  const bgr: unknown[] = [];
  const hsvCh: unknown[] = [];
  const kernel: unknown[] = [];
  try {
    src = cv.imread(prepared.source);
    srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      tl.x,
      tl.y,
      tr.x,
      tr.y,
      br.x,
      br.y,
      bl.x,
      bl.y,
    ]);
    dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0,
      0,
      dstW - 1,
      0,
      dstW - 1,
      dstH - 1,
      0,
      dstH - 1,
    ]);
    M = cv.getPerspectiveTransform(srcTri, dstTri);
    dst = new cv.Mat();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cv.warpPerspective(src, dst, M, new cv.Size(dstW, dstH));

    // Drop alpha (RGBA -> RGB) for filters.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rgb: any = new cv.Mat();
    try {
      cv.cvtColor(dst, rgb, cv.COLOR_RGBA2RGB);

      // Bilateral smoothing (needs 3-channel 8U).
      smoothed = new cv.Mat();
      cv.bilateralFilter(rgb, smoothed, 9, 75, 75, cv.BORDER_DEFAULT);

      // Split channels, per-channel morphological close to isolate background,
      // then divide to remove shadows.
      const splitVec = new cv.MatVector();
      try {
        cv.split(smoothed, splitVec);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sv = splitVec as any;
        const closingKernel = cv.getStructuringElement(
          cv.MORPH_RECT,
          new cv.Size(21, 21)
        );
        kernel.push(closingKernel);
        for (let i = 0; i < 3; i++) {
          const ch = sv.get(i);
          const bg = new cv.Mat();
          const divided = new cv.Mat();
          cv.morphologyEx(ch, bg, cv.MORPH_CLOSE, closingKernel);
          cv.divide(ch, bg, divided, 255);
          bgr.push(divided);
          safeDelete(bg);
          safeDelete(ch);
        }

        // Merge shadow-free channels.
        const mergeVec = new cv.MatVector();
        try {
          for (const b of bgr) mergeVec.push_back(b);
          const shadowFree = new cv.Mat();
          try {
            cv.merge(mergeVec, shadowFree);

            // Convert to HSV, equalise V, boost S.
            hsv = new cv.Mat();
            cv.cvtColor(shadowFree, hsv, cv.COLOR_RGB2HSV);
            const hsvSplit = new cv.MatVector();
            try {
              cv.split(hsv, hsvSplit);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const hs = hsvSplit as any;
              const h = hs.get(0);
              const s = hs.get(1);
              const v = hs.get(2);
              hsvCh.push(h, s, v);

              const vEq = new cv.Mat();
              cv.equalizeHist(v, vEq);
              hsvCh.push(vEq);

              // S * 1.2 clamped to 255.
              const sBoosted = new cv.Mat();
              s.convertTo(sBoosted, cv.CV_8U, 1.2, 0);
              hsvCh.push(sBoosted);

              const outHsvVec = new cv.MatVector();
              try {
                outHsvVec.push_back(h);
                outHsvVec.push_back(sBoosted);
                outHsvVec.push_back(vEq);
                const outHsv = new cv.Mat();
                try {
                  cv.merge(outHsvVec, outHsv);
                  outRgba = new cv.Mat();
                  cv.cvtColor(outHsv, outRgba, cv.COLOR_HSV2RGB);
                } finally {
                  safeDelete(outHsv);
                }
              } finally {
                safeDelete(outHsvVec);
              }
            } finally {
              safeDelete(hsvSplit);
            }
          } finally {
            safeDelete(shadowFree);
          }
        } finally {
          safeDelete(mergeVec);
        }
      } finally {
        safeDelete(splitVec);
      }
    } finally {
      safeDelete(rgb);
    }

    // Render onto a canvas — imshow expects the target element.
    const canvas = document.createElement("canvas");
    canvas.width = dstW;
    canvas.height = dstH;
    cv.imshow(canvas, outRgba);
    return canvas;
  } finally {
    for (const m of hsvCh) safeDelete(m);
    for (const m of bgr) safeDelete(m);
    for (const m of kernel) safeDelete(m);
    safeDelete(outRgba);
    safeDelete(hsv);
    safeDelete(smoothed);
    safeDelete(dst);
    safeDelete(M);
    safeDelete(dstTri);
    safeDelete(srcTri);
    safeDelete(src);
  }
}

export function canvasToJpegBase64(
  canvas: HTMLCanvasElement,
  quality = 0.92
): string {
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}