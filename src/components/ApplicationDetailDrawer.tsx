import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useApplicationPersistence } from "@/hooks/useApplicationPersistence";
import { ApplicationAuditTimeline } from "./ApplicationAuditTimeline";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";
import type { BigAutofillPayload } from "@/bookmarklets/bigAutofillSource";
import { ExternalLink } from "lucide-react";

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
  source?: string | null;
  emailed_at?: string | null;
  whatsapp_sent_at?: string | null;
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
  const isBig = application?.krankenkasse === "big_plusbonus";
  const subLabel = isSub
    ? application?.person_role === "ehegatte"
      ? "Ehegatte"
      : `Kind ${application?.person_index ?? ""}`.trim()
    : "";

  const handleLoad = async () => {
    if (!application) return;
    setBusy(true);
    try {
      const { payload } = await decrypt(application.id);
      sessionStorage.setItem("loadedApplication", JSON.stringify({ id: application.id, payload }));
      toast.success("Antrag geladen. Wechsel zum Editor…");
      navigate("/");
    } catch (e: unknown) {
      console.error("load application failed", e);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Konnte Antrag nicht laden: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!application) return;
    if (isSub) {
      toast.error("Untereinträge können nicht einzeln gelöscht werden. Öffne den Hauptantrag im Editor, entferne dort die 'eigene Mitgliedschaft' bei der Person und speichere erneut.");
      return;
    }
    if (!confirm("Antrag wirklich löschen? Diese Aktion ist nicht umkehrbar.")) return;
    setBusy(true);
    try {
      await remove(application.id);
      toast.success("Antrag gelöscht.");
      onClose();
      onChanged();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Konnte nicht löschen: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  const handleBigOnlineAusfuellen = async () => {
    if (!application) return;
    setBusy(true);
    try {
      const { payload } = await decrypt(application.id);
      const f = payload as unknown as Record<string, unknown>;
      const bank = (f.bigBank as Record<string, string> | undefined) ?? {};
      const eh = (f.ehegatte as Record<string, string> | undefined) ?? {};
      const kinder = (f.kinder as Array<Record<string, string>> | undefined) ?? [];

      // Adresse/Kontakt/Bank vom Hauptantrag (auch bei Untereinträgen genutzt).
      const baseAdresse = {
        strasse: String(f.mitgliedStrasse ?? ""),
        hausnummer: String(f.mitgliedHausnummer ?? ""),
        plz: String(f.mitgliedPlz ?? ""),
        ort: String(f.ort ?? ""),
      };
      const baseBank = {
        kontoinhaber: String(bank.kontoinhaber ?? ""),
        iban: String(bank.iban ?? ""),
        bic: String(bank.bic ?? ""),
        kreditinstitut: String(bank.kreditinstitut ?? ""),
      };
      const baseTelefon = String(f.telefon ?? "");
      const baseEmail = String(f.email ?? "");

      // Person je nach Kontext bestimmen: Hauptantrag / Ehegatte / Kind[N].
      let vorname = String(f.mitgliedVorname ?? "");
      let nachname = String(f.mitgliedName ?? "");
      let geburtsdatum = String(f.mitgliedGeburtsdatum ?? "");
      let geburtsort = String(f.mitgliedGeburtsort ?? "");
      let geburtsland = String(f.mitgliedGeburtsland ?? "");
      let geschlecht = (f.bigGeschlecht as BigAutofillPayload["mitglied"]["geschlecht"]) ?? "";
      let familienstand = String(f.familienstand ?? "");
      let kvNummer = String(f.mitgliedKvNummer ?? "");
      let bisherigeKrankenkasse = String(f.mitgliedKrankenkasse ?? "");

      if (isSub && application.person_role === "ehegatte" && eh) {
        vorname = String(eh.vorname ?? vorname);
        nachname = String(eh.name ?? nachname);
        geburtsdatum = String(eh.geburtsdatum ?? "");
        geburtsort = String(eh.geburtsort ?? "");
        geburtsland = String(eh.geburtsland ?? "");
        kvNummer = String(eh.kvNummer ?? "");
        bisherigeKrankenkasse = String(eh.krankenkasse ?? "");
        familienstand = "verheiratet";
      } else if (isSub && application.person_role === "kind") {
        const idx = (application.person_index ?? 1) - 1;
        const k = (kinder[idx] as Record<string, string> | undefined) ?? {};
        vorname = String(k.vorname ?? "");
        nachname = String(k.name ?? "");
        geburtsdatum = String(k.geburtsdatum ?? "");
        geburtsort = String(k.geburtsort ?? "");
        geburtsland = String(k.geburtsland ?? "");
        kvNummer = String(k.kvNummer ?? "");
        bisherigeKrankenkasse = String(k.krankenkasse ?? "");
        familienstand = "ledig";
        geschlecht = "";
      }

      // Geburtsname = Nachname (Vorgabe: gilt für alle Anträge).
      const geburtsname = nachname;

      const autofill: BigAutofillPayload = {
        __type: "big-autofill/v1",
        mitglied: {
          vorname,
          nachname,
          geburtsname,
          geburtsdatum,
          geburtsort,
          geburtsland,
          staatsangehoerigkeit: "",
          geschlecht,
          familienstand,
          kvNummer,
          bisherigeKrankenkasse,
        },
        adresse: baseAdresse,
        telefon: baseTelefon,
        email: baseEmail,
        bank: baseBank,
        ehegatte: !isSub && eh && (eh.vorname || eh.name)
          ? { vorname: String(eh.vorname ?? ""), nachname: String(eh.name ?? ""), geburtsdatum: String(eh.geburtsdatum ?? "") }
          : null,
        kinder: !isSub
          ? kinder.map((k) => ({
              vorname: String(k.vorname ?? ""),
              nachname: String(k.name ?? ""),
              geburtsdatum: String(k.geburtsdatum ?? ""),
            }))
          : [],
      };
      await navigator.clipboard.writeText(JSON.stringify(autofill));
      toast.success(
        isSub
          ? `Daten für ${subLabel} in Zwischenablage. Im neuen Tab „BIG Autofill" klicken.`
          : "Antragsdaten in Zwischenablage. Klicke im neuen Tab dein Lesezeichen 'BIG Autofill'.",
      );
      const vp = application.vertriebspartner || "8199db59-990d-464b-a851-afaa918b68cc";
      window.open(
        `https://www.big-direkt.de/de/mitglied-werden/online-mitglied-werden?distributionpartner=${encodeURIComponent(vp)}`,
        "_blank",
        "noopener,noreferrer",
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Konnte nicht kopieren: ${msg}`);
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
                {!isSub && (
                  <Button onClick={handleDelete} disabled={busy} variant="destructive">Löschen</Button>
                )}
              </div>

              {isBig && (
                <div className="rounded-xl border border-border p-3 space-y-2 bg-muted/30">
                  <div className="text-sm font-medium">
                    BIG direkt — Online-Antrag{isSub ? ` (${subLabel})` : ""}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Kopiert die Antragsdaten in die Zwischenablage und öffnet BIG. Auf der BIG-Seite dann dein
                    Lesezeichen <b>„BIG Autofill"</b> klicken.
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleBigOnlineAusfuellen} disabled={busy} className="flex-1 gap-1">
                      <ExternalLink className="h-3 w-3" /> BIG online ausfüllen{isSub ? ` (${subLabel})` : ""}
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/big-autofill-setup">Einrichten</Link>
                    </Button>
                  </div>
                </div>
              )}

              {isSub && (
                <p className="text-xs text-muted-foreground">
                  Um diesen Untereintrag zu entfernen: Hauptantrag im Editor laden, bei der jeweiligen Person das Häkchen „eigene Mitgliedschaft" entfernen und speichern.
                </p>
              )}

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