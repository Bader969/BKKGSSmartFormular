import { FormData } from '@/types/form';

export const SIGNATURE_FONTS: string[] = [
  'SigRilonaNotes',
  'SigArabellaForteny',
  'SigSignaturePresent',
  'SigGartenyaCalligraph',
  'SigMillenial',
  'SigMelismaSignature',
  'SigDestomed',
  'SigOTF',
];

let fontReadyPromise: Promise<unknown> | null = null;

const ensureFontLoaded = async (): Promise<void> => {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  if (!fontReadyPromise) {
    fontReadyPromise = Promise.all(
      SIGNATURE_FONTS.flatMap((f) => [
        (document as any).fonts.load(`400 64px "${f}"`),
        (document as any).fonts.load(`700 64px "${f}"`),
      ]),
    ).catch(() => undefined);
  }
  await fontReadyPromise;
};

// Stable FNV-1a 32-bit hash → deterministic font choice per person.
const fnv1a = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
};

export const pickSignatureFont = (seed: string | null | undefined): string => {
  const s = (seed ?? '').trim().toLowerCase();
  if (!s) return SIGNATURE_FONTS[0];
  return SIGNATURE_FONTS[fnv1a(s) % SIGNATURE_FONTS.length];
};

export interface SignatureOptions {
  width?: number;
  height?: number;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  seed?: string;
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
  const fontFamily = opts.fontFamily ?? pickSignatureFont(opts.seed ?? text);

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
  const setFont = () => { ctx.font = `400 ${fontSize}px "${fontFamily}", "Caveat", cursive`; };
  setFont();
  while (ctx.measureText(text).width > maxWidth && fontSize > 20) {
    fontSize -= 4;
    setFont();
  }

  ctx.fillText(text, 12, height / 2);
  return canvas.toDataURL('image/png');
};

export const ensureSignatureFontReady = ensureFontLoaded;

/**
 * Liefert den Nachnamen, der bei BIG Plusbonus für die Unterschrift verwendet wird.
 * Quelle: Kontoinhaber (letztes Wort). Fallback: mitgliedName.
 */
export const resolveBigSignatureLastName = (formData: FormData): string | null => {
  const ki = (formData.bigBank?.kontoinhaber || '').trim();
  if (ki) {
    const parts = ki.split(/\s+/);
    const last = parts[parts.length - 1];
    if (last) return last;
  }
  return (formData.mitgliedName || '').trim() || null;
};

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
  const memberSeed = [formData.mitgliedVorname, formData.mitgliedName, formData.mitgliedGeburtsdatum]
    .filter(Boolean).join('|');
  const familyLast = resolveFamilySignatureLastName(formData);
  const fam = formData.ehegatte?.name?.trim()
    ? [formData.ehegatte?.vorname, formData.ehegatte?.name, formData.ehegatte?.geburtsdatum].filter(Boolean).join('|')
    : familyLast || '';
  return {
    member: generateSignatureDataUrl(formData.mitgliedName, { seed: memberSeed }),
    family: generateSignatureDataUrl(familyLast, { seed: fam }),
  };
};
