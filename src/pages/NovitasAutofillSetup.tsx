import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bookmark, ExternalLink } from "lucide-react";
import { buildNovitasBookmarkletHref, NOVITAS_BOOKMARKLET_VERSION } from "@/bookmarklets/novitasAutofillSource";

export default function NovitasAutofillSetup() {
  const href = buildNovitasBookmarkletHref();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 glass-bar">
        <div className="max-w-3xl mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">
          <div className="font-display text-lg font-semibold">Novitas Autofill — Einrichtung</div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/antraege"><ArrowLeft className="h-4 w-4 mr-1" /> Anträge</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 lg:px-6 py-8 space-y-8">
        <section className="rounded-2xl border border-border bg-card shadow-card p-6">
          <h1 className="text-xl font-display font-semibold mb-2">Einmalige Einrichtung (30 Sekunden)</h1>
          <p className="text-sm text-muted-foreground">
            Um Novitas-BKK-Anträge mit einem Klick online zu übertragen, brauchst du ein
            Lesezeichen. Zieh den Button unten in deine Lesezeichenleiste
            (oder rechtsklicke → „Lesezeichen hinzufügen").
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Aktuelle Version: <b>{NOVITAS_BOOKMARKLET_VERSION}</b>. Wenn rechts im Novitas-Overlay eine ältere
            oder keine Version steht, das alte Lesezeichen löschen und diesen Button neu in die Lesezeichenleiste ziehen.
          </p>

          <div className="mt-6 p-6 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 flex flex-col items-center gap-3">
            <a
              href={href}
              onClick={(e) => e.preventDefault()}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-medium shadow-card cursor-grab active:cursor-grabbing hover:opacity-90"
              draggable
              title="In die Lesezeichenleiste ziehen"
            >
              <Bookmark className="h-4 w-4" /> Novitas Autofill
            </a>
            <p className="text-xs text-muted-foreground text-center max-w-md">
              ⬆ In die <b>Lesezeichenleiste ziehen</b>. Klicken hier tut nichts — das Lesezeichen
              funktioniert nur auf der Novitas-Seite.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card shadow-card p-6 space-y-4">
          <h2 className="text-lg font-display font-semibold">So nutzt du es</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>In der Antragsliste beim Novitas-Antrag auf <b>„Novitas online ausfüllen"</b> klicken (pro Person separat).</li>
            <li>Ein neuer Tab öffnet das Novitas-Formular. Die Antragsdaten liegen jetzt in deiner Zwischenablage.</li>
            <li>Warte, bis das Novitas-Formular geladen ist.</li>
            <li>Klicke oben in der Lesezeichenleiste auf <b>„Novitas Autofill"</b>. Falls gefragt: Zwischenablage-Zugriff <b>erlauben</b>.</li>
            <li>Das Formular wird befüllt. Oben rechts erscheint ein Overlay mit einer Zusammenfassung.</li>
            <li>Prüfe alle Werte, ergänze fehlende Felder manuell und sende ab.</li>
          </ol>
        </section>

        <section className="rounded-2xl border border-border bg-card shadow-card p-6 space-y-3 text-sm">
          <h2 className="text-lg font-display font-semibold">Hinweise</h2>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Datei-Uploads musst du manuell durchführen (Browser-Sicherheit).</li>
            <li>Wenn Novitas das Formular umbaut, kann es passieren, dass Felder nicht gefunden werden — das Overlay zeigt dir welche.</li>
          </ul>
          <div className="pt-3 border-t border-border">
            <a
              href="https://www.novitas-bkk.de/formulare/kundenservice?form_lang=de&f.send.mitarbeiter=1393"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Novitas Formular öffnen <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}