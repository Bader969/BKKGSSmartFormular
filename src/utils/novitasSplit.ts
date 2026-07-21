import type { FormData, FamilyMember } from '@/types/form';
import { parseGermanDate } from './dateUtils';

export type NovitasStatus =
  | 'pflichtversicherter_Arbeitnehmer'
  | 'Auszubildender'
  | 'Arbeitslose_r_Jobcenter'
  | 'Arbeitslose_r_AgenturArbeit'
  | '';

/** Ableiten des Novitas-Status aus der Beschäftigungsangabe. */
export function deriveNovitasStatus(
  beschaeftigung: FormData['viactivBeschaeftigung'] | FamilyMember['beschaeftigung'] | undefined,
): NovitasStatus {
  switch (beschaeftigung) {
    case 'beschaeftigt':
      return 'pflichtversicherter_Arbeitnehmer';
    case 'ausbildung':
      return 'Auszubildender';
    case 'al_geld_2':
      return 'Arbeitslose_r_Jobcenter';
    case 'al_geld_1':
      return 'Arbeitslose_r_AgenturArbeit';
    default:
      return '';
  }
}

/** Alter in Jahren aus einem Geburtsdatum (DD.MM.YYYY oder YYYY-MM-DD). */
function ageInYears(geburtsdatum: string, ref = new Date()): number | null {
  if (!geburtsdatum) return null;
  let d: Date | null = null;
  if (geburtsdatum.includes('.')) {
    d = parseGermanDate(geburtsdatum);
  } else if (geburtsdatum.includes('-')) {
    const [y, m, day] = geburtsdatum.split('-').map(Number);
    if (y && m && day) d = new Date(y, m - 1, day);
  }
  if (!d || Number.isNaN(d.getTime())) return null;
  let a = ref.getFullYear() - d.getFullYear();
  const mDiff = ref.getMonth() - d.getMonth();
  if (mDiff < 0 || (mDiff === 0 && ref.getDate() < d.getDate())) a -= 1;
  return a;
}

export interface NovitasPerson {
  role: 'main' | 'ehegatte' | 'kind';
  index?: number; // 1-based nur für Kinder
  label: string;
  ownMembership: boolean; // true = eigene Mitgliedschaft, false = familienversichert (nur für ehegatte/kind relevant)
}

/**
 * Ermittelt für Novitas, welche Personen eine eigene Mitgliedschaft brauchen.
 * Regel: Wenn Hauptmitglied Jobcenter → Ehegatte + jedes Kind ≥ 16 eigene Mitgliedschaft;
 * Kinder < 16 bleiben familienversichert. Sonst alles familienversichert.
 */
export function splitNovitasPersons(formData: FormData): NovitasPerson[] {
  const persons: NovitasPerson[] = [
    {
      role: 'main',
      label: `${formData.mitgliedVorname} ${formData.mitgliedName}`.trim() || 'Hauptmitglied',
      ownMembership: true,
    },
  ];

  if (formData.novitasMode !== 'familie') return persons;

  const mainStatus = deriveNovitasStatus(formData.viactivBeschaeftigung);
  const mainIsJobcenter = mainStatus === 'Arbeitslose_r_Jobcenter';

  const eh = formData.ehegatte;
  if (eh && (eh.vorname || eh.name)) {
    persons.push({
      role: 'ehegatte',
      label: `Ehegatte · ${eh.vorname} ${eh.name}`.trim(),
      ownMembership: mainIsJobcenter,
    });
  }

  (formData.kinder || []).forEach((k, i) => {
    if (!(k.vorname || k.name)) return;
    const age = ageInYears(k.geburtsdatum);
    const ownMembership = mainIsJobcenter && age != null && age >= 16;
    persons.push({
      role: 'kind',
      index: i + 1,
      label: `Kind ${i + 1} · ${k.vorname} ${k.name}`.trim(),
      ownMembership,
    });
  });

  return persons;
}
