import { PDFDocument } from "pdf-lib";
import { FormData, FamilyMember } from "@/types/form";

/**
 * VIACTIV Familienversicherung PDF Export
 * Dateiname: Viactiv_Nachname, Vorname_Familienversicherung_Datum.pdf
 * 
 * Bei mehr als 3 Kindern werden mehrere PDFs erstellt (max. 3 Kinder pro PDF)
 */

/**
 * Formatiert Eingabe-Datum zu TT.MM.JJJJ (mit Punkten für Familienversicherung)
 */
const formatInputDate = (dateStr: string): string => {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  // Format: TT.MM.JJJJ (mit Punkten für Familienversicherung PDF)
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
};

const formatDateGermanWithDots = (date: Date): string => {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

interface PDFHelpers {
  setTextField: (fieldName: string, value: string) => void;
  setCheckbox: (fieldName: string, checked: boolean) => void;
}

const createPDFHelpers = (form: ReturnType<PDFDocument["getForm"]>): PDFHelpers => {
  const trySetTextField = (fieldNames: string[], value: string): boolean => {
    if (!value) {
      return false;
    }
    
    for (const fieldName of fieldNames) {
      try {
        const field = form.getTextField(fieldName);
        if (field) {
          field.setText(value);
          console.log(`VIACTIV Family Field set: "${fieldName}" = "${value}"`);
          return true;
        }
      } catch (e) {
        // Try next variation
      }
    }
    console.warn(`VIACTIV Family Field NOT FOUND: ${fieldNames.join(' / ')}`);
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
          console.log(`VIACTIV Family Checkbox set: "${name}" = ${checked}`);
          return;
        }
      } catch (e) {
        // Try next variation
      }
    }
    console.warn(`VIACTIV Family Checkbox NOT FOUND: ${fieldName}`);
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

/**
 * Mappt Geschlecht-Wert zu Checkbox-Name
 */
const getGeschlechtCheckboxName = (geschlecht: string, prefix: string): string | null => {
  switch (geschlecht) {
    case 'm': return `${prefix}_männlich`;
    case 'w': return `${prefix}_weiblich`;
    case 'x': return `${prefix} nicht definiertes Geschlecht`;
    case 'd': return `${prefix} divers`;
    default: return null;
  }
};

/**
 * Mappt Verwandtschaft-Wert zu Checkbox-Name
 */
const getVerwandtschaftCheckboxName = (verwandtschaft: string, kindIndex: number): string | null => {
  const suffix = kindIndex === 0 ? '' : `_${kindIndex + 1}`;
  switch (verwandtschaft) {
    case 'leiblich': return `leibliches Kind${suffix}`;
    case 'stief': return `Stiefkind${suffix}`;
    case 'enkel': return `Enkelkind${suffix}`;
    case 'pflege': return `Pflegekind${suffix}`;
    default: return null;
  }
};

/**
 * Erstellt ein einzelnes Familienversicherung PDF
 */
const createViactivFamilyPDF = async (
  formData: FormData,
  childrenForPdf: FamilyMember[],
  pdfIndex: number
): Promise<Uint8Array> => {
  const pdfUrl = "/viactiv-familienversicherung.pdf";
  const existingPdfBytes = await fetch(pdfUrl).then((res) => res.arrayBuffer());
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const form = pdfDoc.getForm();
  
  // Debug: List all field names
  const fields = form.getFields();
  if (pdfIndex === 1) {
    console.log("=== VIACTIV Family PDF Fields ===");
    fields.forEach(field => {
      console.log(`Field: "${field.getName()}" - Type: ${field.constructor.name}`);
    });
    console.log("=== END VIACTIV Family PDF Fields ===");
  }
  
  const helpers = createPDFHelpers(form);
  const { setTextField, setCheckbox } = helpers;

  // === ANTRAGSTELLER DATEN (Seite 1, oben) ===
  setTextField("Titel Name", formData.mitgliedName);
  setTextField("Vorname", formData.mitgliedVorname);

  // === FAMILIENSTAND ===
  setCheckbox("Familienstand ledig", formData.familienstand === "ledig");
  setCheckbox("Familienstand verheiratet", formData.familienstand === "verheiratet");
  setCheckbox("Familienstand getrennt lebend", formData.familienstand === "getrennt");
  setCheckbox("Familienstand geschieden", formData.familienstand === "geschieden");
  setCheckbox("Familienstand verwitwet", formData.familienstand === "verwitwet");
  setCheckbox("eingetragene Lebenspartnerschaft", formData.familienstand === "verheiratet");

  // === EHEPARTNER/-IN SELBST VERSICHERT ===
  const ehegatteSelbstVersichert = formData.ehegatte.bisherigArt === 'mitgliedschaft';
  setCheckbox("Selbst versichert nein", !ehegatteSelbstVersichert);
  setCheckbox("Selbst versichert ja", ehegatteSelbstVersichert);
  if (ehegatteSelbstVersichert) {
    setTextField("Ja, versichert bei", formData.ehegatte.bisherigBestehtWeiterBei || "");
  }

  // === EHEPARTNER DATEN ===
  const ehegatte = formData.ehegatte;
  if (ehegatte.name || ehegatte.vorname) {
    setTextField("Ehepartner/-in Name", ehegatte.name);
    setTextField("Ehepartner/-in Vorname", ehegatte.vorname);
    setTextField("Geburtsdatum_Eheparter/-in TTMMJJJJ", formatInputDate(ehegatte.geburtsdatum));
    
    // Geschlecht Ehepartner
    setCheckbox("Ehepartner/-in_männlich", ehegatte.geschlecht === 'm');
    setCheckbox("Ehepartner/-in_weiblich", ehegatte.geschlecht === 'w');
    setCheckbox("Ehepartner/-in nicht definiertes Geschlecht", ehegatte.geschlecht === 'x');
    setCheckbox("Ehepartner/-in divers", ehegatte.geschlecht === 'd');
    
    setTextField("Ehepartner/-in Geburtsname", ehegatte.geburtsname || ehegatte.name);
    setTextField("Ehepartner/-in Geburtsort_Geburtsland", ehegatte.geburtsort || "");
    setTextField("Ehepartner/-in Staatsangehörigkeit", ehegatte.staatsangehoerigkeit || "");
    setTextField("Ehepartner/-in abweichende Anschrift", ehegatte.abweichendeAnschrift || "");
    
    // Seite 2: Bisherige Versicherung Ehepartner
    setTextField("EhepartnerinDie bisherige Versicherung endete am", ehegatte.bisherigEndeteAm || "");
    setTextField("EhepartnerinDie Versicherung bestand bei Name der Krankenkasse", ehegatte.bisherigBestandBei || "");
    
    // Versicherungsart Ehepartner
    setCheckbox("Ehepartner/-in Mitgliedschaft", ehegatte.bisherigArt === 'mitgliedschaft');
    setCheckbox("Ehepartner/-in familienversichert", ehegatte.bisherigArt === 'familienversicherung');
    setCheckbox("Ehepartner/-in nicht gesetzlich", ehegatte.bisherigArt === 'nicht_gesetzlich');
  }

  // === KINDER DATEN (max. 3 pro PDF) ===
  const kindFieldNames = [
    { name: "Kind_Name", vorname: "Kind Vorname", geb: "Geburtsdatum_Kind TTMMJJJJ", gebName: "Kind Geburtsname", 
      gebOrt: "Kind Geburtsort_Geburtsland", staat: "Kind Staatsangehörigkeit", anschrift: "Kind abweichende Anschrift",
      endete: "KindDie bisherige Versicherung endete am", bestand: "KindDie Versicherung bestand bei Name der Krankenkasse",
      mitglied: "Kind Mitgliedschaft", familie: "Kind familienversichert", nichtGes: "Kind nicht gesetzlich",
      maennlich: "Kind_männlich", weiblich: "Kind_weiblich", unbestimmt: "Kind nicht definiertes Geschlecht", divers: "Kind divers" },
    { name: "Kind_Name_2", vorname: "Kind_Vorname_2", geb: "Geburtsdatum_Kind_2 TTMMJJJJ", gebName: "Kind_2 Geburtsname",
      gebOrt: "Kind_2 Geburtsort_Geburtsland", staat: "Kind_2 Staatsangehörigkeit", anschrift: "Kind_2 abweichende Anschrift",
      endete: "KindDie bisherige Versicherung endete am_2", bestand: "KindDie Versicherung bestand bei Name der Krankenkasse_2",
      mitglied: "Kind_2 Mitgliedschaft", familie: "Kind_2 familienversichert", nichtGes: "Kind_2 nicht gesetzlich",
      maennlich: "Kind_2_männlich", weiblich: "Kind_2_weiblich", unbestimmt: "Kind_2 nicht definiertes Geschlecht", divers: "Kind_2 divers" },
    { name: "KindName_3", vorname: "Kind_Vorname_3", geb: "Geburtsdatum_Kind_3 TTMMJJJJ", gebName: "Kind_3 Geburtsname",
      gebOrt: "Kind_3 Geburtsort_Geburtsland", staat: "Kind_3 Staatsangehörigkeit", anschrift: "Kind_3 abweichende Anschrift",
      endete: "KindDie bisherige Versicherung endete am_3", bestand: "KindDie Versicherung bestand bei Name der Krankenkasse_3",
      mitglied: "Kind_3 Mitgliedschaft", familie: "Kind_3 familienversichert", nichtGes: "Kind_3 nicht gesetzlich",
      maennlich: "Kind_3_männlich", weiblich: "Kind_3_weiblich", unbestimmt: "Kind_3 nicht definiertes Geschlecht", divers: "Kind_3 divers" }
  ];

  const verwandtschaftFields = [
    { leiblich: "leibliches Kind", stief: "Stiefkind", enkel: "Enkelkind", pflege: "Pflegekind" },
    { leiblich: "leibliches Kind_2", stief: "Stiefkind_2", enkel: "Enkelkind_2", pflege: "Pflegekind_2" },
    { leiblich: "leibliches Kind_3", stief: "Stiefkind_3", enkel: "Enkelkind_3", pflege: "Pflegekind_3" }
  ];

  childrenForPdf.forEach((kind, index) => {
    if (index >= 3) return; // Max 3 Kinder pro PDF
    
    const fields = kindFieldNames[index];
    const verwFields = verwandtschaftFields[index];
    
    setTextField(fields.name, kind.name);
    setTextField(fields.vorname, kind.vorname);
    setTextField(fields.geb, formatInputDate(kind.geburtsdatum));
    
    // Geschlecht Kind
    setCheckbox(fields.maennlich, kind.geschlecht === 'm');
    setCheckbox(fields.weiblich, kind.geschlecht === 'w');
    setCheckbox(fields.unbestimmt, kind.geschlecht === 'x');
    setCheckbox(fields.divers, kind.geschlecht === 'd');
    
    setTextField(fields.gebName, kind.geburtsname || kind.name);
    setTextField(fields.gebOrt, kind.geburtsort || "");
    setTextField(fields.staat, kind.staatsangehoerigkeit || "");
    setTextField(fields.anschrift, kind.abweichendeAnschrift || "");
    
    // Verwandtschaft
    setCheckbox(verwFields.leiblich, kind.verwandtschaft === 'leiblich');
    setCheckbox(verwFields.stief, kind.verwandtschaft === 'stief');
    setCheckbox(verwFields.enkel, kind.verwandtschaft === 'enkel');
    setCheckbox(verwFields.pflege, kind.verwandtschaft === 'pflege');
    
    // Bisherige Versicherung Kind
    setTextField(fields.endete, kind.bisherigEndeteAm || "");
    setTextField(fields.bestand, kind.bisherigBestandBei || "");
    
    // Versicherungsart Kind
    setCheckbox(fields.mitglied, kind.bisherigArt === 'mitgliedschaft');
    setCheckbox(fields.familie, kind.bisherigArt === 'familienversicherung');
    setCheckbox(fields.nichtGes, kind.bisherigArt === 'nicht_gesetzlich');
  });

  // === DATUM UND UNTERSCHRIFT (Seite 2) ===
  const today = new Date();
  setTextField("Datum", formatDateGermanWithDots(today));

  // Unterschrift des Mitglieds
  if (formData.unterschrift) {
    await embedSignature(pdfDoc, formData.unterschrift, 180, 760, 1);
  }

  // Unterschrift der Familienangehörigen
  if (formData.unterschriftFamilie) {
    await embedSignature(pdfDoc, formData.unterschriftFamilie, 410, 760, 1);
  }

  return await pdfDoc.save();
};

/**
 * Exportiert VIACTIV Familienversicherung PDF(s)
 * Bei mehr als 3 Kindern werden mehrere PDFs erstellt
 */
export const exportViactivFamilienversicherung = async (formData: FormData): Promise<void> => {
  if (!formData.viactivFamilienangehoerigeMitversichern) {
    console.log("Familienversicherung nicht aktiviert, kein PDF erstellt");
    return;
  }

  const children = formData.kinder;
  const numberOfPDFs = Math.max(1, Math.ceil(children.length / 3));
  
  const today = new Date();
  const datumForFilename = formatDateGermanWithDots(today).replace(/\./g, '-');
  const nachname = formData.mitgliedName || 'Nachname';
  const vorname = formData.mitgliedVorname || 'Vorname';
  const baseFilename = `Viactiv_${nachname}, ${vorname}_Familienversicherung_${datumForFilename}`;

  try {
    for (let pdfIndex = 0; pdfIndex < numberOfPDFs; pdfIndex++) {
      const startChildIndex = pdfIndex * 3;
      const childrenForThisPDF = children.slice(startChildIndex, startChildIndex + 3);

      const pdfBytes = await createViactivFamilyPDF(formData, childrenForThisPDF, pdfIndex + 1);

      const filename = numberOfPDFs > 1 
        ? `${baseFilename}_Teil${pdfIndex + 1}.pdf` 
        : `${baseFilename}.pdf`;

      downloadPDF(pdfBytes, filename);

      // Kleine Verzögerung zwischen Downloads
      if (pdfIndex < numberOfPDFs - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  } catch (error) {
    console.error("Error exporting VIACTIV Familienversicherung PDF:", error);
    throw error;
  }
};
