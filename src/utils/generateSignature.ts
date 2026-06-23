import { FormData } from '@/types/form';

let fontReadyPromise: Promise<unknown> | null = null;

const ensureFontLoaded = async (): Promise<void> => {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  if (!fontReadyPromise) {
    fontReadyPromise = Promise.all([
      (document as any).fonts.load('700 56px "Caveat"'),
      (document as any).fonts.load('400 56px "Caveat"'),
    ]).catch(() => undefined);
  }
  await fontReadyPromise;
};

export interface SignatureOptions {
  width?: number;
  height?: number;
  color?: string;
  fontSize?: number;
}

/**
 * Erzeugt synchron eine PNG-DataURL einer "handschriftlichen" Unterschrift
 * aus dem übergebenen Nachnamen. Gibt null zurück, wenn der Name leer ist.
 *
 * Vor dem ersten Aufruf sollte einmal `await ensureSignatureFontReady()`
 * aufgerufen werden, damit die Caveat-Schrift geladen ist.
 */
export const generateSignatureDataUrl = (
  lastName: string | null | undefined,
  opts: SignatureOptions = {},
): string | null => {
  const text = (lastName ?? '').trim();
  if (!text) return null;
  if (typeof document === 'undefined') return null;

  const width = opts.width ?? 600;
  const height = opts.height ?? 160;
  const color = opts.color ?? '#1a365d';
  let fontSize = opts.fontSize ?? 96;

  const canvas = document.createElement('canvas');
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(dpr, dpr);

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = color;

  // Auto-Downscale, damit der Text in die Zielbreite passt
  const maxWidth = width - 24;
  ctx.font = `700 ${fontSize}px "Caveat", cursive`;
  while (ctx.measureText(text).width > maxWidth && fontSize > 20) {
    fontSize -= 4;
    ctx.font = `700 ${fontSize}px "Caveat", cursive`;
  }

  ctx.fillText(text, 12, height / 2);
  return canvas.toDataURL('image/png');
};

export const ensureSignatureFontReady = ensureFontLoaded;

const parseGeburtsdatum = (value: string): Date | null => {
  if (!value) return null;
  if (value.includes('-')) {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  if (value.includes('.')) {
    const [dd, mm, yyyy] = value.split('.');
    if (!dd || !mm || !yyyy) return null;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const ageInYears = (birth: Date, ref: Date = new Date()): number => {
  let age = ref.getFullYear() - birth.getFullYear();
  const m = ref.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age--;
  return age;
};

/**
 * Bestimmt den Nachnamen, der für die "Familienangehörige"-Unterschrift
 * verwendet werden soll:
 *  1. Ehegatte (sofern vorhanden mit Nachnamen)
 *  2. sonst ältestes Kind ≥ 16 Jahre
 *  3. sonst null (→ keine Signatur)
 */
export const resolveFamilySignatureLastName = (formData: FormData): string | null => {
  const spouseName = formData.ehegatte?.name?.trim();
  if (spouseName) return spouseName;

  const eligibleKinder = (formData.kinder ?? [])
    .map((k) => {
      const birth = parseGeburtsdatum(k.geburtsdatum);
      if (!birth) return null;
      const age = ageInYears(birth);
      if (age < 16) return null;
      const name = (k.name || '').trim();
      if (!name) return null;
      return { name, birth };
    })
    .filter((x): x is { name: string; birth: Date } => x !== null)
    .sort((a, b) => a.birth.getTime() - b.birth.getTime());

  return eligibleKinder[0]?.name ?? null;
};

/**
 * Komfort-Helfer für Export-Utils: liefert die Daten-URLs für Mitglied
 * und Familienangehörige. Felder können null sein – Aufrufer müssen das
 * berücksichtigen und in diesem Fall keine Signatur einbetten.
 */
export const getAutoSignatures = (formData: FormData) => {
  return {
    member: generateSignatureDataUrl(formData.mitgliedName),
    family: generateSignatureDataUrl(resolveFamilySignatureLastName(formData)),
  };
};
