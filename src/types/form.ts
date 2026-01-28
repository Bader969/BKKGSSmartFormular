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
  // VIACTIV Ehegatte-BE Felder
  beschaeftigung: '' | 'beschaeftigt' | 'ausbildung' | 'rente' | 'freiwillig_versichert' | 'studiere' | 'al_geld_1' | 'al_geld_2' | 'minijob' | 'selbststaendig' | 'einkommen_ueber_grenze';
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
  datumRSP: string; // Datum für die Unterschrift
  arztMitglied: ArztDaten;
  arztEhegatte: ArztDaten;
  aerzteKinder: ArztDaten[];
  zusatzversicherung1: ZusatzversicherungOption; // Pflicht
  zusatzversicherung2: ZusatzversicherungOption; // Optional
  jahresbeitrag: string;
  datenschutz1: boolean;
  datenschutz2: boolean;
}

export type FormMode = 'familienversicherung_und_rundum' | 'nur_rundum';

// Krankenkassen-Auswahl
export type Krankenkasse = 'bkk_gs' | 'viactiv';

export const KRANKENKASSEN_OPTIONS = [
  { value: 'bkk_gs' as Krankenkasse, label: 'BKK GILDEMEISTER SEIDENSTICK' },
  { value: 'viactiv' as Krankenkasse, label: 'VIACTIV Krankenkasse' },
] as const;

// VIACTIV-spezifische Typen
export type ViactivGeschlecht = 'weiblich' | 'maennlich' | 'divers' | '';

export type ViactivBeschaeftigung = 
  | 'beschaeftigt'
  | 'ausbildung'
  | 'rente'
  | 'freiwillig_versichert'
  | 'studiere'
  | 'al_geld_1'
  | 'al_geld_2'
  | 'minijob'
  | 'selbststaendig'
  | 'einkommen_ueber_grenze'
  | '';

export type ViactivVersicherungsart = 
  | 'pflichtversichert'
  | 'privat'
  | 'freiwillig_versichert'
  | 'nicht_gesetzlich'
  | 'familienversichert'
  | 'zuzug_ausland'
  | '';

export const VIACTIV_GESCHLECHT_OPTIONS = [
  { value: 'weiblich' as ViactivGeschlecht, label: 'Weiblich' },
  { value: 'maennlich' as ViactivGeschlecht, label: 'Männlich' },
  { value: 'divers' as ViactivGeschlecht, label: 'Divers' },
] as const;

export const VIACTIV_BESCHAEFTIGUNG_OPTIONS = [
  { value: 'beschaeftigt' as ViactivBeschaeftigung, label: 'Ich bin beschäftigt' },
  { value: 'ausbildung' as ViactivBeschaeftigung, label: 'Ich bin in Ausbildung' },
  { value: 'rente' as ViactivBeschaeftigung, label: 'Ich beziehe Rente' },
  { value: 'freiwillig_versichert' as ViactivBeschaeftigung, label: 'Ich bin freiwillig versichert' },
  { value: 'studiere' as ViactivBeschaeftigung, label: 'Ich studiere' },
  { value: 'al_geld_1' as ViactivBeschaeftigung, label: 'Ich beziehe AL-Geld I' },
  { value: 'al_geld_2' as ViactivBeschaeftigung, label: 'Ich beziehe AL-Geld II' },
  { value: 'minijob' as ViactivBeschaeftigung, label: 'Ich habe einen Minijob (bis zu 450 Euro)' },
  { value: 'selbststaendig' as ViactivBeschaeftigung, label: 'Ich bin selbstständig' },
  { value: 'einkommen_ueber_grenze' as ViactivBeschaeftigung, label: 'Einkommen über 64.350 Euro (Stand 2022)' },
] as const;

export const VIACTIV_VERSICHERUNGSART_OPTIONS = [
  { value: 'pflichtversichert' as ViactivVersicherungsart, label: 'Pflichtversichert' },
  { value: 'privat' as ViactivVersicherungsart, label: 'Privat versichert' },
  { value: 'freiwillig_versichert' as ViactivVersicherungsart, label: 'Freiwillig versichert' },
  { value: 'nicht_gesetzlich' as ViactivVersicherungsart, label: 'Nicht gesetzlich versichert' },
  { value: 'familienversichert' as ViactivVersicherungsart, label: 'Familienversichert' },
  { value: 'zuzug_ausland' as ViactivVersicherungsart, label: 'Zuzug aus dem Ausland' },
] as const;

// Arbeitgeber-Daten für VIACTIV
export interface ArbeitgeberDaten {
  name: string;
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  beschaeftigtSeit: string;
}

export const createEmptyArbeitgeberDaten = (): ArbeitgeberDaten => ({
  name: '',
  strasse: '',
  hausnummer: '',
  plz: '',
  ort: '',
  beschaeftigtSeit: '',
});

export interface FormData {
  // Formular-Modus
  mode: FormMode;
  
  // Ausgewählte Krankenkasse für Export
  selectedKrankenkasse: Krankenkasse;
  
  // Mitglied Angaben
  mitgliedName: string;
  mitgliedVorname: string;
  mitgliedGeburtsdatum: string;
  mitgliedGeburtsort: string;
  mitgliedGeburtsland: string;
  mitgliedStrasse: string;
  mitgliedHausnummer: string;
  mitgliedPlz: string;
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
  
  // VIACTIV-spezifische Felder
  viactivGeschlecht: ViactivGeschlecht;
  viactivBeschaeftigung: ViactivBeschaeftigung;
  viactivVersicherungsart: ViactivVersicherungsart;
  viactivArbeitgeber: ArbeitgeberDaten;
  viactivFamilienangehoerigeMitversichern: boolean;
  viactivStaatsangehoerigkeit: string;
  
  // VIACTIV Bonus-Programm Felder
  viactivBonusVertragsnummer: string;
  viactivBonusIBAN: string;
  viactivBonusKontoinhaber: string;
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
  beschaeftigung: '',
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
    selectedKrankenkasse: 'bkk_gs',
    mitgliedName: '',
    mitgliedVorname: '',
    mitgliedGeburtsdatum: '',
    mitgliedGeburtsort: '',
    mitgliedGeburtsland: '',
    mitgliedStrasse: '',
    mitgliedHausnummer: '',
    mitgliedPlz: '',
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
    // VIACTIV-spezifische Felder
    viactivGeschlecht: '',
    viactivBeschaeftigung: '',
    viactivVersicherungsart: '',
    viactivArbeitgeber: createEmptyArbeitgeberDaten(),
    viactivFamilienangehoerigeMitversichern: false,
    viactivStaatsangehoerigkeit: 'deutsch',
    
    // VIACTIV Bonus-Programm Felder
    viactivBonusVertragsnummer: '',
    viactivBonusIBAN: '',
    viactivBonusKontoinhaber: '',
  };
};
