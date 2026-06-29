/**
 * Run an async block while intercepting every anchor-based file download
 * (the pattern used by the PDF export utils:  a.href = blob:…; a.download = name; a.click()).
 * Returns the collected files as { filename, blob } pairs.
 *
 * The original download is suppressed so nothing pops up in the user's browser.
 */
export type CapturedFile = { filename: string; blob: Blob };

export async function captureDownloads(run: () => Promise<void>): Promise<CapturedFile[]> {
  const collected: CapturedFile[] = [];
  const pendingFetches: Promise<unknown>[] = [];
  const heldUrls: string[] = [];
  const originalClick = HTMLAnchorElement.prototype.click;
  const originalRevoke = URL.revokeObjectURL.bind(URL);

  // Defer revocation so we can still fetch() blob URLs after the export utility
  // tries to clean up.
  URL.revokeObjectURL = (url: string) => { heldUrls.push(url); };

  HTMLAnchorElement.prototype.click = function patchedClick(this: HTMLAnchorElement) {
    try {
      const href = this.getAttribute('href') || '';
      const filename = this.getAttribute('download') || '';
      if (filename && href.startsWith('blob:')) {
        const pending = fetch(href)
          .then((r) => r.blob())
          .then((blob) => { collected.push({ filename, blob }); })
          .catch(() => { /* ignore */ });
        pendingFetches.push(pending);
        return;
      }
    } catch {
      // fall through to original click
    }
    return originalClick.call(this);
  } as typeof HTMLAnchorElement.prototype.click;

  try {
    await run();
    await Promise.all(pendingFetches);
  } finally {
    HTMLAnchorElement.prototype.click = originalClick;
    URL.revokeObjectURL = originalRevoke;
    for (const u of heldUrls) { try { originalRevoke(u); } catch { /* ignore */ } }
  }

  return collected;
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = reader.result as string;
      // strip the "data:...;base64," prefix
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}