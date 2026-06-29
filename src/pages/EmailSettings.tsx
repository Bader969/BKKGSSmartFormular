import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Mail, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { KRANKENKASSEN_OPTIONS } from '@/types/form';
import { DEFAULT_BODY_TEMPLATE, DEFAULT_SUBJECT_TEMPLATE } from '@/utils/emailTemplate';

type Recipient = {
  id: string; krankenkasse: string; antragsform: string | null;
  recipient_email: string; cc: string | null; bcc: string | null;
};

type Template = {
  id: string; name: string; subject_template: string; body_template: string; is_default: boolean;
};

export default function EmailSettings() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  const [recOpen, setRecOpen] = useState(false);
  const [recForm, setRecForm] = useState<Omit<Recipient, 'id'>>({ krankenkasse: 'big_plusbonus', antragsform: '', recipient_email: '', cc: '', bcc: '' });

  const [tplOpen, setTplOpen] = useState(false);
  const [tplForm, setTplForm] = useState<Omit<Template, 'id'>>({ name: 'Standard', subject_template: DEFAULT_SUBJECT_TEMPLATE, body_template: DEFAULT_BODY_TEMPLATE, is_default: true });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [r, t] = await Promise.all([
        supabase.from('application_recipients').select('*').order('krankenkasse'),
        supabase.from('email_templates').select('*').order('is_default', { ascending: false }),
      ]);
      if (r.error) throw r.error;
      if (t.error) throw t.error;
      setRecipients((r.data ?? []) as Recipient[]);
      setTemplates((t.data ?? []) as Template[]);
    } catch (e) {
      toast.error('Konnte Daten nicht laden: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isAdmin) reload(); }, [isAdmin, reload]);

  if (roleLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Lädt…</div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  const handleAddRecipient = async () => {
    if (!recForm.recipient_email.trim() || !recForm.krankenkasse) {
      toast.error('Krankenkasse und E-Mail sind Pflicht.');
      return;
    }
    const { error } = await supabase.from('application_recipients').insert({
      krankenkasse: recForm.krankenkasse,
      antragsform: recForm.antragsform || null,
      recipient_email: recForm.recipient_email.trim(),
      cc: recForm.cc || null,
      bcc: recForm.bcc || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Empfänger gespeichert.');
    setRecOpen(false);
    setRecForm({ krankenkasse: 'big_plusbonus', antragsform: '', recipient_email: '', cc: '', bcc: '' });
    reload();
  };

  const handleDeleteRecipient = async (id: string) => {
    if (!confirm('Empfänger löschen?')) return;
    const { error } = await supabase.from('application_recipients').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    reload();
  };

  const handleSaveTemplate = async () => {
    if (tplForm.is_default) {
      await supabase.from('email_templates').update({ is_default: false }).neq('id', '00000000-0000-0000-0000-000000000000');
    }
    const { error } = await supabase.from('email_templates').insert(tplForm);
    if (error) { toast.error(error.message); return; }
    toast.success('Vorlage gespeichert.');
    setTplOpen(false);
    reload();
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Vorlage löschen?')) return;
    const { error } = await supabase.from('email_templates').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    reload();
  };

  const handleMakeDefault = async (id: string) => {
    await supabase.from('email_templates').update({ is_default: false }).neq('id', '00000000-0000-0000-0000-000000000000');
    const { error } = await supabase.from('email_templates').update({ is_default: true }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    reload();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 p-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft className="h-4 w-4 mr-1" /> Zurück</Link></Button>
          <Mail className="h-5 w-5" />
          <h1 className="font-display text-lg font-semibold">E-Mail-Einstellungen</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-6">
        <Tabs defaultValue="recipients">
          <TabsList>
            <TabsTrigger value="recipients">Empfänger</TabsTrigger>
            <TabsTrigger value="templates">Vorlagen</TabsTrigger>
          </TabsList>

          <TabsContent value="recipients" className="mt-4">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm text-muted-foreground">Eine E-Mail-Adresse pro Krankenkasse (optional pro Antragsform).</p>
              <Dialog open={recOpen} onOpenChange={setRecOpen}>
                <DialogTrigger asChild><Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> Empfänger</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Empfänger hinzufügen</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>Krankenkasse</Label>
                      <Select value={recForm.krankenkasse} onValueChange={(v) => setRecForm((p) => ({ ...p, krankenkasse: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {KRANKENKASSEN_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Antragsform (optional, z. B. "Plusbonus + Familienvers.")</Label>
                      <Input value={recForm.antragsform || ''} onChange={(e) => setRecForm((p) => ({ ...p, antragsform: e.target.value }))} placeholder="leer = für alle" />
                    </div>
                    <div>
                      <Label>E-Mail *</Label>
                      <Input value={recForm.recipient_email} onChange={(e) => setRecForm((p) => ({ ...p, recipient_email: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>CC</Label>
                        <Input value={recForm.cc || ''} onChange={(e) => setRecForm((p) => ({ ...p, cc: e.target.value }))} />
                      </div>
                      <div>
                        <Label>BCC</Label>
                        <Input value={recForm.bcc || ''} onChange={(e) => setRecForm((p) => ({ ...p, bcc: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setRecOpen(false)}>Abbrechen</Button>
                    <Button onClick={handleAddRecipient}>Speichern</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="border border-border/60 rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Krankenkasse</TableHead>
                    <TableHead>Antragsform</TableHead>
                    <TableHead>E-Mail</TableHead>
                    <TableHead>CC</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Lädt…</TableCell></TableRow>
                    : recipients.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Noch keine Empfänger</TableCell></TableRow>
                    : recipients.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{KRANKENKASSEN_OPTIONS.find((o) => o.value === r.krankenkasse)?.label ?? r.krankenkasse}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.antragsform || '— alle —'}</TableCell>
                        <TableCell>{r.recipient_email}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.cc || ''}</TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" onClick={() => handleDeleteRecipient(r.id)}><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="templates" className="mt-4">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm text-muted-foreground">Platzhalter: {'{name}'}, {'{vorname}'}, {'{geburtsdatum}'}, {'{antragsform}'}, {'{krankenkasse}'}, {'{bearbeiter}'}</p>
              <Dialog open={tplOpen} onOpenChange={setTplOpen}>
                <DialogTrigger asChild><Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> Vorlage</Button></DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader><DialogTitle>Vorlage hinzufügen</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>Name</Label>
                      <Input value={tplForm.name} onChange={(e) => setTplForm((p) => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Betreff</Label>
                      <Input value={tplForm.subject_template} onChange={(e) => setTplForm((p) => ({ ...p, subject_template: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Nachricht</Label>
                      <Textarea rows={8} value={tplForm.body_template} onChange={(e) => setTplForm((p) => ({ ...p, body_template: e.target.value }))} />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={tplForm.is_default} onChange={(e) => setTplForm((p) => ({ ...p, is_default: e.target.checked }))} />
                      Als Standard verwenden
                    </label>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setTplOpen(false)}>Abbrechen</Button>
                    <Button onClick={handleSaveTemplate}>Speichern</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-3">
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Vorlagen — die App nutzt die eingebauten Standardwerte.</p>
              ) : templates.map((t) => (
                <div key={t.id} className="border border-border/60 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium flex items-center gap-2">
                      {t.name} {t.is_default && <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded">Standard</span>}
                    </div>
                    <div className="flex gap-1">
                      {!t.is_default && <Button size="sm" variant="outline" onClick={() => handleMakeDefault(t.id)}>Als Standard</Button>}
                      <Button size="icon" variant="ghost" onClick={() => handleDeleteTemplate(t.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <p className="text-sm"><span className="text-muted-foreground">Betreff:</span> {t.subject_template}</p>
                  <pre className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{t.body_template}</pre>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}