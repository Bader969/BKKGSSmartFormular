export interface FamilyMember {
  name: string;
  vorname: string;
  geschlecht: 'm' | 'w' | 'x' | 'd' | '';
  geburtsdatum: string;
  abweichendeAnschrift: string;
  verwandtschaft: 'leiblich' | 'stief' | 'enkel' | 'pflege' | '';
  isEhegatteVerwandt: boolean;
  bisherigEndeteAm: string;
  bisherigBestandBei: string;
  bisherigArt: 'mitgliedschaft' | 'familienversicherung' | 'nicht_gesetzlich' | '';
  bisherigVorname: string;
  bisherigNachname: string;
  bisherigBestehtWeiter: boolean;
  bisherigBestehtWeiterBei: string;
}

export interface FormData {
  // Mitglied Angaben
  mitgliedName: string;
  mitgliedVorname: string;
  mitgliedGeburtsdatum: string;
  mitgliedAnschrift: string;
  mitgliedKvNummer: string;
  mitgliedKrankenkasse: string;
  
  familienstand: 'ledig' | 'verheiratet' | 'getrennt' | 'geschieden' | 'verwitwet' | '';
  
  // Kontakt (optional)
  telefon: string;
  email: string;
  
  // Beginn der Familienversicherung (automatisch berechnet)
  beginnFamilienversicherung: string;
  
  // Datum (heutiges Datum)
  datum: string;
  
  // Ort
  ort: string;
  
  // Ehegatte
  ehegatte: FamilyMember;
  ehegatteKrankenkasse: string;
  
  // Kinder (beliebig viele)
  kinder: FamilyMember[];
  
  // Unterschrift des Mitglieds
  unterschrift: string;
  
  // Unterschrift der Familienangehörigen
  unterschriftFamilie: string;
}

export const createEmptyFamilyMember = (): FamilyMember => ({
  name: '',
  vorname: '',
  geschlecht: '',
  geburtsdatum: '',
  abweichendeAnschrift: '',
  verwandtschaft: '',
  isEhegatteVerwandt: false,
  bisherigEndeteAm: '',
  bisherigBestandBei: '',
  bisherigArt: '',
  bisherigVorname: '',
  bisherigNachname: '',
  bisherigBestehtWeiter: true,
  bisherigBestehtWeiterBei: 'BKK GS',
});

export const createInitialFormData = (): FormData => {
  const today = new Date();
  const threeMonthsLater = new Date(today.getFullYear(), today.getMonth() + 3, 1);
  const endOfPreviousMonth = new Date(threeMonthsLater.getFullYear(), threeMonthsLater.getMonth(), 0);
  
  const formatDate = (date: Date) => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };
  
  const formatDateForInput = (date: Date) => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
  };

  return {
    mitgliedName: '',
    mitgliedVorname: '',
    mitgliedGeburtsdatum: '',
    mitgliedAnschrift: '',
    mitgliedKvNummer: '',
    mitgliedKrankenkasse: '',
    familienstand: '',
    telefon: '',
    email: '',
    beginnFamilienversicherung: formatDate(threeMonthsLater),
    datum: formatDateForInput(today),
    ort: '',
    ehegatte: createEmptyFamilyMember(),
    ehegatteKrankenkasse: '',
    kinder: [],
    unterschrift: '',
    unterschriftFamilie: '',
  };
};
