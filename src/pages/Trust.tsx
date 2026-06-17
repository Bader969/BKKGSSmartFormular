import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Lock, Database, FileText, Mail } from 'lucide-react';

const Trust: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground py-6 px-4 shadow-lg">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Shield className="h-8 w-8" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Sicherheit & Datenschutz</h1>
            <p className="text-primary-foreground/80 text-sm">
              Vom Betreiber gepflegte Informationen zu Sicherheits- und Datenschutzpraktiken
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <section className="bg-card border rounded-xl p-6 text-sm text-muted-foreground">
          Diese Seite wird vom Betreiber dieser Anwendung gepflegt und beschreibt die aktuell
          aktivierten Sicherheits- und Datenschutzkontrollen. Sie stellt keine unabhängige
          Zertifizierung dar. Lovable wird als Plattform genutzt; die jeweiligen
          Plattformfunktionen sind weiter unten beschrieben. Betreiber und Nutzer tragen eine
          geteilte Verantwortung für sichere Nutzung.
        </section>

        <section className="bg-card border rounded-xl p-6 space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" /> Zugriff & Authentifizierung
          </h2>
          <ul className="list-disc list-inside text-sm text-foreground/80 space-y-1">
            <li>Anmeldung mit E-Mail und Passwort über Lovable Cloud Auth.</li>
            <li>Selbstregistrierung ist deaktiviert. Konten werden ausschließlich vom Betreiber angelegt.</li>
            <li>Rollen- und Zugriffsprüfungen erfolgen serverseitig über Row-Level-Security (RLS) Richtlinien in der Datenbank.</li>
            <li>Sitzungen werden vom Authentifizierungsdienst verwaltet; Tokens werden bei jedem Aufruf serverseitig validiert.</li>
          </ul>
        </section>

        <section className="bg-card border rounded-xl p-6 space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" /> Datenverarbeitung
          </h2>
          <ul className="list-disc list-inside text-sm text-foreground/80 space-y-1">
            <li>
              Hochgeladene Dokumente (Bilder/PDFs) werden ausschließlich im Arbeitsspeicher der
              KI-Extraktionsfunktion verarbeitet und nicht in Datenbanken oder Object Storage abgelegt.
            </li>
            <li>
              Die KI-Extraktion ist nur für authentifizierte Nutzer erreichbar; nicht autorisierte
              Aufrufe werden serverseitig mit 401 abgelehnt.
            </li>
            <li>
              In der Datenbank werden ausschließlich Profil- und Rollen-Informationen der
              registrierten Bediener gespeichert.
            </li>
          </ul>
        </section>

        <section className="bg-card border rounded-xl p-6 space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Plattform (Lovable Cloud)
          </h2>
          <p className="text-sm text-foreground/80">
            Diese Anwendung läuft auf Lovable Cloud mit verwalteter Authentifizierung, Datenbank
            (Postgres mit RLS) und serverlosen Edge Functions. Geheime Schlüssel werden serverseitig
            in der Geheimnisverwaltung der Plattform gehalten und nicht in das Browser-Bundle ausgeliefert.
          </p>
        </section>

        <section className="bg-card border rounded-xl p-6 space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" /> Kontakt für Sicherheitsmeldungen
          </h2>
          <p className="text-sm text-foreground/80">
            Bitte ergänzen Sie hier die Kontaktadresse Ihres Unternehmens für sicherheitsrelevante
            Meldungen (Security Contact / Vulnerability Disclosure).
          </p>
        </section>

        <div className="pt-4">
          <Link to="/" className="text-sm text-primary hover:underline">← Zurück zur Anwendung</Link>
        </div>
      </main>
    </div>
  );
};

export default Trust;