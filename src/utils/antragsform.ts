import type { FormData } from '@/types/form';

export function deriveAntragsform(formData: FormData): string {
  switch (formData.selectedKrankenkasse) {
    case 'big_plusbonus':
      return formData.bigFamilienversicherung
        ? 'Plusbonus + Familienvers.'
        : 'Plusbonus';
    case 'viactiv': {
      const parts: string[] = ['Beitritt'];
      if (formData.viactivFamilienangehoerigeMitversichern) parts.push('Familienvers.');
      parts.push('Bonus');
      return parts.join(' + ');
    }
    case 'novitas':
      return formData.novitasMode === 'einzeln' ? 'Beitritt' : 'Familienvers.';
    case 'dak':
      return 'Familienvers.';
    case 'bkk_gs':
      return formData.mode === 'nur_rundum'
        ? 'Rundum-Sicher'
        : 'Familienvers. + Rundum-Sicher';
    default:
      return '';
  }
}

/**
 * Long form for email subject usage: "Familienvers." expanded to "Familienversicherung".
 */
export function deriveAntragsformLong(formData: FormData): string {
  return deriveAntragsform(formData).replace(/Familienvers\./g, 'Familienversicherung');
}