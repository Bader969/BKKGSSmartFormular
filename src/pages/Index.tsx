import React, { useState, useEffect } from 'react';
import { FormData, FormMode, Krankenkasse, KRANKENKASSEN_OPTIONS, createInitialFormData } from '@/types/form';
import { MemberSection } from '@/components/MemberSection';
import { SpouseSection } from '@/components/SpouseSection';
import { ChildrenSection } from '@/components/ChildrenSection';
import { SignatureSection } from '@/components/SignatureSection';
import { RundumSicherPaketSection } from '@/components/RundumSicherPaketSection';
import { ViactivSection } from '@/components/ViactivSection';
import { BigPlusbonusSection } from '@/components/BigPlusbonusSection';
import { Button } from '@/components/ui/button';
import { FileDown, FileText, AlertCircle, Users, User, Building2, LogOut, ShieldCheck, Sparkles, ChevronRight, Save, Archive, Settings } from 'lucide-react';
import { exportFilledPDF, exportRundumSicherPaketOnly } from '@/utils/pdfExport';
import { exportViactivBeitrittserklaerung } from '@/utils/viactivExport';
import { exportViactivFamilienversicherung } from '@/utils/viactivFamilyExport';
import { exportViactivBonusPDFs } from '@/utils/viactivBonusExport';
import { exportNovitasFamilienversicherung } from '@/utils/novitasExport';
import { exportDAKFamilienversicherung } from '@/utils/dakExport';
import { exportBigPlusbonus } from '@/utils/bigPlusbonusExport';
import { exportBigFamilienversicherung } from '@/utils/bigFamversExport';
import { toast } from 'sonner';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { LoginForm } from '@/components/LoginForm';
import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';
import { JsonImportDialog } from '@/components/JsonImportDialog';
import { FreitextImportDialog } from '@/components/FreitextImportDialog';
import { DocumentMergeDialog } from '@/components/DocumentMergeDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Link } from 'react-router-dom';
import { useApplicationPersistence } from '@/hooks/useApplicationPersistence';
import { useUserRole } from '@/hooks/useUserRole';

const Index = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [formData, setFormData] = useState<FormData>(createInitialFormData);
  const [isExporting, setIsExporting] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const { save, saving, markExported } = useApplicationPersistence();
  const { isAdmin } = useUserRole();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Hydrate from a previously decrypted application (loaded via /antraege)
  useEffect(() => {
    const raw = sessionStorage.getItem('loadedApplication');
    if (!raw) return;
    try {
      const { id, payload } = JSON.parse(raw) as { id: string; payload: FormData };
      setFormData(payload);
      setApplicationId(id);
      sessionStorage.removeItem('loadedApplication');
      toast.success('Antrag geladen.');
    } catch {
      sessionStorage.removeItem('loadedApplication');
    }
  }, []);

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Lädt…</div>;
  }

  if (!session) {
    return <LoginForm />;
  }

  const handleSaveDraft = async () => {
    try {
      const app = await save({ applicationId, formData });
      setApplicationId(app.id);
      toast.success('Entwurf gespeichert.');
    } catch {
      toast.error('Konnte Entwurf nicht speichern.');
    }
  };
  
  const updateFormData = (updates: Partial<FormData>) => {
    setFormData(prev => {
      const newData = { ...prev, ...updates };
      
      // Automatische Synchronisierung der KV-Nummer zur Mitglied-Versichertennummer
      if ('mitgliedKvNummer' in updates) {
        newData.mitgliedVersichertennummer = updates.mitgliedKvNummer as string;
      }
      
      // Automatische Synchronisierung des Bonus-Kontoinhabers mit Hauptmitglied-Name
      if ('mitgliedVorname' in updates || 'mitgliedName' in updates) {
        const oldFullName = `${prev.mitgliedVorname} ${prev.mitgliedName}`.trim();
        const newFullName = `${newData.mitgliedVorname} ${newData.mitgliedName}`.trim();
        
        // Nur synchronisieren wenn Feld leer ist oder noch dem alten Wert entspricht
        if (!newData.viactivBonusKontoinhaber || newData.viactivBonusKontoinhaber === oldFullName) {
          newData.viactivBonusKontoinhaber = newFullName;
        }
        if (!newData.bigBank.kontoinhaber || newData.bigBank.kontoinhaber === oldFullName) {
          newData.bigBank = { ...newData.bigBank, kontoinhaber: newFullName };
        }
      }
      
      return newData;
    });
  };
  
  const handleModeChange = (mode: FormMode) => {
    updateFormData({ mode });
  };
  
  const getHeaderTitle = () => {
    switch (formData.selectedKrankenkasse) {
      case 'viactiv': return 'VIACTIV Formular';
      case 'novitas': return 'Novitas BKK Formular';
      case 'dak': return 'DAK Formular';
      case 'bkk_gs': return 'BKK GS Formular';
      case 'big_plusbonus': return 'BIG direkt gesund Formular';
      default: return 'Smart Formular';
    }
  };

  const getHeaderSubtitle = () => {
    switch (formData.selectedKrankenkasse) {
      case 'viactiv': return 'VIACTIV Krankenkasse - Beitrittserklärung';
      case 'novitas': return 'Novitas BKK - Familienversicherung';
      case 'dak': return 'DAK - Familienversicherung';
      case 'bkk_gs': return 'BKK GILDEMEISTER SEIDENSTICK - Online-Formular';
      case 'big_plusbonus': return 'BIG direkt gesund - Plusbonus Antrag';
      default: return 'Bitte wählen Sie eine Krankenkasse aus';
    }
  };
  
  const handleExport = async () => {
    // Basis-Validierung für alle Krankenkassen
    if (!formData.mitgliedName || !formData.mitgliedVorname) {
      toast.error('Bitte geben Sie Name und Vorname des Mitglieds ein.');
      return;
    }
    
    // Geburtsdatum nur prüfen wenn NICHT Novitas (bei Novitas ausgeblendet)
    if (formData.selectedKrankenkasse !== 'novitas' && formData.selectedKrankenkasse !== 'big_plusbonus' && !formData.mitgliedGeburtsdatum) {
      toast.error('Bitte geben Sie das Geburtsdatum des Mitglieds ein.');
      return;
    }
    
    // Unterschrift wird automatisch aus dem Nachnamen des Mitglieds erzeugt
    // (Nachname ist bereits Pflicht); kein zusätzlicher Check nötig.

    // BIG Plusbonus-spezifische Validierung
    if (formData.selectedKrankenkasse === 'big_plusbonus') {
      if (!formData.mitgliedStrasse || !formData.mitgliedHausnummer || !formData.mitgliedPlz || !formData.ort) {
        toast.error('Bitte vollständige Adresse (Straße, Hausnr., PLZ, Ort) eingeben.');
        return;
      }
      if (!formData.bigGeschlecht) {
        toast.error('Bitte wählen Sie das Geschlecht aus.');
        return;
      }
      const b = formData.bigBank;
      if (!b.kontoinhaber || !b.kreditinstitut || !b.iban || !b.bic || !b.ort || !b.datum) {
        toast.error('Bitte alle Bankdaten (Kontoinhaber, Kreditinstitut, IBAN, BIC, Ort, Datum) ausfüllen.');
        return;
      }
      if (formData.bigFamilienversicherung) {
        if (!formData.mitgliedKvNummer) { toast.error('Bitte KV-Nummer eingeben.'); return; }
        if (!formData.mitgliedKrankenkasse) { toast.error('Bitte Name der bisherigen Krankenkasse eingeben.'); return; }
        if (!formData.familienstand) { toast.error('Bitte Familienstand auswählen.'); return; }
        if (!formData.telefon || !formData.email) { toast.error('Telefon und E-Mail sind Pflicht.'); return; }
        if (!formData.mitgliedGeburtsdatum) { toast.error('Bitte Geburtsdatum des Mitglieds eingeben.'); return; }
      }
    }
    
    // VIACTIV-spezifische Validierung
    if (formData.selectedKrankenkasse === 'big_plusbonus') {
      // BIG Plusbonus: keine zusätzlichen Pflichtfelder (KV-Nr, Krankenkasse, Familienstand,
      // Telefon, Email, Geburtsdatum sind nicht erforderlich). Adresse + Bank wurden bereits
      // weiter oben validiert.
    }
    else if (formData.selectedKrankenkasse === 'viactiv') {
      if (!formData.ort) {
        toast.error('Bitte geben Sie den Ort ein.');
        return;
      }
      if (!formData.viactivGeschlecht) {
        toast.error('Bitte wählen Sie das Geschlecht aus.');
        return;
      }
      if (!formData.viactivBeschaeftigung) {
        toast.error('Bitte wählen Sie den Beschäftigungsstatus aus.');
        return;
      }
      if (!formData.viactivVersicherungsart) {
        toast.error('Bitte wählen Sie die bisherige Versicherungsart aus.');
        return;
      }
      // Bonus-Programm Validierung
      if (!formData.viactivBonusVertragsnummer) {
        toast.error('Bitte geben Sie die Antrags-/Vertragsnummer für das Bonus-Programm ein.');
        return;
      }
      if (!formData.viactivBonusIBAN) {
        toast.error('Bitte geben Sie die IBAN für das Bonus-Programm ein.');
        return;
      }
      if (!formData.viactivBonusKontoinhaber) {
        toast.error('Bitte geben Sie den Kontoinhaber für das Bonus-Programm ein.');
        return;
      }
    }
    // Novitas-spezifische Validierung
    else if (formData.selectedKrankenkasse === 'novitas') {
      if (!formData.mitgliedKvNummer) {
        toast.error('Bitte geben Sie die KV-Nummer ein.');
        return;
      }
      if (!formData.mitgliedKrankenkasse) {
        toast.error('Bitte geben Sie den Namen der Krankenkasse ein.');
        return;
      }
      if (!formData.familienstand) {
        toast.error('Bitte wählen Sie den Familienstand aus.');
        return;
      }
      // Ort-Validierung entfernt - Feld ist für Novitas ausgeblendet
    }
    // DAK-spezifische Validierung
    else if (formData.selectedKrankenkasse === 'dak') {
      if (!formData.mitgliedKvNummer) {
        toast.error('Bitte geben Sie die KV-Nummer ein.');
        return;
      }
      if (!formData.mitgliedKrankenkasse) {
        toast.error('Bitte geben Sie den Namen der Krankenkasse ein.');
        return;
      }
      if (!formData.mitgliedGeburtsdatum) {
        toast.error('Bitte geben Sie das Geburtsdatum des Mitglieds ein.');
        return;
      }
    }
    // BKK GS-spezifische Validierung
    else {
      if (!formData.mitgliedKvNummer) {
        toast.error('Bitte geben Sie die KV-Nummer ein.');
        return;
      }
      
      if (!formData.mitgliedKrankenkasse) {
        toast.error('Bitte geben Sie den Namen der Krankenkasse ein.');
        return;
      }
      
      if (!formData.familienstand) {
        toast.error('Bitte wählen Sie den Familienstand aus.');
        return;
      }
      
      if (!formData.ort) {
        toast.error('Bitte geben Sie den Ort ein.');
        return;
      }
      
      // Rundum-Sicher-Paket Validierung
      if (!formData.rundumSicherPaket.zusatzversicherung1) {
        toast.error('Bitte wählen Sie Zusatzversicherung 1 (Pflicht) aus.');
        return;
      }
      
      // Jahresbeitrag min. 300€
      const jahresbeitragClean = formData.rundumSicherPaket.jahresbeitrag.replace(/[€\s]/g, '').replace(',', '.');
      const jahresbeitragAmount = parseFloat(jahresbeitragClean);
      if (isNaN(jahresbeitragAmount) || jahresbeitragAmount < 300) {
        toast.error('Der Jahresbeitrag muss mindestens 300 € betragen.');
        return;
      }
      
      if (!formData.rundumSicherPaket.iban) {
        toast.error('Bitte geben Sie die IBAN ein.');
        return;
      }
      
      if (!formData.rundumSicherPaket.kontoinhaber) {
        toast.error('Bitte geben Sie den Namen des Kontoinhabers ein.');
        return;
      }
      
      // Datenschutz-Validierung
      if (!formData.rundumSicherPaket.datenschutz1 || !formData.rundumSicherPaket.datenschutz2) {
        toast.error('Bitte stimmen Sie den Datenschutzbestimmungen zu.');
        return;
      }
    }
    
    setIsExporting(true);
    let savedAppId = applicationId;
    let pdfCount = 0;
    try {
      // Auto-save before exporting so every export is tracked
      try {
        const app = await save({ applicationId, formData });
        savedAppId = app.id;
        if (!applicationId) setApplicationId(app.id);
      } catch {
        // Saving failure shouldn't block the PDF export
      }
      // BIG Plusbonus Export
      if (formData.selectedKrankenkasse === 'big_plusbonus') {
        if (formData.bigFamilienversicherung) {
          toast.info('BIG Familienversicherung + Plusbonus PDFs werden erstellt...');
          await exportBigFamilienversicherung(formData);
          await exportBigPlusbonus(formData);
          pdfCount = 2 + Math.max(0, Math.ceil(Math.max(0, formData.kinder.length - 3) / 3));
          toast.success('BIG PDFs erfolgreich exportiert!');
        } else {
          toast.info('BIG direkt gesund Plusbonus PDF wird erstellt...');
          await exportBigPlusbonus(formData);
          pdfCount = 1;
          toast.success('BIG Plusbonus PDF erfolgreich exportiert!');
        }
      }
      // VIACTIV Export
      else if (formData.selectedKrankenkasse === 'viactiv') {
        if (formData.viactivFamilienangehoerigeMitversichern) {
          // Berechne Anzahl der PDFs inkl. eigener Mitgliedschaft für Kinder
          const kinderMitEigenerMitgliedschaft = formData.kinder.filter(k => k.eigeneMitgliedschaft).length;
          const familienversicherteKinder = formData.kinder.length - kinderMitEigenerMitgliedschaft;
          
          const numberOfFamilyPDFs = familienversicherteKinder > 0 || formData.ehegatte.name 
            ? Math.max(1, Math.ceil(familienversicherteKinder / 3)) 
            : 0;
          
          const hasSpouseWithOwnMembership = formData.ehegatte.name && formData.ehegatte.bisherigArt === 'mitgliedschaft';
          const numberOfBEs = 1 + (hasSpouseWithOwnMembership ? 1 : 0) + kinderMitEigenerMitgliedschaft;
          const numberOfBonusPDFs = 1 + (formData.ehegatte.name ? 1 : 0) + formData.kinder.length;
          
          toast.info(`Es werden ${numberOfBEs} Beitrittserklärung(en), ${numberOfFamilyPDFs} Familienversicherungs-PDF(s) und ${numberOfBonusPDFs} Bonus-PDF(s) erstellt...`);
          await exportViactivBeitrittserklaerung(formData);
          await exportViactivFamilienversicherung(formData);
          await exportViactivBonusPDFs(formData);
          pdfCount = numberOfBEs + numberOfFamilyPDFs + numberOfBonusPDFs;
        } else {
          toast.info('VIACTIV Beitrittserklärung und Bonus-PDF werden erstellt...');
          await exportViactivBeitrittserklaerung(formData);
          await exportViactivBonusPDFs(formData);
          pdfCount = 2;
        }
        toast.success('VIACTIV PDF(s) erfolgreich exportiert!');
      }
      // Novitas BKK Export
      else if (formData.selectedKrankenkasse === 'novitas') {
        const numberOfPDFs = Math.max(1, Math.ceil(formData.kinder.length / 3));
        toast.info(`Es werden ${numberOfPDFs} Novitas Familienversicherungs-PDF(s) erstellt...`);
        await exportNovitasFamilienversicherung(formData);
        pdfCount = numberOfPDFs;
        toast.success('Novitas BKK Familienversicherung erfolgreich exportiert!');
      }
      // DAK Export
      else if (formData.selectedKrankenkasse === 'dak') {
        const numberOfPDFs = Math.max(1, Math.ceil(formData.kinder.length / 2)); // Nur 2 Kinder pro PDF!
        toast.info(`Es werden ${numberOfPDFs} DAK Familienversicherungs-PDF(s) erstellt...`);
        await exportDAKFamilienversicherung(formData);
        pdfCount = numberOfPDFs;
        toast.success('DAK Familienversicherung erfolgreich exportiert!');
      }
      // BKK GS Export
      else {
        if (formData.mode === 'nur_rundum') {
          toast.info('Es wird 1 Rundum-Sicher-Paket-PDF erstellt.');
          await exportRundumSicherPaketOnly(formData);
          pdfCount = 1;
        } else {
          const numberOfPDFs = Math.max(1, Math.ceil(formData.kinder.length / 3));
          const numberOfRundumPDFs = 1 + (formData.ehegatte.name ? 1 : 0) + formData.kinder.length;
          toast.info(`Es werden ${numberOfPDFs} Familienversicherungs-PDF(s) und ${numberOfRundumPDFs} Rundum-Sicher-Paket-PDF(s) erstellt.`);
          await exportFilledPDF(formData);
          pdfCount = numberOfPDFs + numberOfRundumPDFs;
        }
        toast.success('PDF erfolgreich exportiert!');
      }
      if (savedAppId) {
        try { await markExported(savedAppId, pdfCount); } catch { /* non-blocking */ }
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Fehler beim Exportieren des PDFs. Bitte versuchen Sie es erneut.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sticky glass top bar */}
      <header className="sticky top-0 z-40 border-b border-border/60 glass-bar">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-gradient-hero text-primary-foreground flex items-center justify-center shadow-card shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="font-display text-base md:text-lg font-semibold leading-tight truncate">
                {getHeaderTitle()}
              </div>
              <div className="text-xs text-muted-foreground truncate hidden sm:block">
                {getHeaderSubtitle()}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <DocumentMergeDialog />
            <FreitextImportDialog formData={formData} setFormData={setFormData} currentMode={formData.mode} selectedKrankenkasse={formData.selectedKrankenkasse} />
            <JsonImportDialog formData={formData} setFormData={setFormData} currentMode={formData.mode} selectedKrankenkasse={formData.selectedKrankenkasse} />
            <div className="w-px h-6 bg-border/70 mx-1 hidden md:block" />
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" title="Meine Anträge">
              <Link to="/antraege"><Archive className="h-4 w-4" /><span className="hidden md:inline ml-1">Anträge</span></Link>
            </Button>
            {isAdmin && (
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" title="Admin">
                <Link to="/admin"><Settings className="h-4 w-4" /><span className="hidden md:inline ml-1">Admin</span></Link>
              </Button>
            )}
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => supabase.auth.signOut()}
              className="text-muted-foreground hover:text-foreground"
              title="Abmelden"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden md:inline ml-1">Abmelden</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero / context strip */}
      <div className="bg-gradient-surface border-b border-border/60">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 py-6 md:py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-medium text-accent bg-accent/10 px-2.5 py-1 rounded-full mb-3">
              <Sparkles className="h-3.5 w-3.5" /> Smart-Antrag
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
              {formData.selectedKrankenkasse ? getHeaderSubtitle() : 'Bitte wählen Sie eine Krankenkasse'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              <AlertCircle className="inline h-4 w-4 mr-1 -mt-0.5 text-accent" />
              Automatisch ausgefüllt: bisherige Versicherung, Anlass, Beginn (+3 Monate), Informationsblatt — und vieles mehr.
            </p>
          </div>
        </div>
      </div>

      {/* Main Form */}
      <main className="max-w-6xl mx-auto px-4 lg:px-6 py-8 grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-8">
        {/* Side TOC (desktop only) */}
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-1 text-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-3">
              Abschnitte
            </div>
            {[
              { id: 'sec-krankenkasse', label: 'Krankenkasse' },
              ...(formData.selectedKrankenkasse ? [{ id: 'sec-mitglied', label: 'Mitglied' }] : []),
              ...(formData.selectedKrankenkasse && formData.selectedKrankenkasse !== 'big_plusbonus' && !(formData.selectedKrankenkasse === 'bkk_gs' && formData.mode === 'nur_rundum') ? [
                { id: 'sec-ehegatte', label: 'Ehegatte' },
                { id: 'sec-kinder', label: 'Kinder' },
              ] : []),
              ...(formData.selectedKrankenkasse === 'bkk_gs' ? [{ id: 'sec-rundum', label: 'Rundum-Sicher' }] : []),
              ...(formData.selectedKrankenkasse === 'big_plusbonus' ? [{ id: 'sec-bigplus', label: 'Plusbonus' }] : []),
              ...(formData.selectedKrankenkasse ? [{ id: 'sec-signature', label: 'Unterschrift' }] : []),
            ].map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="flex items-center justify-between px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors group"
              >
                <span>{item.label}</span>
                <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            ))}
          </nav>
        </aside>

        <div>
        <form onSubmit={(e) => e.preventDefault()} className="space-y-2">
          {/* Krankenkassen-Auswahl */}
          <div id="sec-krankenkasse" className="bg-card rounded-2xl shadow-card border border-border/60 p-6 mb-4 scroll-mt-24 animate-fade-in-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold leading-tight">Krankenkasse auswählen</h2>
                <p className="text-xs text-muted-foreground">Das Formular passt sich automatisch an.</p>
              </div>
            </div>
            {/* Quick-pick chips */}
            <div className="flex flex-wrap gap-2 mb-3">
              {KRANKENKASSEN_OPTIONS.map((opt) => {
                const active = formData.selectedKrankenkasse === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateFormData({ selectedKrankenkasse: opt.value as Krankenkasse })}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                      active
                        ? 'bg-primary text-primary-foreground border-primary shadow-card'
                        : 'bg-card text-foreground border-border hover:border-accent hover:text-accent'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <Select
              value={formData.selectedKrankenkasse}
              onValueChange={(value) => updateFormData({ selectedKrankenkasse: value as Krankenkasse })}
            >
              <SelectTrigger className="w-full md:w-96">
                <SelectValue placeholder="Krankenkasse auswählen..." />
              </SelectTrigger>
              <SelectContent>
                {KRANKENKASSEN_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-3">
              {formData.selectedKrankenkasse === 'big_plusbonus'
                ? 'Es wird der BIG direkt gesund Plusbonus-Antrag erstellt.'
                : formData.selectedKrankenkasse === 'dak' 
                ? 'Es wird die DAK Familienversicherung erstellt.'
                : formData.selectedKrankenkasse === 'novitas' 
                  ? 'Es wird die Novitas BKK Familienversicherung erstellt.'
                  : formData.selectedKrankenkasse === 'viactiv' 
                    ? 'Es wird die VIACTIV Beitrittserklärung erstellt.'
                    : 'Es werden BKK GS Familienversicherung und Rundum-Sicher-Paket erstellt.'}
            </p>
          </div>
          
          {/* Formular-Sektionen nur anzeigen wenn Krankenkasse gewählt */}
          {formData.selectedKrankenkasse && (
            <>
              {/* Modus-Auswahl (nur für BKK GS) */}
              {formData.selectedKrankenkasse === 'bkk_gs' && (
                <div className="bg-card rounded-2xl shadow-card border border-border/60 p-6 mb-4 animate-fade-in-up">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Formular-Modus auswählen
                  </h2>
                  <RadioGroup
                    value={formData.mode}
                    onValueChange={(value) => handleModeChange(value as FormMode)}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    <Label
                      htmlFor="mode-family"
                      className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        formData.mode === 'familienversicherung_und_rundum'
                          ? 'border-primary bg-primary/5 shadow-card'
                          : 'border-border hover:border-accent/60'
                      }`}
                    >
                      <RadioGroupItem value="familienversicherung_und_rundum" id="mode-family" className="mt-1" />
                      <div>
                        <div className="flex items-center gap-2 font-medium">
                          <Users className="h-4 w-4 text-primary" />
                          Familienversicherung + Rundum-Sicher-Paket
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Für Mitglied mit Ehegatte und/oder Kindern. Erstellt beide PDF-Typen.
                        </p>
                      </div>
                    </Label>
                    <Label
                      htmlFor="mode-single"
                      className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        formData.mode === 'nur_rundum'
                          ? 'border-primary bg-primary/5 shadow-card'
                          : 'border-border hover:border-accent/60'
                      }`}
                    >
                      <RadioGroupItem value="nur_rundum" id="mode-single" className="mt-1" />
                      <div>
                        <div className="flex items-center gap-2 font-medium">
                          <User className="h-4 w-4 text-primary" />
                          Nur Rundum-Sicher-Paket
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Nur für das Mitglied selbst. Keine Familienangehörigen erforderlich.
                        </p>
                      </div>
                    </Label>
                  </RadioGroup>
                </div>
              )}
              
              <div id="sec-mitglied"><MemberSection formData={formData} updateFormData={updateFormData} /></div>
              
              {/* BKK GS spezifische Sektionen */}
              {formData.selectedKrankenkasse === 'bkk_gs' && (
                <>
                  {formData.mode === 'familienversicherung_und_rundum' && (
                    <>
                      <div id="sec-ehegatte"><SpouseSection formData={formData} updateFormData={updateFormData} /></div>
                      <div id="sec-kinder"><ChildrenSection formData={formData} updateFormData={updateFormData} /></div>
                    </>
                  )}
                  <div id="sec-rundum"><RundumSicherPaketSection formData={formData} updateFormData={updateFormData} /></div>
                </>
              )}
              
              {/* VIACTIV-spezifische Sektionen */}
              {formData.selectedKrankenkasse === 'viactiv' && (
                <div id="sec-ehegatte"><ViactivSection formData={formData} updateFormData={updateFormData} /></div>
              )}
              
              {/* Novitas BKK spezifische Sektionen */}
              {formData.selectedKrankenkasse === 'novitas' && (
                <>
                  <div id="sec-ehegatte"><SpouseSection formData={formData} updateFormData={updateFormData} /></div>
                  <div id="sec-kinder"><ChildrenSection formData={formData} updateFormData={updateFormData} /></div>
                </>
              )}
              
              {/* DAK spezifische Sektionen */}
              {formData.selectedKrankenkasse === 'dak' && (
                <>
                  <div id="sec-ehegatte"><SpouseSection formData={formData} updateFormData={updateFormData} /></div>
                  <div id="sec-kinder"><ChildrenSection formData={formData} updateFormData={updateFormData} /></div>
                </>
              )}
              
              {/* BIG direkt gesund (Plusbonus) spezifische Sektionen */}
              {formData.selectedKrankenkasse === 'big_plusbonus' && (
                <div id="sec-bigplus"><BigPlusbonusSection formData={formData} updateFormData={updateFormData} /></div>
              )}

              <div id="sec-signature"><SignatureSection formData={formData} updateFormData={updateFormData} /></div>
              
              {/* Export Button */}
              <div className="sticky bottom-4 pt-4 z-30">
                <div className="glass-bar rounded-2xl shadow-elevated border border-border/70 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="text-center md:text-left flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <FileDown className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {applicationId ? 'Antrag wird aktualisiert' : 'Bereit zum Exportieren?'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Jeder Export wird verschlüsselt gespeichert und im Audit-Log erfasst.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      onClick={handleSaveDraft}
                      disabled={saving || isExporting}
                      className="gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {saving ? 'Speichere…' : applicationId ? 'Aktualisieren' : 'Entwurf speichern'}
                    </Button>
                    <Button
                      type="button"
                      size="lg"
                      onClick={handleExport}
                      disabled={isExporting}
                      className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 shadow-card"
                    >
                      <FileDown className="h-5 w-5" />
                      {isExporting ? 'Exportiere…' : 'PDF Exportieren'}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </form>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="border-t border-border/60 py-6 px-4 mt-8">
        <div className="max-w-6xl mx-auto text-center text-xs text-muted-foreground">
          Smart-Formular · Unterstützt das Ausfüllen von Krankenkassen-Anträgen.
        </div>
      </footer>
    </div>
  );
};

export default Index;
