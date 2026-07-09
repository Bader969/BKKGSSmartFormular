// Lazy loader for OpenCV.js (WebAssembly). Loads from CDN on first use.
// Only imported by the DocumentMergeDialog so it never enters the initial bundle.

const OPENCV_URL =
  "https://docs.opencv.org/4.x/opencv.js";
// Fallback CDN if the primary is unreachable.
const OPENCV_FALLBACK_URL =
  "https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.10.0-release.1/dist/opencv.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CV = any;

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cv?: any;
    Module?: unknown;
  }
}

let cvPromise: Promise<CV> | null = null;

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-opencv="${src}"]`
    );
    if (existing) {
      if (existing.dataset.loaded === "1") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error(`Failed to load ${src}`))
      );
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.dataset.opencv = src;
    s.addEventListener("load", () => {
      s.dataset.loaded = "1";
      resolve();
    });
    s.addEventListener("error", () =>
      reject(new Error(`Failed to load ${src}`))
    );
    document.head.appendChild(s);
  });
}

async function waitForRuntime(cv: CV): Promise<CV> {
  // OpenCV.js dispatches `cv.onRuntimeInitialized` when the WASM heap is ready.
  if (cv && typeof cv.getBuildInformation === "function") {
    // Already initialised
    try {
      cv.getBuildInformation();
      return cv;
    } catch {
      /* runtime not ready yet */
    }
  }
  return new Promise<CV>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error("OpenCV runtime init timed out")),
      30_000
    );
    const done = () => {
      window.clearTimeout(timeout);
      resolve(window.cv);
    };
    // If `cv` is a Promise (some builds), await it.
    if (cv && typeof cv.then === "function") {
      Promise.resolve(cv)
        .then((resolved: CV) => {
          window.cv = resolved;
          done();
        })
        .catch((err) => {
          window.clearTimeout(timeout);
          reject(err);
        });
      return;
    }
    if (cv) {
      cv.onRuntimeInitialized = done;
    } else {
      // fall back to polling for window.cv
      const iv = window.setInterval(() => {
        if (window.cv && typeof window.cv.Mat === "function") {
          window.clearInterval(iv);
          done();
        }
      }, 50);
    }
  });
}

export function loadOpenCV(): Promise<CV> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("OpenCV can only load in the browser"));
  }
  if (window.cv && typeof window.cv.Mat === "function") {
    return Promise.resolve(window.cv);
  }
  if (cvPromise) return cvPromise;

  cvPromise = (async () => {
    try {
      await injectScript(OPENCV_URL);
    } catch {
      await injectScript(OPENCV_FALLBACK_URL);
    }
    const cv = await waitForRuntime(window.cv);
    window.cv = cv;
    return cv;
  })().catch((err) => {
    cvPromise = null;
    throw err;
  });

  return cvPromise;
}

export type OpenCV = CV;