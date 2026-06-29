import { PDFDocument, PDFTextField, PDFCheckBox } from 'pdf-lib';
import { FormData } from '@/types/form';
import { getAutoSignatures, ensureSignatureFontReady } from './generateSignature';
import { getBeginDate, formatDateGerman } from './dateUtils';

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

// Convert ISO YYYY-MM-DD or DD.MM.YYYY -> DD.MM.YYYY
const toGermanDate = (input: string): string => {
  if (!input) return '';
  if (input.includes('-')) {
    const [yy, mm, dd] = input.split('-');
    if (yy && mm && dd) return `${dd.padStart(2, '0')}.${mm.padStart(2, '0')}.${yy}`;
  }
  return input;
};

type Antragsperson = {
  vorname: string;
  name: string;
  geburtsdatum: string; // ISO or DE
  geschlecht: 'maennlich' | 'weiblich' | 'divers' | '';
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
};

const mapKindGeschlecht = (g: string): Antragsperson['geschlecht'] => {
  if (g === 'm') return 'maennlich';
  if (g === 'w') return 'weiblich';
  if (g === 'd' || g === 'x') return 'divers';
  return '';
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

const buildPlusbonusPdfsForPerson = async (
  formData: FormData,
  templateBytes: ArrayBuffer,
  person: Antragsperson,
  includeMitversicherte: boolean = false,
): Promise<void> => {
  const mv = includeMitversicherte ? formData.bigMitversicherte : [];
  const chunkSize = 3;
  const chunks: typeof mv[] = mv.length > 0
    ? Array.from({ length: Math.ceil(mv.length / chunkSize) }, (_, i) =>
        mv.slice(i * chunkSize, i * chunkSize + chunkSize)
      )
    : [[]];
  const multi = chunks.length > 1;

  const beginnStr = formatDateGerman(getBeginDate());
  const gebStr = toGermanDate(person.geburtsdatum);

  for (let partIdx = 0; partIdx < chunks.length; partIdx++) {
    const chunk = chunks[partIdx];
    const pdfDoc = await PDFDocument.load(templateBytes);
    const form = pdfDoc.getForm();

  // Personendaten (Antragsteller dieses PDFs)
  setText(form, 'Name', person.name);
  setText(form, 'Vorname', person.vorname);
  setText(form, 'Straße', person.strasse);
  setText(form, 'Hausnummer', person.hausnummer);
  setText(form, 'PLZ', person.plz);
  setText(form, 'Ort', person.ort);

  // Geschlecht
  setCheck(form, 'männlich', person.geschlecht === 'maennlich');
  setCheck(form, 'weiblich', person.geschlecht === 'weiblich');
  setCheck(form, 'divers', person.geschlecht === 'divers');

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

  // Mitversicherte Angehörige – bis zu 3 pro PDF (aktueller Chunk)
  if (chunk[0]) {
    setText(form, 'Name Vorname', chunk[0].nameVorname);
    setText(form, 'Höhe der Police in Euro', chunk[0].hoehePolice);
  }
  if (chunk[1]) {
    setText(form, 'Name Vorname_2', chunk[1].nameVorname);
    setText(form, 'Höhe der Police in Euro_2', chunk[1].hoehePolice);
  }
  if (chunk[2]) {
    setText(form, 'Name Vorname_3', chunk[2].nameVorname);
    setText(form, 'Höhe der Police in Euro_3', chunk[2].hoehePolice);
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
    const suffix = multi ? ` (Teil ${partIdx + 1})` : '';
    const vornameOut = (person.vorname || '').trim();
    const nameOut = (person.name || '').trim();
    const personLabel = [vornameOut, nameOut].filter(Boolean).join(' ') || 'Antrag';
    const gebLabel = gebStr ? `, ${gebStr}` : '';
    const fname = `Antrag Plusbonus-interaktiv-${beginnStr}, ${personLabel}${gebLabel}${suffix}.pdf`;
    downloadPdf(out, fname);
  }
};

export const exportBigPlusbonus = async (formData: FormData): Promise<void> => {
  await ensureSignatureFontReady();
  const _sigs = getAutoSignatures(formData);
  formData = { ...formData, unterschrift: _sigs.member ?? '', unterschriftFamilie: _sigs.family ?? '' };
  const res = await fetch('/big-plusbonus.pdf');
  const templateBytes = await res.arrayBuffer();

  // 1) Mitglied immer
  const mitglied: Antragsperson = {
    vorname: formData.mitgliedVorname,
    name: formData.mitgliedName,
    geburtsdatum: formData.mitgliedGeburtsdatum,
    geschlecht: formData.bigGeschlecht as Antragsperson['geschlecht'],
    strasse: formData.mitgliedStrasse,
    hausnummer: formData.mitgliedHausnummer,
    plz: formData.mitgliedPlz,
    ort: formData.ort,
  };
  await buildPlusbonusPdfsForPerson(formData, templateBytes, mitglied, true);

  // 2) Variante B: Ehegatte/Kinder mit eigener Mitgliedschaft → eigener Plusbonus
  if (formData.bigFamilienversicherung) {
    const e = formData.ehegatte;
    const eHasOwn = e && (e.eigeneMitgliedschaft === true || e.bisherigArt === 'mitgliedschaft') && (e.vorname || e.name);
    if (eHasOwn) {
      const eMap: Antragsperson['geschlecht'] =
        e.geschlecht === 'm' ? 'maennlich' :
        e.geschlecht === 'w' ? 'weiblich' :
        (e.geschlecht === 'd' || e.geschlecht === 'x') ? 'divers' : '';
      const ehegatte: Antragsperson = {
        vorname: e.vorname,
        name: e.name,
        geburtsdatum: e.geburtsdatum,
        geschlecht: eMap,
        strasse: formData.mitgliedStrasse,
        hausnummer: formData.mitgliedHausnummer,
        plz: formData.mitgliedPlz,
        ort: formData.ort,
      };
      await buildPlusbonusPdfsForPerson(formData, templateBytes, ehegatte, false);
    }

    for (const k of formData.kinder) {
      const kHasOwn = (k.eigeneMitgliedschaft === true || k.bisherigArt === 'mitgliedschaft');
      if (!kHasOwn) continue;
      if (!k.vorname && !k.name) continue;
      const kind: Antragsperson = {
        vorname: k.vorname,
        name: k.name,
        geburtsdatum: k.geburtsdatum,
        geschlecht: mapKindGeschlecht(k.geschlecht),
        strasse: formData.mitgliedStrasse,
        hausnummer: formData.mitgliedHausnummer,
        plz: formData.mitgliedPlz,
        ort: formData.ort,
      };
      await buildPlusbonusPdfsForPerson(formData, templateBytes, kind, false);
    }
  }
};
