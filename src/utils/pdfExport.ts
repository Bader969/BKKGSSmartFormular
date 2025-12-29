import { PDFDocument } from 'pdf-lib';
import { FormData } from '@/types/form';
import { calculateDates } from './dateUtils';

const formatInputDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
};

export const exportFilledPDF = async (formData: FormData): Promise<void> => {
  try {
    // Load the original PDF
    const pdfUrl = '/familienversicherung.pdf';
    const existingPdfBytes = await fetch(pdfUrl).then(res => res.arrayBuffer());
    
    // Load the PDF document with form fields
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const form = pdfDoc.getForm();
    
    const { beginDate, endDate } = calculateDates();
    const datumFormatted = formatInputDate(formData.datum);
    
    // Helper function to safely set text field
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
    
    // Helper function to safely set checkbox
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
    
    // === PAGE 1 - Header Fields ===
    // Vorname Mitglied (top right)
    setTextField('Vorname Mitglied', `${formData.mitgliedVorname} ${formData.mitgliedName}`);
    
    // KV-Nummer (top right)
    setTextField('KV-Nummer', formData.mitgliedKvNummer || '');
    
    // === "Ich war bisher" ===
    // 01 = "im Rahmen einer eigenen Mitgliedschaft" - ALWAYS checked
    setCheckbox('01', true);
    setCheckbox('02', false);
    setCheckbox('03', false);
    
    // === Familienstand ===
    // 04=ledig, 05=verheiratet, 06=getrennt, 07=geschieden, 08=verwitwet
    setCheckbox('04', formData.familienstand === 'ledig');
    setCheckbox('05', formData.familienstand === 'verheiratet');
    setCheckbox('06', formData.familienstand === 'getrennt');
    setCheckbox('07', formData.familienstand === 'geschieden');
    setCheckbox('08', formData.familienstand === 'verwitwet');
    
    // === "Anlass für die Aufnahme" ===
    // 10 = "Beginn meiner Mitgliedschaft" - ALWAYS checked
    setCheckbox('09', false);  // LPartG
    setCheckbox('10', true);   // Beginn meiner Mitgliedschaft
    setCheckbox('11', false);
    setCheckbox('12', false);
    setCheckbox('13', false);
    setCheckbox('14', false);
    
    // === Beginn der Familienversicherung ===
    setTextField('Beginn FamiVersicherung', beginDate);
    
    // === Telefon ===
    if (formData.telefon) {
      setTextField('Rückfrage Telefon-Nr', formData.telefon);
    }
    
    // === E-Mail ===
    if (formData.email) {
      setTextField('E-Mail', formData.email);
    }
    
    // === "Informationsblatt erhalten: ja" ===
    // 15=ja, 16=nein
    setCheckbox('15', true);
    setCheckbox('16', false);
    
    // === TABELLE: Allgemeine Angaben zu Familienangehörigen ===
    
    // --- Ehegatte/Partner ---
    if (formData.ehegatte.name || formData.ehegatte.vorname) {
      setTextField('Ehegatte Name', formData.ehegatte.name);
      setTextField('Ehegatte Vorname', formData.ehegatte.vorname);
      
      // Geschlecht: m1=männlich, w1=weiblich, x1=unbestimmt, d1=divers
      setCheckbox('m1', formData.ehegatte.geschlecht === 'm');
      setCheckbox('w1', formData.ehegatte.geschlecht === 'w');
      setCheckbox('x1', formData.ehegatte.geschlecht === 'x');
      setCheckbox('d1', formData.ehegatte.geschlecht === 'd');
      
      // Geburtsdatum
      if (formData.ehegatte.geburtsdatum) {
        setTextField('Ehegatte GebDatum', formatInputDate(formData.ehegatte.geburtsdatum));
      }
      
      // KV-Nummer in "abweichende Anschrift" field
      if (formData.ehegatte.abweichendeAnschrift) {
        setTextField('Ehegatte Anschrift', formData.ehegatte.abweichendeAnschrift);
      }
    }
    
    // --- Kind 1 ---
    if (formData.kinder[0] && (formData.kinder[0].name || formData.kinder[0].vorname)) {
      const kind = formData.kinder[0];
      setTextField('Kind 1 Name', kind.name);
      setTextField('Kind 1 Vorname', kind.vorname);
      
      // Geschlecht
      setCheckbox('m2', kind.geschlecht === 'm');
      setCheckbox('w2', kind.geschlecht === 'w');
      setCheckbox('x2', kind.geschlecht === 'x');
      setCheckbox('d2', kind.geschlecht === 'd');
      
      if (kind.geburtsdatum) {
        setTextField('Kind1 GebDatum', formatInputDate(kind.geburtsdatum));
      }
      
      if (kind.abweichendeAnschrift) {
        setTextField('Kind1 Anschrift', kind.abweichendeAnschrift);
      }
      
      // Verwandtschaftsverhältnis
      setCheckbox('leibliches Kind1', kind.verwandtschaft === 'leiblich');
      setCheckbox('Stiefkind1', kind.verwandtschaft === 'stief');
      setCheckbox('Enkel1', kind.verwandtschaft === 'enkel');
      setCheckbox('Pflegekind1', kind.verwandtschaft === 'pflege');
    }
    
    // --- Kind 2 ---
    if (formData.kinder[1] && (formData.kinder[1].name || formData.kinder[1].vorname)) {
      const kind = formData.kinder[1];
      setTextField('Kind 2 Name', kind.name);
      setTextField('Kind 2 Vorname', kind.vorname);
      
      setCheckbox('m3', kind.geschlecht === 'm');
      setCheckbox('w3', kind.geschlecht === 'w');
      setCheckbox('x3', kind.geschlecht === 'x');
      setCheckbox('d3', kind.geschlecht === 'd');
      
      if (kind.geburtsdatum) {
        setTextField('Kind2 GebDatum', formatInputDate(kind.geburtsdatum));
      }
      
      if (kind.abweichendeAnschrift) {
        setTextField('Kind2 Anschrift', kind.abweichendeAnschrift);
      }
      
      setCheckbox('leibliches Kind2', kind.verwandtschaft === 'leiblich');
      setCheckbox('Stiefkind2', kind.verwandtschaft === 'stief');
      setCheckbox('Enkel2', kind.verwandtschaft === 'enkel');
      setCheckbox('Pflegekind2', kind.verwandtschaft === 'pflege');
    }
    
    // --- Kind 3 ---
    if (formData.kinder[2] && (formData.kinder[2].name || formData.kinder[2].vorname)) {
      const kind = formData.kinder[2];
      setTextField('Kind 3 Name', kind.name);
      setTextField('Kind 3 Vorname', kind.vorname);
      
      setCheckbox('m4', kind.geschlecht === 'm');
      setCheckbox('w4', kind.geschlecht === 'w');
      setCheckbox('x4', kind.geschlecht === 'x');
      setCheckbox('d4', kind.geschlecht === 'd');
      
      if (kind.geburtsdatum) {
        setTextField('Kind3 GebDatum', formatInputDate(kind.geburtsdatum));
      }
      
      if (kind.abweichendeAnschrift) {
        setTextField('Kind3 Anschrift', kind.abweichendeAnschrift);
      }
      
      setCheckbox('leibliches Kind3', kind.verwandtschaft === 'leiblich');
      setCheckbox('Stiefkind3', kind.verwandtschaft === 'stief');
      setCheckbox('Enkel3', kind.verwandtschaft === 'enkel');
      setCheckbox('Pflegekind3', kind.verwandtschaft === 'pflege');
    }
    
    // === PAGE 2: Angaben zur bisherigen Versicherung ===
    
    // --- Ehegatte ---
    if (formData.ehegatte.name || formData.ehegatte.vorname) {
      // Bisherige Versicherung endete am
      setTextField('Ehegatte - letzte Vers endet am', endDate);
      
      // Familienversichert - ALWAYS checked
      setCheckbox('Ehegatte Fami', true);
      setCheckbox('Ehegatte MG', false);
      setCheckbox('Ehegatte nicht gesetzlich', false);
      
      // "KK bleibt" - Besteht weiter bei
      if (formData.ehegatte.bisherigBestehtWeiter && formData.ehegatte.bisherigBestehtWeiterBei) {
        setTextField('KK bleibt', formData.ehegatte.bisherigBestehtWeiterBei);
      }
    }
    
    // --- Kind 1 ---
    if (formData.kinder[0] && (formData.kinder[0].name || formData.kinder[0].vorname)) {
      setTextField('Kind1 - letzte Vers endet am', endDate);
      setCheckbox('Kind1 Fami', true);
      setCheckbox('Kind1 MG', false);
      setCheckbox('Kind1 nicht gesetzlich', false);
    }
    
    // --- Kind 2 ---
    if (formData.kinder[1] && (formData.kinder[1].name || formData.kinder[1].vorname)) {
      setTextField('Kind2 - letzte Vers endet am', endDate);
      setCheckbox('Kind2 Fami', true);
      setCheckbox('Kind2 MG', false);
      setCheckbox('Kind2 nicht gesetzlich', false);
    }
    
    // --- Kind 3 ---
    if (formData.kinder[2] && (formData.kinder[2].name || formData.kinder[2].vorname)) {
      setTextField('Kind3 - letzte Vers endet am', endDate);
      setCheckbox('Kind3 Fami', true);
      setCheckbox('Kind3 MG', false);
      setCheckbox('Kind3 nicht gesetzlich', false);
    }
    
    // === Ort, Datum ===
    setTextField('Ort, Datum', `${formData.ort}, ${datumFormatted}`);
    
    // === Unterschrift ===
    // For the signature, we need to draw it directly on the page since it's not a form field
    if (formData.unterschrift) {
      try {
        const pages = pdfDoc.getPages();
        const secondPage = pages[1];
        const { height } = secondPage.getSize();
        
        const signatureImage = await pdfDoc.embedPng(formData.unterschrift);
        const sigDims = signatureImage.scale(0.25);
        
        secondPage.drawImage(signatureImage, {
          x: 200,
          y: height - 715,
          width: Math.min(sigDims.width, 140),
          height: Math.min(sigDims.height, 45),
        });
      } catch (e) {
        console.error('Could not embed signature:', e);
      }
    }
    
    // Flatten form to make fields non-editable (optional)
    // form.flatten();
    
    // PDF speichern und herunterladen
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `Familienversicherung_${formData.mitgliedName || 'Antrag'}_${datumFormatted.replace(/\./g, '-')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
  } catch (error) {
    console.error('Error exporting PDF:', error);
    throw error;
  }
};
