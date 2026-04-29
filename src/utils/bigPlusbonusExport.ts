import { PDFDocument, PDFTextField, PDFCheckBox } from 'pdf-lib';
import { FormData } from '@/types/form';

// Convert ISO YYYY-MM-DD or DD.MM.YYYY -> DDMMJJ (6-digit, two-digit year)
const toDDMMJJ = (input: string): string => {
  if (!input) return '';
  let d = '', m = '', y = '';
  if (input.includes('-')) {
    const [yy, mm, dd] = input.split('-');
    y = yy; m = mm; d = dd;
  } else if (input.includes('.')) {
    const [dd, mm, yy] = input.split('.');
    y = yy; m = mm; d = dd;
  } else {
    return input;
  }
  if (!y || !m || !d) return '';
  return `${d.padStart(2, '0')}${m.padStart(2, '0')}${y.slice(-2)}`;
};

// Erzeuge Encoding-/Whitespace-Varianten eines Feldnamens
const nameVariants = (name: string): string[] => {
  const variants = new Set<string>();
  variants.add(name);
  // Doppelte Spaces ↔ einfache Spaces
  variants.add(name.replace(/  +/g, ' '));
  variants.add(name.replace(/ /g, '  '));
  // Umlaute ↔ ae/oe/ue/ss und kaputte Encodings (Ã¤=ä, Ã¶=ö, Ã¼=ü, ÃŸ=ß)
  const umlautMap: Array<[RegExp, string]> = [
    [/ä/g, 'ae'], [/ö/g, 'oe'], [/ü/g, 'ue'], [/ß/g, 'ss'],
    [/Ä/g, 'Ae'], [/Ö/g, 'Oe'], [/Ü/g, 'Ue'],
  ];
  let mangled = name;
  for (const [re, rep] of umlautMap) mangled = mangled.replace(re, rep);
  variants.add(mangled);
  // Mit kaputtem UTF8 (Ã¤ etc.) Variante – falls die PDF so kodiert
  const broken = name
    .replace(/ä/g, 'Ã¤').replace(/ö/g, 'Ã¶').replace(/ü/g, 'Ã¼').replace(/ß/g, 'ÃŸ')
    .replace(/Ä/g, 'Ã„').replace(/Ö/g, 'Ã–').replace(/Ü/g, 'Ãœ');
  variants.add(broken);
  return Array.from(variants);
};

const getField = (form: any, name: string): any | null => {
  for (const v of nameVariants(name)) {
    try {
      return form.getField(v);
    } catch {/* try next */}
  }
  return null;
};

const setText = (form: any, name: string, value: string) => {
  const f = getField(form, name);
  if (f && f instanceof PDFTextField) f.setText(value || '');
  else if (!f) console.warn(`[BIG] Feld nicht gefunden: ${name}`);
};

const setCheck = (form: any, name: string, checked: boolean) => {
  const f = getField(form, name);
  if (f && f instanceof PDFCheckBox) {
    if (checked) f.check(); else f.uncheck();
  } else if (!f) {
    console.warn(`[BIG] Checkbox nicht gefunden: ${name}`);
  }
};

const downloadPdf = (bytes: Uint8Array, filename: string) => {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const exportBigPlusbonus = async (formData: FormData): Promise<void> => {
  const res = await fetch('/big-plusbonus.pdf');
  const bytes = await res.arrayBuffer();
  const pdfDoc = await PDFDocument.load(bytes);
  const form = pdfDoc.getForm();

  // Personendaten
  setText(form, 'Name', formData.mitgliedName);
  setText(form, 'Vorname', formData.mitgliedVorname);
  setText(form, 'Straße', formData.mitgliedStrasse);
  setText(form, 'Hausnummer', formData.mitgliedHausnummer);
  setText(form, 'PLZ', formData.mitgliedPlz);
  setText(form, 'Ort', formData.ort);

  // Geschlecht
  setCheck(form, 'männlich', formData.bigGeschlecht === 'maennlich');
  setCheck(form, 'weiblich', formData.bigGeschlecht === 'weiblich');
  setCheck(form, 'divers', formData.bigGeschlecht === 'divers');

  // Bankdaten
  setText(form, 'Kontoinhaberin', formData.bigBank.kontoinhaber);
  setText(form, 'Kreditinstitut', formData.bigBank.kreditinstitut);
  setText(form, 'IBAN Internationale Bankkontonummer', formData.bigBank.iban);
  setText(form, 'BIC', formData.bigBank.bic);
  setText(form, 'Ort_2', formData.bigBank.ort);
  setText(form, 'Datum TTMMJJ', toDDMMJJ(formData.bigBank.datum));

  // Versicherungsstatus
  setCheck(form, 'Neuabschluss', formData.bigVersicherungsstatus === 'neuabschluss');
  setCheck(form, 'bestehende Zusatzversicherung', formData.bigVersicherungsstatus === 'bestehend');
  setText(form, 'Euro', formData.bigHoeheEuro);

  // Versicherungsarten (Checkboxen) – Originalname aus CSV mit doppelten Spaces
  setCheck(form, 'private Zusatzversicherung im Sinne von  22 sowie  16', formData.bigVersicherungsarten.privateZusatz);
  setCheck(form, 'Berufsunfähigkeitsversicherung', formData.bigVersicherungsarten.berufsunfaehigkeit);
  setCheck(form, 'Unfallversicherung', formData.bigVersicherungsarten.unfall);
  setCheck(form, 'Grundfähigkeitsversicherung', formData.bigVersicherungsarten.grundfaehigkeit);

  // Mitversicherte Angehörige (bis zu 3)
  const mv = formData.bigMitversicherte;
  if (mv[0]) {
    setText(form, 'Name Vorname', mv[0].nameVorname);
    setText(form, 'Höhe der Police in Euro', mv[0].hoehePolice);
  }
  if (mv[1]) {
    setText(form, 'Name Vorname_2', mv[1].nameVorname);
    setText(form, 'Höhe der Police in Euro_2', mv[1].hoehePolice);
  }
  if (mv[2]) {
    setText(form, 'Name Vorname_3', mv[2].nameVorname);
    setText(form, 'Höhe der Police in Euro_3', mv[2].hoehePolice);
  }

  // Unterschrift Kontoinhaber als Bild über Signatur16-Widget
  // CSV: Signatur16 page 1, Left=301, Top=407, Width=261, Height=12
  // pdf-lib: y from bottom = pageHeight - top - height
  if (formData.unterschrift) {
    try {
      const base64 = formData.unterschrift.split(',')[1];
      if (base64) {
        const sigBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        const img = formData.unterschrift.includes('image/png')
          ? await pdfDoc.embedPng(sigBytes)
          : await pdfDoc.embedJpg(sigBytes);
        const page = pdfDoc.getPages()[0];
        const pageHeight = page.getHeight();
        // Höhe etwas erhöhen für sichtbare Unterschrift (max 30)
        const targetHeight = 28;
        const aspect = img.width / img.height;
        let height = targetHeight;
        let width = height * aspect;
        if (width > 240) {
          width = 240;
          height = width / aspect;
        }
        const left = 301;
        const top = 407;
        const fieldHeight = 12;
        // Auf der gleichen Ebene wie das Datumsfeld; vertikal so platzieren, dass Unterkante auf Linie sitzt
        const y = pageHeight - top - fieldHeight;
        page.drawImage(img, { x: left, y, width, height });
      }
    } catch (e) {
      console.warn('[BIG] Unterschrift konnte nicht eingebettet werden:', e);
    }
  }

  form.flatten();
  const out = await pdfDoc.save();
  const fname = `BIG-Plusbonus_${formData.mitgliedName || 'Antrag'}_${formData.mitgliedVorname || ''}.pdf`.replace(/\s+/g, '_');
  downloadPdf(out, fname);
};
