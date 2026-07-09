import type { FormData } from '@/types/form';
import { deriveAntragsform, deriveAntragsformLong } from './antragsform';

export type TemplateVars = {
  name: string;
  vorname: string;
  geburtsdatum: string;
  antragsform: string;
  krankenkasse: string;
  bearbeiter: string;
  unterlagen: string;
  foto: string;
  startdatum: string;
};

const KK_LABEL: Record<string, string> = {
  big_plusbonus: 'BIG direkt gesund',
  viactiv: 'VIACTIV',
  novitas: 'Novitas BKK',
  dak: 'DAK',
  bkk_gs: 'BKK GILDEMEISTER SEIDENSTICKER',
};

const formatGeburtsdatum = (input: string): string => {
  if (!input) return '';
  if (input.includes('-')) {
    const [y, m, d] = input.split('-');
    if (y && m && d) return `${d.padStart(2, '0')}.${m.padStart(2, '0')}.${y}`;
  }
  return input;
};

export function buildTemplateVars(
  formData: FormData,
  bearbeiter: string,
  opts?: { hasPhotos?: boolean },
): TemplateVars {
  return {
    name: formData.mitgliedName || '',
    vorname: formData.mitgliedVorname || '',
    geburtsdatum: formatGeburtsdatum(formData.mitgliedGeburtsdatum || ''),
    antragsform: deriveAntragsformLong(formData),
    krankenkasse: KK_LABEL[formData.selectedKrankenkasse] || formData.selectedKrankenkasse || '',
    bearbeiter: bearbeiter || '',
    unterlagen: 'Unterlagen',
    foto: opts?.hasPhotos ? ' + Foto' : '',
    startdatum: formatGeburtsdatum(formData.beginnFamilienversicherung || ''),
  };
}

export function buildTemplateVarsForPerson(
  formData: FormData,
  person: { vorname: string; name: string; geburtsdatum: string },
  bearbeiter: string,
  antragsformOverride?: string,
  opts?: { hasPhotos?: boolean },
): TemplateVars {
  return {
    name: person.name || '',
    vorname: person.vorname || '',
    geburtsdatum: formatGeburtsdatum(person.geburtsdatum || ''),
    antragsform: (antragsformOverride ?? deriveAntragsformLong(formData)).replace(/Familienvers\./g, 'Familienversicherung'),
    krankenkasse: KK_LABEL[formData.selectedKrankenkasse] || formData.selectedKrankenkasse || '',
    bearbeiter: bearbeiter || '',
    unterlagen: 'Unterlagen',
    foto: opts?.hasPhotos ? ' + Foto' : '',
    startdatum: formatGeburtsdatum(formData.beginnFamilienversicherung || ''),
  };
}

export function applyTemplate(tpl: string, vars: TemplateVars): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (vars as Record<string, string>)[k] ?? `{${k}}`);
}

export const DEFAULT_SUBJECT_TEMPLATE =
  '{vorname} {name} {geburtsdatum} - {unterlagen} + {antragsform}{foto} start {startdatum}';

export const DEFAULT_BODY_TEMPLATE =
  `Sehr geehrte Damen und Herren,\n\n` +
  `anbei finden Sie den/die Antrag/Anträge für {vorname} {name}, geboren am {geburtsdatum}.\n` +
  `Angefügt: {antragsform}.\n\n` +
  `Mit freundlichen Grüßen\n{bearbeiter}`;