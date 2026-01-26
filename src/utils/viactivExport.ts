import { PDFDocument } from "pdf-lib";
import { FormData } from "@/types/form";

/**
 * VIACTIV Beitrittserklärung PDF Export
 * Dateiname: Viactiv_Nachname, Vorname_BE_Datum.pdf
 */

const formatInputDate = (dateStr: string): string => {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  // Format: TTMMJJJJ (ohne Punkte für VIACTIV PDF)
  return `${parts[2]}${parts[1]}${parts[0]}`;
};

const formatDateGerman = (date: Date): string => {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  // Format: TTMMJJJJ (ohne Punkte für VIACTIV PDF)
  return `${day}${month}${year}`;
};

/**
 * Berechnet Datum Mitgliedschaft: Immer +3 Kalendermonate (1. des Monats)
 * Z.B. heute 23.01.2026 → 01.04.2026
 */
const getDatumMitgliedschaft = (): string => {
  const today = new Date();
  const targetDate = new Date(today.getFullYear(), today.getMonth() + 3, 1);
  return formatDateGerman(targetDate);
};

/**
 * Berechnet "versichert bis" Datum: Ende des 3. Monats ab jetzt
 * Z.B. heute 23.01.2026 → 31.03.2026
 */
const getVersichertBis = (): string => {
  const today = new Date();
  // Ende des 3. Monats = Tag 0 des 4. Monats (letzter Tag des Vormonats)
  const endOfThirdMonth = new Date(today.getFullYear(), today.getMonth() + 3, 0);
  return formatDateGerman(endOfThirdMonth);
};

interface PDFHelpers {
  setTextField: (fieldName: string, value: string) => void;
  setCheckbox: (fieldName: string, checked: boolean) => void;
}

const createPDFHelpers = (form: ReturnType<PDFDocument["getForm"]>): PDFHelpers => {
  const trySetTextField = (fieldNames: string[], value: string): boolean => {
    if (!value) {
      console.log(`VIACTIV Skipping empty value for: ${fieldNames[0]}`);
      return false;
    }
    
    for (const fieldName of fieldNames) {
      try {
        const field = form.getTextField(fieldName);
        if (field) {
          field.setText(value);
          console.log(`VIACTIV Field set: "${fieldName}" = "${value}"`);
          return true;
        }
      } catch (e) {
        console.log(`VIACTIV Field "${fieldName}" error:`, e);
      }
    }
    console.warn(`VIACTIV Field NOT FOUND: ${fieldNames.join(' / ')}`);
    return false;
  };

  const setTextField = (fieldName: string, value: string) => {
    // Try with original name and common encoding variations
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
          console.log(`VIACTIV Checkbox set: "${name}" = ${checked}`);
          return;
        }
      } catch (e) {
        // Try next variation
      }
    }
    console.warn(`VIACTIV Checkbox NOT FOUND: ${fieldName}`);
  };

  return { setTextField, setCheckbox };
};

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

export const createViactivBeitrittserklaerungPDF = async (formData: FormData): Promise<Uint8Array> => {
  const pdfUrl = "/viactiv-beitrittserklaerung.pdf";
  const existingPdfBytes = await fetch(pdfUrl).then((res) => res.arrayBuffer());
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const form = pdfDoc.getForm();
  
  // Debug: List all field names in the PDF
  const fields = form.getFields();
  console.log("=== VIACTIV PDF Fields ===");
  fields.forEach(field => {
    console.log(`Field: "${field.getName()}" - Type: ${field.constructor.name}`);
  });
  console.log("=== END VIACTIV PDF Fields ===");
  
  const helpers = createPDFHelpers(form);
  const { setTextField, setCheckbox } = helpers;

  // === AUTOMATISCH AUSGEFÜLLT ===
  
  // Eintrittsdatum: +3 Kalendermonate (1. des Monats)
  const datumMitgliedschaft = getDatumMitgliedschaft();
  console.log("VIACTIV Setting Datum Mitgliedschaft:", datumMitgliedschaft);
  setTextField("Datum Mitgliedschaft", datumMitgliedschaft);
  
  // versichert bis: Ende des 3. Monats
  const versichertBis = getVersichertBis();
  console.log("VIACTIV Setting versichert bis:", versichertBis);
  setTextField("versichert bis (Datum)", versichertBis);
  
  // Immer angekreuzt
  setCheckbox("Mein Versicherungsstatus ist unverändert", true);

  // === PERSÖNLICHE DATEN ===
  setTextField("Name", formData.mitgliedName);
  setTextField("Vorname", formData.mitgliedVorname);
  
  // Geburtsdatum formatieren und setzen
  const geburtsdatumFormatted = formatInputDate(formData.mitgliedGeburtsdatum);
  console.log("VIACTIV Setting Geburtsdatum:", geburtsdatumFormatted);
  setTextField("Geburtsdatum", geburtsdatumFormatted);
  
  setTextField("Geburtsort", formData.mitgliedGeburtsort || "");
  setTextField("Geburtsland", formData.mitgliedGeburtsland || "");
  
  // Geburtsname - falls vorhanden im Formular, sonst Nachname
  setTextField("Geburtsname", formData.mitgliedName);
  
  // Staatsangehörigkeit
  setTextField("Staatsangehörigkeit", formData.viactivStaatsangehoerigkeit || "deutsch");

  // === GESCHLECHT ===
  setCheckbox("weiblich", formData.viactivGeschlecht === "weiblich");
  setCheckbox("männlich", formData.viactivGeschlecht === "maennlich");
  setCheckbox("divers", formData.viactivGeschlecht === "divers");

  // === ADRESSE ===
  setTextField("Straße", formData.mitgliedStrasse || "");
  setTextField("Hausnummer", formData.mitgliedHausnummer || "");
  setTextField("PLZ", formData.mitgliedPlz || "");
  setTextField("Ort", formData.ort || "");
  
  // === KONTAKT ===
  setTextField("Telefon", formData.telefon || "");
  setTextField("E-Mail", formData.email || "");

  // === FAMILIENSTAND ===
  setCheckbox("ledig", formData.familienstand === "ledig");
  setCheckbox("verheiratet", formData.familienstand === "verheiratet");
  setCheckbox("Lebenspartnerschaft", formData.familienstand === "verheiratet"); // Fallback

  // === BESCHÄFTIGUNGSSTATUS ===
  setCheckbox("Ich bin beschäftigt", formData.viactivBeschaeftigung === "beschaeftigt");
  setCheckbox("Ich bin in Ausbildung", formData.viactivBeschaeftigung === "ausbildung");
  setCheckbox("Ich beziehe Rente", formData.viactivBeschaeftigung === "rente");
  setCheckbox("Ich bin freiwillig versichert", formData.viactivBeschaeftigung === "freiwillig_versichert");
  setCheckbox("ich studiere", formData.viactivBeschaeftigung === "studiere");
  setCheckbox("ich beziehe AL-Geld I", formData.viactivBeschaeftigung === "al_geld_1");
  setCheckbox("ich beziehe AL-Geld II", formData.viactivBeschaeftigung === "al_geld_2");
  setCheckbox("ich habe einen Minijob (bis zu 450 Euro)", formData.viactivBeschaeftigung === "minijob");
  setCheckbox("ich bin selbstständig", formData.viactivBeschaeftigung === "selbststaendig");
  setCheckbox("Einkommen über 64.350 Euro-Stand 2022", formData.viactivBeschaeftigung === "einkommen_ueber_grenze");

  // === ARBEITGEBER ===
  const ag = formData.viactivArbeitgeber;
  setTextField("Name des Arbeitgebers", ag.name || "");
  setTextField("Arbeitgeber Straße", ag.strasse || "");
  setTextField("Arbeitgeber Hausnummer", ag.hausnummer || "");
  setTextField("Arbeitgeber PLZ", ag.plz || "");
  setTextField("Arbeitgeber Ort", ag.ort || "");
  setTextField("Beschäftigt seit", formatInputDate(ag.beschaeftigtSeit) || "");

  // === BISHERIGE VERSICHERUNGSART ===
  setCheckbox("pflichtversichert", formData.viactivVersicherungsart === "pflichtversichert");
  setCheckbox("privat", formData.viactivVersicherungsart === "privat");
  setCheckbox("freiwillig versichert", formData.viactivVersicherungsart === "freiwillig_versichert");
  setCheckbox("nicht gesetzl. versichert", formData.viactivVersicherungsart === "nicht_gesetzlich");
  setCheckbox("familienversichert", formData.viactivVersicherungsart === "familienversichert");
  setCheckbox("Zuzug aus dem Ausland", formData.viactivVersicherungsart === "zuzug_ausland");

  // === BISHERIGE KRANKENKASSE ===
  setTextField("Name der letzten KrankenkasseKrankenversicherung", formData.mitgliedKrankenkasse || "");

  // === FAMILIENANGEHÖRIGE MITVERSICHERN ===
  setCheckbox("Familienangehörige sollen mitversichert werden", formData.viactivFamilienangehoerigeMitversichern);

  // === DATUM UND UNTERSCHRIFT ===
  const today = new Date();
  const datumHeute = formatDateGerman(today);
  setTextField("Datum und Unterschrift", datumHeute);

  // Unterschrift einbetten (Position basierend auf PDF-Analyse)
  if (formData.unterschrift) {
    await embedSignature(pdfDoc, formData.unterschrift, 180, 735, 0);
  }

  return await pdfDoc.save();
};

export const exportViactivBeitrittserklaerung = async (formData: FormData): Promise<void> => {
  try {
    const pdfBytes = await createViactivBeitrittserklaerungPDF(formData);
    
    // Dateiname: Viactiv_Nachname, Vorname_BE_Datum.pdf
    const today = new Date();
    const datumForFilename = formatDateGerman(today).replace(/\./g, '-');
    const nachname = formData.mitgliedName || 'Nachname';
    const vorname = formData.mitgliedVorname || 'Vorname';
    const filename = `Viactiv_${nachname}, ${vorname}_BE_${datumForFilename}.pdf`;
    
    downloadPDF(pdfBytes, filename);
  } catch (error) {
    console.error("Error exporting VIACTIV PDF:", error);
    throw error;
  }
};
