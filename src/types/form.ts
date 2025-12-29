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
  // Neue Felder für Kinder
  geburtsname: string;
  geburtsort: string;
  geburtsland: string;
  staatsangehoerigkeit: string;
  // Rundum-Sicher-Paket Felder
  versichertennummer: string;
  // Bearbeitbare Felder
  familienversichert: boolean;
}

// Arzt-Daten für Rundum-Sicher-Paket
export interface ArztDaten {
  name: string;
  ort: string;
}

// Zusatzversicherung Optionen
export type ZusatzversicherungOption = 
  | 'zahnzusatz'
  | 'private_rente'
  | 'unfall'
  | 'berufsunfaehigkeit'
  | 'grundfaehigkeit'
  | '';

export const ZUSATZVERSICHERUNG_OPTIONS = [
  { value: 'zahnzusatz', label: 'Zahnzusatzversicherung' },
  { value: 'private_rente', label: 'Private Rentenversicherung' },
  { value: 'unfall', label: 'Unfallversicherung' },
  { value: 'berufsunfaehigkeit', label: 'Berufsunfähigkeitsversicherung' },
  { value: 'grundfaehigkeit', label: 'Grundfähigkeitsversicherung' },
] as const;

// Rundum-Sicher-Paket Daten
export interface RundumSicherPaketData {
  iban: string;
  kontoinhaber: string;
  zeitraumVon: string;
  zeitraumBis: string;
  datumRSP: string; // Gemeinsames Datum für "Datum Makler" und "Datum"
  arztMitglied: ArztDaten;
  arztEhegatte: ArztDaten;
  aerzteKinder: ArztDaten[];
  zusatzversicherung1: ZusatzversicherungOption; // Pflicht
  zusatzversicherung2: ZusatzversicherungOption; // Optional
  jahresbeitrag: string;
  datenschutz1: boolean;
  datenschutz2: boolean;
  unterschriftMakler: string;
}

export type FormMode = 'familienversicherung_und_rundum' | 'nur_rundum';

export interface FormData {
  // Formular-Modus
  mode: FormMode;
  
  // Mitglied Angaben
  mitgliedName: string;
  mitgliedVorname: string;
  mitgliedGeburtsdatum: string;
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
  
  // Rundum-Sicher-Paket
  rundumSicherPaket: RundumSicherPaketData;
  
  // Mitglied Versichertennummer für Rundum-Sicher-Paket
  mitgliedVersichertennummer: string;
}

export const createEmptyArztDaten = (): ArztDaten => ({
  name: '',
  ort: '',
});

export const createEmptyRundumSicherPaket = (): RundumSicherPaketData => ({
  iban: '',
  kontoinhaber: '',
  zeitraumVon: '2026-01-01',
  zeitraumBis: '2026-12-31',
  datumRSP: '2026-01-10',
  arztMitglied: createEmptyArztDaten(),
  arztEhegatte: createEmptyArztDaten(),
  aerzteKinder: [],
  zusatzversicherung1: '',
  zusatzversicherung2: '',
  jahresbeitrag: '',
  datenschutz1: false,
  datenschutz2: false,
  unterschriftMakler: '',
});

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
  geburtsname: '',
  geburtsort: '',
  geburtsland: '',
  staatsangehoerigkeit: '',
  versichertennummer: '',
  familienversichert: true,
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
    mode: 'familienversicherung_und_rundum',
    mitgliedName: '',
    mitgliedVorname: '',
    mitgliedGeburtsdatum: '',
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
    rundumSicherPaket: createEmptyRundumSicherPaket(),
    mitgliedVersichertennummer: '',
  };
};
