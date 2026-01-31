import { PDFDocument } from "pdf-lib";
import { FormData, FamilyMember } from "@/types/form";
import { calculateDates } from "@/utils/dateUtils";
import { COUNTRY_OPTIONS, NATIONALITY_OPTIONS } from "@/utils/countries";

// Helper to get full country name from code
const getCountryName = (code: string): string => {
  const country = COUNTRY_OPTIONS.find(c => c.code === code);
  return country?.name || code;
};

// Helper to get nationality name from code
const getNationalityName = (code: string): string => {
  const nat = NATIONALITY_OPTIONS.find(c => c.code === code);
  return nat?.name || code;
};

// Date splitting for DAK: "01.05.1980" -> { T1: "0", T2: "1", M1: "0", M2: "5", J1: "1", J2: "9", J3: "8", J4: "0" }
interface SplitDate {
  T1: string; T2: string;
  M1: string; M2: string;
  J1: string; J2: string; J3: string; J4: string;
}

const splitDate = (dateStr: string): SplitDate | null => {
  if (!dateStr) return null;
  
  let day: string, month: string, year: string;
  
  if (dateStr.includes('.')) {
    const parts = dateStr.split('.');
    if (parts.length !== 3) return null;
    [day, month, year] = parts;
  } else if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    [year, month, day] = parts;
  } else {
    return null;
  }
  
  day = day.padStart(2, '0');
  month = month.padStart(2, '0');
  year = year.padStart(4, '0');
  
  return {
    T1: day[0], T2: day[1],
    M1: month[0], M2: month[1],
    J1: year[0], J2: year[1], J3: year[2], J4: year[3]
  };
};

// Convert German date format to display format
const formatDateGerman = (dateStr: string): string => {
  if (!dateStr) return '';
  
  if (dateStr.includes('.')) return dateStr;
  
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts;
    return `${day}.${month}.${year}`;
  }
  
  return dateStr;
};

// Field mapping for spouse and children
interface PersonFieldMapping {
  vorname: string;
  familienname: string;
  geburtsdatumT: [string, string]; // T1, T2
  geburtsdatumM: [string, string]; // M1, M2
  geburtsdatumJ: [string, string, string, string]; // J1-J4
  geschlechtW: string;
  geschlechtM: string;
  geschlechtD: string;
  strasse: string;
  plzOrt: string;
  geburtsname: string;
  geburtsort: string;
  geburtsland: string;
  staatsangehoerigkeit: string;
  kasseName: string;
  // Vorversicherungsart Checkboxen - KORRIGIERTE REIHENFOLGE: gar nicht, privat, familienversichert, eigene
  vorversNicht: string;
  vorversPrivat: string;
  vorversFamilie: string;
  vorversGesetzlich: string;
  // Vorversicherung bis Datum
  vorversBisT: [string, string];
  vorversBisM: [string, string];
  vorversBisJ: [string, string, string, string];
  // Name Hauptversicherter
  nameHauptversicherter: string;
  // Geburtsdatum Hauptversicherter
  gebHauptversT: [string, string];
  gebHauptversM: [string, string];
  gebHauptversJ: [string, string, string, string];
  // Verwandtschaft Checkboxen (nur für Kinder)
  verwandtschaftLeibl?: string;
  verwandtschaftEnkel?: string;
  verwandtschaftStief?: string;
  verwandtschaftPflege?: string;
}

// Spouse (Ehegatte) - Column 1 (Left)
// KORRIGIERT: Vorversicherung Reihenfolge: gar nicht (62), privat (63), familienversichert (64), eigene (65)
const SPOUSE_FIELDS: PersonFieldMapping = {
  vorname: 'Vorname 1',
  familienname: 'Familienname 1',
  geburtsdatumT: ['Geburtsdatum T1', 'Geburtsdatum T2'],
  geburtsdatumM: ['Geburtsdatum M1', 'Geburtsdatum M2'],
  geburtsdatumJ: ['Geburtsdatum J1', 'Geburtsdatum J2', 'Geburtsdatum J3', 'Geburtsdatum J4'],
  geschlechtW: 'Weiblich 12',
  geschlechtM: 'männlich 13',
  geschlechtD: 'divers 14',
  strasse: 'Familienname 4',
  plzOrt: 'Familienname 7',
  geburtsname: 'Familienname 13',
  geburtsort: 'Familienname 16',
  geburtsland: 'Familienname 19',
  staatsangehoerigkeit: 'Familienname 22',
  kasseName: 'Familienname 25',
  // KORRIGIERT: Vorversicherung Mapping
  vorversNicht: 'Kontrollkästchen 62',      // gar nicht versichert
  vorversPrivat: 'Kontrollkästchen 63',     // privat versichert
  vorversFamilie: 'Kontrollkästchen 64',    // familienversichert
  vorversGesetzlich: 'Kontrollkästchen 65', // eigene Versicherung (Mitgliedschaft)
  vorversBisT: ['Geburtsdatum T7', 'Geburtsdatum T10'],
  vorversBisM: ['Geburtsdatum M7', 'Geburtsdatum M10'],
  vorversBisJ: ['Geburtsdatum J13', 'Geburtsdatum J16', 'Geburtsdatum J19', 'Geburtsdatum J22'],
  nameHauptversicherter: 'Familienname 31',
  gebHauptversT: ['Geburtsdatum T13', 'Geburtsdatum T16'],
  gebHauptversM: ['Geburtsdatum M13', 'Geburtsdatum M16'],
  gebHauptversJ: ['Geburtsdatum J25', 'Geburtsdatum J28', 'Geburtsdatum J31', 'Geburtsdatum J34'],
};

// Kind 1 - Column 2 (Middle)
// KORRIGIERT: Vorversicherung Reihenfolge + Verwandtschaft Checkboxen hinzugefügt
const CHILD1_FIELDS: PersonFieldMapping = {
  vorname: 'Vorname 2',
  familienname: 'Familienname 2',
  geburtsdatumT: ['Geburtsdatum T3', 'Geburtsdatum T4'],
  geburtsdatumM: ['Geburtsdatum M3', 'Geburtsdatum M4'],
  geburtsdatumJ: ['Geburtsdatum J5', 'Geburtsdatum J6', 'Geburtsdatum J7', 'Geburtsdatum J8'],
  geschlechtW: 'weiblich 15',
  geschlechtM: 'männlich 16',
  geschlechtD: 'divers 17',
  strasse: 'Familienname 5',
  plzOrt: 'Familienname 8',
  geburtsname: 'Familienname 14',
  geburtsort: 'Familienname 17',
  geburtsland: 'Familienname 20',
  staatsangehoerigkeit: 'Familienname 23',
  kasseName: 'Familienname 26',
  // KORRIGIERT: Vorversicherung Mapping
  vorversNicht: 'Kontrollkästchen 66',      // gar nicht versichert
  vorversPrivat: 'Kontrollkästchen 67',     // privat versichert
  vorversFamilie: 'Kontrollkästchen 68',    // familienversichert
  vorversGesetzlich: 'Kontrollkästchen 69', // eigene Versicherung (Mitgliedschaft)
  vorversBisT: ['Geburtsdatum T8', 'Geburtsdatum T11'],
  vorversBisM: ['Geburtsdatum M8', 'Geburtsdatum M11'],
  vorversBisJ: ['Geburtsdatum J14', 'Geburtsdatum J17', 'Geburtsdatum J20', 'Geburtsdatum J23'],
  nameHauptversicherter: 'Familienname 32',
  gebHauptversT: ['Geburtsdatum T14', 'Geburtsdatum T17'],
  gebHauptversM: ['Geburtsdatum M14', 'Geburtsdatum M17'],
  gebHauptversJ: ['Geburtsdatum J26', 'Geburtsdatum J29', 'Geburtsdatum J32', 'Geburtsdatum J35'],
  // NEU: Verwandtschaft Checkboxen
  verwandtschaftLeibl: 'Kontrollkästchen 21',
  verwandtschaftEnkel: 'Kontrollkästchen 22',
  verwandtschaftStief: 'Kontrollkästchen 23',
  verwandtschaftPflege: 'Kontrollkästchen 24',
};

// Kind 2 - Column 3 (Right)
// KORRIGIERT: Vorversicherung 79 statt 73 + Verwandtschaft Checkboxen
const CHILD2_FIELDS: PersonFieldMapping = {
  vorname: 'Vorname 3',
  familienname: 'Familienname 3',
  geburtsdatumT: ['Geburtsdatum T5', 'Geburtsdatum T6'],
  geburtsdatumM: ['Geburtsdatum M5', 'Geburtsdatum M6'],
  geburtsdatumJ: ['Geburtsdatum J9', 'Geburtsdatum J10', 'Geburtsdatum J11', 'Geburtsdatum J12'],
  geschlechtW: 'weiblich 18',
  geschlechtM: 'männlich 19',
  geschlechtD: 'divers 20',
  strasse: 'Familienname 6',
  plzOrt: 'Familienname 9',
  geburtsname: 'Familienname 15',
  geburtsort: 'Familienname 18',
  geburtsland: 'Familienname 21',
  staatsangehoerigkeit: 'Familienname 24',
  kasseName: 'Familienname 27',
  // KORRIGIERT: Vorversicherung Mapping - ACHTUNG: 79 statt 73!
  vorversNicht: 'Kontrollkästchen 70',      // gar nicht versichert
  vorversPrivat: 'Kontrollkästchen 71',     // privat versichert
  vorversFamilie: 'Kontrollkästchen 72',    // familienversichert
  vorversGesetzlich: 'Kontrollkästchen 79', // eigene Versicherung (79, nicht 73!)
  vorversBisT: ['Geburtsdatum T9', 'Geburtsdatum T12'],
  vorversBisM: ['Geburtsdatum M9', 'Geburtsdatum M12'],
  vorversBisJ: ['Geburtsdatum J15', 'Geburtsdatum J18', 'Geburtsdatum J21', 'Geburtsdatum J24'],
  nameHauptversicherter: 'Familienname 33',
  gebHauptversT: ['Geburtsdatum T15', 'Geburtsdatum T18'],
  gebHauptversM: ['Geburtsdatum M15', 'Geburtsdatum M18'],
  gebHauptversJ: ['Geburtsdatum J27', 'Geburtsdatum J30', 'Geburtsdatum J33', 'Geburtsdatum J36'],
  // NEU: Verwandtschaft Checkboxen
  verwandtschaftLeibl: 'Kontrollkästchen 25',
  verwandtschaftEnkel: 'Kontrollkästchen 26',
  verwandtschaftStief: 'Kontrollkästchen 27',
  verwandtschaftPflege: 'Kontrollkästchen 28',
};

const fillPersonFields = (
  form: ReturnType<PDFDocument['getForm']>,
  member: FamilyMember,
  mapping: PersonFieldMapping,
  formData: FormData,
  dates: ReturnType<typeof calculateDates>
) => {
  const setTextField = (fieldName: string, value: string) => {
    try {
      const field = form.getTextField(fieldName);
      field.setText(value || '');
    } catch (e) {
      console.warn(`Field ${fieldName} not found`);
    }
  };

  const setCheckbox = (fieldName: string, checked: boolean) => {
    try {
      const field = form.getCheckBox(fieldName);
      if (checked) {
        field.check();
      } else {
        field.uncheck();
      }
    } catch (e) {
      console.warn(`Checkbox ${fieldName} not found`);
    }
  };

  // Basic info
  setTextField(mapping.vorname, member.vorname);
  setTextField(mapping.familienname, member.name);

  // Geburtsdatum split
  const gebSplit = splitDate(member.geburtsdatum);
  if (gebSplit) {
    setTextField(mapping.geburtsdatumT[0], gebSplit.T1);
    setTextField(mapping.geburtsdatumT[1], gebSplit.T2);
    setTextField(mapping.geburtsdatumM[0], gebSplit.M1);
    setTextField(mapping.geburtsdatumM[1], gebSplit.M2);
    setTextField(mapping.geburtsdatumJ[0], gebSplit.J1);
    setTextField(mapping.geburtsdatumJ[1], gebSplit.J2);
    setTextField(mapping.geburtsdatumJ[2], gebSplit.J3);
    setTextField(mapping.geburtsdatumJ[3], gebSplit.J4);
  }

  // Geschlecht
  if (member.geschlecht === 'w') {
    setCheckbox(mapping.geschlechtW, true);
  } else if (member.geschlecht === 'm') {
    setCheckbox(mapping.geschlechtM, true);
  } else if (member.geschlecht === 'd' || member.geschlecht === 'x') {
    setCheckbox(mapping.geschlechtD, true);
  }

  // Address - use member's or main member's address
  const strasse = member.abweichendeAnschrift || 
    `${formData.mitgliedStrasse} ${formData.mitgliedHausnummer}`.trim();
  const plzOrt = `${formData.mitgliedPlz} ${formData.ort}`.trim();
  setTextField(mapping.strasse, strasse);
  setTextField(mapping.plzOrt, plzOrt);

  // Geburtsname, Geburtsort, Geburtsland, Staatsangehörigkeit
  setTextField(mapping.geburtsname, member.geburtsname || member.name);
  setTextField(mapping.geburtsort, member.geburtsort);
  setTextField(mapping.geburtsland, getCountryName(member.geburtsland));
  setTextField(mapping.staatsangehoerigkeit, getNationalityName(member.staatsangehoerigkeit));

  // Vorversicherung Kasse Name
  const kasseName = member.bisherigBestehtWeiter && member.bisherigBestehtWeiterBei
    ? member.bisherigBestehtWeiterBei
    : (member.bisherigBestandBei || formData.mitgliedKrankenkasse || 'DAK');
  setTextField(mapping.kasseName, kasseName);

  // Vorversicherungsart - KORRIGIERTE LOGIK
  if (member.bisherigArt === 'mitgliedschaft') {
    setCheckbox(mapping.vorversGesetzlich, true); // eigene Versicherung
  } else if (member.bisherigArt === 'familienversicherung') {
    setCheckbox(mapping.vorversFamilie, true);
  } else if (member.bisherigArt === 'nicht_gesetzlich') {
    setCheckbox(mapping.vorversPrivat, true); // privat
  } else if (!member.bisherigArt && !member.bisherigBestehtWeiter) {
    setCheckbox(mapping.vorversNicht, true); // gar nicht versichert
  } else if (member.bisherigBestehtWeiter) {
    setCheckbox(mapping.vorversFamilie, true); // Default: familienversichert
  }

  // Vorversicherung bis Datum
  const vorversBis = member.bisherigEndeteAm || dates.endDate;
  const vorversBisSplit = splitDate(vorversBis);
  if (vorversBisSplit) {
    setTextField(mapping.vorversBisT[0], vorversBisSplit.T1);
    setTextField(mapping.vorversBisT[1], vorversBisSplit.T2);
    setTextField(mapping.vorversBisM[0], vorversBisSplit.M1);
    setTextField(mapping.vorversBisM[1], vorversBisSplit.M2);
    setTextField(mapping.vorversBisJ[0], vorversBisSplit.J1);
    setTextField(mapping.vorversBisJ[1], vorversBisSplit.J2);
    setTextField(mapping.vorversBisJ[2], vorversBisSplit.J3);
    setTextField(mapping.vorversBisJ[3], vorversBisSplit.J4);
  }

  // Name Hauptversicherter (Main member's name)
  const hauptversName = `${formData.mitgliedVorname} ${formData.mitgliedName}`.trim();
  setTextField(mapping.nameHauptversicherter, hauptversName);

  // Geburtsdatum Hauptversicherter
  const hauptversGebSplit = splitDate(formData.mitgliedGeburtsdatum);
  if (hauptversGebSplit) {
    setTextField(mapping.gebHauptversT[0], hauptversGebSplit.T1);
    setTextField(mapping.gebHauptversT[1], hauptversGebSplit.T2);
    setTextField(mapping.gebHauptversM[0], hauptversGebSplit.M1);
    setTextField(mapping.gebHauptversM[1], hauptversGebSplit.M2);
    setTextField(mapping.gebHauptversJ[0], hauptversGebSplit.J1);
    setTextField(mapping.gebHauptversJ[1], hauptversGebSplit.J2);
    setTextField(mapping.gebHauptversJ[2], hauptversGebSplit.J3);
    setTextField(mapping.gebHauptversJ[3], hauptversGebSplit.J4);
  }

  // NEU: Verwandtschaft Checkboxen (nur für Kinder)
  if (mapping.verwandtschaftLeibl) {
    setCheckbox(mapping.verwandtschaftLeibl, member.verwandtschaft === 'leiblich');
    setCheckbox(mapping.verwandtschaftEnkel!, member.verwandtschaft === 'enkel');
    setCheckbox(mapping.verwandtschaftStief!, member.verwandtschaft === 'stief');
    setCheckbox(mapping.verwandtschaftPflege!, member.verwandtschaft === 'pflege');
  }
};

const fillHeaderFields = (
  form: ReturnType<PDFDocument['getForm']>,
  formData: FormData
) => {
  const setTextField = (fieldName: string, value: string) => {
    try {
      const field = form.getTextField(fieldName);
      field.setText(value || '');
    } catch (e) {
      console.warn(`Field ${fieldName} not found`);
    }
  };

  const hauptmitgliedName = `${formData.mitgliedVorname} ${formData.mitgliedName}`.trim();
  
  // Kopfdaten auf allen Seiten
  setTextField('Mitglief.Seite 1', hauptmitgliedName);
  setTextField('Mitglief.Seite 2', hauptmitgliedName);
  setTextField('Mitglief.Seite 3', hauptmitgliedName);
  
  setTextField('KVNR.Seite 1', formData.mitgliedKvNummer);
  setTextField('KVNR.Seite 2', formData.mitgliedKvNummer);
  setTextField('KVNR.Seite 3', formData.mitgliedKvNummer);
  
  // KORREKTUR 1: Geburtsdatum auf allen 3 Seiten (PDF-Lib setzt Felder mit gleichem Namen automatisch)
  const geburtsdatumFormatted = formatDateGerman(formData.mitgliedGeburtsdatum);
  setTextField('Geburtsdatum.Seite 1.', geburtsdatumFormatted);
};

const fillHardcodedFields = (
  form: ReturnType<PDFDocument['getForm']>,
  formData: FormData
) => {
  const setCheckbox = (fieldName: string, checked: boolean) => {
    try {
      const field = form.getCheckBox(fieldName);
      if (checked) {
        field.check();
      } else {
        field.uncheck();
      }
    } catch (e) {
      console.warn(`Checkbox ${fieldName} not found`);
    }
  };

  const setTextField = (fieldName: string, value: string) => {
    try {
      const field = form.getTextField(fieldName);
      field.setText(value || '');
    } catch (e) {
      console.warn(`Field ${fieldName} not found`);
    }
  };

  // Anlass: Beginn meiner Mitgliedschaft
  setCheckbox('Kontrollkästchen 1', true);

  // KORREKTUR 2: Beginn Familienversicherung automatisch berechnen
  const dates = calculateDates();
  setTextField('Textfeld 1', dates.beginDate);

  // KORREKTUR 3: Familienstand Checkboxen
  setCheckbox('Kontrollkästchen 6', formData.familienstand === 'ledig');
  setCheckbox('Kontrollkästchen 7', formData.familienstand === 'verheiratet');
  setCheckbox('Kontrollkästchen 8', formData.familienstand === 'getrennt');
  setCheckbox('Kontrollkästchen 9', formData.familienstand === 'verwitwet');

  // KORREKTUR 9: Unterschrift Datum (heutiges Datum)
  const today = new Date();
  const datumHeute = `${today.getDate().toString().padStart(2, '0')}.${(today.getMonth() + 1).toString().padStart(2, '0')}.${today.getFullYear()}`;
  setTextField('Textfeld 417', datumHeute);

  // KORREKTUR 10: Telefon
  setTextField('Textfeld 420', formData.telefon || '');

  // KORREKTUR 11: Email
  setTextField('Textfeld 421', formData.email || '');

  // KORREKTUR 13: Unterschriften werden jetzt als Bilder eingebettet (nicht mehr als Text)
  // Die Text-Unterschriften werden nicht mehr gesetzt
  
  // Ehegatte Einkünfte checkbox on page 3
  if (formData.ehegatte.name) {
    setCheckbox('Kontrollkästchen 261', true);
  }
};

const fillSpouseOnPage3 = (
  form: ReturnType<PDFDocument['getForm']>,
  formData: FormData
) => {
  if (!formData.ehegatte.name) return;

  const setTextField = (fieldName: string, value: string) => {
    try {
      const field = form.getTextField(fieldName);
      field.setText(value || '');
    } catch (e) {
      console.warn(`Field ${fieldName} not found`);
    }
  };

  const setCheckbox = (fieldName: string, checked: boolean) => {
    try {
      const field = form.getCheckBox(fieldName);
      if (checked) {
        field.check();
      } else {
        field.uncheck();
      }
    } catch (e) {
      console.warn(`Checkbox ${fieldName} not found`);
    }
  };

  const ehegatte = formData.ehegatte;
  
  // KORREKTUR 6: Vorname und Nachname getrennt
  setTextField('Familienname 154', ehegatte.vorname);
  setTextField('Familienname 155', ehegatte.name);

  // Geburtsdatum T53...J108
  const gebSplit = splitDate(ehegatte.geburtsdatum);
  if (gebSplit) {
    setTextField('Geburtsdatum T53', gebSplit.T1);
    setTextField('Geburtsdatum T54', gebSplit.T2);
    setTextField('Geburtsdatum M53', gebSplit.M1);
    setTextField('Geburtsdatum M54', gebSplit.M2);
    setTextField('Geburtsdatum J105', gebSplit.J1);
    setTextField('Geburtsdatum J106', gebSplit.J2);
    setTextField('Geburtsdatum J107', gebSplit.J3);
    setTextField('Geburtsdatum J108', gebSplit.J4);
  }

  // KORREKTUR 7: Ehegatte verwandt mit Kindern
  setCheckbox('Kontrollkästchen 256', ehegatte.isEhegatteVerwandt === true);
  setCheckbox('Kontrollkästchen 257', ehegatte.isEhegatteVerwandt === false);

  // KORREKTUR 8: Ehegatte ist Mitglied einer gesetzlichen Krankenkasse?
  const ehegatteIstMitglied = ehegatte.bisherigArt === 'mitgliedschaft';
  setCheckbox('Kontrollkästchen 258', ehegatteIstMitglied);
  setCheckbox('Kontrollkästchen 259', !ehegatteIstMitglied);

  // Krankenkasse Name (wenn ja)
  if (ehegatteIstMitglied) {
    setTextField('Familienname 156', ehegatte.bisherigBestandBei || formData.ehegatteKrankenkasse || '');
  }
};

// KORREKTUR 13: Unterschriften als Bild einbetten
const embedSignature = async (
  pdfDoc: PDFDocument,
  signatureData: string,
  x: number,
  y: number,
  pageIndex: number
): Promise<void> => {
  if (!signatureData) return;

  try {
    const base64Data = signatureData.split(',')[1];
    if (!base64Data) return;
    
    const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    let image;
    if (signatureData.includes('image/png')) {
      image = await pdfDoc.embedPng(imageBytes);
    } else {
      image = await pdfDoc.embedJpg(imageBytes);
    }
    
    const pages = pdfDoc.getPages();
    if (pageIndex >= pages.length) return;
    
    const page = pages[pageIndex];
    
    // Signatur skalieren (max 100x30)
    const aspectRatio = image.width / image.height;
    let width = 100;
    let height = width / aspectRatio;
    if (height > 30) {
      height = 30;
      width = height * aspectRatio;
    }
    
    page.drawImage(image, { x, y, width, height });
  } catch (error) {
    console.warn('Signatur konnte nicht eingebettet werden:', error);
  }
};

export const exportDAKFamilienversicherung = async (formData: FormData): Promise<void> => {
  const dates = calculateDates();
  
  // Calculate number of PDFs needed (max 2 children per PDF)
  const numberOfPDFs = Math.max(1, Math.ceil(formData.kinder.length / 2));
  
  for (let pdfIndex = 0; pdfIndex < numberOfPDFs; pdfIndex++) {
    // Load the PDF template
    const pdfUrl = '/dak-familienversicherung.pdf';
    const existingPdfBytes = await fetch(pdfUrl).then(res => res.arrayBuffer());
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const form = pdfDoc.getForm();
    
    // Fill header fields (same on all PDFs)
    fillHeaderFields(form, formData);
    
    // Fill hardcoded fields
    fillHardcodedFields(form, formData);
    
    // KORREKTUR 12: Ehegatte in ALLEN PDFs eintragen (nicht nur im ersten)
    if (formData.ehegatte.name) {
      fillPersonFields(form, formData.ehegatte, SPOUSE_FIELDS, formData, dates);
      fillSpouseOnPage3(form, formData);
    }
    
    // Fill children for this PDF
    const startChildIndex = pdfIndex * 2;
    const childrenForThisPdf = formData.kinder.slice(startChildIndex, startChildIndex + 2);
    
    childrenForThisPdf.forEach((kind, idx) => {
      // If spouse exists, children go to columns 2 and 3
      // If no spouse, first child goes to column 1 (treated as spouse position)
      
      let mapping: PersonFieldMapping;
      
      if (!formData.ehegatte.name && idx === 0) {
        // No spouse, first child uses spouse column
        mapping = SPOUSE_FIELDS;
      } else if (!formData.ehegatte.name && idx === 1) {
        // No spouse, second child uses child 1 column
        mapping = CHILD1_FIELDS;
      } else if (idx === 0) {
        mapping = CHILD1_FIELDS;
      } else {
        mapping = CHILD2_FIELDS;
      }
      
      fillPersonFields(form, kind, mapping, formData, dates);
    });
    
    // KORREKTUR 13: Unterschriften als Bilder einbetten (Seite 3 = Index 2)
    if (formData.unterschrift) {
      await embedSignature(pdfDoc, formData.unterschrift, 185, 493, 2);
    }
    if (formData.ehegatte.name && formData.unterschriftFamilie) {
      await embedSignature(pdfDoc, formData.unterschriftFamilie, 375, 493, 2);
    }
    
    // Save and download
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    
    // Generate filename
    const today = new Date();
    const dateStr = `${today.getDate().toString().padStart(2, '0')}.${(today.getMonth() + 1).toString().padStart(2, '0')}.${today.getFullYear()}`;
    const baseName = `DAK_${formData.mitgliedName}, ${formData.mitgliedVorname}_Familienversicherung_${dateStr}`;
    
    if (numberOfPDFs > 1) {
      link.download = `${baseName}_Teil${pdfIndex + 1}.pdf`;
    } else {
      link.download = `${baseName}.pdf`;
    }
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};
