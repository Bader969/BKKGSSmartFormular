import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, FileText, ArrowLeft } from "lucide-react";
import { useApplicationPersistence } from "@/hooks/useApplicationPersistence";
import { ApplicationDetailDrawer, type ApplicationRow } from "@/components/ApplicationDetailDrawer";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

export default function Applications() {
  const { list } = useApplicationPersistence();
  const { isAdmin } = useUserRole();
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [kkFilter, setKkFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<ApplicationRow | null>(null);

  const reload = () => {
    setLoading(true);
    list().then(({ applications, userEmails }) => {
      setRows(applications);
      setEmails(userEmails);
    }).catch(() => toast.error("Konnte Anträge nicht laden.")).finally(() => setLoading(false));
  };

  useEffect(reload, [list]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (kkFilter !== "all" && r.krankenkasse !== kkFilter) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!r.krankenkasse.toLowerCase().includes(s) && !(emails[r.user_id] ?? "").toLowerCase().includes(s)) return false;
    }
    return true;
  }), [rows, kkFilter, statusFilter, search, emails]);

  const kks = Array.from(new Set(rows.map((r) => r.krankenkasse)));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 glass-bar">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-gradient-hero text-primary-foreground flex items-center justify-center shadow-card">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-lg font-semibold leading-tight">Meine Anträge</div>
              <div className="text-xs text-muted-foreground">{isAdmin ? "Admin-Ansicht (alle Bearbeiter)" : "Nur Ihre Anträge"}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/"><ArrowLeft className="h-4 w-4 mr-1" /> Formular</Link>
            </Button>
            {isAdmin && (
              <Button asChild variant="ghost" size="sm">
                <Link to="/admin">Admin</Link>
              </Button>
            )}
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>Abmelden</Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 lg:px-6 py-8 space-y-6">
        <div className="flex flex-col md:flex-row gap-3 md:items-end">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">Suche</label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Krankenkasse oder Bearbeiter…" />
          </div>
          <div className="w-full md:w-48">
            <label className="text-xs text-muted-foreground">Krankenkasse</label>
            <Select value={kkFilter} onValueChange={setKkFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                {kks.map((kk) => <SelectItem key={kk} value={kk}>{kk}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full md:w-40">
            <label className="text-xs text-muted-foreground">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="draft">Entwurf</SelectItem>
                <SelectItem value="exported">Exportiert</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Krankenkasse</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>PDFs</TableHead>
                <TableHead>Aktualisiert</TableHead>
                <TableHead>Erstellt</TableHead>
                {isAdmin && <TableHead>Bearbeiter</TableHead>}
                <TableHead className="text-right">Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={isAdmin ? 7 : 6} className="text-center text-muted-foreground py-8">Lädt…</TableCell></TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={isAdmin ? 7 : 6} className="text-center text-muted-foreground py-8">
                  <FileText className="inline h-4 w-4 mr-1" /> Noch keine Anträge gespeichert.
                </TableCell></TableRow>
              )}
              {filtered.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                  <TableCell className="font-medium">{r.krankenkasse}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "exported" ? "default" : "secondary"}>
                      {r.status === "exported" ? "Exportiert" : "Entwurf"}
                    </Badge>
                  </TableCell>
                  <TableCell>{r.pdf_count}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(r.updated_at).toLocaleString("de-DE")}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(r.created_at).toLocaleString("de-DE")}</TableCell>
                  {isAdmin && <TableCell className="text-muted-foreground text-xs">{emails[r.user_id] ?? r.user_id.slice(0, 8)}</TableCell>}
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelected(r); }}>Öffnen</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </main>

      <ApplicationDetailDrawer
        application={selected}
        onClose={() => setSelected(null)}
        onChanged={reload}
        userEmail={selected ? emails[selected.user_id] : undefined}
      />
    </div>
  );
}