import { PDFDocument } from "pdf-lib";
import { FormData, FamilyMember } from "@/types/form";

/**
 * VIACTIV Bonus-PDF Export
 * Erwachsene (15+ Jahre): 170€ Bonus
 * Kinder (unter 15 Jahre): 110€ Bonus
 * 
 * Dateiname: Startdatum_Nachname, Vorname_geb. Datum.pdf
 */

// Helper: Parse date string (ISO or TT.MM.JJJJ) to Date object
const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  
  // ISO format: YYYY-MM-DD
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
  }
  
  // German format: TT.MM.JJJJ
  if (dateStr.includes('.')) {
    const parts = dateStr.split('.');
    if (parts.length === 3) {
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
  }
  
  return null;
};

// Calculate age in years from birthdate
const calculateAge = (geburtsdatum: string): number => {
  const birthDate = parseDate(geburtsdatum);
  if (!birthDate) return 0;
  
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

// Check if person is a child (under 15)
const isChild = (geburtsdatum: string): boolean => {
  return calculateAge(geburtsdatum) < 15;
};

// Format date as TT.MM.JJJJ
const formatDateGerman = (date: Date): string => {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

// Format ISO date to TT.MM.JJJJ
const formatISOToGerman = (isoDate: string): string => {
  const date = parseDate(isoDate);
  if (!date) return '';
  return formatDateGerman(date);
};

// Format date as YYYY-MM-DD for filename
const formatStartDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Get membership start date (+3 months, 1st of month)
const getMembershipStartDate = (): Date => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth() + 3, 1);
};

// Download PDF helper
const downloadPDF = (pdfBytes: Uint8Array, filename: string) => {
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Embed signature image into PDF
const embedSignature = async (
  pdfDoc: PDFDocument,
  signatureData: string,
  x: number,
  y: number,
  pageIndex: number = 0,
) => {
  if (!signatureData) return;

  try {
    const pages = pdfDoc.getPages();
    const page = pages[pageIndex];
    const { height } = page.getSize();

    const signatureImage = await pdfDoc.embedPng(signatureData);
    const sigDims = signatureImage.scale(0.2);

    page.drawImage(signatureImage, {
      x,
      y: height - y,
      width: Math.min(sigDims.width, 100),
      height: Math.min(sigDims.height, 30),
    });
  } catch (e) {
    console.error("Could not embed signature:", e);
  }
};

interface PDFHelpers {
  setTextField: (fieldName: string, value: string) => void;
  setCheckbox: (fieldName: string, checked: boolean) => void;
}

const createPDFHelpers = (form: ReturnType<PDFDocument["getForm"]>): PDFHelpers => {
  const trySetTextField = (fieldNames: string[], value: string): boolean => {
    if (!value) {
      console.log(`VIACTIV Bonus Skipping empty value for: ${fieldNames[0]}`);
      return false;
    }
    
    for (const fieldName of fieldNames) {
      try {
        const field = form.getTextField(fieldName);
        if (field) {
          field.setText(value);
          console.log(`VIACTIV Bonus Field set: "${fieldName}" = "${value}"`);
          return true;
        }
      } catch (e) {
        console.log(`VIACTIV Bonus Field "${fieldName}" error:`, e);
      }
    }
    console.warn(`VIACTIV Bonus Field NOT FOUND: ${fieldNames.join(' / ')}`);
    return false;
  };

  const setTextField = (fieldName: string, value: string) => {
    const variations = [
      fieldName,
      fieldName.replace(/ä/g, 'Ã¤').replace(/ö/g, 'Ã¶').replace(/ü/g, 'Ã¼').replace(/ß/g, 'ÃŸ'),
      fieldName.replace(/Ä/g, 'Ã„').replace(/Ö/g, 'Ã–').replace(/Ü/g, 'Ãœ'),
    ];
    trySetTextField(variations, value);
  };

  const setCheckbox = (fieldName: string, checked: boolean) => {
    const variations = [
      fieldName,
      fieldName.replace(/ä/g, 'Ã¤').replace(/ö/g, 'Ã¶').replace(/ü/g, 'Ã¼').replace(/ß/g, 'ÃŸ'),
      fieldName.replace(/Ä/g, 'Ã„').replace(/Ö/g, 'Ã–').replace(/Ü/g, 'Ãœ'),
    ];
    
    for (const name of variations) {
      try {
        const field = form.getCheckBox(name);
        if (field) {
          if (checked) {
            field.check();
          } else {
            field.uncheck();
          }
          console.log(`VIACTIV Bonus Checkbox set: "${name}" = ${checked}`);
          return;
        }
      } catch (e) {
        // Try next variation
      }
    }
    console.warn(`VIACTIV Bonus Checkbox NOT FOUND: ${fieldName}`);
  };

  return { setTextField, setCheckbox };
};

/**
 * Create Bonus-Erwachsene PDF (170€) for an adult person
 */
const createBonusErwachsenePDF = async (
  formData: FormData,
  personVorname: string,
  personNachname: string,
  personGeburtsdatum: string,
  personVersichertennummer: string,
  signatureData: string,
): Promise<Uint8Array> => {
  const pdfUrl = "/viactiv-bonus-erwachsene.pdf";
  const existingPdfBytes = await fetch(pdfUrl).then((res) => res.arrayBuffer());
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const form = pdfDoc.getForm();
  
  // Debug: List all field names
  const fields = form.getFields();
  console.log("=== VIACTIV Bonus Erwachsene PDF Fields ===");
  fields.forEach(field => {
    console.log(`Field: "${field.getName()}" - Type: ${field.constructor.name}`);
  });
  console.log("=== END VIACTIV Bonus Erwachsene PDF Fields ===");
  
  const helpers = createPDFHelpers(form);
  const { setTextField, setCheckbox } = helpers;

  // Verzicht Checkboxen immer ankreuzen
  setCheckbox("Verzicht 1", true);
  setCheckbox("Verzicht 2", true);

  // Antrags-/Vertragsnummer
  setTextField("Antragsnummer", formData.viactivBonusVertragsnummer);
  setTextField("Antragsnummer 2", formData.viactivBonusVertragsnummer);

  // Person-Daten
  setTextField("Versicherungsnummer", personVersichertennummer);
  setTextField("Vorname", personVorname);
  setTextField("Nachname", personNachname);
  setTextField("Geburtsdatum", formatISOToGerman(personGeburtsdatum));

  // Kontodaten
  setTextField("Kontoinhaberin", formData.viactivBonusKontoinhaber);
  setTextField("IBAN", formData.viactivBonusIBAN);

  // Unterschriftsdatum
  const today = new Date();
  setTextField("Datum Unterschrift", formatDateGerman(today));

  // Unterschrift einbetten (Position rechts neben Datum - korrigiert)
  if (signatureData) {
    await embedSignature(pdfDoc, signatureData, 310, 760, 0);
  }

  return await pdfDoc.save();
};

/**
 * Create Bonus-Kinder PDF (110€) for a child
 */
const createBonusKinderPDF = async (
  formData: FormData,
  kind: FamilyMember,
  signatureData: string,
): Promise<Uint8Array> => {
  const pdfUrl = "/viactiv-bonus-kinder.pdf";
  const existingPdfBytes = await fetch(pdfUrl).then((res) => res.arrayBuffer());
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const form = pdfDoc.getForm();
  
  // Debug: List all field names
  const fields = form.getFields();
  console.log("=== VIACTIV Bonus Kinder PDF Fields ===");
  fields.forEach(field => {
    console.log(`Field: "${field.getName()}" - Type: ${field.constructor.name}`);
  });
  console.log("=== END VIACTIV Bonus Kinder PDF Fields ===");
  
  const helpers = createPDFHelpers(form);
  const { setTextField, setCheckbox } = helpers;

  // Verzicht Checkboxen immer ankreuzen
  setCheckbox("Verzicht 1", true);
  setCheckbox("Verzicht 2", true);

  // Antrags-/Vertragsnummer
  setTextField("Antragsnummer", formData.viactivBonusVertragsnummer);
  setTextField("Antragsnummer 2", formData.viactivBonusVertragsnummer);

  // Hauptmitglied-Daten (Erziehungsberechtigter)
  setTextField("Versicherungsnummer", formData.mitgliedVersichertennummer);
  setTextField("Vorname", formData.mitgliedVorname);
  setTextField("Nachname", formData.mitgliedName);

  // Kind-Daten
  setTextField("Versicherungsnummer_2", kind.versichertennummer);
  setTextField("Vorname_2", kind.vorname);
  setTextField("Nachname_2", kind.name);
  setTextField("Geburtsdatum Kind", formatISOToGerman(kind.geburtsdatum));

  // Kontodaten
  setTextField("Kontoinhaberin", formData.viactivBonusKontoinhaber);
  setTextField("IBAN", formData.viactivBonusIBAN);

  // Unterschriftsdatum
  const today = new Date();
  setTextField("Datum Unterschrift", formatDateGerman(today));

  // Unterschrift einbetten (Hauptmitglied unterschreibt für Kind - korrigiert)
  if (signatureData) {
    await embedSignature(pdfDoc, signatureData, 310, 720, 0);
  }

  return await pdfDoc.save();
};

/**
 * Generate filename for Bonus PDF
 * Format: Startdatum_Nachname, Vorname_geb. Datum.pdf
 */
const generateBonusFilename = (
  nachname: string,
  vorname: string,
  geburtsdatum: string,
): string => {
  const startDate = getMembershipStartDate();
  const startDateStr = formatStartDate(startDate);
  const geburtsdatumStr = formatISOToGerman(geburtsdatum);
  
  return `${startDateStr}_${nachname}, ${vorname}_geb. ${geburtsdatumStr}.pdf`;
};

/**
 * Export all VIACTIV Bonus PDFs
 * Returns the number of PDFs generated
 */
export const exportViactivBonusPDFs = async (formData: FormData): Promise<number> => {
  let count = 0;

  try {
    // 1. Hauptmitglied - immer Erwachsene (170€)
    console.log("VIACTIV Bonus: Erstelle PDF für Hauptmitglied");
    const memberPdfBytes = await createBonusErwachsenePDF(
      formData,
      formData.mitgliedVorname,
      formData.mitgliedName,
      formData.mitgliedGeburtsdatum,
      formData.mitgliedVersichertennummer,
      formData.unterschrift,
    );
    const memberFilename = generateBonusFilename(
      formData.mitgliedName,
      formData.mitgliedVorname,
      formData.mitgliedGeburtsdatum,
    );
    downloadPDF(memberPdfBytes, memberFilename);
    count++;

    // 2. Ehegatte (falls vorhanden und Familienversicherung aktiviert)
    if (formData.viactivFamilienangehoerigeMitversichern && formData.ehegatte.name) {
      const spouse = formData.ehegatte;
      console.log(`VIACTIV Bonus: Erstelle PDF für Ehegatte (Alter: ${calculateAge(spouse.geburtsdatum)})`);
      
      if (isChild(spouse.geburtsdatum)) {
        // Unter 15: Kinder-PDF (110€)
        const spousePdfBytes = await createBonusKinderPDF(
          formData,
          spouse,
          formData.unterschriftFamilie,
        );
        const spouseFilename = generateBonusFilename(
          spouse.name,
          spouse.vorname,
          spouse.geburtsdatum,
        );
        downloadPDF(spousePdfBytes, spouseFilename);
      } else {
        // 15+: Erwachsene-PDF (170€)
        const spousePdfBytes = await createBonusErwachsenePDF(
          formData,
          spouse.vorname,
          spouse.name,
          spouse.geburtsdatum,
          spouse.versichertennummer,
          formData.unterschriftFamilie,
        );
        const spouseFilename = generateBonusFilename(
          spouse.name,
          spouse.vorname,
          spouse.geburtsdatum,
        );
        downloadPDF(spousePdfBytes, spouseFilename);
      }
      count++;
    }

    // 3. Kinder (falls vorhanden und Familienversicherung aktiviert)
    if (formData.viactivFamilienangehoerigeMitversichern && formData.kinder.length > 0) {
      for (const kind of formData.kinder) {
        if (!kind.name || !kind.vorname) continue;
        
        console.log(`VIACTIV Bonus: Erstelle PDF für Kind ${kind.vorname} ${kind.name} (Alter: ${calculateAge(kind.geburtsdatum)})`);
        
        if (isChild(kind.geburtsdatum)) {
          // Unter 15: Kinder-PDF (110€)
          const kindPdfBytes = await createBonusKinderPDF(
            formData,
            kind,
            formData.unterschrift, // Hauptmitglied unterschreibt für Kinder
          );
          const kindFilename = generateBonusFilename(
            kind.name,
            kind.vorname,
            kind.geburtsdatum,
          );
          downloadPDF(kindPdfBytes, kindFilename);
        } else {
          // 15+: Erwachsene-PDF (170€) - unterschrieben vom Hauptmitglied
          const kindPdfBytes = await createBonusErwachsenePDF(
            formData,
            kind.vorname,
            kind.name,
            kind.geburtsdatum,
            kind.versichertennummer,
            formData.unterschrift, // Hauptmitglied unterschreibt
          );
          const kindFilename = generateBonusFilename(
            kind.name,
            kind.vorname,
            kind.geburtsdatum,
          );
          downloadPDF(kindPdfBytes, kindFilename);
        }
        count++;
      }
    }

    console.log(`VIACTIV Bonus: ${count} PDF(s) erstellt`);
    return count;
  } catch (error) {
    console.error("VIACTIV Bonus Export error:", error);
    throw error;
  }
};
