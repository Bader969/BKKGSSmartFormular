import { PDFDocument } from 'pdf-lib';
import { FormData, FamilyMember } from '@/types/form';
import { calculateDates } from './dateUtils';

const formatInputDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
};

interface PDFHelpers {
  setTextField: (fieldName: string, value: string) => void;
  setCheckbox: (fieldName: string, checked: boolean) => void;
}

const createPDFHelpers = (form: ReturnType<PDFDocument['getForm']>): PDFHelpers => {
  const setTextField = (fieldName: string, value: string) => {
    try {
      const field = form.getTextField(fieldName);
      if (field && value) {
        field.setText(value);
      }
    } catch (e) {
      console.warn(`Field not found: ${fieldName}`);
    }
  };

  const setCheckbox = (fieldName: string, checked: boolean) => {
    try {
      const field = form.getCheckBox(fieldName);
      if (field) {
        if (checked) {
          field.check();
        } else {
          field.uncheck();
        }
      }
    } catch (e) {
      console.warn(`Checkbox not found: ${fieldName}`);
    }
  };

  return { setTextField, setCheckbox };
};

const fillBasicFields = (
  formData: FormData,
  helpers: PDFHelpers,
  beginDate: string,
  endDate: string,
  datumFormatted: string
) => {
  const { setTextField, setCheckbox } = helpers;

  // === PAGE 1 - Header Fields ===
  setTextField('Vorname Mitglied', `${formData.mitgliedVorname} ${formData.mitgliedName}`);
  setTextField('KV-Nummer', formData.mitgliedKvNummer || '');
  setTextField('Name KK', formData.mitgliedKrankenkasse || '');

  // === "Ich war bisher" ===
  setCheckbox('01', true);
  setCheckbox('02', false);
  setCheckbox('03', false);

  // === Familienstand ===
  setCheckbox('04', formData.familienstand === 'ledig');
  setCheckbox('05', formData.familienstand === 'verheiratet');
  setCheckbox('06', formData.familienstand === 'getrennt');
  setCheckbox('07', formData.familienstand === 'geschieden');
  setCheckbox('08', formData.familienstand === 'verwitwet');

  // === "Anlass für die Aufnahme" ===
  setCheckbox('09', false);
  setCheckbox('10', true);
  setCheckbox('11', false);
  setCheckbox('12', false);
  setCheckbox('13', false);
  setCheckbox('14', false);

  // === Beginn der Familienversicherung ===
  setTextField('Beginn FamiVersicherung', beginDate);

  // === Telefon & E-Mail ===
  if (formData.telefon) {
    setTextField('Rückfrage Telefon-Nr', formData.telefon);
  }
  if (formData.email) {
    setTextField('E-Mail', formData.email);
  }

  // === "Informationsblatt erhalten: ja" ===
  setCheckbox('15', true);
  setCheckbox('16', false);

  // === Ort, Datum ===
  setTextField('Ort, Datum', `${formData.ort}, ${datumFormatted}`);
};

const fillSpouseFields = (
  formData: FormData,
  helpers: PDFHelpers,
  endDate: string
) => {
  const { setTextField, setCheckbox } = helpers;

  if (formData.ehegatte.name || formData.ehegatte.vorname) {
    setTextField('Ehegatte Name', formData.ehegatte.name);
    setTextField('Ehegatte Vorname', formData.ehegatte.vorname);

    setCheckbox('m1', formData.ehegatte.geschlecht === 'm');
    setCheckbox('w1', formData.ehegatte.geschlecht === 'w');
    setCheckbox('x1', formData.ehegatte.geschlecht === 'x');
    setCheckbox('d1', formData.ehegatte.geschlecht === 'd');

    if (formData.ehegatte.geburtsdatum) {
      setTextField('Ehegatte GebDatum', formatInputDate(formData.ehegatte.geburtsdatum));
    }

    if (formData.ehegatte.abweichendeAnschrift) {
      setTextField('Ehegatte Anschrift', formData.ehegatte.abweichendeAnschrift);
    }

    // Page 2 - Bisherige Versicherung
    setTextField('Ehegatte - letzte Vers endet am', endDate);
    setTextField('Ehegatte - letzte Vers KK', formData.ehegatteKrankenkasse || '');

    setCheckbox('Ehegatte Fami', true);
    setCheckbox('Ehegatte MG', false);
    setCheckbox('Ehegatte nicht gesetzlich', false);

    if (formData.ehegatte.bisherigBestehtWeiter && formData.ehegatte.bisherigBestehtWeiterBei) {
      setTextField('KK bleibt', formData.ehegatte.bisherigBestehtWeiterBei);
    }
  }
};

const fillChildFields = (
  kind: FamilyMember,
  index: number,
  helpers: PDFHelpers,
  endDate: string
) => {
  const { setTextField, setCheckbox } = helpers;
  const childNum = index + 1;

  if (!kind.name && !kind.vorname) return;

  // Field name mappings based on child position (1, 2, or 3)
  const nameField = `Kind ${childNum} Name`;
  const vornameField = `Kind ${childNum} Vorname`;
  const gebDatumField = `Kind${childNum} GebDatum`;
  const anschriftField = `Kind${childNum} Anschrift`;
  const endetAmField = `Kind${childNum} - letzte Vers endet am`;

  // Gender checkbox indices: Kind 1 = m2/w2/x2/d2, Kind 2 = m3/w3/x3/d3, Kind 3 = m4/w4/x4/d4
  const genderSuffix = index + 2;

  setTextField(nameField, kind.name);
  setTextField(vornameField, kind.vorname);

  setCheckbox(`m${genderSuffix}`, kind.geschlecht === 'm');
  setCheckbox(`w${genderSuffix}`, kind.geschlecht === 'w');
  setCheckbox(`x${genderSuffix}`, kind.geschlecht === 'x');
  setCheckbox(`d${genderSuffix}`, kind.geschlecht === 'd');

  if (kind.geburtsdatum) {
    setTextField(gebDatumField, formatInputDate(kind.geburtsdatum));
  }

  if (kind.abweichendeAnschrift) {
    setTextField(anschriftField, kind.abweichendeAnschrift);
  }

  // Verwandtschaftsverhältnis
  setCheckbox(`leibliches Kind${childNum}`, kind.verwandtschaft === 'leiblich');
  setCheckbox(`Stiefkind${childNum}`, kind.verwandtschaft === 'stief');
  setCheckbox(`Enkel${childNum}`, kind.verwandtschaft === 'enkel');
  setCheckbox(`Pflegekind${childNum}`, kind.verwandtschaft === 'pflege');

  // Page 2 - Bisherige Versicherung
  setTextField(endetAmField, endDate);
  setCheckbox(`Kind${childNum} Fami`, true);
  setCheckbox(`Kind${childNum} MG`, false);
  setCheckbox(`Kind${childNum} nicht gesetzlich`, false);
};

const embedSignature = async (
  pdfDoc: PDFDocument,
  signatureData: string,
  x: number,
  y: number,
  pageIndex: number = 1
) => {
  if (!signatureData) return;

  try {
    const pages = pdfDoc.getPages();
    const page = pages[pageIndex];
    const { height } = page.getSize();

    const signatureImage = await pdfDoc.embedPng(signatureData);
    const sigDims = signatureImage.scale(0.25);

    page.drawImage(signatureImage, {
      x,
      y: height - y,
      width: Math.min(sigDims.width, 140),
      height: Math.min(sigDims.height, 45),
    });
  } catch (e) {
    console.error('Could not embed signature:', e);
  }
};

const createFilledPDF = async (
  formData: FormData,
  childrenForThisPDF: FamilyMember[],
  pdfNumber: number
): Promise<Uint8Array> => {
  const pdfUrl = '/familienversicherung.pdf';
  const existingPdfBytes = await fetch(pdfUrl).then(res => res.arrayBuffer());
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const form = pdfDoc.getForm();

  const { beginDate, endDate } = calculateDates();
  const datumFormatted = formatInputDate(formData.datum);
  const helpers = createPDFHelpers(form);

  // Fill basic member fields
  fillBasicFields(formData, helpers, beginDate, endDate, datumFormatted);

  // Fill spouse fields
  fillSpouseFields(formData, helpers, endDate);

  // Fill children fields (max 3 per PDF)
  childrenForThisPDF.forEach((kind, index) => {
    fillChildFields(kind, index, helpers, endDate);
  });

  // Embed signatures
  await embedSignature(pdfDoc, formData.unterschrift, 200, 715, 1);
  await embedSignature(pdfDoc, formData.unterschriftFamilie, 400, 715, 1);

  return await pdfDoc.save();
};

const downloadPDF = (pdfBytes: Uint8Array, filename: string) => {
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportFilledPDF = async (formData: FormData): Promise<void> => {
  try {
    const datumFormatted = formatInputDate(formData.datum);
    const baseName = `Familienversicherung_${formData.mitgliedName || 'Antrag'}_${datumFormatted.replace(/\./g, '-')}`;

    const children = formData.kinder;
    const numberOfPDFs = Math.max(1, Math.ceil(children.length / 3));

    for (let pdfIndex = 0; pdfIndex < numberOfPDFs; pdfIndex++) {
      const startChildIndex = pdfIndex * 3;
      const childrenForThisPDF = children.slice(startChildIndex, startChildIndex + 3);

      const pdfBytes = await createFilledPDF(formData, childrenForThisPDF, pdfIndex + 1);

      const filename = numberOfPDFs > 1
        ? `${baseName}_Teil${pdfIndex + 1}.pdf`
        : `${baseName}.pdf`;

      downloadPDF(pdfBytes, filename);

      // Small delay between downloads to prevent browser blocking
      if (pdfIndex < numberOfPDFs - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  } catch (error) {
    console.error('Error exporting PDF:', error);
    throw error;
  }
};
