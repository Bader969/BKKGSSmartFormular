import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
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
    
    // Load the PDF document
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const secondPage = pages[1];
    
    const { height } = firstPage.getSize();
    const fontSize = 9;
    const smallFontSize = 8;
    const textColor = rgb(0, 0, 0);
    
    const { beginDate, endDate } = calculateDates();
    
    // === PAGE 1 - Top Right Box ===
    // Vorname Name des Mitglieds
    firstPage.drawText(`${formData.mitgliedVorname} ${formData.mitgliedName}`, {
      x: 470,
      y: height - 28,
      size: smallFontSize,
      font: helvetica,
      color: textColor,
    });
    
    // KV-Nummer (top right)
    if (formData.mitgliedKvNummer) {
      firstPage.drawText(formData.mitgliedKvNummer, {
        x: 470,
        y: height - 42,
        size: smallFontSize,
        font: helvetica,
        color: textColor,
      });
    }
    
    // === "Ich war bisher" - "im Rahmen einer eigenen Mitgliedschaft" checkbox ===
    firstPage.drawText('X', {
      x: 78,
      y: height - 107,
      size: 11,
      font: helveticaBold,
      color: textColor,
    });
    
    // === Familienstand checkboxes ===
    const familienstandPositions: Record<string, { x: number; y: number }> = {
      'ledig': { x: 173, y: height - 127 },
      'verheiratet': { x: 214, y: height - 127 },
      'getrennt': { x: 278, y: height - 127 },
      'geschieden': { x: 355, y: height - 127 },
      'verwitwet': { x: 418, y: height - 127 },
    };
    
    if (formData.familienstand && familienstandPositions[formData.familienstand]) {
      const pos = familienstandPositions[formData.familienstand];
      firstPage.drawText('X', {
        x: pos.x,
        y: pos.y,
        size: 11,
        font: helveticaBold,
        color: textColor,
      });
    }
    
    // === "Anlass für die Aufnahme" - "Beginn meiner Mitgliedschaft" checkbox ===
    firstPage.drawText('X', {
      x: 78,
      y: height - 183,
      size: 11,
      font: helveticaBold,
      color: textColor,
    });
    
    // === Beginn der Familienversicherung ===
    firstPage.drawText(beginDate, {
      x: 280,
      y: height - 213,
      size: fontSize,
      font: helvetica,
      color: textColor,
    });
    
    // === Telefon (optional) ===
    if (formData.telefon) {
      firstPage.drawText(formData.telefon, {
        x: 295,
        y: height - 229,
        size: fontSize,
        font: helvetica,
        color: textColor,
      });
    }
    
    // === E-Mail (optional) ===
    if (formData.email) {
      firstPage.drawText(formData.email, {
        x: 188,
        y: height - 245,
        size: fontSize,
        font: helvetica,
        color: textColor,
      });
    }
    
    // === "Informationsblatt erhalten: ja" checkbox ===
    firstPage.drawText('X', {
      x: 287,
      y: height - 259,
      size: 11,
      font: helveticaBold,
      color: textColor,
    });
    
    // === Tabelle "Allgemeine Angaben zu Familienangehörigen" ===
    // Column X positions (approximate based on PDF)
    const colEhegatte = 315;
    const colKind1 = 395;
    const colKind2 = 475;
    const colKind3 = 552;
    
    // Row Y positions
    const rowName = height - 492;
    const rowVorname = height - 526;
    const rowGeschlechtM = height - 544;
    const rowGeschlechtX = height - 558;
    const rowGeburt = height - 586;
    const rowAnschrift = height - 612;
    const rowVerwandtLeiblich = height - 638;
    const rowVerwandtStief = height - 652;
    const rowVerwandtEnkel = height - 666;
    const rowVerwandtPflege = height - 680;
    
    const drawTextInCell = (text: string, x: number, y: number, page = firstPage, maxWidth = 65) => {
      if (!text) return;
      let displayText = text;
      while (helvetica.widthOfTextAtSize(displayText, smallFontSize) > maxWidth && displayText.length > 3) {
        displayText = displayText.slice(0, -1);
      }
      page.drawText(displayText, {
        x: x,
        y: y,
        size: smallFontSize,
        font: helvetica,
        color: textColor,
      });
    };
    
    // Ehegatte data
    if (formData.ehegatte.name || formData.ehegatte.vorname) {
      drawTextInCell(formData.ehegatte.name, colEhegatte, rowName);
      drawTextInCell(formData.ehegatte.vorname, colEhegatte, rowVorname);
      
      // Geschlecht checkboxes
      if (formData.ehegatte.geschlecht === 'm') {
        firstPage.drawText('X', { x: colEhegatte + 5, y: rowGeschlechtM, size: 9, font: helveticaBold, color: textColor });
      } else if (formData.ehegatte.geschlecht === 'w') {
        firstPage.drawText('X', { x: colEhegatte + 35, y: rowGeschlechtM, size: 9, font: helveticaBold, color: textColor });
      } else if (formData.ehegatte.geschlecht === 'x') {
        firstPage.drawText('X', { x: colEhegatte + 5, y: rowGeschlechtX, size: 9, font: helveticaBold, color: textColor });
      } else if (formData.ehegatte.geschlecht === 'd') {
        firstPage.drawText('X', { x: colEhegatte + 35, y: rowGeschlechtX, size: 9, font: helveticaBold, color: textColor });
      }
      
      // Geburtsdatum
      if (formData.ehegatte.geburtsdatum) {
        drawTextInCell(formatInputDate(formData.ehegatte.geburtsdatum), colEhegatte, rowGeburt);
      }
      
      // KV-Nummer (goes in "abweichende Anschrift" field as per user request)
      if (formData.ehegatte.abweichendeAnschrift) {
        drawTextInCell(formData.ehegatte.abweichendeAnschrift, colEhegatte, rowAnschrift);
      }
    }
    
    // Kinder data
    const kinderCols = [colKind1, colKind2, colKind3];
    formData.kinder.forEach((kind, idx) => {
      if (idx >= 3) return;
      const col = kinderCols[idx];
      
      if (kind.name || kind.vorname) {
        drawTextInCell(kind.name, col, rowName);
        drawTextInCell(kind.vorname, col, rowVorname);
        
        // Geschlecht
        if (kind.geschlecht === 'm') {
          firstPage.drawText('X', { x: col + 5, y: rowGeschlechtM, size: 9, font: helveticaBold, color: textColor });
        } else if (kind.geschlecht === 'w') {
          firstPage.drawText('X', { x: col + 35, y: rowGeschlechtM, size: 9, font: helveticaBold, color: textColor });
        } else if (kind.geschlecht === 'x') {
          firstPage.drawText('X', { x: col + 5, y: rowGeschlechtX, size: 9, font: helveticaBold, color: textColor });
        } else if (kind.geschlecht === 'd') {
          firstPage.drawText('X', { x: col + 35, y: rowGeschlechtX, size: 9, font: helveticaBold, color: textColor });
        }
        
        // Geburtsdatum
        if (kind.geburtsdatum) {
          drawTextInCell(formatInputDate(kind.geburtsdatum), col, rowGeburt);
        }
        
        // KV-Nummer
        if (kind.abweichendeAnschrift) {
          drawTextInCell(kind.abweichendeAnschrift, col, rowAnschrift);
        }
        
        // Verwandtschaftsverhältnis
        if (kind.verwandtschaft === 'leiblich') {
          firstPage.drawText('X', { x: col + 3, y: rowVerwandtLeiblich, size: 9, font: helveticaBold, color: textColor });
        } else if (kind.verwandtschaft === 'stief') {
          firstPage.drawText('X', { x: col + 3, y: rowVerwandtStief, size: 9, font: helveticaBold, color: textColor });
        } else if (kind.verwandtschaft === 'enkel') {
          firstPage.drawText('X', { x: col + 3, y: rowVerwandtEnkel, size: 9, font: helveticaBold, color: textColor });
        } else if (kind.verwandtschaft === 'pflege') {
          firstPage.drawText('X', { x: col + 3, y: rowVerwandtPflege, size: 9, font: helveticaBold, color: textColor });
        }
      }
    });
    
    // === PAGE 2 ===
    const page2Height = secondPage.getSize().height;
    
    // Column positions for page 2
    const p2ColEhegatte = 230;
    const p2ColKind1 = 330;
    const p2ColKind2 = 430;
    const p2ColKind3 = 528;
    
    // Row positions for "Angaben zur bisherigen Versicherung"
    const p2RowEndeteAm = page2Height - 57;
    const p2RowBestandBei = page2Height - 71;
    const p2RowArtFamilien = page2Height - 100;
    const p2RowBestehtWeiter = page2Height - 183;
    const p2RowBestehtWeiterBei = page2Height - 197;
    
    // Ehegatte - Bisherige Versicherung
    if (formData.ehegatte.name || formData.ehegatte.vorname) {
      // Endete am
      drawTextInCell(endDate, p2ColEhegatte, p2RowEndeteAm, secondPage, 80);
      
      // Art: Familienversicherung ankreuzen
      secondPage.drawText('X', {
        x: p2ColEhegatte - 27,
        y: p2RowArtFamilien,
        size: 9,
        font: helveticaBold,
        color: textColor,
      });
      
      // Besteht weiter checkbox and text
      if (formData.ehegatte.bisherigBestehtWeiter) {
        secondPage.drawText('X', {
          x: p2ColEhegatte - 27,
          y: p2RowBestehtWeiter,
          size: 9,
          font: helveticaBold,
          color: textColor,
        });
        drawTextInCell(formData.ehegatte.bisherigBestehtWeiterBei, p2ColEhegatte, p2RowBestehtWeiterBei, secondPage, 80);
      }
    }
    
    // Kinder - Bisherige Versicherung
    const p2KinderCols = [p2ColKind1, p2ColKind2, p2ColKind3];
    formData.kinder.forEach((kind, idx) => {
      if (idx >= 3 || (!kind.name && !kind.vorname)) return;
      const col = p2KinderCols[idx];
      
      // Endete am
      drawTextInCell(endDate, col, p2RowEndeteAm, secondPage, 80);
      
      // Art: Familienversicherung ankreuzen
      secondPage.drawText('X', {
        x: col - 27,
        y: p2RowArtFamilien,
        size: 9,
        font: helveticaBold,
        color: textColor,
      });
      
      // Besteht weiter
      if (kind.bisherigBestehtWeiter) {
        secondPage.drawText('X', {
          x: col - 27,
          y: p2RowBestehtWeiter,
          size: 9,
          font: helveticaBold,
          color: textColor,
        });
        drawTextInCell(kind.bisherigBestehtWeiterBei, col, p2RowBestehtWeiterBei, secondPage, 80);
      }
    });
    
    // === Ort, Datum ===
    const datumFormatted = formatInputDate(formData.datum);
    secondPage.drawText(`${formData.ort}, ${datumFormatted}`, {
      x: 42,
      y: page2Height - 594,
      size: fontSize,
      font: helvetica,
      color: textColor,
    });
    
    // === Unterschrift ===
    if (formData.unterschrift) {
      try {
        const signatureImage = await pdfDoc.embedPng(formData.unterschrift);
        const sigDims = signatureImage.scale(0.25);
        secondPage.drawImage(signatureImage, {
          x: 180,
          y: page2Height - 615,
          width: Math.min(sigDims.width, 140),
          height: Math.min(sigDims.height, 45),
        });
      } catch (e) {
        console.error('Could not embed signature:', e);
      }
    }
    
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
