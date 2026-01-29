import { PDFDocument, rgb } from "pdf-lib";
import { FormData, FamilyMember } from "@/types/form";
import { getCountryName, getNationalityName } from "./countries";

// Helper function to format date from YYYY-MM-DD to DD.MM.YYYY
const formatInputDate = (dateStr: string): string => {
  if (!dateStr) return '';
  if (dateStr.includes('.')) return dateStr; // Already in DD.MM.YYYY format
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
};

// Helper function to format date as DD.MM.YYYY
const formatDateGerman = (date: Date): string => {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

// Calculate automatic dates for Novitas (same as BKK GS)
const calculateNovitasDates = () => {
  const today = new Date();
  const beginDate = new Date(today.getFullYear(), today.getMonth() + 3, 1);
  const endDate = new Date(beginDate.getFullYear(), beginDate.getMonth(), 0);
  
  return {
    beginDate: formatDateGerman(beginDate),  // e.g., 01.04.2026
    endDate: formatDateGerman(endDate),      // e.g., 31.03.2026
    today: formatDateGerman(today),          // e.g., 29.01.2026
  };
};

// Helper to create PDF field setters
const createPDFHelpers = (form: any) => {
  const setTextField = (fieldName: string, value: string) => {
    try {
      const field = form.getTextField(fieldName);
      if (field && value) {
        field.setText(value);
      }
    } catch (e) {
      // Field doesn't exist or error - silently ignore
    }
  };

  // Set all text fields matching pattern (for duplicate fields like KVNR. / KVNR.#0 / KVNR.#1)
  const setAllTextFields = (fieldNamePattern: string, value: string) => {
    if (!value) return;
    try {
      const allFields = form.getFields();
      allFields.forEach((field: any) => {
        const name = field.getName();
        // Match exact name OR names starting with pattern (e.g., KVNR. matches KVNR.#0, KVNR.#1)
        if (name === fieldNamePattern || name.startsWith(fieldNamePattern)) {
          try {
            const textField = form.getTextField(name);
            textField.setText(value);
          } catch {}
        }
      });
    } catch (e) {
      // Fallback to single field
      setTextField(fieldNamePattern, value);
    }
  };

  const setCheckbox = (fieldName: string, checked: boolean) => {
    try {
      const field = form.getCheckBox(fieldName);
      if (field && checked) {
        field.check();
      }
    } catch (e) {
      // Field doesn't exist or error - silently ignore
    }
  };

  // NEW: RadioButton helper - PDF RadioButtons use getRadioGroup().select()
  const setRadioButton = (groupName: string, option: string) => {
    if (!option) return;
    try {
      const radioGroup = form.getRadioGroup(groupName);
      if (radioGroup) {
        radioGroup.select(option);
      }
    } catch (e) {
      // Fallback: try as checkbox (some PDFs mix these)
      try {
        setCheckbox(`${groupName}.${option}`, true);
      } catch {}
    }
  };

  return { setTextField, setAllTextFields, setCheckbox, setRadioButton };
};

// Fill basic member fields
const fillBasicFields = (
  formData: FormData, 
  helpers: ReturnType<typeof createPDFHelpers>,
  dates: ReturnType<typeof calculateNovitasDates>
) => {
  const { setTextField, setAllTextFields, setRadioButton } = helpers;
  
  // Member data
  setTextField("NameGesamt", `${formData.mitgliedVorname} ${formData.mitgliedName}`);
  
  // KVNR exists on multiple pages - set ALL instances (try both patterns)
  setAllTextFields("KVNR.", formData.mitgliedKvNummer);
  setAllTextFields("KVNR", formData.mitgliedKvNummer); // Fallback without dot
  
  setTextField("fna_BeginnFamiVers", dates.beginDate);
  setTextField("fna_Telefon", formData.telefon);
  setTextField("fna_Email", formData.email);
  setTextField("datum", dates.today);
  
  // Familienstand - use RadioButton (not Checkbox!)
  const familienstandMap: Record<string, string> = {
    ledig: 'L',
    verheiratet: 'V',
    getrennt: 'GL',
    geschieden: 'G',
    verwitwet: 'W'
  };
  if (formData.familienstand && familienstandMap[formData.familienstand]) {
    setRadioButton("fna_Famstand", familienstandMap[formData.familienstand]);
  }
  
  // Abgabegrund: ALWAYS "Beginn meiner Mitgliedschaft" - RadioButton!
  setRadioButton("abgabegrund", "B");
};

// Fill spouse fields
const fillSpouseFields = (
  formData: FormData,
  helpers: ReturnType<typeof createPDFHelpers>,
  dates: ReturnType<typeof calculateNovitasDates>
) => {
  const { setTextField, setRadioButton } = helpers;
  const ehegatte = formData.ehegatte;
  
  if (!ehegatte.name && !ehegatte.vorname) return;
  
  // Basic data
  setTextField("fna_PartnerName", ehegatte.name);
  setTextField("fna_PartnerVorname", ehegatte.vorname);
  
  // Gender - RadioButton!
  if (ehegatte.geschlecht) {
    setRadioButton("fna_PartnerGeschlecht", ehegatte.geschlecht);
  }
  
  setTextField("fna_PartnerGebdat", formatInputDate(ehegatte.geburtsdatum));
  
  // NOTE: No Versichertennummer field exists in Novitas PDF for spouse - removed
  
  // Address fields if deviating address exists
  if (ehegatte.abweichendeAnschrift) {
    const addressParts = ehegatte.abweichendeAnschrift.split(',');
    if (addressParts.length >= 2) {
      const plzOrt = addressParts[1].trim().split(' ');
      if (plzOrt.length >= 2) {
        setTextField("fna_PartnerPlz", plzOrt[0]);
        setTextField("fna_PartnerOrt", plzOrt.slice(1).join(' '));
      }
    }
  }
  
  // Previous insurance
  setTextField("fna_PartnerVersBis", dates.endDate);
  
  // Wenn "besteht weiter" aktiviert: Wert aus bisherigBestehtWeiterBei nehmen
  // Ansonsten: Fallback auf bisherigBestandBei oder mitgliedKrankenkasse
  if (ehegatte.bisherigBestehtWeiter && ehegatte.bisherigBestehtWeiterBei) {
    setTextField("fna_PartnerNameAltkasse", ehegatte.bisherigBestehtWeiterBei);
  } else {
    setTextField("fna_PartnerNameAltkasse", ehegatte.bisherigBestandBei || formData.mitgliedKrankenkasse);
  }
  
  // Insurance type - RadioButton!
  const versArtMap: Record<string, string> = {
    mitgliedschaft: 'GesetzlichMitglied',
    familienversicherung: 'GesetzlichFAMI',
    nicht_gesetzlich: 'NichtGesetzlich'
  };
  if (ehegatte.bisherigArt && versArtMap[ehegatte.bisherigArt]) {
    setRadioButton("fna_PartnerVersArt", versArtMap[ehegatte.bisherigArt]);
  }
  
  // If family insurance: sync first/last name from main member
  if (ehegatte.bisherigArt === 'familienversicherung') {
    setTextField("famv_vorname_bisher_kv_partner", formData.mitgliedVorname);
    setTextField("famv_name_bisher_kv_partner", formData.mitgliedName);
  }
  
  // Current Kasse if continues
  if (ehegatte.bisherigBestehtWeiter) {
    setTextField("fna_PartnerAktuelleKasse", ehegatte.bisherigBestehtWeiterBei);
  }
  
  // Personal data (WITHOUT RV-Nummer!)
  setTextField("fna_PartnerGeburtsname", ehegatte.geburtsname || ehegatte.name);
  setTextField("fna_PartnerGeburtsort", ehegatte.geburtsort);
  setTextField("fna_PartnerGeburtsland", getCountryName(ehegatte.geburtsland));
  setTextField("fna_PartnerStaatsangehoerigkeit", getNationalityName(ehegatte.staatsangehoerigkeit));
};

// Fill child fields for a single child
const fillChildFields = (
  kind: FamilyMember,
  index: number,
  formData: FormData,
  helpers: ReturnType<typeof createPDFHelpers>,
  dates: ReturnType<typeof calculateNovitasDates>
) => {
  const { setTextField, setRadioButton } = helpers;
  const i = index + 1; // 1-based index
  
  if (!kind.name && !kind.vorname) return;
  
  // Basic data (Page 2)
  setTextField(`name_kind_${i}`, kind.name);
  setTextField(`vorname_kind_${i}`, kind.vorname);
  
  // Gender - RadioButton!
  if (kind.geschlecht) {
    setRadioButton(`geschlecht_kind_${i}`, kind.geschlecht);
  }
  
  setTextField(`gebdat_kind_${i}`, formatInputDate(kind.geburtsdatum));
  
  // bw_strasse_kind is for DEVIATING ADDRESS, NOT Versichertennummer!
  // Only fill if child has a different address than member
  if (kind.abweichendeAnschrift) {
    setTextField(`bw_strasse_kind_${i}`, kind.abweichendeAnschrift);
    const addressParts = kind.abweichendeAnschrift.split(',');
    if (addressParts.length >= 2) {
      const plzOrt = addressParts[1].trim().split(' ');
      if (plzOrt.length >= 2) {
        setTextField(`fna_KindPlz_${i}`, plzOrt[0]);
        setTextField(`fna_KindOrt_${i}`, plzOrt.slice(1).join(' '));
      }
    }
  }
  
  // Relationship - RadioButton!
  const verwandtschaftMap: Record<string, string> = { 
    leiblich: 'L', 
    stief: 'S', 
    enkel: 'E', 
    pflege: 'P' 
  };
  if (kind.verwandtschaft && verwandtschaftMap[kind.verwandtschaft]) {
    setRadioButton(`fna_KindVerwandt_${i}`, verwandtschaftMap[kind.verwandtschaft]);
  }
  
  // Page 3 - Previous insurance
  setTextField(`famv_bisher_kind_${i}`, dates.endDate);
  
  // Wenn "besteht weiter" aktiviert: Wert aus bisherigBestehtWeiterBei nehmen
  // Ansonsten: Fallback auf bisherigBestandBei oder mitgliedKrankenkasse
  if (kind.bisherigBestehtWeiter && kind.bisherigBestehtWeiterBei) {
    setTextField(`famv_kv_kind_${i}`, kind.bisherigBestehtWeiterBei);
  } else {
    setTextField(`famv_kv_kind_${i}`, kind.bisherigBestandBei || formData.mitgliedKrankenkasse);
  }
  
  // Children are ALWAYS family insured - RadioButton!
  setRadioButton(`angabe_eigene_kv_kind_${i}`, "GesetzlichFAMI");
  
  // AUTO-SYNC: Vorname/Nachname des Hauptmitglieds
  setTextField(`famv_vorname_bisher_kv_kind_${i}`, formData.mitgliedVorname);
  setTextField(`famv_name_bisher_kv_kind_${i}`, formData.mitgliedName);
  
  // Personal data (WITHOUT RV-Nummer!)
  setTextField(`geburtsname_kind_${i}`, kind.geburtsname || kind.name);
  setTextField(`geburtsort_kind_${i}`, kind.geburtsort);
  setTextField(`geburtsland_kind_${i}`, getCountryName(kind.geburtsland));
  setTextField(`staatsangehoerigkeit_kind_${i}`, getNationalityName(kind.staatsangehoerigkeit));
};

// Add signature to PDF
const addSignature = async (
  pdfDoc: PDFDocument,
  signatureDataUrl: string,
  pageIndex: number,
  x: number,
  y: number,
  width: number,
  height: number
) => {
  if (!signatureDataUrl) return;
  
  try {
    const signatureImageBytes = await fetch(signatureDataUrl).then(res => res.arrayBuffer());
    const signatureImage = await pdfDoc.embedPng(signatureImageBytes);
    
    const pages = pdfDoc.getPages();
    const page = pages[pageIndex];
    
    page.drawImage(signatureImage, {
      x,
      y: page.getHeight() - y - height,
      width,
      height,
    });
  } catch (e) {
    console.error("Error adding signature:", e);
  }
};

// Create single Novitas family insurance PDF
const createNovitasFamilyPDF = async (
  formData: FormData,
  childrenSubset: FamilyMember[]
): Promise<Uint8Array> => {
  // Load template
  const templateUrl = '/novitas-familienversicherung.pdf';
  const existingPdfBytes = await fetch(templateUrl).then(res => res.arrayBuffer());
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const form = pdfDoc.getForm();
  
  const helpers = createPDFHelpers(form);
  const dates = calculateNovitasDates();
  
  // Fill all fields
  fillBasicFields(formData, helpers, dates);
  fillSpouseFields(formData, helpers, dates);
  
  // Fill children (max 3 per PDF)
  childrenSubset.forEach((kind, index) => {
    if (index < 3) {
      fillChildFields(kind, index, formData, helpers, dates);
    }
  });
  
  // Add signatures on page 3 (index 2)
  // Signature positions - near the "datum" field
  if (formData.unterschrift) {
    await addSignature(pdfDoc, formData.unterschrift, 2, 170, 690, 100, 30);
  }
  if (formData.unterschriftFamilie) {
    await addSignature(pdfDoc, formData.unterschriftFamilie, 2, 380, 690, 100, 30);
  }
  
  // DO NOT flatten - keep PDF editable!
  // form.flatten(); // REMOVED
  
  return await pdfDoc.save();
};

// Download helper
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

// Main export function with multi-PDF support for >3 children
export const exportNovitasFamilienversicherung = async (formData: FormData): Promise<void> => {
  const children = formData.kinder;
  const numberOfPDFs = Math.max(1, Math.ceil(children.length / 3));
  
  for (let pdfIndex = 0; pdfIndex < numberOfPDFs; pdfIndex++) {
    const childrenForThisPDF = children.slice(pdfIndex * 3, (pdfIndex + 1) * 3);
    const pdfBytes = await createNovitasFamilyPDF(formData, childrenForThisPDF);
    
    const sanitizedVorname = formData.mitgliedVorname.replace(/[^a-zA-ZäöüÄÖÜß]/g, '_');
    const sanitizedName = formData.mitgliedName.replace(/[^a-zA-ZäöüÄÖÜß]/g, '_');
    
    const filename = numberOfPDFs > 1 
      ? `Novitas_Familienversicherung_${sanitizedVorname}_${sanitizedName}_Teil${pdfIndex + 1}.pdf`
      : `Novitas_Familienversicherung_${sanitizedVorname}_${sanitizedName}.pdf`;
    
    downloadPDF(pdfBytes, filename);
  }
};
