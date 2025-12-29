/**
 * Generiert eine handschriftliche Unterschrift als Base64-Bild
 */
export const generateHandwrittenSignature = (name: string): string => {
  if (!name) return '';
  
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return '';
  
  // Transparenter Hintergrund
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Handschrift-Stil
  ctx.font = 'italic 48px "Brush Script MT", "Segoe Script", "Bradley Hand", cursive';
  ctx.fillStyle = '#1a365d';
  ctx.textBaseline = 'middle';
  
  // Text zentrieren
  const textWidth = ctx.measureText(name).width;
  const x = (canvas.width - textWidth) / 2;
  const y = canvas.height / 2;
  
  // Leichte Rotation für natürlicheren Look
  ctx.save();
  ctx.translate(x + textWidth / 2, y);
  ctx.rotate(-0.02); // Leichte Neigung
  ctx.translate(-(x + textWidth / 2), -y);
  
  // Unterschrift zeichnen
  ctx.fillText(name, x, y);
  
  // Unterstrich hinzufügen
  ctx.beginPath();
  ctx.moveTo(x - 10, y + 30);
  ctx.lineTo(x + textWidth + 10, y + 25);
  ctx.strokeStyle = '#1a365d';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  
  ctx.restore();
  
  return canvas.toDataURL('image/png');
};
