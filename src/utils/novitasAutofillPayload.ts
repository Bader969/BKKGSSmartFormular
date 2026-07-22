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
    geburtsdatum: string; // YYYY-MM-DD
    geburtsort: string;
    geschlecht: 'maennlich' | 'weiblich' | 'unbestimmt' | 'divers' | '';
    familienstand: string;
    kvNummer: string;
    bisherigeKrankenkasse: string;
    status: NovitasStatus;
  };
  adresse: { strasseHausnummer: string; plz: string; ort: string };
  telefon: string;
  email: string;
  arbeitgeber: {
    name: string;
    strasseHausnummer: string;
    plz: string;
    ort: string;
    arbeitsentgeltMonatlich: string;
  };
  bank: { kontoinhaber: string; iban: string };
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

/** Liefert exakt die Werte, die das Novitas-Dropdown erwartet. */
const geschlechtFromString = (
  g: FormData['bigGeschlecht'] | FormData['viactivGeschlecht'] | FamilyMember['geschlecht'] | '' | undefined,
): 'maennlich' | 'weiblich' | 'unbestimmt' | 'divers' | '' => {
  const s = String(g || '').toLowerCase();
  if (s === 'm' || s === 'maennlich' || s === 'männlich' || s.startsWith('mann')) return 'maennlich';
  if (s === 'w' || s === 'weiblich' || s.startsWith('weib')) return 'weiblich';
  if (s === 'unbestimmt') return 'unbestimmt';
  if (s === 'd' || s === 'x' || s === 'divers') return 'divers';
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
  let geschlecht = geschlechtFromString(formData.viactivGeschlecht || formData.bigGeschlecht);
  let familienstand = formData.familienstand;
  let kvNummer = formData.mitgliedKvNummer;
  let bisherigeKrankenkasse = formData.mitgliedKrankenkasse;
  let beschaeftigung: FormData['viactivBeschaeftigung'] | FamilyMember['beschaeftigung'] = formData.viactivBeschaeftigung;
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
    geschlecht = geschlechtFromString(eh.geschlecht);
    familienstand = 'verheiratet';
    kvNummer = ''; // Ehegatte hat i.d.R. eigene KVNR nicht in Novitas-Feldern
    bisherigeKrankenkasse = eh.bisherigBestandBei || formData.mitgliedKrankenkasse;
    beschaeftigung = eh.beschaeftigung;
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
      geschlecht = geschlechtFromString(k.geschlecht);
      familienstand = 'ledig';
      kvNummer = '';
      bisherigeKrankenkasse = k.bisherigBestandBei || formData.mitgliedKrankenkasse;
      beschaeftigung = k.beschaeftigung;
      personAg = k.novitasArbeitgeber;
      personArbeitsentgelt = k.novitasArbeitsentgelt;
      personBank = k.novitasBank;
    }
  }

  const status = deriveNovitasStatus(beschaeftigung);

  // Arbeitgeber: bei Sub-Person eigenen AG bevorzugen, sonst Hauptmitglied.
  const ag = personAg || formData.viactivArbeitgeber || { name: '', strasse: '', hausnummer: '', plz: '', ort: '', beschaeftigtSeit: '' };
  const arbeitsentgeltMonatlich = personArbeitsentgelt ?? formData.novitasArbeitsentgelt ?? '';
  const combine = (s?: string, h?: string) => [s || '', h || ''].map(x => x.trim()).filter(Boolean).join(' ');
  let arbeitgeber = {
    name: ag.name || '',
    strasseHausnummer: combine(ag.strasse, ag.hausnummer),
    plz: ag.plz || '',
    ort: ag.ort || '',
    arbeitsentgeltMonatlich,
  };
  if (status === 'Arbeitslose_r_Jobcenter') {
    arbeitgeber = {
      name: ag.name || 'Jobcenter',
      strasseHausnummer: combine(ag.strasse, ag.hausnummer),
      plz: ag.plz || formData.mitgliedPlz || '',
      ort: ag.ort || formData.ort || '',
      arbeitsentgeltMonatlich,
    };
  } else if (status === 'Arbeitslose_r_AgenturArbeit') {
    arbeitgeber = {
      name: ag.name || 'Agentur für Arbeit',
      strasseHausnummer: combine(ag.strasse, ag.hausnummer),
      plz: ag.plz || formData.mitgliedPlz || '',
      ort: ag.ort || formData.ort || '',
      arbeitsentgeltMonatlich,
    };
  }

  // Bank: primär person-eigen, sonst bigBank/rundum-Fallback
  const bank = {
    kontoinhaber: personBank?.kontoinhaber || formData.bigBank?.kontoinhaber || formData.rundumSicherPaket?.kontoinhaber || '',
    iban: personBank?.iban || formData.bigBank?.iban || formData.rundumSicherPaket?.iban || '',
  };

  return {
    __type: 'novitas-autofill/v1',
    mode: isFamilie ? 'familie' : 'einzeln',
    person: {
      role: person.role,
      label: person.label,
      vorname: vorname || '',
      nachname: nachname || '',
      geburtsdatum: toIso(geburtsdatum || ''),
      geburtsort: geburtsort || '',
      geschlecht,
      familienstand: familienstand || '',
      kvNummer: kvNummer || '',
      bisherigeKrankenkasse: bisherigeKrankenkasse || '',
      status,
    },
    adresse: {
      strasseHausnummer: combine(formData.mitgliedStrasse, formData.mitgliedHausnummer),
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