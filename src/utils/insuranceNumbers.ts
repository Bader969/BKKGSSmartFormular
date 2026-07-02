import { Krankenkasse } from '@/types/form';

export interface InsuranceNumberNormalizationResult<T> {
  data: T;
  warnings: string[];
}

const MAIN_NUMBER_ALIASES = [
  'mitgliedKvNummer',
  'mitgliedVersichertennummer',
  'kvnr',
  'kvNummer',
  'kv_nummer',
  'kv-nummer',
  'versichertennummer',
  'versichertenNummer',
  'versicherungsnummer',
  'versicherungsNummer',
  'mitgliedsnummer',
  'mitgliedsNummer',
  'krankenversichertennummer',
  'krankenVersichertennummer',
  'krankenversicherungsnummer',
  'egkNummer',
  'eGKNummer',
];

const PERSON_NUMBER_ALIASES = [
  'versichertennummer',
  'versichertenNummer',
  'versicherungsnummer',
  'versicherungsNummer',
  'mitgliedsnummer',
  'mitgliedsNummer',
  'kvnr',
  'kvNummer',
  'kv_nummer',
  'kv-nummer',
  'krankenversichertennummer',
  'krankenVersichertennummer',
  'krankenversicherungsnummer',
  'egkNummer',
  'eGKNummer',
];

const FIRST_LETTER_CORRECTIONS: Record<string, string> = {
  '0': 'O',
  '1': 'I',
  '5': 'S',
  '8': 'B',
};

const DIGIT_CORRECTIONS: Record<string, string> = {
  O: '0',
  Q: '0',
  D: '0',
  I: '1',
  L: '1',
  Z: '2',
  S: '5',
  B: '8',
  G: '9',
};

const stripKnownLabels = (value: string) =>
  value.replace(
    /\b(?:KVNR|KV\s*-?\s*NR|KV\s*-?\s*NUMMER|VERSICHERTEN\s*-?\s*NR|VERSICHERTEN\s*-?\s*NUMMER|VERSICHERUNGS\s*-?\s*NR|VERSICHERUNGS\s*-?\s*NUMMER|MITGLIEDS\s*-?\s*NR|MITGLIEDS\s*-?\s*NUMMER|EGK\s*-?\s*NUMMER)\b/gi,
    '',
  );

const normalizeCandidate = (candidate: string): string => {
  if (candidate.length !== 10) return '';

  const first = FIRST_LETTER_CORRECTIONS[candidate[0]] ?? candidate[0];
  if (!/^[A-Z]$/.test(first)) return '';

  const digits = candidate
    .slice(1)
    .split('')
    .map((char) => DIGIT_CORRECTIONS[char] ?? char)
    .join('');

  return /^\d{9}$/.test(digits) ? `${first}${digits}` : '';
};

export const normalizeInsuranceNumber = (value: unknown): string => {
  if (value === null || value === undefined) return '';

  const compact = stripKnownLabels(String(value))
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();

  if (!compact) return '';

  const exact = normalizeCandidate(compact);
  if (exact) return exact;

  for (let index = 0; index <= compact.length - 10; index += 1) {
    const normalized = normalizeCandidate(compact.slice(index, index + 10));
    if (normalized) return normalized;
  }

  return compact;
};

export const isValidInsuranceNumber = (value: unknown): boolean =>
  /^[A-Z]\d{9}$/.test(normalizeInsuranceNumber(value));

export const findInsuranceNumberAlias = (
  source: unknown,
  aliases: string[] = PERSON_NUMBER_ALIASES,
): string => {
  if (!source || typeof source !== 'object') return '';

  const record = source as Record<string, unknown>;
  for (const alias of aliases) {
    const normalized = normalizeInsuranceNumber(record[alias]);
    if (isValidInsuranceNumber(normalized)) return normalized;
  }

  for (const [key, value] of Object.entries(record)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    const looksLikeNumberField =
      normalizedKey.includes('kvnr') ||
      normalizedKey.includes('kvnummer') ||
      normalizedKey.includes('versichertennummer') ||
      normalizedKey.includes('versicherungsnummer') ||
      normalizedKey.includes('mitgliedsnummer') ||
      normalizedKey.includes('egknummer');

    if (looksLikeNumberField) {
      const normalized = normalizeInsuranceNumber(value);
      if (isValidInsuranceNumber(normalized)) return normalized;
    }
  }

  return '';
};

const hasAnyNumberLikeValue = (source: unknown, aliases: string[]): boolean => {
  if (!source || typeof source !== 'object') return false;
  const record = source as Record<string, unknown>;
  return aliases.some((alias) => String(record[alias] ?? '').trim().length > 0);
};

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export const normalizeInsuranceNumberData = <T extends Record<string, unknown>>(
  input: T,
): InsuranceNumberNormalizationResult<T> => {
  const data = cloneJson(input ?? ({} as T));
  const warnings: string[] = [];

  const mainNumber = findInsuranceNumberAlias(data, MAIN_NUMBER_ALIASES);
  if (mainNumber) {
    (data as Record<string, unknown>).mitgliedKvNummer = mainNumber;
    (data as Record<string, unknown>).mitgliedVersichertennummer = mainNumber;
  } else if (hasAnyNumberLikeValue(data, MAIN_NUMBER_ALIASES)) {
    warnings.push('Mitglied: Versichertennummer/KVNR konnte nicht sicher normalisiert werden.');
  }

  const normalizePerson = (person: unknown, label: string) => {
    if (!person || typeof person !== 'object') return;
    const record = person as Record<string, unknown>;
    const number = findInsuranceNumberAlias(record, PERSON_NUMBER_ALIASES);

    if (number) {
      record.versichertennummer = number;
    } else if (hasAnyNumberLikeValue(record, PERSON_NUMBER_ALIASES)) {
      warnings.push(`${label}: Versichertennummer konnte nicht sicher normalisiert werden.`);
    }
  };

  normalizePerson((data as Record<string, unknown>).ehegatte, 'Ehegatte');

  const kinder = (data as Record<string, unknown>).kinder;
  if (Array.isArray(kinder)) {
    kinder.forEach((kind, index) => normalizePerson(kind, `Kind ${index + 1}`));
  }

  return { data, warnings };
};

export const collectMissingInsuranceNumberWarnings = (
  data: Record<string, unknown>,
  selectedKrankenkasse: Krankenkasse,
  requireMain = true,
): string[] => {
  const warnings: string[] = [];

  if (requireMain && !findInsuranceNumberAlias(data, MAIN_NUMBER_ALIASES)) {
    warnings.push('Mitglied: Keine gültige KV-Nummer erkannt. Bitte eGK/Karte prüfen.');
  }

  if (selectedKrankenkasse === 'viactiv') {
    const spouse = data.ehegatte as Record<string, unknown> | undefined;
    if (spouse && Object.values(spouse).some((value) => String(value ?? '').trim())) {
      if (!findInsuranceNumberAlias(spouse, PERSON_NUMBER_ALIASES)) {
        warnings.push('Ehegatte: Keine gültige Versichertennummer erkannt.');
      }
    }

    const kinder = data.kinder;
    if (Array.isArray(kinder)) {
      kinder.forEach((kind, index) => {
        if (kind && typeof kind === 'object' && !findInsuranceNumberAlias(kind, PERSON_NUMBER_ALIASES)) {
          warnings.push(`Kind ${index + 1}: Keine gültige Versichertennummer erkannt.`);
        }
      });
    }
  }

  return warnings;
};

export { MAIN_NUMBER_ALIASES, PERSON_NUMBER_ALIASES };