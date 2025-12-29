/**
 * Generiert eine handschriftliche Unterschrift als Base64-Bild
 * Verwendet die Caveat Google Font für authentischen Handschrift-Look
 */

// Prüft ob die Caveat-Schriftart geladen ist
const waitForFont = (): Promise<void> => {
  return new Promise((resolve) => {
    if (document.fonts) {
      document.fonts.ready.then(() => {
        // Zusätzlich prüfen ob Caveat verfügbar ist
        const testCanvas = document.createElement('canvas');
        const testCtx = testCanvas.getContext('2d');
        if (testCtx) {
          testCtx.font = '48px Caveat';
          const caveatWidth = testCtx.measureText('Test').width;
          testCtx.font = '48px serif';
          const serifWidth = testCtx.measureText('Test').width;
          // Wenn die Breiten unterschiedlich sind, ist Caveat geladen
          if (caveatWidth !== serifWidth) {
            resolve();
            return;
          }
        }
        // Fallback: kurz warten
        setTimeout(resolve, 100);
      });
    } else {
      setTimeout(resolve, 100);
    }
  });
};

export const generateHandwrittenSignature = async (name: string): Promise<string> => {
  if (!name) return '';
  
  // Warte auf Font-Laden
  await waitForFont();
  
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 120;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return '';
  
  // Transparenter Hintergrund
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Handschrift-Stil mit Caveat (wie im CSS)
  ctx.font = '600 56px Caveat, cursive';
  ctx.fillStyle = '#1a4d80'; // Kugelschreiber-Blau
  ctx.textBaseline = 'middle';
  
  // Text zentrieren
  const textWidth = ctx.measureText(name).width;
  const x = (canvas.width - textWidth) / 2;
  const y = canvas.height / 2;
  
  // Leichte Rotation für natürlicheren Look
  ctx.save();
  ctx.translate(x + textWidth / 2, y);
  ctx.rotate(-0.03); // Leichte Neigung
  ctx.translate(-(x + textWidth / 2), -y);
  
  // Unterschrift zeichnen
  ctx.fillText(name, x, y);
  
  // Unterstrich hinzufügen
  ctx.beginPath();
  ctx.moveTo(x - 10, y + 28);
  ctx.lineTo(x + textWidth + 10, y + 25);
  ctx.strokeStyle = '#1a4d80';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  
  ctx.restore();
  
  return canvas.toDataURL('image/png');
};

// Synchrone Version für einfache Fälle (nutzt bereits geladene Fonts)
export const generateHandwrittenSignatureSync = (name: string): string => {
  if (!name) return '';
  
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 120;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return '';
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = '600 56px Caveat, cursive';
  ctx.fillStyle = '#1a4d80';
  ctx.textBaseline = 'middle';
  
  const textWidth = ctx.measureText(name).width;
  const x = (canvas.width - textWidth) / 2;
  const y = canvas.height / 2;
  
  ctx.save();
  ctx.translate(x + textWidth / 2, y);
  ctx.rotate(-0.03);
  ctx.translate(-(x + textWidth / 2), -y);
  
  ctx.fillText(name, x, y);
  
  ctx.beginPath();
  ctx.moveTo(x - 10, y + 28);
  ctx.lineTo(x + textWidth + 10, y + 25);
  ctx.strokeStyle = '#1a4d80';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  
  ctx.restore();
  
  return canvas.toDataURL('image/png');
};
