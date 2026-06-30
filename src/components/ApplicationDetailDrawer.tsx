import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useApplicationPersistence } from "@/hooks/useApplicationPersistence";
import { ApplicationAuditTimeline } from "./ApplicationAuditTimeline";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export type ApplicationRow = {
  id: string; user_id: string; krankenkasse: string; status: string;
  pdf_count: number; exported_at: string | null; last_opened_at: string | null;
  created_at: string; updated_at: string;
  vertriebspartner: string | null;
  applicant_name: string | null;
  applicant_vorname: string | null;
  antragsform: string | null;
  parent_application_id: string | null;
  person_role: string | null;
  person_index: number | null;
};

export function ApplicationDetailDrawer({
  application,
  onClose,
  onChanged,
  userEmail,
}: {
  application: ApplicationRow | null;
  onClose: () => void;
  onChanged: () => void;
  userEmail?: string;
}) {
  const { decrypt, remove } = useApplicationPersistence();
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const open = !!application;
  const isSub = !!application?.parent_application_id;

  const handleLoad = async () => {
    if (!application) return;
    setBusy(true);
    try {
      const { payload } = await decrypt(application.id);
      sessionStorage.setItem("loadedApplication", JSON.stringify({ id: application.id, payload }));
      toast.success("Antrag geladen. Wechsel zum Editor…");
      navigate("/");
    } catch {
      toast.error("Konnte Antrag nicht entschlüsseln.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!application) return;
    if (isSub) {
      toast.error("Untereinträge können nicht einzeln gelöscht werden. Bitte den Hauptantrag löschen oder die eigene Mitgliedschaft im Formular entfernen.");
      return;
    }
    if (!confirm("Antrag wirklich löschen? Diese Aktion ist nicht umkehrbar.")) return;
    setBusy(true);
    try {
      await remove(application.id);
      toast.success("Antrag gelöscht.");
      onClose();
      onChanged();
    } catch {
      toast.error("Konnte nicht löschen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {application && (
          <>
            <SheetHeader>
              <SheetTitle className="font-display">
                {isSub
                  ? application.person_role === "ehegatte"
                    ? "Untereintrag · Ehegatte"
                    : `Untereintrag · Kind ${application.person_index ?? ""}`.trim()
                  : "Antrag"}
              </SheetTitle>
              <SheetDescription>
                {application.krankenkasse.toUpperCase()} · erstellt {new Date(application.created_at).toLocaleString("de-DE")}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-4">
              <div className="flex flex-wrap gap-2">
                {!isSub && (
                  <>
                    <Badge variant={application.status === "exported" ? "default" : "secondary"}>
                      {application.status === "exported" ? "Exportiert" : "Entwurf"}
                    </Badge>
                    <Badge variant="outline">{application.pdf_count} PDFs</Badge>
                  </>
                )}
                {isSub && <Badge variant="outline">Untereintrag</Badge>}
                {userEmail && <Badge variant="outline">{userEmail}</Badge>}
              </div>

              {isSub && (
                <p className="text-xs text-muted-foreground">
                  Dieser Eintrag gehört zu einem Hauptantrag und teilt sich dessen Datensatz. Beim Laden wird der vollständige Antrag im Editor geöffnet.
                </p>
              )}

              <div className="flex gap-2">
                <Button onClick={handleLoad} disabled={busy} className="flex-1">In Editor laden</Button>
                <Button onClick={handleDelete} disabled={busy || isSub} variant="destructive">Löschen</Button>
              </div>

              <div>
                <h3 className="font-display text-sm font-semibold mb-3 mt-6">Verlauf</h3>
                <ApplicationAuditTimeline applicationId={application.id} />
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}