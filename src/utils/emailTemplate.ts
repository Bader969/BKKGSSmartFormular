import type { FormData } from '@/types/form';
import { deriveAntragsform } from './antragsform';

export type TemplateVars = {
  name: string;
  vorname: string;
  geburtsdatum: string;
  antragsform: string;
  krankenkasse: string;
  bearbeiter: string;
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

export function buildTemplateVars(formData: FormData, bearbeiter: string): TemplateVars {
  return {
    name: formData.mitgliedName || '',
    vorname: formData.mitgliedVorname || '',
    geburtsdatum: formatGeburtsdatum(formData.mitgliedGeburtsdatum || ''),
    antragsform: deriveAntragsform(formData),
    krankenkasse: KK_LABEL[formData.selectedKrankenkasse] || formData.selectedKrankenkasse || '',
    bearbeiter: bearbeiter || '',
  };
}

export function applyTemplate(tpl: string, vars: TemplateVars): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (vars as Record<string, string>)[k] ?? `{${k}}`);
}

export const DEFAULT_SUBJECT_TEMPLATE =
  '{name}, {vorname}, {geburtsdatum} ({antragsform})';

export const DEFAULT_BODY_TEMPLATE =
  `Sehr geehrte Damen und Herren,\n\n` +
  `anbei finden Sie den/die Antrag/Anträge für {vorname} {name}, geboren am {geburtsdatum}.\n` +
  `Angefügt: {antragsform}.\n\n` +
  `Mit freundlichen Grüßen\n{bearbeiter}`;