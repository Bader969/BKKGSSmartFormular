import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bookmark, ExternalLink } from "lucide-react";
import { buildBookmarkletHref } from "@/bookmarklets/bigAutofillSource";

export default function BigAutofillSetup() {
  const href = buildBookmarkletHref();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 glass-bar">
        <div className="max-w-3xl mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">
          <div className="font-display text-lg font-semibold">BIG Autofill — Einrichtung</div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/antraege"><ArrowLeft className="h-4 w-4 mr-1" /> Anträge</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 lg:px-6 py-8 space-y-8">
        <section className="rounded-2xl border border-border bg-card shadow-card p-6">
          <h1 className="text-xl font-display font-semibold mb-2">Einmalige Einrichtung (30 Sekunden)</h1>
          <p className="text-sm text-muted-foreground">
            Damit du BIG-Anträge mit einem Klick online übertragen kannst, brauchst du ein
            Lesezeichen in deinem Browser. Zieh den blauen Button unten in deine Lesezeichenleiste
            (oder rechtsklicke ihn → „Lesezeichen hinzufügen").
          </p>

          <div className="mt-6 p-6 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 flex flex-col items-center gap-3">
            {/* Der Anchor selbst IST das Lesezeichen. Drag & Drop in die Leiste funktioniert nur mit echtem javascript:-href. */}
            <a
              href={href}
              onClick={(e) => e.preventDefault()}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-medium shadow-card cursor-grab active:cursor-grabbing hover:opacity-90"
              draggable
              title="In die Lesezeichenleiste ziehen"
            >
              <Bookmark className="h-4 w-4" /> BIG Autofill
            </a>
            <p className="text-xs text-muted-foreground text-center max-w-md">
              ⬆ In deine <b>Lesezeichenleiste ziehen</b>. Klicken hier tut nichts — das Lesezeichen
              funktioniert nur auf der BIG-Seite.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card shadow-card p-6 space-y-4">
          <h2 className="text-lg font-display font-semibold">So nutzt du es</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>In der Antragsliste beim BIG-Antrag auf <b>„BIG online ausfüllen"</b> klicken.</li>
            <li>Ein neuer Tab öffnet <b>big-direkt.de/online-mitglied-werden</b>. Die Antragsdaten liegen jetzt in deiner Zwischenablage.</li>
            <li>Warte, bis das BIG-Formular geladen ist.</li>
            <li>Klicke oben in der Lesezeichenleiste auf <b>„BIG Autofill"</b>. Der Browser fragt einmalig nach Zwischenablage-Zugriff → <b>Erlauben</b>.</li>
            <li>Das Formular wird befüllt. Oben rechts erscheint ein Overlay mit einer Zusammenfassung (was gefüllt, was fehlt, Familien-Infos zum manuellen Übertragen).</li>
            <li>Nach <b>„Weiter"</b> im BIG-Assistenten: Bookmarklet nochmal klicken, es füllt die Felder des nächsten Schritts.</li>
          </ol>
        </section>

        <section className="rounded-2xl border border-border bg-card shadow-card p-6 space-y-3 text-sm">
          <h2 className="text-lg font-display font-semibold">Was funktioniert nicht?</h2>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Datei-Uploads (Ausweiskopie) — musst du manuell hochladen (Browser-Sicherheit).</li>
            <li>Wenn BIG das Formular umbaut, kann es passieren, dass Felder nicht gefunden werden. Das Overlay zeigt dir, welche.</li>
            <li>In Safari muss die Lesezeichenleiste eingeblendet sein: <i>Ansicht → Favoritenleiste einblenden</i>.</li>
          </ul>
          <div className="pt-3 border-t border-border">
            <a
              href="https://www.big-direkt.de/de/mitglied-werden/online-mitglied-werden"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              BIG Online-Mitgliedsantrag öffnen <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
