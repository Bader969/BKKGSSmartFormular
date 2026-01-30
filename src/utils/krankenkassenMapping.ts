import { FormData, Krankenkasse, FamilyMember, createEmptyFamilyMember } from '@/types/form';

/**
 * Applies Krankenkassen-specific mapping to extracted OCR data
 * Maps AI-extracted fields to the correct FormData structure
 */
export const applyKrankenkassenMapping = (
  extractedData: any,
  selectedKrankenkasse: Krankenkasse,
  currentFormData: FormData
): Partial<FormData> => {
  // Base mapping - common fields across all Krankenkassen
  const baseMapping: Partial<FormData> = {
    mitgliedVorname: extractedData.mitgliedVorname || currentFormData.mitgliedVorname,
    mitgliedName: extractedData.mitgliedName || currentFormData.mitgliedName,
    mitgliedKvNummer: extractedData.mitgliedKvNummer || currentFormData.mitgliedKvNummer,
    mitgliedKrankenkasse: extractedData.mitgliedKrankenkasse || currentFormData.mitgliedKrankenkasse,
    familienstand: extractedData.familienstand || currentFormData.familienstand,
    telefon: extractedData.telefon || currentFormData.telefon,
    email: extractedData.email || currentFormData.email,
  };

  switch (selectedKrankenkasse) {
    case 'viactiv':
      return {
        ...baseMapping,
        // Mitglied-spezifische VIACTIV Felder (PFLICHT)
        mitgliedGeburtsdatum: extractedData.mitgliedGeburtsdatum || currentFormData.mitgliedGeburtsdatum,
        mitgliedGeburtsort: extractedData.mitgliedGeburtsort || currentFormData.mitgliedGeburtsort,
        mitgliedGeburtsland: extractedData.mitgliedGeburtsland || currentFormData.mitgliedGeburtsland,
        mitgliedStrasse: extractedData.mitgliedStrasse || currentFormData.mitgliedStrasse,
        mitgliedHausnummer: extractedData.mitgliedHausnummer || currentFormData.mitgliedHausnummer,
        mitgliedPlz: extractedData.mitgliedPlz || currentFormData.mitgliedPlz,
        ort: extractedData.ort || currentFormData.ort,
        // VIACTIV-spezifisch
        viactivGeschlecht: extractedData.viactivGeschlecht || currentFormData.viactivGeschlecht,
        viactivStaatsangehoerigkeit: extractedData.viactivStaatsangehoerigkeit || currentFormData.viactivStaatsangehoerigkeit,
        viactivBeschaeftigung: extractedData.viactivBeschaeftigung || currentFormData.viactivBeschaeftigung,
        viactivVersicherungsart: extractedData.viactivVersicherungsart || currentFormData.viactivVersicherungsart,
        // BEDINGT PFLICHT: Arbeitgeber
        viactivArbeitgeber: extractedData.viactivArbeitgeber 
          ? { ...currentFormData.viactivArbeitgeber, ...extractedData.viactivArbeitgeber }
          : currentFormData.viactivArbeitgeber,
        // Bonus
        viactivBonusVertragsnummer: extractedData.viactivBonusVertragsnummer || currentFormData.viactivBonusVertragsnummer,
        viactivBonusIBAN: extractedData.viactivBonusIBAN || currentFormData.viactivBonusIBAN,
        viactivBonusKontoinhaber: extractedData.viactivBonusKontoinhaber || currentFormData.viactivBonusKontoinhaber,
        // EHEGATTE mit Versichertennummer (PFLICHT für VIACTIV)
        ehegatte: extractedData.ehegatte
          ? {
              ...currentFormData.ehegatte,
              ...extractedData.ehegatte,
              versichertennummer: extractedData.ehegatte.versichertennummer || currentFormData.ehegatte.versichertennummer || '',
              bisherigBestehtWeiter: true,
            }
          : currentFormData.ehegatte,
        // KINDER mit Versichertennummer (PFLICHT für VIACTIV)
        kinder: extractedData.kinder?.length > 0
          ? extractedData.kinder.map((kind: Partial<FamilyMember>) => ({
              ...createEmptyFamilyMember(),
              ...kind,
              versichertennummer: kind.versichertennummer || '',
              bisherigBestehtWeiter: true,
              bisherigBestehtWeiterBei: '',
            }))
          : currentFormData.kinder,
      };

    case 'novitas':
      return {
        ...baseMapping,
        // Novitas: KEINE Adress-/Geburts-Felder für Mitglied (sind im UI hidden)
        ehegatte: extractedData.ehegatte
          ? {
              ...currentFormData.ehegatte,
              ...extractedData.ehegatte,
              bisherigBestehtWeiter: true,
              bisherigVorname: extractedData.ehegatte.bisherigVorname || currentFormData.mitgliedVorname,
              bisherigNachname: extractedData.ehegatte.bisherigNachname || currentFormData.mitgliedName,
            }
          : currentFormData.ehegatte,
        kinder: extractedData.kinder?.length > 0
          ? extractedData.kinder.map((kind: Partial<FamilyMember>) => ({
              ...createEmptyFamilyMember(),
              ...kind,
              bisherigBestehtWeiter: true,
              bisherigBestehtWeiterBei: '',
            }))
          : currentFormData.kinder,
      };

    case 'dak':
      return {
        ...baseMapping,
        mitgliedGeburtsdatum: extractedData.mitgliedGeburtsdatum || currentFormData.mitgliedGeburtsdatum,
        mitgliedStrasse: extractedData.mitgliedStrasse || currentFormData.mitgliedStrasse,
        mitgliedHausnummer: extractedData.mitgliedHausnummer || currentFormData.mitgliedHausnummer,
        mitgliedPlz: extractedData.mitgliedPlz || currentFormData.mitgliedPlz,
        ort: extractedData.ort || currentFormData.ort,
        ehegatte: extractedData.ehegatte
          ? {
              ...currentFormData.ehegatte,
              ...extractedData.ehegatte,
              bisherigBestehtWeiter: true,
            }
          : currentFormData.ehegatte,
        kinder: extractedData.kinder?.length > 0
          ? extractedData.kinder.map((kind: Partial<FamilyMember>) => ({
              ...createEmptyFamilyMember(),
              ...kind,
              bisherigBestehtWeiter: true,
              bisherigBestehtWeiterBei: '',
            }))
          : currentFormData.kinder,
      };

    default:
      // Default/BKK GS - full data
      return {
        ...baseMapping,
        mitgliedGeburtsdatum: extractedData.mitgliedGeburtsdatum || currentFormData.mitgliedGeburtsdatum,
        mitgliedGeburtsort: extractedData.mitgliedGeburtsort || currentFormData.mitgliedGeburtsort,
        mitgliedGeburtsland: extractedData.mitgliedGeburtsland || currentFormData.mitgliedGeburtsland,
        mitgliedStrasse: extractedData.mitgliedStrasse || currentFormData.mitgliedStrasse,
        mitgliedHausnummer: extractedData.mitgliedHausnummer || currentFormData.mitgliedHausnummer,
        mitgliedPlz: extractedData.mitgliedPlz || currentFormData.mitgliedPlz,
        ort: extractedData.ort || currentFormData.ort,
        beginnFamilienversicherung: extractedData.beginnFamilienversicherung || currentFormData.beginnFamilienversicherung,
        ehegatteKrankenkasse: extractedData.ehegatteKrankenkasse || extractedData.mitgliedKrankenkasse || currentFormData.ehegatteKrankenkasse,
        ehegatte: extractedData.ehegatte
          ? {
              ...currentFormData.ehegatte,
              ...extractedData.ehegatte,
              bisherigBestehtWeiter: true,
            }
          : currentFormData.ehegatte,
        kinder: extractedData.kinder?.length > 0
          ? extractedData.kinder.map((kind: Partial<FamilyMember>) => ({
              ...createEmptyFamilyMember(),
              ...kind,
              bisherigBestehtWeiter: true,
              bisherigBestehtWeiterBei: '',
            }))
          : currentFormData.kinder,
        rundumSicherPaket: extractedData.rundumSicherPaket
          ? { ...currentFormData.rundumSicherPaket, ...extractedData.rundumSicherPaket }
          : currentFormData.rundumSicherPaket,
      };
  }
};
