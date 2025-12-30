import { jsPDF } from 'jspdf';

export interface ImageForPdf {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Create a PDF from multiple images
 * Each image is placed on its own page, scaled to fit A4
 */
export const createPdfFromImages = async (images: ImageForPdf[]): Promise<Blob> => {
  // A4 dimensions in mm
  const A4_WIDTH = 210;
  const A4_HEIGHT = 297;
  const MARGIN = 10;
  
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  
  for (let i = 0; i < images.length; i++) {
    if (i > 0) {
      pdf.addPage();
    }
    
    const img = images[i];
    
    // Calculate scale to fit within margins
    const maxWidth = A4_WIDTH - 2 * MARGIN;
    const maxHeight = A4_HEIGHT - 2 * MARGIN;
    
    // Convert pixels to mm (assuming 96 DPI)
    const imgWidthMm = (img.width / 96) * 25.4;
    const imgHeightMm = (img.height / 96) * 25.4;
    
    // Calculate scale factor
    const scaleX = maxWidth / imgWidthMm;
    const scaleY = maxHeight / imgHeightMm;
    const scale = Math.min(scaleX, scaleY, 1); // Don't upscale
    
    const scaledWidth = imgWidthMm * scale;
    const scaledHeight = imgHeightMm * scale;
    
    // Center on page
    const x = (A4_WIDTH - scaledWidth) / 2;
    const y = (A4_HEIGHT - scaledHeight) / 2;
    
    // Add image to PDF
    pdf.addImage(img.dataUrl, 'JPEG', x, y, scaledWidth, scaledHeight);
  }
  
  return pdf.output('blob');
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
