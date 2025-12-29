/**
 * Generiert eine Unterschrift als PNG Data-URL mit der Dancing Script Schriftart
 */
export const generateSignatureImage = async (name: string): Promise<string> => {
  if (!name) return '';

  // Canvas erstellen
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Canvas-Größe
  canvas.width = 400;
  canvas.height = 100;

  // Hintergrund transparent
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Schriftart laden und warten
  await document.fonts.ready;

  // Text-Style setzen - Kugelschreiber-Blau
  ctx.font = 'italic 48px "Dancing Script", cursive';
  ctx.fillStyle = '#1a4d80';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  // Text zeichnen
  ctx.fillText(name, 20, canvas.height / 2);

  // Als PNG Data-URL zurückgeben
  return canvas.toDataURL('image/png');
};
