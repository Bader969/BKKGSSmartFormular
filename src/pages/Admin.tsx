import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, ArrowLeft, KeyRound, Trash2, UserPlus, Plus } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

type AdminUser = {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  is_admin: boolean;
  is_allowed: boolean;
};

type AllowedEntry = { email: string; note: string | null; created_at: string };

async function callAdmin(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("admin-users-api", {
    body: { action, ...payload },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function Admin() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [allowedList, setAllowedList] = useState<AllowedEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ email: "", password: "", display_name: "", is_admin: false });

  const [pwUser, setPwUser] = useState<AdminUser | null>(null);
  const [pwValue, setPwValue] = useState("");

  const [newAllowed, setNewAllowed] = useState({ email: "", note: "" });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [u, a] = await Promise.all([callAdmin("list_users"), callAdmin("list_allowed")]);
      setUsers(u.users ?? []);
      setAllowedList(a.allowed ?? []);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) reload();
  }, [isAdmin, reload]);

  if (roleLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Lädt…</div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  const handleCreate = async () => {
    try {
      await callAdmin("create_user", createForm);
      toast.success("Nutzer angelegt.");
      setCreateOpen(false);
      setCreateForm({ email: "", password: "", display_name: "", is_admin: false });
      reload();
    } catch (e) { toast.error((e as Error).message); }
  };

  const handleSetPassword = async () => {
    if (!pwUser || pwValue.length < 8) { toast.error("Mindestens 8 Zeichen."); return; }
    try {
      await callAdmin("set_password", { user_id: pwUser.id, password: pwValue });
      toast.success("Passwort gesetzt.");
      setPwUser(null);
      setPwValue("");
    } catch (e) { toast.error((e as Error).message); }
  };

  const toggleAdmin = async (u: AdminUser, v: boolean) => {
    try { await callAdmin("set_admin", { user_id: u.id, is_admin: v }); reload(); }
    catch (e) { toast.error((e as Error).message); }
  };

  const toggleAllowed = async (u: AdminUser, v: boolean) => {
    if (!u.email) return;
    try { await callAdmin("set_allowed", { email: u.email, allowed: v }); reload(); }
    catch (e) { toast.error((e as Error).message); }
  };

  const handleDelete = async (u: AdminUser) => {
    if (!confirm(`Nutzer ${u.email} endgültig löschen?`)) return;
    try { await callAdmin("delete_user", { user_id: u.id }); toast.success("Gelöscht."); reload(); }
    catch (e) { toast.error((e as Error).message); }
  };

  const handleAddAllowed = async () => {
    if (!newAllowed.email.trim()) return;
    try {
      await callAdmin("add_allowed", { email: newAllowed.email.trim(), note: newAllowed.note || null });
      setNewAllowed({ email: "", note: "" });
      reload();
    } catch (e) { toast.error((e as Error).message); }
  };

  const handleRemoveAllowed = async (email: string) => {
    try { await callAdmin("remove_allowed", { email }); reload(); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 glass-bar">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-hero text-primary-foreground flex items-center justify-center shadow-card">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-lg font-semibold leading-tight">Admin</div>
              <div className="text-xs text-muted-foreground">Nutzerverwaltung & Allow-List</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/antraege"><ArrowLeft className="h-4 w-4 mr-1" /> Anträge</Link></Button>
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>Abmelden</Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 lg:px-6 py-8 space-y-6">
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users">Nutzer</TabsTrigger>
            <TabsTrigger value="allowlist">Allow-List</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><UserPlus className="h-4 w-4 mr-1" /> Nutzer anlegen</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Neuen Nutzer anlegen</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1"><Label>E-Mail</Label><Input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} /></div>
                    <div className="space-y-1"><Label>Initialpasswort</Label><Input type="text" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} /></div>
                    <div className="space-y-1"><Label>Anzeigename (optional)</Label><Input value={createForm.display_name} onChange={(e) => setCreateForm({ ...createForm, display_name: e.target.value })} /></div>
                    <label className="flex items-center gap-2 text-sm"><Switch checked={createForm.is_admin} onCheckedChange={(v) => setCreateForm({ ...createForm, is_admin: v })} /> Admin-Rolle vergeben</label>
                  </div>
                  <DialogFooter><Button onClick={handleCreate}>Anlegen</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-Mail</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Erstellt</TableHead>
                    <TableHead>Letzter Login</TableHead>
                    <TableHead>Allow-List</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Lädt…</TableCell></TableRow>
                  ) : users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.email ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{u.display_name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(u.created_at).toLocaleDateString("de-DE")}</TableCell>
                      <TableCell className="text-muted-foreground">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("de-DE") : "—"}</TableCell>
                      <TableCell>
                        <Switch checked={u.is_allowed} onCheckedChange={(v) => toggleAllowed(u, v)} />
                      </TableCell>
                      <TableCell>
                        <Switch checked={u.is_admin} onCheckedChange={(v) => toggleAdmin(u, v)} />
                        {u.is_admin && <Badge className="ml-2">Admin</Badge>}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="ghost" onClick={() => { setPwUser(u); setPwValue(""); }}><KeyRound className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(u)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="allowlist" className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-card flex gap-2 items-end">
              <div className="flex-1 space-y-1"><Label>E-Mail freigeben</Label><Input type="email" value={newAllowed.email} onChange={(e) => setNewAllowed({ ...newAllowed, email: e.target.value })} /></div>
              <div className="flex-1 space-y-1"><Label>Notiz (optional)</Label><Input value={newAllowed.note} onChange={(e) => setNewAllowed({ ...newAllowed, note: e.target.value })} /></div>
              <Button onClick={handleAddAllowed}><Plus className="h-4 w-4 mr-1" /> Hinzufügen</Button>
            </div>
            <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>E-Mail</TableHead><TableHead>Notiz</TableHead><TableHead>Hinzugefügt</TableHead><TableHead className="text-right">Entfernen</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {allowedList.map((a) => (
                    <TableRow key={a.email}>
                      <TableCell className="font-medium">{a.email}</TableCell>
                      <TableCell className="text-muted-foreground">{a.note ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(a.created_at).toLocaleDateString("de-DE")}</TableCell>
                      <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => handleRemoveAllowed(a.email)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={!!pwUser} onOpenChange={(o) => { if (!o) { setPwUser(null); setPwValue(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Passwort setzen für {pwUser?.email}</DialogTitle></DialogHeader>
          <div className="space-y-1"><Label>Neues Passwort</Label><Input type="text" value={pwValue} onChange={(e) => setPwValue(e.target.value)} /></div>
          <DialogFooter><Button onClick={handleSetPassword}>Speichern</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}