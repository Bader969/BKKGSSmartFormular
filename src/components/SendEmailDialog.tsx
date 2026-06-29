import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Mail, Paperclip, Upload, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { FormData } from '@/types/form';
import { captureDownloads, blobToBase64, type CapturedFile } from '@/utils/captureDownloads';
import {
  applyTemplate,
  buildTemplateVars,
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

type Attachment = CapturedFile & { include: boolean };

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9_\-.äöüÄÖÜß ]/g, '_');
}

function baseFilename(formData: FormData): string {
  const parts = [formData.mitgliedName, formData.mitgliedVorname, formData.mitgliedGeburtsdatum]
    .filter(Boolean)
    .map((p) => sanitize(p!));
  return parts.join('_') || 'Antrag';
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
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadedDocs, setUploadedDocs] = useState<File[]>([]);
  const [combiningDocs, setCombiningDocs] = useState(false);

  const vars = useMemo(() => buildTemplateVars(formData, bearbeiter), [formData, bearbeiter]);

  // When dialog opens: run exports under capture, look up recipient, fill template
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingAttachments(true);
    setUploadedDocs([]);

    (async () => {
      try {
        // Default subject / body — fetch override template if present
        let subjTpl = DEFAULT_SUBJECT_TEMPLATE;
        let bodyTpl = DEFAULT_BODY_TEMPLATE;
        try {
          const { data: tpl } = await supabase
            .from('email_templates')
            .select('subject_template, body_template')
            .eq('is_default', true)
            .maybeSingle();
          if (tpl) { subjTpl = tpl.subject_template; bodyTpl = tpl.body_template; }
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
          setSubject(applyTemplate(subjTpl, vars));
          setBody(applyTemplate(bodyTpl, vars));
        }

        // Capture PDFs
        const captured = await captureDownloads(() => runAllExports(formData));
        if (!cancelled) {
          setAttachments(captured.map((c) => ({ ...c, include: true })));
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

  const handleAddDocs = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const arr = Array.from(files);
    setUploadedDocs((p) => [...p, ...arr]);
    setCombiningDocs(true);
    try {
      const all = [...uploadedDocs, ...arr];
      const forPdf: FileForPdf[] = all.map((f) => ({ file: f, name: f.name, type: f.type }));
      const blob = await createCombinedPdf(forPdf);
      const filename = `${baseFilename(formData)}_Dokumente.pdf`;
      setAttachments((prev) => {
        const withoutDocs = prev.filter((a) => !a.filename.endsWith('_Dokumente.pdf'));
        return [...withoutDocs, { filename, blob, include: true }];
      });
    } catch (e) {
      console.error(e);
      toast.error('Dokumente konnten nicht zu PDF zusammengefasst werden.');
    } finally {
      setCombiningDocs(false);
    }
  };

  const removeUploadedDoc = async (idx: number) => {
    const next = uploadedDocs.filter((_, i) => i !== idx);
    setUploadedDocs(next);
    if (!next.length) {
      setAttachments((prev) => prev.filter((a) => !a.filename.endsWith('_Dokumente.pdf')));
      return;
    }
    setCombiningDocs(true);
    try {
      const forPdf: FileForPdf[] = next.map((f) => ({ file: f, name: f.name, type: f.type }));
      const blob = await createCombinedPdf(forPdf);
      const filename = `${baseFilename(formData)}_Dokumente.pdf`;
      setAttachments((prev) => {
        const withoutDocs = prev.filter((a) => !a.filename.endsWith('_Dokumente.pdf'));
        return [...withoutDocs, { filename, blob, include: true }];
      });
    } finally { setCombiningDocs(false); }
  };

  const totalSize = attachments.filter((a) => a.include).reduce((s, a) => s + a.blob.size, 0);
  const tooLarge = totalSize > 24 * 1024 * 1024;

  const handleSend = async () => {
    if (!to.trim()) { toast.error('Bitte Empfänger angeben.'); return; }
    if (!subject.trim()) { toast.error('Betreff darf nicht leer sein.'); return; }
    const active = attachments.filter((a) => a.include);
    if (!active.length) { toast.error('Mindestens ein Anhang erforderlich.'); return; }
    if (tooLarge) { toast.error('Anhänge überschreiten 24 MB (Gmail-Limit).'); return; }

    setSending(true);
    try {
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
          subject: subject.trim(),
          body,
          attachments: encoded,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error === 'gmail_scope_missing') {
        toast.error('Gmail-Verbindung erlaubt kein Senden. Bitte Verbindung mit Scope "gmail.send" neu autorisieren.');
        return;
      }
      if (data?.error) throw new Error(data.error);
      toast.success('E-Mail versendet.');
      onSent?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(`Versand fehlgeschlagen: ${(e as Error).message}`);
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
            <Label htmlFor="email-subject">Betreff *</Label>
            <Input id="email-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div>
            <Label htmlFor="email-body">Nachricht</Label>
            <Textarea id="email-body" rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">
              Platzhalter: {'{name}'}, {'{vorname}'}, {'{geburtsdatum}'}, {'{antragsform}'}, {'{krankenkasse}'}, {'{bearbeiter}'}
            </p>
          </div>

          <div>
            <Label className="flex items-center gap-2"><Paperclip className="h-4 w-4" /> Anhänge</Label>
            {loadingAttachments ? (
              <div className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Erstelle Antrags-PDFs…
              </div>
            ) : attachments.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-2">Keine PDFs erzeugt.</p>
            ) : (
              <ul className="mt-2 space-y-1 border border-border/60 rounded-lg p-2">
                {attachments.map((a, i) => (
                  <li key={a.filename + i} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={a.include}
                      onCheckedChange={(v) => setAttachments((prev) => prev.map((x, j) => (j === i ? { ...x, include: !!v } : x)))}
                      id={`att-${i}`}
                    />
                    <label htmlFor={`att-${i}`} className="flex-1 truncate cursor-pointer">{a.filename}</label>
                    <span className="text-xs text-muted-foreground shrink-0">{(a.blob.size / 1024).toFixed(0)} KB</span>
                  </li>
                ))}
              </ul>
            )}
            <p className={`text-xs mt-1 ${tooLarge ? 'text-destructive' : 'text-muted-foreground'}`}>
              Gesamtgröße: {(totalSize / 1024 / 1024).toFixed(2)} MB {tooLarge && '· Gmail-Limit 25 MB überschritten'}
            </p>
          </div>

          <div className="border-t border-border/60 pt-3">
            <Label className="flex items-center gap-2"><Upload className="h-4 w-4" /> Zusätzliche Dokumente (Bilder/PDF → "Dokumente.pdf")</Label>
            <Input type="file" multiple accept="image/*,application/pdf" onChange={(e) => handleAddDocs(e.target.files)} className="mt-2" />
            {combiningDocs && <p className="text-xs text-muted-foreground mt-1">Kombiniere…</p>}
            {uploadedDocs.length > 0 && (
              <ul className="mt-2 space-y-1">
                {uploadedDocs.map((f, i) => (
                  <li key={f.name + i} className="flex items-center gap-2 text-xs">
                    <span className="flex-1 truncate">{f.name}</span>
                    <button onClick={() => removeUploadedDoc(i)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
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