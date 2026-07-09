// Browser-only document scanner pipeline.
// Kept deliberately Canvas-based: no OpenCV/WASM on upload or export, so large
// batches cannot freeze the browser while WebAssembly compiles or processes.

export interface Point {
  x: number;
  y: number;
}

export type Corners = [Point, Point, Point, Point]; // TL, TR, BR, BL

const OUTPUT_MAX_WIDTH = 850;
const EXPORT_SOURCE_MAX_DIMENSION = 1500;
const PREVIEW_SCAN_MAX_DIMENSION = 360;

export function defaultCorners(width: number, height: number): Corners {
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
}

function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Lightweight, non-WASM document boundary estimate for upload previews.
 * This intentionally avoids OpenCV during upload so large batches cannot freeze
 * the tab while the WASM runtime compiles on the main thread.
 */
export function detectDocumentCornersFast(img: HTMLImageElement): Corners {
  const naturalWidth = img.naturalWidth || img.width;
  const naturalHeight = img.naturalHeight || img.height;
  const maxDim = PREVIEW_SCAN_MAX_DIMENSION;
  const scale = Math.min(1, maxDim / Math.max(naturalWidth, naturalHeight));
  const width = Math.max(1, Math.round(naturalWidth * scale));
  const height = Math.max(1, Math.round(naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return defaultCorners(naturalWidth, naturalHeight);

  ctx.drawImage(img, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  const sample = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    return data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
  };

  const step = Math.max(3, Math.floor(Math.min(width, height) / 75));
  const marginX = Math.floor(width * 0.03);
  const marginY = Math.floor(height * 0.03);
  const edgePoints: Point[] = [];
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = marginY; y < height - marginY; y += step) {
    for (let x = marginX; x < width - marginX; x += step) {
      const gx = Math.abs(sample(Math.min(width - 1, x + step), y) - sample(Math.max(0, x - step), y));
      const gy = Math.abs(sample(x, Math.min(height - 1, y + step)) - sample(x, Math.max(0, y - step)));
      if (gx + gy > 42) {
        edgePoints.push({ x, y });
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (edgePoints.length < 18 || maxX - minX < width * 0.18 || maxY - minY < height * 0.12) {
    const padX = naturalWidth * 0.03;
    const padY = naturalHeight * 0.03;
    return [
      { x: padX, y: padY },
      { x: naturalWidth - padX, y: padY },
      { x: naturalWidth - padX, y: naturalHeight - padY },
      { x: padX, y: naturalHeight - padY },
    ];
  }

  const pad = Math.max(3, step * 3);
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width, maxX + pad);
  maxY = Math.min(height, maxY + pad);

  const inv = 1 / scale;
  return [
    { x: minX * inv, y: minY * inv },
    { x: maxX * inv, y: minY * inv },
    { x: maxX * inv, y: maxY * inv },
    { x: minX * inv, y: maxY * inv },
  ];
}

function solveLinearSystem(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    }
    if (Math.abs(m[pivot][col]) < 1e-10) return null;
    [m[col], m[pivot]] = [m[pivot], m[col]];

    const div = m[col][col];
    for (let j = col; j <= n; j++) m[col][j] /= div;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = m[row][col];
      for (let j = col; j <= n; j++) m[row][j] -= factor * m[col][j];
    }
  }

  return m.map((row) => row[n]);
}

function inversePerspectiveCoefficients(
  corners: Corners,
  width: number,
  height: number
): number[] | null {
  const dst = [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: width - 1, y: height - 1 },
    { x: 0, y: height - 1 },
  ];
  const a: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const u = dst[i].x;
    const v = dst[i].y;
    const x = corners[i].x;
    const y = corners[i].y;
    a.push([u, v, 1, 0, 0, 0, -u * x, -v * x]);
    b.push(x);
    a.push([0, 0, 0, u, v, 1, -u * y, -v * y]);
    b.push(y);
  }

  return solveLinearSystem(a, b);
}

function sampleBilinear(src: ImageData, x: number, y: number, channel: number): number {
  const maxX = src.width - 1;
  const maxY = src.height - 1;
  const clampedX = Math.max(0, Math.min(maxX, x));
  const clampedY = Math.max(0, Math.min(maxY, y));
  const x0 = Math.floor(clampedX);
  const y0 = Math.floor(clampedY);
  const x1 = Math.min(maxX, x0 + 1);
  const y1 = Math.min(maxY, y0 + 1);
  const dx = clampedX - x0;
  const dy = clampedY - y0;
  const i00 = (y0 * src.width + x0) * 4 + channel;
  const i10 = (y0 * src.width + x1) * 4 + channel;
  const i01 = (y1 * src.width + x0) * 4 + channel;
  const i11 = (y1 * src.width + x1) * 4 + channel;
  return (
    src.data[i00] * (1 - dx) * (1 - dy) +
    src.data[i10] * dx * (1 - dy) +
    src.data[i01] * (1 - dx) * dy +
    src.data[i11] * dx * dy
  );
}

function enhancePixel(value: number): number {
  const contrasted = (value - 128) * 1.28 + 142;
  return Math.max(0, Math.min(255, contrasted));
}

export function cropAndEnhanceFallback(
  img: HTMLImageElement,
  corners: Corners
): HTMLCanvasElement {
  const naturalWidth = img.naturalWidth || img.width;
  const naturalHeight = img.naturalHeight || img.height;
  const sourceScale = Math.min(
    1,
    EXPORT_SOURCE_MAX_DIMENSION / Math.max(naturalWidth, naturalHeight)
  );
  const scaledCorners = corners.map((p) => ({
    x: p.x * sourceScale,
    y: p.y * sourceScale,
  })) as Corners;
  const sourceWidth = Math.max(1, Math.round(naturalWidth * sourceScale));
  const sourceHeight = Math.max(1, Math.round(naturalHeight * sourceScale));
  const topW = distance(scaledCorners[0], scaledCorners[1]);
  const bottomW = distance(scaledCorners[3], scaledCorners[2]);
  const leftH = distance(scaledCorners[0], scaledCorners[3]);
  const rightH = distance(scaledCorners[1], scaledCorners[2]);
  const srcW = Math.max(1, (topW + bottomW) / 2);
  const srcH = Math.max(1, (leftH + rightH) / 2);
  const dstW = Math.min(OUTPUT_MAX_WIDTH, Math.max(700, Math.round(srcW)));
  const dstH = Math.max(1, Math.round(dstW * (srcH / srcW)));

  const canvas = document.createElement("canvas");
  canvas.width = dstW;
  canvas.height = dstH;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas konnte nicht initialisiert werden");

  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = sourceWidth;
  srcCanvas.height = sourceHeight;
  const srcCtx = srcCanvas.getContext("2d", { willReadFrequently: true });
  if (!srcCtx) throw new Error("Canvas konnte nicht initialisiert werden");
  srcCtx.imageSmoothingEnabled = true;
  srcCtx.imageSmoothingQuality = "high";
  srcCtx.drawImage(img, 0, 0, sourceWidth, sourceHeight);
  const srcData = srcCtx.getImageData(0, 0, sourceWidth, sourceHeight);
  const out = ctx.createImageData(dstW, dstH);
  const coeff = inversePerspectiveCoefficients(scaledCorners, dstW, dstH);

  if (!coeff) {
    ctx.filter = "contrast(1.2) brightness(1.08) saturate(1.08)";
    const minX = Math.max(0, Math.min(...scaledCorners.map((p) => p.x)));
    const minY = Math.max(0, Math.min(...scaledCorners.map((p) => p.y)));
    const maxX = Math.min(sourceWidth, Math.max(...scaledCorners.map((p) => p.x)));
    const maxY = Math.min(sourceHeight, Math.max(...scaledCorners.map((p) => p.y)));
    ctx.drawImage(srcCanvas, minX, minY, maxX - minX, maxY - minY, 0, 0, dstW, dstH);
    return canvas;
  }

  const [a, b, c, d, e, f, g, h] = coeff;
  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const denom = g * x + h * y + 1;
      const sx = (a * x + b * y + c) / denom;
      const sy = (d * x + e * y + f) / denom;
      const oi = (y * dstW + x) * 4;
      out.data[oi] = enhancePixel(sampleBilinear(srcData, sx, sy, 0));
      out.data[oi + 1] = enhancePixel(sampleBilinear(srcData, sx, sy, 1));
      out.data[oi + 2] = enhancePixel(sampleBilinear(srcData, sx, sy, 2));
      out.data[oi + 3] = 255;
    }
  }

  ctx.putImageData(out, 0, 0);
  return canvas;
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