import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';

export interface ImageForPdf {
  dataUrl: string;
  width: number;
  height: number;
}

export interface FileForPdf {
  base64: string;
  mimeType: string;
}

/**
 * Create a PDF from multiple images using jsPDF
 * Each image is placed on its own page, scaled to fit A4
 */
const createPdfFromImages = async (images: ImageForPdf[]): Promise<Uint8Array> => {
  let pdf: jsPDF | null = null;

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const widthMm = (img.width / 96) * 25.4;
    const heightMm = (img.height / 96) * 25.4;
    const orientation = widthMm >= heightMm ? 'landscape' : 'portrait';
    const format: [number, number] = [widthMm, heightMm];

    if (!pdf) {
      pdf = new jsPDF({ orientation, unit: 'mm', format });
    } else {
      pdf.addPage(format, orientation);
    }

    pdf.addImage(img.dataUrl, 'JPEG', 0, 0, widthMm, heightMm);
  }

  const arrayBuffer = pdf!.output('arraybuffer');
  return new Uint8Array(arrayBuffer);
};

/**
 * Merge multiple PDFs into one using pdf-lib
 */
const mergePdfs = async (pdfBytes: Uint8Array[]): Promise<Uint8Array> => {
  const mergedPdf = await PDFDocument.create();
  
  for (const bytes of pdfBytes) {
    try {
      const pdf = await PDFDocument.load(bytes);
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      pages.forEach(page => mergedPdf.addPage(page));
    } catch (error) {
      console.error('Error loading PDF:', error);
    }
  }
  
  return mergedPdf.save();
};

/**
 * Convert base64 string to Uint8Array
 */
const base64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

/**
 * Get image dimensions from a data URL
 */
export const getImageDimensions = (dataUrl: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
};

/**
 * Create a combined PDF from images and existing PDFs
 */
export const createCombinedPdf = async (files: FileForPdf[]): Promise<Blob> => {
  const images = files.filter(f => f.mimeType.startsWith('image/'));
  const pdfs = files.filter(f => f.mimeType === 'application/pdf');
  
  const pdfParts: Uint8Array[] = [];
  
  // First, create PDF from images if there are any
  if (images.length > 0) {
    const imageInfos: ImageForPdf[] = await Promise.all(
      images.map(async (img) => {
        const dataUrl = `data:${img.mimeType};base64,${img.base64}`;
        const dimensions = await getImageDimensions(dataUrl);
        return {
          dataUrl,
          width: dimensions.width,
          height: dimensions.height
        };
      })
    );
    
    const imagePdf = await createPdfFromImages(imageInfos);
    pdfParts.push(imagePdf);
  }
  
  // Add existing PDFs
  for (const pdf of pdfs) {
    const bytes = base64ToUint8Array(pdf.base64);
    pdfParts.push(bytes);
  }
  
  // Merge all parts
  if (pdfParts.length === 0) {
    throw new Error('Keine Dateien zum Zusammenfassen');
  }
  
  if (pdfParts.length === 1) {
    return new Blob([pdfParts[0] as BlobPart], { type: 'application/pdf' });
  }
  
  const mergedBytes = await mergePdfs(pdfParts);
  return new Blob([mergedBytes as BlobPart], { type: 'application/pdf' });
};

/**
 * Download a blob as a file
 */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
