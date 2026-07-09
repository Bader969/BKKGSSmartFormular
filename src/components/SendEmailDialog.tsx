import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Mail, Paperclip, Upload, Loader2, X, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { FormData } from '@/types/form';
import { captureDownloads, blobToBase64, type CapturedFile } from '@/utils/captureDownloads';
import {
  applyTemplate,
  buildTemplateVars,
  buildTemplateVarsForPerson,
  DEFAULT_BODY_TEMPLATE,
  DEFAULT_SUBJECT_TEMPLATE,
} from '@/utils/emailTemplate';
import { createCombinedPdf } from '@/utils/pdfUtils';
import type { FileForPdf } from '@/utils/pdfUtils';
import { exportBigPlusbonus } from '@/utils/bigPlusbonusExport';
import { exportBigFamilienversicherung } from '@/utils/bigFamversExport';
import { exportViactivBeitrittserklaerung } from '@/utils/viactivExport';
import { exportViactivFamilienversicherung } from '@/utils/viactivFamilyExport';
import { exportViactivBonusPDFs } from '@/utils/viactivBonusExport';
import { exportNovitasFamilienversicherung } from '@/utils/novitasExport';
import { exportDAKFamilienversicherung } from '@/utils/dakExport';
import { exportFilledPDF, exportRundumSicherPaketOnly } from '@/utils/pdfExport';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error);
    r.onload = () => {
      const s = r.result as string;
      const c = s.indexOf(',');
      resolve(c >= 0 ? s.slice(c + 1) : s);
    };
    r.readAsDataURL(file);
  });
}

async function filesToFileForPdf(files: File[]): Promise<FileForPdf[]> {
  return Promise.all(
    files.map(async (f) => ({
      base64: await fileToBase64(f),
      mimeType: f.type || 'application/octet-stream',
    })),
  );
}

type AttachmentKind = 'auto' | 'shared' | 'group' | 'photo-shared' | 'photo-group';
type Attachment = CapturedFile & { include: boolean; kind: AttachmentKind; groupId?: string };

type SendGroup = {
  id: string;
  label: string;            // angezeigt im UI
  person: { vorname: string; name: string; geburtsdatum: string };
  antragsform: string;      // für Betreff/Body Vars
  subject: string;
  body: string;
  attachmentIndices: number[]; // Verweis auf attachments
};

function fullNameLower(v: string, n: string) {
  return `${(v || '').trim()} ${(n || '').trim()}`.trim().toLowerCase();
}

function fileBelongsToPerson(filename: string, vorname: string, name: string): boolean {
  const fn = filename.toLowerCase();
  const full = fullNameLower(vorname, name);
  if (!full) return false;
  return fn.includes(full);
}

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9_\-.äöüÄÖÜß ]/g, '_');
}

function baseFilename(formData: FormData): string {
  const parts = [formData.mitgliedName, formData.mitgliedVorname, formData.mitgliedGeburtsdatum]
    .filter(Boolean)
    .map((p) => sanitize(p!));
  return parts.join('_') || 'Antrag';
}

const WA_CHAT_ID = '120363309092314738@g.us';
const WA_KK_LABEL: Record<string, string> = {
  big_plusbonus: 'Bigdirekt gesund',
  viactiv: 'VIACTIV',
  novitas: 'Novitas BKK',
  dak: 'DAK',
  bkk_gs: 'BKK GILDEMEISTER SEIDENSTICKER',
};

function todayDdMmYyyy(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

function buildWaTextLines(
  person: { vorname: string; name: string },
  kk: string,
  vertriebspartner: string,
): string[] {
  const lines: string[] = [];
  const fullName = `${(person.vorname || '').trim()} ${(person.name || '').trim()}`.trim();
  if (fullName) lines.push(fullName);
  lines.push(todayDdMmYyyy());
  const kkLabel = WA_KK_LABEL[kk] || kk;
  if (kkLabel) lines.push(kkLabel);
  if (vertriebspartner && vertriebspartner.trim()) lines.push(vertriebspartner.trim());
  return lines;
}

async function runAllExports(formData: FormData): Promise<void> {
  const kk = formData.selectedKrankenkasse;
  if (kk === 'big_plusbonus') {
    if (formData.bigFamilienversicherung) {
      await exportBigFamilienversicherung(formData);
    }
    await exportBigPlusbonus(formData);
  } else if (kk === 'viactiv') {
    await exportViactivBeitrittserklaerung(formData);
    if (formData.viactivFamilienangehoerigeMitversichern) {
      await exportViactivFamilienversicherung(formData);
    }
    await exportViactivBonusPDFs(formData);
  } else if (kk === 'novitas') {
    await exportNovitasFamilienversicherung(formData);
  } else if (kk === 'dak') {
    await exportDAKFamilienversicherung(formData);
  } else if (kk === 'bkk_gs') {
    if (formData.mode === 'nur_rundum') await exportRundumSicherPaketOnly(formData);
    else await exportFilledPDF(formData);
  }
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: FormData;
  applicationId: string | null;
  bearbeiter: string;
  onSent?: () => void;
};

export function SendEmailDialog({ open, onOpenChange, formData, applicationId, bearbeiter, onSent }: Props) {
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [sending, setSending] = useState(false);
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sharedDocs, setSharedDocs] = useState<File[]>([]);
  const [groupDocs, setGroupDocs] = useState<Record<string, File[]>>({});
  const [sharedPhotos, setSharedPhotos] = useState<File[]>([]);
  const [groupPhotos, setGroupPhotos] = useState<Record<string, File[]>>({});
  const [combiningShared, setCombiningShared] = useState(false);
  const [combiningGroup, setCombiningGroup] = useState<Record<string, boolean>>({});
  const [subjTpl, setSubjTpl] = useState<string>(DEFAULT_SUBJECT_TEMPLATE);
  const [groupSubjects, setGroupSubjects] = useState<Record<string, string>>({});
  const [sendToWhatsApp, setSendToWhatsApp] = useState<boolean>(true);

  const vars = useMemo(() => buildTemplateVars(formData, bearbeiter), [formData, bearbeiter]);

  // Berechne Sende-Gruppen basierend auf Anhängen + Variante-B Personen
  const groups: SendGroup[] = useMemo(() => {
    if (loadingAttachments) return [];
    const sharedIndices = attachments
      .map((a, i) => (a.kind === 'shared' || a.kind === 'photo-shared' ? i : -1))
      .filter((i) => i >= 0);

    const result: SendGroup[] = [];

    // Hauptmitglied: FamVers + alle Plusbonus-PDFs des Mitglieds + Dokumente
    const mainIdx: number[] = [];
    // Vorab: Personen mit eigener VIACTIV-Mitgliedschaft (für Filename-Zuordnung)
    const viactivOwnMembers: Array<{ vorname: string; name: string }> = [];
    if (formData.selectedKrankenkasse === 'viactiv' && formData.viactivFamilienangehoerigeMitversichern) {
      const e = formData.ehegatte;
      if (e && (e.vorname || e.name) && e.bisherigArt === 'mitgliedschaft') {
        viactivOwnMembers.push({ vorname: e.vorname, name: e.name });
      }
      formData.kinder.forEach((k) => {
        if (k.eigeneMitgliedschaft && (k.vorname || k.name)) {
          viactivOwnMembers.push({ vorname: k.vorname, name: k.name });
        }
      });
    }
    attachments.forEach((a, i) => {
      if (a.kind !== 'auto') return;
      const fn = a.filename.toLowerCase();
      if (fn.startsWith('zusammenfassung_familienversicherung')) mainIdx.push(i);
      else if (fn.startsWith('antrag plusbonus') && fileBelongsToPerson(a.filename, formData.mitgliedVorname, formData.mitgliedName)) mainIdx.push(i);
      else if (formData.selectedKrankenkasse === 'viactiv') {
        // VIACTIV: Datei gehört zu Hauptmitglied, wenn sie nicht einem separaten Mitglied zugeordnet ist
        const belongsToOther = viactivOwnMembers.some((p) => fileBelongsToPerson(a.filename, p.vorname, p.name));
        if (!belongsToOther) mainIdx.push(i);
      }
      else if (formData.selectedKrankenkasse !== 'big_plusbonus') {
        // Für nicht-BIG: alle Antrags-PDFs gehören zum Hauptmitglied
        mainIdx.push(i);
      }
    });
    const mainGroupIdx = attachments
      .map((a, i) => ((a.kind === 'group' || a.kind === 'photo-group') && a.groupId === 'main' ? i : -1))
      .filter((i) => i >= 0);
    const mainAttIdx = Array.from(new Set([...mainIdx, ...sharedIndices, ...mainGroupIdx]));
    const mainKey = 'main';
    const mainHasPhotos = mainAttIdx.some((i) => {
      const a = attachments[i];
      return a && a.include && (a.kind === 'photo-shared' || a.kind === 'photo-group');
    });
    const mainVars = buildTemplateVarsForPerson(
      formData,
      { vorname: formData.mitgliedVorname, name: formData.mitgliedName, geburtsdatum: formData.mitgliedGeburtsdatum },
      bearbeiter,
      undefined,
      { hasPhotos: mainHasPhotos },
    );
    result.push({
      id: mainKey,
      label: `Hauptmitglied — ${formData.mitgliedVorname} ${formData.mitgliedName}`.trim(),
      person: { vorname: formData.mitgliedVorname, name: formData.mitgliedName, geburtsdatum: formData.mitgliedGeburtsdatum },
      antragsform: mainVars.antragsform,
      subject: groupSubjects[mainKey] ?? applyTemplate(subjTpl, mainVars),
      body: applyTemplate(body || DEFAULT_BODY_TEMPLATE, mainVars),
      attachmentIndices: mainAttIdx,
    });

    // BIG Variante B: pro Ehegatte/Kind mit eigener Mitgliedschaft
    if (formData.selectedKrankenkasse === 'big_plusbonus' && formData.bigFamilienversicherung) {
      const persons: Array<{ id: string; label: string; vorname: string; name: string; geb: string }> = [];
      const e = formData.ehegatte;
      if (e && e.eigeneMitgliedschaft && (e.vorname || e.name)) {
        persons.push({ id: 'spouse', label: `Ehegatte — ${e.vorname} ${e.name}`.trim(), vorname: e.vorname, name: e.name, geb: e.geburtsdatum });
      }
      formData.kinder.forEach((k, i) => {
        if (k.eigeneMitgliedschaft && (k.vorname || k.name)) {
          persons.push({ id: `kind-${i}`, label: `Kind ${i + 1} — ${k.vorname} ${k.name}`.trim(), vorname: k.vorname, name: k.name, geb: k.geburtsdatum });
        }
      });
      for (const p of persons) {
        const idx: number[] = [];
        attachments.forEach((a, i) => {
          if (a.kind !== 'auto') return;
          const fn = a.filename.toLowerCase();
          if (fn.startsWith('antrag plusbonus') && fileBelongsToPerson(a.filename, p.vorname, p.name)) idx.push(i);
        });
        const groupSpecific = attachments
          .map((a, i) => ((a.kind === 'group' || a.kind === 'photo-group') && a.groupId === p.id ? i : -1))
          .filter((i) => i >= 0);
        const attIdx = Array.from(new Set([...idx, ...sharedIndices, ...groupSpecific]));
        const pHasPhotos = attIdx.some((i) => {
          const a = attachments[i];
          return a && a.include && (a.kind === 'photo-shared' || a.kind === 'photo-group');
        });
        const pVars = buildTemplateVarsForPerson(
          formData,
          { vorname: p.vorname, name: p.name, geburtsdatum: p.geb },
          bearbeiter,
          'Plusbonus',
          { hasPhotos: pHasPhotos },
        );
        result.push({
          id: p.id,
          label: p.label,
          person: { vorname: p.vorname, name: p.name, geburtsdatum: p.geb },
          antragsform: pVars.antragsform,
          subject: groupSubjects[p.id] ?? applyTemplate(subjTpl, pVars),
          body: applyTemplate(body || DEFAULT_BODY_TEMPLATE, pVars),
          attachmentIndices: attIdx,
        });
      }
    }

    // VIACTIV Variante B: Ehegatte + Kinder mit eigener Mitgliedschaft
    if (formData.selectedKrankenkasse === 'viactiv' && formData.viactivFamilienangehoerigeMitversichern) {
      const persons: Array<{ id: string; label: string; vorname: string; name: string; geb: string }> = [];
      const e = formData.ehegatte;
      if (e && (e.vorname || e.name) && e.bisherigArt === 'mitgliedschaft') {
        persons.push({ id: 'spouse', label: `Ehegatte — ${e.vorname} ${e.name}`.trim(), vorname: e.vorname, name: e.name, geb: e.geburtsdatum });
      }
      formData.kinder.forEach((k, i) => {
        if (k.eigeneMitgliedschaft && (k.vorname || k.name)) {
          persons.push({ id: `kind-${i}`, label: `Kind ${i + 1} — ${k.vorname} ${k.name}`.trim(), vorname: k.vorname, name: k.name, geb: k.geburtsdatum });
        }
      });
      for (const p of persons) {
        const idx: number[] = [];
        attachments.forEach((a, i) => {
          if (a.kind !== 'auto') return;
          if (fileBelongsToPerson(a.filename, p.vorname, p.name)) idx.push(i);
        });
        const groupSpecific = attachments
          .map((a, i) => ((a.kind === 'group' || a.kind === 'photo-group') && a.groupId === p.id ? i : -1))
          .filter((i) => i >= 0);
        const attIdx = Array.from(new Set([...idx, ...sharedIndices, ...groupSpecific]));
        const pHasPhotos = attIdx.some((i) => {
          const a = attachments[i];
          return a && a.include && (a.kind === 'photo-shared' || a.kind === 'photo-group');
        });
        const pVars = buildTemplateVarsForPerson(
          formData,
          { vorname: p.vorname, name: p.name, geburtsdatum: p.geb },
          bearbeiter,
          undefined,
          { hasPhotos: pHasPhotos },
        );
        result.push({
          id: p.id,
          label: p.label,
          person: { vorname: p.vorname, name: p.name, geburtsdatum: p.geb },
          antragsform: pVars.antragsform,
          subject: groupSubjects[p.id] ?? applyTemplate(subjTpl, pVars),
          body: applyTemplate(body || DEFAULT_BODY_TEMPLATE, pVars),
          attachmentIndices: attIdx,
        });
      }
    }

    return result;
  }, [attachments, formData, bearbeiter, subjTpl, groupSubjects, body, loadingAttachments]);

  // When dialog opens: run exports under capture, look up recipient, fill template
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingAttachments(true);
    setSharedDocs([]);
    setGroupDocs({});
    setSharedPhotos([]);
    setGroupPhotos({});

    (async () => {
      try {
        // Default subject / body — fetch override template if present
        let nextSubjTpl = DEFAULT_SUBJECT_TEMPLATE;
        let bodyTpl = DEFAULT_BODY_TEMPLATE;
        try {
          const { data: tpl } = await supabase
            .from('email_templates')
            .select('subject_template, body_template')
            .eq('is_default', true)
            .maybeSingle();
          if (tpl) { nextSubjTpl = tpl.subject_template; bodyTpl = tpl.body_template; }
        } catch { /* ignore */ }

        // Look up recipient by Krankenkasse (+ optional antragsform match)
        try {
          const { data: recs } = await supabase
            .from('application_recipients')
            .select('recipient_email, cc, bcc, antragsform')
            .eq('krankenkasse', formData.selectedKrankenkasse);
          const exact = recs?.find((r) => r.antragsform && r.antragsform === vars.antragsform);
          const fallback = recs?.find((r) => !r.antragsform);
          const rec = exact ?? fallback;
          if (rec) {
            if (!cancelled) {
              setTo(rec.recipient_email);
              setCc(rec.cc || '');
              setBcc(rec.bcc || '');
            }
          }
        } catch { /* ignore */ }

        if (!cancelled) {
          setSubjTpl(nextSubjTpl);
          setBody(bodyTpl);
          setGroupSubjects({});
        }

        // Capture PDFs
        const captured = await captureDownloads(() => runAllExports(formData));
        if (!cancelled) {
          setAttachments(captured.map((c) => ({ ...c, include: true, kind: 'auto' as AttachmentKind })));
        }
      } catch (e) {
        console.error('Anhänge konnten nicht erzeugt werden', e);
        toast.error('Anhänge konnten nicht erzeugt werden.');
      } finally {
        if (!cancelled) setLoadingAttachments(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Build attachments for a list of files: PDFs kept individually with original name;
  // images combined into a single "Dokumente.pdf".
  const buildDocAttachments = async (
    files: File[],
    kind: AttachmentKind,
    groupId?: string,
  ): Promise<Attachment[]> => {
    const pdfs = files.filter((f) => f.type === 'application/pdf');
    const images = files.filter((f) => f.type.startsWith('image/'));
    const out: Attachment[] = [];
    for (const p of pdfs) {
      out.push({ filename: p.name, blob: p, include: true, kind, groupId });
    }
    if (images.length > 0) {
      const forPdf = await filesToFileForPdf(images);
      const blob = await createCombinedPdf(forPdf);
      out.push({ filename: 'Dokumente.pdf', blob, include: true, kind, groupId });
    }
    return out;
  };

  const rebuildShared = async (files: File[]) => {
    setCombiningShared(true);
    try {
      const built = await buildDocAttachments(files, 'shared');
      setAttachments((prev) => [...prev.filter((a) => a.kind !== 'shared'), ...built]);
    } catch (e) {
      console.error(e);
      toast.error('Dokumente konnten nicht zusammengefasst werden.');
    } finally {
      setCombiningShared(false);
    }
  };

  const rebuildGroup = async (gid: string, files: File[]) => {
    setCombiningGroup((s) => ({ ...s, [gid]: true }));
    try {
      const built = await buildDocAttachments(files, 'group', gid);
      setAttachments((prev) => [
        ...prev.filter((a) => !(a.kind === 'group' && a.groupId === gid)),
        ...built,
      ]);
    } catch (e) {
      console.error(e);
      toast.error('Dokumente konnten nicht zusammengefasst werden.');
    } finally {
      setCombiningGroup((s) => ({ ...s, [gid]: false }));
    }
  };

  const handleAddSharedDocs = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const arr = Array.from(files);
    const next = [...sharedDocs, ...arr];
    setSharedDocs(next);
    await rebuildShared(next);
  };

  const removeSharedDoc = async (idx: number) => {
    const next = sharedDocs.filter((_, i) => i !== idx);
    setSharedDocs(next);
    await rebuildShared(next);
  };

  const handleAddGroupDocs = async (gid: string, files: FileList | null) => {
    if (!files || !files.length) return;
    const arr = Array.from(files);
    const next = [...(groupDocs[gid] || []), ...arr];
    setGroupDocs((s) => ({ ...s, [gid]: next }));
    await rebuildGroup(gid, next);
  };

  const removeGroupDoc = async (gid: string, idx: number) => {
    const next = (groupDocs[gid] || []).filter((_, i) => i !== idx);
    setGroupDocs((s) => ({ ...s, [gid]: next }));
    await rebuildGroup(gid, next);
  };

  // Photos: attached as-is (no PDF conversion). Only image/* accepted.
  const rebuildSharedPhotos = (files: File[]) => {
    const photos: Attachment[] = files
      .filter((f) => f.type.startsWith('image/'))
      .map((f) => ({
        filename: f.name,
        blob: f,
        include: true,
        kind: 'photo-shared' as AttachmentKind,
      }));
    setAttachments((prev) => [...prev.filter((a) => a.kind !== 'photo-shared'), ...photos]);
  };

  const rebuildGroupPhotos = (gid: string, files: File[]) => {
    const photos: Attachment[] = files
      .filter((f) => f.type.startsWith('image/'))
      .map((f) => ({
        filename: f.name,
        blob: f,
        include: true,
        kind: 'photo-group' as AttachmentKind,
        groupId: gid,
      }));
    setAttachments((prev) => [
      ...prev.filter((a) => !(a.kind === 'photo-group' && a.groupId === gid)),
      ...photos,
    ]);
  };

  const handleAddSharedPhotos = (files: FileList | null) => {
    if (!files || !files.length) return;
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!arr.length) { toast.error('Nur Bilddateien erlaubt.'); return; }
    const next = [...sharedPhotos, ...arr];
    setSharedPhotos(next);
    rebuildSharedPhotos(next);
  };

  const removeSharedPhoto = (idx: number) => {
    const next = sharedPhotos.filter((_, i) => i !== idx);
    setSharedPhotos(next);
    rebuildSharedPhotos(next);
  };

  const handleAddGroupPhotos = (gid: string, files: FileList | null) => {
    if (!files || !files.length) return;
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!arr.length) { toast.error('Nur Bilddateien erlaubt.'); return; }
    const next = [...(groupPhotos[gid] || []), ...arr];
    setGroupPhotos((s) => ({ ...s, [gid]: next }));
    rebuildGroupPhotos(gid, next);
  };

  const removeGroupPhoto = (gid: string, idx: number) => {
    const next = (groupPhotos[gid] || []).filter((_, i) => i !== idx);
    setGroupPhotos((s) => ({ ...s, [gid]: next }));
    rebuildGroupPhotos(gid, next);
  };

  const totalSize = attachments.filter((a) => a.include).reduce((s, a) => s + a.blob.size, 0);
  const tooLarge = totalSize > 24 * 1024 * 1024;

  const handleSend = async () => {
    if (!to.trim()) { toast.error('Bitte Empfänger angeben.'); return; }
    if (!groups.length) { toast.error('Keine Sende-Gruppen.'); return; }
    for (const g of groups) {
      if (!g.subject.trim()) { toast.error(`Betreff für "${g.label}" fehlt.`); return; }
      const active = g.attachmentIndices.map((i) => attachments[i]).filter((a) => a && a.include);
      if (!active.length) { toast.error(`Mindestens ein Anhang für "${g.label}" erforderlich.`); return; }
      const size = active.reduce((s, a) => s + a.blob.size, 0);
      if (size > 24 * 1024 * 1024) { toast.error(`"${g.label}" überschreitet 24 MB.`); return; }
    }

    setSending(true);
    let okCount = 0;
    let failCount = 0;
    try {
      for (const g of groups) {
        try {
          const active = g.attachmentIndices.map((i) => attachments[i]).filter((a) => a && a.include);
          const encoded = await Promise.all(
            active.map(async (a) => ({
              filename: a.filename,
              mimeType: a.blob.type || 'application/pdf',
              base64: await blobToBase64(a.blob),
            })),
          );
          const { data, error } = await supabase.functions.invoke('send-application-email', {
            body: {
              application_id: applicationId,
              to: to.trim(),
              cc: cc.trim() || undefined,
              bcc: bcc.trim() || undefined,
              subject: g.subject.trim(),
              body: g.body,
              attachments: encoded,
            },
          });
          if (error) throw new Error(error.message);
          if (data?.error === 'gmail_scope_missing') {
            toast.error('Gmail-Verbindung erlaubt kein Senden. Bitte Verbindung mit Scope "gmail.send" neu autorisieren.');
            failCount++;
            continue;
          }
          if (data?.error) throw new Error(data.error);
          okCount++;

          // WhatsApp-Versand
          if (sendToWhatsApp) {
            const active = g.attachmentIndices.map((i) => attachments[i]).filter((a) => a && a.include);
            const summary = active.find((a) =>
              a.filename.toLowerCase().startsWith('zusammenfassung_mitgliedsantrag'),
            );
            if (!summary) {
              toast.info(`"${g.label}": keine „Zusammenfassung_Mitgliedsantrag" angehängt — WhatsApp übersprungen.`);
            } else {
              try {
                const pdfBase64 = await blobToBase64(summary.blob);
                const textLines = buildWaTextLines(
                  g.person,
                  formData.selectedKrankenkasse,
                  formData.vertriebspartner || '',
                );
                const { data: waData, error: waErr } = await supabase.functions.invoke('send-whatsapp-summary', {
                  body: {
                    application_id: applicationId,
                    chatId: WA_CHAT_ID,
                    pdfBase64,
                    pdfFilename: summary.filename,
                    textLines,
                  },
                });
                if (waErr) throw new Error(waErr.message);
                if (waData?.error) throw new Error(waData.error);
                toast.success(`WhatsApp gesendet: ${g.label}`);
              } catch (waErr) {
                toast.error(`WhatsApp „${g.label}" fehlgeschlagen: ${(waErr as Error).message}`);
              }
            }
          }
        } catch (e) {
          failCount++;
          toast.error(`"${g.label}" fehlgeschlagen: ${(e as Error).message}`);
        }
      }
      if (okCount) toast.success(`${okCount} E-Mail(s) versendet.`);
      if (okCount && !failCount) {
        onSent?.();
        onOpenChange(false);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Mail className="h-5 w-5" /> Antrag per E-Mail senden
          </DialogTitle>
          <DialogDescription>
            Betreff, Empfänger und Nachricht sind vorausgefüllt und vor dem Versand frei änderbar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="email-to">An *</Label>
              <Input id="email-to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="empfaenger@krankenkasse.de" />
            </div>
            <div>
              <Label htmlFor="email-cc">CC</Label>
              <Input id="email-cc" value={cc} onChange={(e) => setCc(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="email-bcc">BCC</Label>
              <Input id="email-bcc" value={bcc} onChange={(e) => setBcc(e.target.value)} />
            </div>
          </div>

          <div>
            <Label htmlFor="email-body">Nachricht</Label>
            <Textarea id="email-body" rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">
              Platzhalter: {'{name}'}, {'{vorname}'}, {'{geburtsdatum}'}, {'{antragsform}'}, {'{krankenkasse}'}, {'{bearbeiter}'}, {'{unterlagen}'}, {'{foto}'}, {'{startdatum}'}
            </p>
          </div>

          <div className="space-y-3">
            <Label>Sende-Gruppen (eine E-Mail pro Gruppe)</Label>
            {loadingAttachments ? (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Erstelle Antrags-PDFs…
              </div>
            ) : groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Gruppen.</p>
            ) : (
              groups.map((g) => {
                const groupSize = g.attachmentIndices
                  .map((i) => attachments[i])
                  .filter((a) => a && a.include)
                  .reduce((s, a) => s + a.blob.size, 0);
                const groupTooLarge = groupSize > 24 * 1024 * 1024;
                return (
                  <div key={g.id} className="border border-border/60 rounded-lg p-3 space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground">{g.label}</div>
                    <div>
                      <Label htmlFor={`subj-${g.id}`} className="text-xs">Betreff *</Label>
                      <Input
                        id={`subj-${g.id}`}
                        value={g.subject}
                        onChange={(e) => setGroupSubjects((prev) => ({ ...prev, [g.id]: e.target.value }))}
                      />
                    </div>
                    <ul className="space-y-1">
                      {g.attachmentIndices.map((idx) => {
                        const a = attachments[idx];
                        if (!a) return null;
                        return (
                          <li key={a.filename + idx} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={a.include}
                              onCheckedChange={(v) => setAttachments((prev) => prev.map((x, j) => (j === idx ? { ...x, include: !!v } : x)))}
                              id={`g-${g.id}-att-${idx}`}
                            />
                            <label htmlFor={`g-${g.id}-att-${idx}`} className="flex-1 truncate cursor-pointer">{a.filename}</label>
                            <span className="text-xs text-muted-foreground shrink-0">{(a.blob.size / 1024).toFixed(0)} KB</span>
                          </li>
                        );
                      })}
                    </ul>
                    <p className={`text-xs ${groupTooLarge ? 'text-destructive' : 'text-muted-foreground'}`}>
                      Größe: {(groupSize / 1024 / 1024).toFixed(2)} MB {groupTooLarge && '· >24 MB'}
                    </p>
                    <div className="border-t border-border/40 pt-2 mt-1">
                      <Label className="flex items-center gap-2 text-xs">
                        <Upload className="h-3 w-3" /> Nur für diese E-Mail (Bilder/PDF)
                      </Label>
                      <Input
                        type="file"
                        multiple
                        accept="image/*,application/pdf"
                        onChange={(e) => handleAddGroupDocs(g.id, e.target.files)}
                        className="mt-1 h-8 text-xs"
                      />
                      {combiningGroup[g.id] && <p className="text-xs text-muted-foreground mt-1">Kombiniere…</p>}
                      {(groupDocs[g.id]?.length ?? 0) > 0 && (
                        <ul className="mt-1 space-y-1">
                          {(groupDocs[g.id] || []).map((f, i) => (
                            <li key={f.name + i} className="flex items-center gap-2 text-xs">
                              <span className="flex-1 truncate">{f.name}</span>
                              <button onClick={() => removeGroupDoc(g.id, i)} className="text-muted-foreground hover:text-destructive">
                                <X className="h-3 w-3" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="border-t border-border/40 pt-2 mt-1">
                      <Label className="flex items-center gap-2 text-xs">
                        <ImageIcon className="h-3 w-3" /> Fotos (nur für diese E-Mail, ohne PDF-Konvertierung)
                      </Label>
                      <Input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => handleAddGroupPhotos(g.id, e.target.files)}
                        className="mt-1 h-8 text-xs"
                      />
                      {(groupPhotos[g.id]?.length ?? 0) > 0 && (
                        <ul className="mt-1 space-y-1">
                          {(groupPhotos[g.id] || []).map((f, i) => (
                            <li key={f.name + i} className="flex items-center gap-2 text-xs">
                              <span className="flex-1 truncate">{f.name}</span>
                              <button onClick={() => removeGroupPhoto(g.id, i)} className="text-muted-foreground hover:text-destructive">
                                <X className="h-3 w-3" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-border/60 pt-3">
            <Label className="flex items-center gap-2"><Upload className="h-4 w-4" /> Zusätzliche Dokumente (Bilder/PDF → "Dokumente.pdf")</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Wird an alle E-Mails angehängt. PDFs behalten ihren Originalnamen; mehrere Bilder werden zu „Dokumente.pdf" zusammengefasst.
            </p>
            <Input type="file" multiple accept="image/*,application/pdf" onChange={(e) => handleAddSharedDocs(e.target.files)} className="mt-2" />
            {combiningShared && <p className="text-xs text-muted-foreground mt-1">Kombiniere…</p>}
            {sharedDocs.length > 0 && (
              <ul className="mt-2 space-y-1">
                {sharedDocs.map((f, i) => (
                  <li key={f.name + i} className="flex items-center gap-2 text-xs">
                    <span className="flex-1 truncate">{f.name}</span>
                    <button onClick={() => removeSharedDoc(i)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-border/60 pt-3">
            <Label className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Fotos (an alle E-Mails, ohne PDF-Konvertierung)</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Bilder werden als separate Foto-Anhänge versendet (nicht zu PDF konvertiert). Aktiviert „+ Foto" im Betreff.
            </p>
            <Input type="file" multiple accept="image/*" onChange={(e) => handleAddSharedPhotos(e.target.files)} className="mt-2" />
            {sharedPhotos.length > 0 && (
              <ul className="mt-2 space-y-1">
                {sharedPhotos.map((f, i) => (
                  <li key={f.name + i} className="flex items-center gap-2 text-xs">
                    <span className="flex-1 truncate">{f.name}</span>
                    <button onClick={() => removeSharedPhoto(i)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <div className="mr-auto flex items-center gap-2">
            <Checkbox
              id="wa-send"
              checked={sendToWhatsApp}
              onCheckedChange={(v) => setSendToWhatsApp(!!v)}
            />
            <Label htmlFor="wa-send" className="text-sm cursor-pointer">
              Auch per WhatsApp an Gruppe senden
            </Label>
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Abbrechen</Button>
          <Button onClick={handleSend} disabled={sending || loadingAttachments || tooLarge} className="gap-2">
            {sending && <Loader2 className="h-4 w-4 animate-spin" />}
            {sending ? 'Sende…' : 'Senden'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}