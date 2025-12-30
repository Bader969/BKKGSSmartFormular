/**
 * Image Processing Utilities for Document Scanner
 * Includes auto-crop detection, contrast/brightness adjustment, 
 * grayscale conversion, and noise reduction
 */

export interface ProcessingOptions {
  contrast: number; // 0.5 - 2.0 (1 = normal)
  brightness: number; // -100 to 100 (0 = normal)
  grayscale: boolean;
  denoise: boolean;
  autoCrop: boolean;
}

export const defaultProcessingOptions: ProcessingOptions = {
  contrast: 1.3,
  brightness: 10,
  grayscale: false,
  denoise: true,
  autoCrop: true,
};

/**
 * Load an image from a file or URL
 */
export const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

/**
 * Detect document edges and crop the image
 * Uses edge detection to find the document bounds
 */
export const autoCropDocument = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): { x: number; y: number; width: number; height: number } => {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  // Convert to grayscale for edge detection
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0; i < data.length; i += 4) {
    gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  
  // Find edges using threshold (detect non-background pixels)
  const threshold = 240; // Pixels darker than this are considered content
  let minX = width, minY = height, maxX = 0, maxY = 0;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (gray[idx] < threshold) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  
  // Add small padding
  const padding = 10;
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(width, maxX + padding);
  maxY = Math.min(height, maxY + padding);
  
  // If no edges found or crop is too small, return full image
  if (maxX - minX < 100 || maxY - minY < 100) {
    return { x: 0, y: 0, width, height };
  }
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

/**
 * Apply contrast and brightness adjustments
 */
export const applyContrastBrightness = (
  imageData: ImageData,
  contrast: number,
  brightness: number
): ImageData => {
  const data = imageData.data;
  const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
  
  for (let i = 0; i < data.length; i += 4) {
    // Apply contrast
    data[i] = Math.max(0, Math.min(255, factor * (data[i] - 128) + 128 + brightness));
    data[i + 1] = Math.max(0, Math.min(255, factor * (data[i + 1] - 128) + 128 + brightness));
    data[i + 2] = Math.max(0, Math.min(255, factor * (data[i + 2] - 128) + 128 + brightness));
  }
  
  return imageData;
};

/**
 * Convert image to grayscale
 */
export const applyGrayscale = (imageData: ImageData): ImageData => {
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }
  
  return imageData;
};

/**
 * Simple noise reduction using box blur on small variations
 */
export const applyDenoising = (
  imageData: ImageData,
  width: number,
  height: number
): ImageData => {
  const data = imageData.data;
  const output = new Uint8ClampedArray(data);
  
  // 3x3 box blur kernel
  const kernel = 1 / 9;
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const idx = ((y + dy) * width + (x + dx)) * 4 + c;
            sum += data[idx];
          }
        }
        output[(y * width + x) * 4 + c] = Math.round(sum * kernel);
      }
    }
  }
  
  for (let i = 0; i < data.length; i++) {
    data[i] = output[i];
  }
  
  return imageData;
};

/**
 * Process an image with all scanner filters
 */
export const processImage = async (
  imageSrc: string,
  options: ProcessingOptions = defaultProcessingOptions
): Promise<{ dataUrl: string; blob: Blob }> => {
  const img = await loadImage(imageSrc);
  
  // Create canvas with original dimensions
  let canvas = document.createElement('canvas');
  let ctx = canvas.getContext('2d')!;
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);
  
  // Auto-crop if enabled
  if (options.autoCrop) {
    const cropBounds = autoCropDocument(ctx, canvas.width, canvas.height);
    
    // Create new canvas with cropped dimensions
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = cropBounds.width;
    croppedCanvas.height = cropBounds.height;
    const croppedCtx = croppedCanvas.getContext('2d')!;
    
    // Draw cropped region
    croppedCtx.drawImage(
      canvas,
      cropBounds.x, cropBounds.y, cropBounds.width, cropBounds.height,
      0, 0, cropBounds.width, cropBounds.height
    );
    
    canvas = croppedCanvas;
    ctx = croppedCtx;
  }
  
  // Get image data for processing
  let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
  // Apply denoise first (before other adjustments)
  if (options.denoise) {
    imageData = applyDenoising(imageData, canvas.width, canvas.height);
  }
  
  // Apply contrast and brightness
  imageData = applyContrastBrightness(imageData, options.contrast, options.brightness);
  
  // Apply grayscale if enabled
  if (options.grayscale) {
    imageData = applyGrayscale(imageData);
  }
  
  // Put processed data back
  ctx.putImageData(imageData, 0, 0);
  
  // Convert to data URL and blob
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve({ dataUrl, blob: blob! });
    }, 'image/jpeg', 0.92);
  });
};

/**
 * Convert a file to base64 string
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
  });
};

/**
 * Convert data URL to base64 string
 */
export const dataUrlToBase64 = (dataUrl: string): string => {
  return dataUrl.split(',')[1];
};

/**
 * Get MIME type from data URL
 */
export const getMimeTypeFromDataUrl = (dataUrl: string): string => {
  const match = dataUrl.match(/^data:([^;]+);/);
  return match ? match[1] : 'image/jpeg';
};
