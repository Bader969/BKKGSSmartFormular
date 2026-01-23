import React, { useState, useEffect } from 'react';
import { FormData, FormMode, Krankenkasse, KRANKENKASSEN_OPTIONS, createInitialFormData } from '@/types/form';
import { MemberSection } from '@/components/MemberSection';
import { SpouseSection } from '@/components/SpouseSection';
import { ChildrenSection } from '@/components/ChildrenSection';
import { SignatureSection } from '@/components/SignatureSection';
import { RundumSicherPaketSection } from '@/components/RundumSicherPaketSection';
import { Button } from '@/components/ui/button';
import { FileDown, FileText, AlertCircle, Users, User, Building2 } from 'lucide-react';
import { exportFilledPDF, exportRundumSicherPaketOnly } from '@/utils/pdfExport';
import { exportViactivBeitrittserklaerung } from '@/utils/viactivExport';
import { toast } from 'sonner';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { LoginForm } from '@/components/LoginForm';
import { JsonImportDialog } from '@/components/JsonImportDialog';
import { FreitextImportDialog } from '@/components/FreitextImportDialog';
import { DocumentMergeDialog } from '@/components/DocumentMergeDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const Index = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [formData, setFormData] = useState<FormData>(createInitialFormData);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const authStatus = sessionStorage.getItem('isAuthenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} />;
  }
  
  const updateFormData = (updates: Partial<FormData>) => {
    setFormData(prev => {
      const newData = { ...prev, ...updates };
      
      // Automatische Synchronisierung der KV-Nummer zur Mitglied-Versichertennummer
      if ('mitgliedKvNummer' in updates) {
        newData.mitgliedVersichertennummer = updates.mitgliedKvNummer as string;
      }
      
      return newData;
    });
  };
  
  const handleModeChange = (mode: FormMode) => {
    updateFormData({ mode });
  };
  
  const handleExport = async () => {
    // Basis-Validierung für alle Krankenkassen
    if (!formData.mitgliedName || !formData.mitgliedVorname) {
      toast.error('Bitte geben Sie Name und Vorname des Mitglieds ein.');
      return;
    }
    
    if (!formData.mitgliedGeburtsdatum) {
      toast.error('Bitte geben Sie das Geburtsdatum des Mitglieds ein.');
      return;
    }
    
    if (!formData.unterschrift) {
      toast.error('Bitte unterschreiben Sie das Formular.');
      return;
    }
    
    // VIACTIV-spezifische Validierung
    if (formData.selectedKrankenkasse === 'viactiv') {
      if (!formData.ort) {
        toast.error('Bitte geben Sie den Ort ein.');
        return;
      }
      // VIACTIV braucht weniger Felder
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
    try {
      // VIACTIV Export
      if (formData.selectedKrankenkasse === 'viactiv') {
        toast.info('VIACTIV Beitrittserklärung wird erstellt...');
        await exportViactivBeitrittserklaerung(formData);
        toast.success('VIACTIV PDF erfolgreich exportiert!');
      } 
      // BKK GS Export
      else {
        if (formData.mode === 'nur_rundum') {
          toast.info('Es wird 1 Rundum-Sicher-Paket-PDF erstellt.');
          await exportRundumSicherPaketOnly(formData);
        } else {
          const numberOfPDFs = Math.max(1, Math.ceil(formData.kinder.length / 3));
          const numberOfRundumPDFs = 1 + (formData.ehegatte.name ? 1 : 0) + formData.kinder.length;
          toast.info(`Es werden ${numberOfPDFs} Familienversicherungs-PDF(s) und ${numberOfRundumPDFs} Rundum-Sicher-Paket-PDF(s) erstellt.`);
          await exportFilledPDF(formData);
        }
        toast.success('PDF erfolgreich exportiert!');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Fehler beim Exportieren des PDFs. Bitte versuchen Sie es erneut.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-6 px-4 shadow-lg">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8" />
              <h1 className="text-2xl md:text-3xl font-bold">
                BKK GS-Smart Formular
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <DocumentMergeDialog />
              <FreitextImportDialog formData={formData} setFormData={setFormData} currentMode={formData.mode} />
              <JsonImportDialog formData={formData} setFormData={setFormData} currentMode={formData.mode} />
            </div>
          </div>
          <p className="text-primary-foreground/80 text-sm md:text-base">
            BKK GILDEMEISTER SEIDENSTICK - Online-Formular
          </p>
        </div>
      </header>
      
      {/* Info Banner */}
      <div className="bg-secondary/10 border-b border-secondary/20 py-3 px-4">
        <div className="max-w-5xl mx-auto flex items-start gap-3 text-sm">
          <AlertCircle className="h-5 w-5 text-secondary shrink-0 mt-0.5" />
          <div className="text-foreground/80">
            <strong className="text-foreground">Automatisch ausgefüllt:</strong>{' '}
            Bisherige Versicherung (eigene Mitgliedschaft), Anlass (Beginn Mitgliedschaft), 
            Beginn (+3 Monate), Informationsblatt (Ja), Versicherung besteht weiter (bei BKK GS).
          </div>
        </div>
      </div>
      
      {/* Main Form */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <form onSubmit={(e) => e.preventDefault()} className="space-y-2">
          {/* Krankenkassen-Auswahl */}
          <div className="bg-card rounded-xl shadow-sm border p-6 mb-4">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Krankenkasse auswählen
            </h2>
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
            <p className="text-sm text-muted-foreground mt-2">
              {formData.selectedKrankenkasse === 'viactiv' 
                ? 'Es wird die VIACTIV Beitrittserklärung erstellt.'
                : 'Es werden BKK GS Familienversicherung und Rundum-Sicher-Paket erstellt.'}
            </p>
          </div>
          
          {/* Modus-Auswahl (nur für BKK GS) */}
          {formData.selectedKrankenkasse === 'bkk_gs' && (
            <div className="bg-card rounded-xl shadow-sm border p-6 mb-4">
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
                  className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    formData.mode === 'familienversicherung_und_rundum'
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-primary/50'
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
                  className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    formData.mode === 'nur_rundum'
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-primary/50'
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
          
          <MemberSection formData={formData} updateFormData={updateFormData} />
          
          {/* BKK GS spezifische Sektionen */}
          {formData.selectedKrankenkasse === 'bkk_gs' && (
            <>
              {formData.mode === 'familienversicherung_und_rundum' && (
                <>
                  <SpouseSection formData={formData} updateFormData={updateFormData} />
                  <ChildrenSection formData={formData} updateFormData={updateFormData} />
                </>
              )}
              <RundumSicherPaketSection formData={formData} updateFormData={updateFormData} />
            </>
          )}
          
          <SignatureSection formData={formData} updateFormData={updateFormData} />
          
          {/* Export Button */}
          <div className="sticky bottom-4 pt-4">
            <div className="bg-card rounded-xl shadow-2xl border p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-center md:text-left">
                <p className="font-medium text-foreground">Bereit zum Exportieren?</p>
                <p className="text-sm text-muted-foreground">
                  Das ausgefüllte PDF wird heruntergeladen.
                </p>
              </div>
              <Button
                type="button"
                size="lg"
                onClick={handleExport}
                disabled={isExporting}
                className="w-full md:w-auto gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8"
              >
                <FileDown className="h-5 w-5" />
                {isExporting ? 'Exportiere...' : 'PDF Exportieren'}
              </Button>
            </div>
          </div>
        </form>
      </main>
      
      {/* Footer */}
      <footer className="bg-muted py-6 px-4 mt-8 border-t">
        <div className="max-w-5xl mx-auto text-center text-sm text-muted-foreground">
          <p>
            Dieses Online-Formular dient zur Unterstützung beim Ausfüllen des Fragebogens 
            für die Familienversicherung der BKK GILDEMEISTER SEIDENSTICK.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
