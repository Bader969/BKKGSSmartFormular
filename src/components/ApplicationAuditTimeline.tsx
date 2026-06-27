import { useEffect, useState } from "react";
import { useApplicationPersistence } from "@/hooks/useApplicationPersistence";
import { Clock, Plus, Pencil, FileDown, Eye, KeyRound, Trash2 } from "lucide-react";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  created: Plus,
  updated: Pencil,
  exported: FileDown,
  opened: Eye,
  decrypted: KeyRound,
  deleted: Trash2,
};

const LABELS: Record<string, string> = {
  created: "Erstellt",
  updated: "Aktualisiert",
  exported: "Exportiert",
  opened: "Geöffnet",
  decrypted: "Entschlüsselt",
  deleted: "Gelöscht",
};

export function ApplicationAuditTimeline({ applicationId }: { applicationId: string }) {
  const { events } = useApplicationPersistence();
  const [items, setItems] = useState<Array<{ id: string; event_type: string; meta: Record<string, unknown>; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    events(applicationId).then((res) => { if (!cancelled) { setItems(res.events); setLoading(false); } }).catch(() => setLoading(false));
    return () => { cancelled = true; };
  }, [applicationId, events]);

  if (loading) return <div className="text-sm text-muted-foreground">Lädt Verlauf…</div>;
  if (!items.length) return <div className="text-sm text-muted-foreground">Noch keine Ereignisse.</div>;

  return (
    <ol className="space-y-3">
      {items.map((ev) => {
        const Icon = ICONS[ev.event_type] ?? Clock;
        return (
          <li key={ev.id} className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{LABELS[ev.event_type] ?? ev.event_type}</div>
              <div className="text-xs text-muted-foreground">{new Date(ev.created_at).toLocaleString("de-DE")}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}