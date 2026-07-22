import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, FileText, ArrowLeft, FileSpreadsheet, Mail, MessageCircle, Check } from "lucide-react";
import { useApplicationPersistence } from "@/hooks/useApplicationPersistence";
import { ApplicationDetailDrawer, type ApplicationRow } from "@/components/ApplicationDetailDrawer";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export default function Applications() {
  const { list } = useApplicationPersistence();
  const { isAdmin } = useUserRole();
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [kkFilter, setKkFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [vpFilter, setVpFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selected, setSelected] = useState<ApplicationRow | null>(null);

  const reload = () => {
    setLoading(true);
    list().then(({ applications, userEmails, userDisplayNames }) => {
      setRows(applications);
      setEmails(userEmails);
      setDisplayNames(userDisplayNames ?? {});
    }).catch(() => toast.error("Konnte Anträge nicht laden.")).finally(() => setLoading(false));
  };

  useEffect(reload, [list]);

  const bearbeiterOf = (userId: string) => displayNames[userId] || emails[userId] || userId.slice(0, 8);

  const filtered = useMemo(() => rows.filter((r) => {
    if (kkFilter !== "all" && r.krankenkasse !== kkFilter) return false;
    // Status filter applies only to parent entries; sub-entries follow parent.
    if (statusFilter !== "all" && !r.parent_application_id && r.status !== statusFilter) return false;
    if (sourceFilter !== "all" && !r.parent_application_id && (r.source ?? "manual") !== sourceFilter) return false;
    if (vpFilter !== "all" && !r.parent_application_id && (r.vertriebspartner ?? "") !== vpFilter) return false;
    if (!r.parent_application_id) {
      const created = new Date(r.created_at);
      if (monthFilter !== "all") {
        const key = `${String(created.getMonth() + 1).padStart(2, "0")}.${created.getFullYear()}`;
        if (key !== monthFilter) return false;
      } else {
        if (dateFrom) {
          const from = new Date(dateFrom + "T00:00:00");
          if (created < from) return false;
        }
        if (dateTo) {
          const to = new Date(dateTo + "T23:59:59");
          if (created > to) return false;
        }
      }
    }
    if (search) {
      const s = search.toLowerCase();
      const haystacks = [
        r.krankenkasse,
        r.vertriebspartner ?? "",
        displayNames[r.user_id] ?? "",
        emails[r.user_id] ?? "",
        r.applicant_name ?? "",
        r.applicant_vorname ?? "",
        r.antragsform ?? "",
      ];
      if (!haystacks.some((h) => h.toLowerCase().includes(s))) return false;
    }
    return true;
  }), [rows, kkFilter, statusFilter, sourceFilter, vpFilter, monthFilter, dateFrom, dateTo, search, emails, displayNames]);

  // Group sub-entries under their parent, preserving the existing top-level sort order.
  const grouped = useMemo(() => {
    const childrenByParent = new Map<string, ApplicationRow[]>();
    const parents: ApplicationRow[] = [];
    for (const r of filtered) {
      if (r.parent_application_id) {
        const arr = childrenByParent.get(r.parent_application_id) ?? [];
        arr.push(r);
        childrenByParent.set(r.parent_application_id, arr);
      } else {
        parents.push(r);
      }
    }
    for (const arr of childrenByParent.values()) {
      arr.sort((a, b) => {
        if (a.person_role !== b.person_role) {
          return a.person_role === "ehegatte" ? -1 : 1;
        }
        return (a.person_index ?? 0) - (b.person_index ?? 0);
      });
    }
    // Orphan sub-entries (parent not in current filtered set) → render as-is at top.
    const parentIds = new Set(parents.map((p) => p.id));
    const orphans: ApplicationRow[] = [];
    for (const [pid, arr] of childrenByParent) {
      if (!parentIds.has(pid)) orphans.push(...arr);
    }
    const out: ApplicationRow[] = [...orphans];
    for (const p of parents) {
      out.push(p);
      const kids = childrenByParent.get(p.id);
      if (kids) out.push(...kids);
    }
    return out;
  }, [filtered]);

  const kks = Array.from(new Set(rows.map((r) => r.krankenkasse)));
  const vps = Array.from(new Set(rows.filter((r) => !r.parent_application_id && r.vertriebspartner).map((r) => r.vertriebspartner as string))).sort();
  const months = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.parent_application_id) continue;
      const d = new Date(r.created_at);
      set.add(`${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`);
    }
    return Array.from(set).sort((a, b) => {
      const [ma, ya] = a.split(".").map(Number);
      const [mb, yb] = b.split(".").map(Number);
      return yb - ya || mb - ma;
    });
  }, [rows]);

  // Number map: parent → "1", sub → "1.1", "1.2"
  const numberMap = useMemo(() => {
    const map = new Map<string, string>();
    let parentNo = 0;
    const subCount = new Map<string, number>();
    for (const r of grouped) {
      if (!r.parent_application_id) {
        parentNo += 1;
        map.set(r.id, String(parentNo));
      }
    }
    for (const r of grouped) {
      if (r.parent_application_id) {
        const parentLabel = map.get(r.parent_application_id);
        if (parentLabel) {
          const n = (subCount.get(r.parent_application_id) ?? 0) + 1;
          subCount.set(r.parent_application_id, n);
          map.set(r.id, `${parentLabel}.${n}`);
        } else {
          map.set(r.id, "—");
        }
      }
    }
    return map;
  }, [grouped]);

  const handleExportXlsx = () => {
    const data = grouped.map((r) => ({
      "Nr.": numberMap.get(r.id) ?? "",
      Typ: r.parent_application_id
        ? r.person_role === "ehegatte" ? "Ehegatte" : `Kind ${r.person_index ?? ""}`.trim()
        : "Hauptantrag",
      Krankenkasse: r.krankenkasse,
      Status: r.parent_application_id ? "" : (r.status === "exported" ? "Exportiert" : "Entwurf"),
      PDFs: r.parent_application_id ? "" : r.pdf_count,
      "E-Mail gesendet": r.emailed_at ? new Date(r.emailed_at).toLocaleString("de-DE") : "",
      "WhatsApp gesendet": r.whatsapp_sent_at ? new Date(r.whatsapp_sent_at).toLocaleString("de-DE") : "",
      Aktualisiert: new Date(r.updated_at).toLocaleString("de-DE"),
      Erstellt: new Date(r.created_at).toLocaleString("de-DE"),
      VP: r.vertriebspartner ?? "",
      Bearbeiter: bearbeiterOf(r.user_id),
      Name: r.applicant_name ?? "",
      Vorname: r.applicant_vorname ?? "",
      Antragsform: r.antragsform ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Anträge");
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    XLSX.writeFile(wb, `antraege_${ts}.xlsx`);
  };

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
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Krankenkasse, VP, Bearbeiter, Name, Vorname, Antragsform…" />
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
          <div className="w-full md:w-40">
            <label className="text-xs text-muted-foreground">Herkunft</label>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="manual">Manuell</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            onClick={handleExportXlsx}
            disabled={!filtered.length}
            className="gap-2"
          >
            <FileSpreadsheet className="h-4 w-4" /> Als Excel exportieren
          </Button>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Typ</TableHead>
                <TableHead>Krankenkasse</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>PDFs</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Aktualisiert</TableHead>
                <TableHead>Erstellt</TableHead>
                <TableHead>VP</TableHead>
                <TableHead>Bearbeiter</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Vorname</TableHead>
                <TableHead>Antragsform</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={13} className="text-center text-muted-foreground py-8">Lädt…</TableCell></TableRow>
              )}
              {!loading && grouped.length === 0 && (
                <TableRow><TableCell colSpan={13} className="text-center text-muted-foreground py-8">
                  <FileText className="inline h-4 w-4 mr-1" /> Noch keine Anträge gespeichert.
                </TableCell></TableRow>
              )}
              {grouped.map((r) => {
                const isSub = !!r.parent_application_id;
                const typLabel = isSub
                  ? r.person_role === "ehegatte" ? "Ehegatte" : `Kind ${r.person_index ?? ""}`.trim()
                  : "Hauptantrag";
                return (
                <TableRow key={r.id} className={`cursor-pointer ${isSub ? "bg-muted/30" : ""}`} onClick={() => setSelected(r)}>
                  <TableCell>
                    <Badge variant={isSub ? "outline" : "secondary"} className="text-xs">{typLabel}</Badge>
                    {!isSub && r.source === "whatsapp" && (
                      <Badge variant="outline" className="text-xs ml-1 border-green-500 text-green-700 dark:text-green-400">WhatsApp</Badge>
                    )}
                  </TableCell>
                  <TableCell className={`font-medium ${isSub ? "pl-6" : ""}`}>{r.krankenkasse}</TableCell>
                  <TableCell>
                    {isSub ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <Badge variant={r.status === "exported" ? "default" : "secondary"}>
                        {r.status === "exported" ? "Exportiert" : "Entwurf"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{isSub ? <span className="text-muted-foreground">—</span> : r.pdf_count}</TableCell>
                  <TableCell>
                    {r.emailed_at ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400" title={`Gesendet: ${new Date(r.emailed_at).toLocaleString("de-DE")}`}>
                        <Check className="h-3 w-3" /> <Mail className="h-3 w-3" />
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.whatsapp_sent_at ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400" title={`Gesendet: ${new Date(r.whatsapp_sent_at).toLocaleString("de-DE")}`}>
                        <Check className="h-3 w-3" /> <MessageCircle className="h-3 w-3" />
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{new Date(r.updated_at).toLocaleString("de-DE")}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(r.created_at).toLocaleString("de-DE")}</TableCell>
                  <TableCell>{r.vertriebspartner || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{bearbeiterOf(r.user_id)}</TableCell>
                  <TableCell>{r.applicant_name || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{r.applicant_vorname || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{r.antragsform || <span className="text-muted-foreground">—</span>}</TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </main>

      <ApplicationDetailDrawer
        application={selected}
        onClose={() => setSelected(null)}
        onChanged={reload}
        userEmail={selected ? (displayNames[selected.user_id] || emails[selected.user_id]) : undefined}
      />
    </div>
  );
}