import { PDFDocument, PDFTextField, PDFCheckBox } from 'pdf-lib';
import { FormData } from '@/types/form';
import { getAutoSignatures, ensureSignatureFontReady } from './generateSignature';

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
  await ensureSignatureFontReady();
  const _sigs = getAutoSignatures(formData);
  formData = { ...formData, unterschrift: _sigs.member ?? '', unterschriftFamilie: _sigs.family ?? '' };
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

  // Untere Bestätigungs-Felder (Hiermit wird die Richtigkeit der o.a. Daten bestätigt)
  setText(form, 'Ort_3', formData.ort);
  setText(form, 'Datum TTMMJJ_2', toDDMMJJ(formData.datum));

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
  // Widget-Rect (PDF-Koordinaten, Ursprung unten links): [301, 406, 562, 418]
  if (formData.unterschrift) {
    try {
      const base64 = formData.unterschrift.split(',')[1];
      if (base64) {
        const sigBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        const img = formData.unterschrift.includes('image/png')
          ? await pdfDoc.embedPng(sigBytes)
          : await pdfDoc.embedJpg(sigBytes);
        const page = pdfDoc.getPages()[0];
        // Signatur16: x=301..562 (w=261), y=406..418 (h=12)
        const widgetX = 301;
        const widgetY = 406;
        const widgetW = 261;
        const widgetH = 12;
        const aspect = img.width / img.height;
        // Etwas grösser darstellen, damit Caveat-Schrift gut lesbar bleibt
        let height = 22;
        let width = height * aspect;
        if (width > widgetW) {
          width = widgetW;
          height = width / aspect;
        }
        const x = widgetX;
        const y = widgetY + widgetH / 2 - height / 2;
        page.drawImage(img, { x, y, width, height });
      }
    } catch (e) {
      console.warn('[BIG] Unterschrift konnte nicht eingebettet werden:', e);
    }
  }

  // PDF NICHT flatten – AcroFields sollen bearbeitbar bleiben (wie bei anderen Kassen)
  const out = await pdfDoc.save();
  const fname = `BIG-Plusbonus_${formData.mitgliedName || 'Antrag'}_${formData.mitgliedVorname || ''}.pdf`.replace(/\s+/g, '_');
  downloadPdf(out, fname);
};
