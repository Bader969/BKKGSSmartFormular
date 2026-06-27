import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

type Profile = { id: string; email: string | null; display_name: string | null; created_at: string };

export default function Admin() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const [{ data: ps }, { data: rs }] = await Promise.all([
        supabase.from("profiles").select("id, email, display_name, created_at").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role").eq("role", "admin"),
      ]);
      setProfiles(ps ?? []);
      setAdminIds(new Set((rs ?? []).map((r) => r.user_id as string)));
      setLoading(false);
    })();
  }, [isAdmin]);

  if (roleLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Lädt…</div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  const toggleAdmin = async (userId: string, makeAdmin: boolean) => {
    if (makeAdmin) {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
      if (error) { toast.error("Konnte Rolle nicht zuweisen."); return; }
      setAdminIds((s) => new Set(s).add(userId));
      toast.success("Admin-Rolle vergeben.");
    } else {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
      if (error) { toast.error("Konnte Rolle nicht entfernen."); return; }
      setAdminIds((s) => { const n = new Set(s); n.delete(userId); return n; });
      toast.success("Admin-Rolle entfernt.");
    }
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
              <div className="text-xs text-muted-foreground">Nutzer & Rollen</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/antraege"><ArrowLeft className="h-4 w-4 mr-1" /> Anträge</Link></Button>
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>Abmelden</Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 lg:px-6 py-8">
        <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>E-Mail</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Erstellt</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead className="text-right">Admin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Lädt…</TableCell></TableRow>
              ) : profiles.map((p) => {
                const isUserAdmin = adminIds.has(p.id);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.email ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{p.display_name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(p.created_at).toLocaleDateString("de-DE")}</TableCell>
                    <TableCell>{isUserAdmin ? <Badge>Admin</Badge> : <Badge variant="secondary">User</Badge>}</TableCell>
                    <TableCell className="text-right">
                      <Switch checked={isUserAdmin} onCheckedChange={(v) => toggleAdmin(p.id, v)} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}