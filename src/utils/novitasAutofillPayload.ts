import type { FormData, FamilyMember } from '@/types/form';
import { getBeginDate, getEndDate, formatDateForInput } from './dateUtils';
import { deriveNovitasStatus, splitNovitasPersons, type NovitasPerson, type NovitasStatus } from './novitasSplit';

export interface NovitasAutofillPayload {
  __type: 'novitas-autofill/v1';
  mode: 'einzeln' | 'familie';
  person: {
    role: 'main' | 'ehegatte' | 'kind';
    label: string;
    vorname: string;
    nachname: string;
    geburtsname: string;
    geburtsdatum: string; // YYYY-MM-DD
    geburtsort: string;
    geburtsland: string;
    staatsangehoerigkeit: string;
    geschlecht: 'm' | 'w' | 'd' | '';
    familienstand: string;
    kvNummer: string;
    rentenversicherungsnummer: string;
    bisherigeKrankenkasse: string;
    status: NovitasStatus;
  };
  adresse: { strasse: string; hausnummer: string; plz: string; ort: string };
  telefon: string;
  email: string;
  arbeitgeber: {
    name: string;
    strasse: string;
    hausnummer: string;
    plz: string;
    ort: string;
    arbeitsentgeltMonatlich: string;
  };
  bank: { kontoinhaber: string; iban: string; bic: string; kreditinstitut: string };
  daten: {
    beginn: string;        // YYYY-MM-DD (01. des Monats +3)
    zuletztVersichertBis: string; // YYYY-MM-DD (Tag davor)
    heute: string;         // YYYY-MM-DD
  };
  anlass: 'Ablauf_Bindungsfrist';
  vertriebspartner: { istVertriebspartner: true; vermittlerId: string };
  familienangehoerigeFragebogen: boolean;
}

const VERMITTLER_ID = '011062257459';

/** DD.MM.YYYY oder ISO → ISO YYYY-MM-DD. */
const toIso = (dateStr: string): string => {
  if (!dateStr) return '';
  if (dateStr.includes('-') && dateStr.length === 10) return dateStr;
  const parts = dateStr.split('.');
  if (parts.length !== 3) return '';
  const [d, m, y] = parts;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
};

const geschlechtFromString = (
  g: FormData['bigGeschlecht'] | FormData['viactivGeschlecht'] | FamilyMember['geschlecht'] | '' | undefined,
): 'm' | 'w' | 'd' | '' => {
  const s = String(g || '').toLowerCase();
  if (s === 'm' || s.startsWith('mann')) return 'm';
  if (s === 'w' || s.startsWith('weib')) return 'w';
  if (s === 'd' || s === 'x' || s === 'divers') return 'd';
  return '';
};

/** Baut das komplette Autofill-Payload für eine bestimmte Person aus dem Formular. */
export function buildNovitasAutofillPayload(
  formData: FormData,
  person: NovitasPerson,
): NovitasAutofillPayload {
  const today = new Date();
  const beginn = getBeginDate();
  const bis = getEndDate(beginn);

  const isFamilie = formData.novitasMode === 'familie';
  const wantsFragebogen = isFamilie && person.role === 'main';

  // Basisdaten (Hauptmitglied)
  let vorname = formData.mitgliedVorname;
  let nachname = formData.mitgliedName;
  let geburtsdatum = formData.mitgliedGeburtsdatum;
  let geburtsort = formData.mitgliedGeburtsort;
  let geburtsland = formData.mitgliedGeburtsland;
  let staat = formData.viactivStaatsangehoerigkeit || 'deutsch';
  let geschlecht = geschlechtFromString(formData.viactivGeschlecht || formData.bigGeschlecht);
  let familienstand = formData.familienstand;
  let kvNummer = formData.mitgliedKvNummer;
  let bisherigeKrankenkasse = formData.mitgliedKrankenkasse;
  let beschaeftigung: FormData['viactivBeschaeftigung'] | FamilyMember['beschaeftigung'] = formData.viactivBeschaeftigung;
  let rentenversicherungsnummer = formData.mitgliedRentenversicherungsnummer || '';
  // Sub-Person-spezifische AG/Bank/Arbeitsentgelt-Fallbacks
  let personAg: typeof formData.viactivArbeitgeber | undefined;
  let personArbeitsentgelt: string | undefined;
  let personBank: { kontoinhaber: string; iban: string } | undefined;

  if (person.role === 'ehegatte' && formData.ehegatte) {
    const eh = formData.ehegatte;
    vorname = eh.vorname;
    nachname = eh.name;
    geburtsdatum = eh.geburtsdatum;
    geburtsort = eh.geburtsort;
    geburtsland = eh.geburtsland;
    staat = eh.staatsangehoerigkeit || staat;
    geschlecht = geschlechtFromString(eh.geschlecht);
    familienstand = 'verheiratet';
    kvNummer = ''; // Ehegatte hat i.d.R. eigene KVNR nicht in Novitas-Feldern
    bisherigeKrankenkasse = eh.bisherigBestandBei || formData.mitgliedKrankenkasse;
    beschaeftigung = eh.beschaeftigung;
    rentenversicherungsnummer = eh.rentenversicherungsnummer || '';
    personAg = eh.novitasArbeitgeber;
    personArbeitsentgelt = eh.novitasArbeitsentgelt;
    personBank = eh.novitasBank;
  } else if (person.role === 'kind' && person.index) {
    const k = formData.kinder[person.index - 1];
    if (k) {
      vorname = k.vorname;
      nachname = k.name;
      geburtsdatum = k.geburtsdatum;
      geburtsort = k.geburtsort;
      geburtsland = k.geburtsland;
      staat = k.staatsangehoerigkeit || staat;
      geschlecht = geschlechtFromString(k.geschlecht);
      familienstand = 'ledig';
      kvNummer = '';
      bisherigeKrankenkasse = k.bisherigBestandBei || formData.mitgliedKrankenkasse;
      beschaeftigung = k.beschaeftigung;
      rentenversicherungsnummer = k.rentenversicherungsnummer || '';
      personAg = k.novitasArbeitgeber;
      personArbeitsentgelt = k.novitasArbeitsentgelt;
      personBank = k.novitasBank;
    }
  }

  const status = deriveNovitasStatus(beschaeftigung);

  // Arbeitgeber: bei Sub-Person eigenen AG bevorzugen, sonst Hauptmitglied.
  const ag = personAg || formData.viactivArbeitgeber || { name: '', strasse: '', hausnummer: '', plz: '', ort: '', beschaeftigtSeit: '' };
  const arbeitsentgeltMonatlich = personArbeitsentgelt ?? formData.novitasArbeitsentgelt ?? '';
  let arbeitgeber = {
    name: ag.name || '',
    strasse: ag.strasse || '',
    hausnummer: ag.hausnummer || '',
    plz: ag.plz || '',
    ort: ag.ort || '',
    arbeitsentgeltMonatlich,
  };
  if (status === 'Arbeitslose_r_Jobcenter') {
    arbeitgeber = {
      name: ag.name || 'Jobcenter',
      strasse: ag.strasse || '',
      hausnummer: ag.hausnummer || '',
      plz: ag.plz || formData.mitgliedPlz || '',
      ort: ag.ort || formData.ort || '',
      arbeitsentgeltMonatlich,
    };
  } else if (status === 'Arbeitslose_r_AgenturArbeit') {
    arbeitgeber = {
      name: ag.name || 'Agentur für Arbeit',
      strasse: ag.strasse || '',
      hausnummer: ag.hausnummer || '',
      plz: ag.plz || formData.mitgliedPlz || '',
      ort: ag.ort || formData.ort || '',
      arbeitsentgeltMonatlich,
    };
  }

  // Bank: primär person-eigen, sonst bigBank/rundum-Fallback
  const bank = {
    kontoinhaber: personBank?.kontoinhaber || formData.bigBank?.kontoinhaber || formData.rundumSicherPaket?.kontoinhaber || '',
    iban: personBank?.iban || formData.bigBank?.iban || formData.rundumSicherPaket?.iban || '',
    bic: formData.bigBank?.bic || '',
    kreditinstitut: formData.bigBank?.kreditinstitut || '',
  };

  return {
    __type: 'novitas-autofill/v1',
    mode: isFamilie ? 'familie' : 'einzeln',
    person: {
      role: person.role,
      label: person.label,
      vorname: vorname || '',
      nachname: nachname || '',
      geburtsname: nachname || '', // Vorgabe: Geburtsname = Nachname
      geburtsdatum: toIso(geburtsdatum || ''),
      geburtsort: geburtsort || '',
      geburtsland: geburtsland || '',
      staatsangehoerigkeit: staat || '',
      geschlecht,
      familienstand: familienstand || '',
      kvNummer: kvNummer || '',
      rentenversicherungsnummer: rentenversicherungsnummer || '',
      bisherigeKrankenkasse: bisherigeKrankenkasse || '',
      status,
    },
    adresse: {
      strasse: formData.mitgliedStrasse || '',
      hausnummer: formData.mitgliedHausnummer || '',
      plz: formData.mitgliedPlz || '',
      ort: formData.ort || '',
    },
    telefon: formData.telefon || '',
    email: formData.email || '',
    arbeitgeber,
    bank,
    daten: {
      beginn: formatDateForInput(beginn),
      zuletztVersichertBis: formatDateForInput(bis),
      heute: formatDateForInput(today),
    },
    anlass: 'Ablauf_Bindungsfrist',
    vertriebspartner: { istVertriebspartner: true, vermittlerId: VERMITTLER_ID },
    familienangehoerigeFragebogen: wantsFragebogen,
  };
}

export { splitNovitasPersons };