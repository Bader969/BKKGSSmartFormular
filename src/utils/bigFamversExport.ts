import { PDFDocument, PDFTextField, PDFCheckBox, PDFRadioGroup } from 'pdf-lib';
import { FormData, FamilyMember } from '@/types/form';
import { getCountryName, getNationalityName } from './countries';
import { getAutoSignatures, ensureSignatureFontReady, generateSignatureDataUrl } from './generateSignature';

// ---------- Date helpers ----------
const toDE = (input: string): string => {
  if (!input) return '';
  if (input.includes('.')) return input;
  const [y, m, d] = input.split('-');
  if (!y || !m || !d) return '';
  return `${d.padStart(2, '0')}.${m.padStart(2, '0')}.${y}`;
};

const formatDateGerman = (date: Date) => {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${d}.${m}.${date.getFullYear()}`;
};

const calcDates = () => {
  const today = new Date();
  const begin = new Date(today.getFullYear(), today.getMonth() + 3, 1);
  const end = new Date(begin.getFullYear(), begin.getMonth(), 0);
  return { today: formatDateGerman(today), begin: formatDateGerman(begin), end: formatDateGerman(end) };
};

// ---------- Field helpers ----------
const setText = (form: any, name: string, value: string) => {
  try {
    const f = form.getField(name);
    if (f instanceof PDFTextField) f.setText(value || '');
  } catch {/* missing field */}
};

const setRadio = (form: any, name: string, value: string) => {
  try {
    const f = form.getField(name);
    if (f instanceof PDFRadioGroup) f.select(value);
  } catch {/* missing */}
};

const setCheck = (form: any, name: string, on: boolean) => {
  try {
    const f = form.getField(name);
    if (f instanceof PDFCheckBox) (on ? f.check() : f.uncheck());
  } catch {/* missing */}
};

// ---------- Value maps ----------
// Familienstand: 0=ledig, 1=verheiratet, 2=LPartG, 3=verwitwet, 4=getrennt, 5=geschieden
const FAMILIENSTAND: Record<string, string> = {
  ledig: '0', verheiratet: '1', verwitwet: '3', getrennt: '4', geschieden: '5',
};

// Bisherige Versicherung (Mitglied & Familienangehörige):
// 0=selbst versichert, 1=familienversichert, 2=nicht gesetzlich
const VERS_ART: Record<string, string> = {
  mitgliedschaft: '0', familienversicherung: '1', nicht_gesetzlich: '2',
};

// Geschlecht — Ehegatte (083):  m=0, x=1, w=2, d=3
const GESCHLECHT_PARTNER: Record<string, string> = { m: '0', w: '2', x: '1', d: '3' };
// Geschlecht — Kind (090/098/106): m=0, x=1, d=2, w=3
const GESCHLECHT_KIND: Record<string, string> = { m: '0', w: '3', x: '1', d: '2' };

// Verwandtschaft Kind (092/100/108): 0=leiblich, 1=stief, 2=pflege, 3=enkel
const VERWANDT: Record<string, string> = { leiblich: '0', stief: '1', pflege: '2', enkel: '3' };

// ---------- Signature drawing ----------
const drawSig = async (
  pdfDoc: PDFDocument,
  dataUrl: string | null | undefined,
  pageIndex: number,
  rect: { x: number; y: number; w: number; h: number },
) => {
  if (!dataUrl) return;
  try {
    const base64 = dataUrl.split(',')[1];
    if (!base64) return;
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const img = dataUrl.includes('image/png')
      ? await pdfDoc.embedPng(bytes)
      : await pdfDoc.embedJpg(bytes);
    const page = pdfDoc.getPages()[pageIndex];
    const aspect = img.width / img.height;
    let height = Math.min(rect.h + 14, 26);
    let width = height * aspect;
    if (width > rect.w) { width = rect.w; height = width / aspect; }
    const x = rect.x;
    const y = rect.y + rect.h / 2 - height / 2;
    page.drawImage(img, { x, y, width, height });
  } catch (e) {
    console.warn('[BIG-FamVers] Signatur konnte nicht eingebettet werden:', e);
  }
};

// ---------- Column field maps (Spalte 1=Partner, 2=Kind1, 3=Kind2, 4=Kind3) ----------
interface ColumnFields {
  beginn: string;
  name: string;
  vorname: string;
  geburtsdatum: string;
  abwAnschrift: string;
  geschlecht: string;      // radio group
  geschlechtMap: Record<string, string>;
  verwandtschaft?: string; // radio group (Kinder only)
  nichtVerwandt?: string;  // checkbox (Kinder only)
  bisherEnde: string;
  bisherArt: string;       // radio
  abgeleitetVon?: string;  // textfield (Kinder only)
  weiterBei: string;
  weiterBeiKKName: string; // unused: separate text
  // page 2
  versNr: string;
  rentenNr: string;
  geburtsname: string;
  geburtsort: string;
  geburtsland: string;
  staatsang: string;
}

const COL_PARTNER: ColumnFields = {
  beginn: '081_page_0',
  name: '082_page_0',
  vorname: '083_page_0',
  geburtsdatum: '085_page_0',
  abwAnschrift: '086_page_0',
  geschlecht: '083_Geschlecht Lebenspartner_page_0',
  geschlechtMap: GESCHLECHT_PARTNER,
  bisherEnde: '111_page_0',
  bisherArt: '112_BIsherige Vers Partner_page_0',
  weiterBei: '115_page_0',
  weiterBeiKKName: '112_page_0',
  versNr: '183_page_0',
  rentenNr: '184_page_0',
  geburtsname: '185_page_0',
  geburtsort: '186_page_0',
  geburtsland: '187_page_0',
  staatsang: '188_page_0',
};

const COL_KIND1: ColumnFields = {
  beginn: '087_page_0',
  name: '088_page_0',
  vorname: '089_page_0',
  geburtsdatum: '091_page_0',
  abwAnschrift: '092_page_0',
  geschlecht: '090_Geschlecht Lebenspartner_page_0',
  geschlechtMap: GESCHLECHT_KIND,
  verwandtschaft: '092_Verwandtschaft Kind1_page_0',
  nichtVerwandt: '093_Kontrollkästchen 2_page_0',
  bisherEnde: '116_page_0',
  bisherArt: '117_BIsherige Vers Kind1_page_0',
  abgeleitetVon: '119_page_0',
  weiterBei: '120_page_0',
  weiterBeiKKName: '117_page_0',
  versNr: '189_page_0',
  rentenNr: '190_page_0',
  geburtsname: '191_page_0',
  geburtsort: '192_page_0',
  geburtsland: '193_page_0',
  staatsang: '194_page_0',
};

const COL_KIND2: ColumnFields = {
  beginn: '095_page_0',
  name: '096_page_0',
  vorname: '097_page_0',
  geburtsdatum: '099_page_0',
  abwAnschrift: '100_page_0',
  geschlecht: '098_Geschlecht Lebenspartner_page_0',
  geschlechtMap: GESCHLECHT_KIND,
  verwandtschaft: '100_Verwandtschaft Kind2_page_0',
  nichtVerwandt: '101_Kontrollkästchen 2_page_0',
  bisherEnde: '121_page_0',
  bisherArt: '122_BIsherige Vers Kind2_page_0',
  abgeleitetVon: '124_page_0',
  weiterBei: '125_page_0',
  weiterBeiKKName: '122_page_0',
  versNr: '195_page_0',
  rentenNr: '196_page_0',
  geburtsname: '197_page_0',
  geburtsort: '198_page_0',
  geburtsland: '199_page_0',
  staatsang: '200_page_0',
};

const COL_KIND3: ColumnFields = {
  beginn: '103_page_0',
  name: '104_page_0',
  vorname: '105_page_0',
  geburtsdatum: '107_page_0',
  abwAnschrift: '108_page_0',
  geschlecht: '106_Geschlecht Lebenspartner_page_0',
  geschlechtMap: GESCHLECHT_KIND,
  verwandtschaft: '108_Verwandtschaft Kind3_page_0',
  nichtVerwandt: '109_Kontrollkästchen 2_page_0',
  bisherEnde: '126_page_0',
  bisherArt: '127_BIsherige Vers Kind3_page_0',
  abgeleitetVon: '129_page_0',
  weiterBei: '130_page_0',
  weiterBeiKKName: '127_page_0',
  versNr: '201_page_0',
  rentenNr: '202_page_0',
  geburtsname: '203_page_0',
  geburtsort: '204_page_0',
  staatsang: '206_page_0',
  geburtsland: '205_page_0',
};

const fillColumn = (
  form: any,
  cols: ColumnFields,
  m: FamilyMember,
  member: FormData,
  isPartner: boolean,
  dates: ReturnType<typeof calcDates>,
) => {
  if (!m.name && !m.vorname) return;
  setText(form, cols.beginn, dates.begin);
  setText(form, cols.name, m.name);
  setText(form, cols.vorname, m.vorname);
  setText(form, cols.geburtsdatum, toDE(m.geburtsdatum));
  setText(form, cols.abwAnschrift, m.abweichendeAnschrift);

  if (m.geschlecht && cols.geschlechtMap[m.geschlecht]) {
    setRadio(form, cols.geschlecht, cols.geschlechtMap[m.geschlecht]);
  }

  if (!isPartner && cols.verwandtschaft && m.verwandtschaft && VERWANDT[m.verwandtschaft]) {
    setRadio(form, cols.verwandtschaft, VERWANDT[m.verwandtschaft]);
  }
  if (!isPartner && cols.nichtVerwandt) {
    // "nein" wenn explizit als nicht-verwandt mit Ehegatte markiert
    setCheck(form, cols.nichtVerwandt, m.isEhegatteVerwandt === false && !!member.ehegatte?.name);
  }

  // bisherige Vers
  setText(form, cols.bisherEnde, toDE(m.bisherigEndeteAm) || dates.end);
  if (m.bisherigArt && VERS_ART[m.bisherigArt]) {
    setRadio(form, cols.bisherArt, VERS_ART[m.bisherigArt]);
  } else if (!isPartner) {
    // Kinder: standardmäßig familienversichert
    setRadio(form, cols.bisherArt, '1');
  }
  // Aus dessen Mitgliedschaft abgeleitet (nur Kinder)
  if (!isPartner && cols.abgeleitetVon) {
    setText(form, cols.abgeleitetVon, `${member.mitgliedVorname} ${member.mitgliedName}`.trim());
  }
  // weiterhin bei
  setText(form, cols.weiterBei, m.bisherigBestehtWeiterBei || 'BIG direkt gesund');
  // Name bisherige Kasse (Textfeld)
  setText(form, cols.weiterBeiKKName, m.bisherigBestandBei || '');

  // Page 2 — Versichertennummer / Geburtsdaten
  setText(form, cols.versNr, m.versichertennummer);
  setText(form, cols.geburtsname, m.geburtsname || m.name);
  setText(form, cols.geburtsort, m.geburtsort);
  setText(form, cols.geburtsland, getCountryName(m.geburtsland));
  setText(form, cols.staatsang, getNationalityName(m.staatsangehoerigkeit));
};

// ---------- File name ----------
const fname = (formData: FormData): string => {
  const v = (formData.mitgliedVorname || '').trim();
  const n = (formData.mitgliedName || 'Antrag').trim();
  const gd = toDE(formData.mitgliedGeburtsdatum);
  const base = `Zusammenfassung_Familienversicherung ${v} ${n}${gd ? ', ' + gd : ''}`.trim();
  return `${base.replace(/\s+/g, ' ')}.pdf`;
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

// ---------- Build single PDF (up to 3 children) ----------
const buildPdf = async (
  formData: FormData,
  childrenSubset: FamilyMember[],
): Promise<Uint8Array> => {
  const res = await fetch('/big-familienversicherung.pdf');
  const bytes = await res.arrayBuffer();
  const pdfDoc = await PDFDocument.load(bytes);
  const form = pdfDoc.getForm();
  const dates = calcDates();

  // --- Mitglied ---
  setText(form, '066_page_0', formData.mitgliedName);
  setText(form, '067_page_0', formData.mitgliedVorname);
  setText(form, '068_page_0', formData.mitgliedKvNummer);
  setText(form, '073_page_0', formData.telefon);
  setText(form, '074_page_0', formData.email);
  setText(form, '078_page_0', formData.mitgliedKrankenkasse);
  // Erreichbarkeit: 0=Festnetz, 1=Mobil → wir wählen Mobil
  setRadio(form, '068_Erreichbarkeit_page_0', '1');
  // Familienstand
  if (formData.familienstand && FAMILIENSTAND[formData.familienstand]) {
    setRadio(form, '074_Familienstand_page_0', FAMILIENSTAND[formData.familienstand]);
  }
  // bisher: selbst versichert (Standard für Mitglied)
  setRadio(form, '076_Versicherung_page_0', '0');
  // Anlass: Beginn meiner Mitgliedschaft
  setRadio(form, '078_Anlass_page_0', '0');

  // --- Ehegatte (Spalte 1) ---
  if (formData.ehegatte && (formData.ehegatte.name || formData.ehegatte.vorname)) {
    fillColumn(form, COL_PARTNER, formData.ehegatte, formData, true, dates);
  }

  // --- Kinder (Spalten 2..4) ---
  const COLS = [COL_KIND1, COL_KIND2, COL_KIND3];
  childrenSubset.forEach((k, i) => {
    if (i < 3) fillColumn(form, COLS[i], k, formData, false, dates);
  });

  // --- Page 2: Ort + Datum für Unterschrift ---
  setText(form, '207_page_0', formData.ort);
  setText(form, '208_page_0', dates.today);

  // --- Signaturen einbetten ---
  await ensureSignatureFontReady();
  const sigs = getAutoSignatures(formData);
  // Widget-Rects (PDF-Koordinaten, Ursprung bottom-left). CSV "top" entspricht hier y.
  // 208 Mitglied: x=313 y=249 w=252 h=14
  await drawSig(pdfDoc, sigs.member, 1, { x: 313, y: 249, w: 252, h: 14 });
  // 209 Ehegatte (links unten): x=44 y=227 w=252 h=12
  if (formData.ehegatte && (formData.ehegatte.name || formData.ehegatte.vorname)) {
    const spouseSig = generateSignatureDataUrl(formData.ehegatte.name);
    await drawSig(pdfDoc, spouseSig, 1, { x: 44, y: 227, w: 252, h: 12 });
  }
  // 210 Kind (rechts unten): x=313 y=226 w=252 h=14 — ältestes Kind ≥15
  const eldestEligibleKid = childrenSubset
    .map(k => {
      const bd = k.geburtsdatum;
      if (!bd || !k.name) return null;
      const date = bd.includes('-') ? new Date(bd) : null;
      if (!date || isNaN(date.getTime())) return null;
      const age = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      return age >= 15 ? { name: k.name, age } : null;
    })
    .filter((x): x is { name: string; age: number } => x !== null)
    .sort((a, b) => b.age - a.age)[0];
  if (eldestEligibleKid) {
    const kidSig = generateSignatureDataUrl(eldestEligibleKid.name);
    await drawSig(pdfDoc, kidSig, 1, { x: 313, y: 226, w: 252, h: 14 });
  }

  return await pdfDoc.save();
};

// ---------- Public export ----------
export const exportBigFamilienversicherung = async (formData: FormData): Promise<void> => {
  const children = formData.kinder || [];
  // Up to 3 Kinder pro PDF (wie Novitas)
  const numPDFs = Math.max(1, Math.ceil(children.length / 3));
  for (let i = 0; i < numPDFs; i++) {
    const subset = children.slice(i * 3, (i + 1) * 3);
    const bytes = await buildPdf(formData, subset);
    const base = fname(formData).replace(/\.pdf$/, '');
    const filename = numPDFs > 1 ? `${base} (Teil ${i + 1}).pdf` : `${base}.pdf`;
    downloadPdf(bytes, filename);
  }
};