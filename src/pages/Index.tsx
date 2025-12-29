import React, { useState } from 'react';
import { FormData, createInitialFormData } from '@/types/form';
import { MemberSection } from '@/components/MemberSection';
import { SpouseSection } from '@/components/SpouseSection';
import { ChildrenSection } from '@/components/ChildrenSection';
import { SignatureSection } from '@/components/SignatureSection';
import { Button } from '@/components/ui/button';
import { FileDown, FileText, AlertCircle } from 'lucide-react';
import { exportFilledPDF } from '@/utils/pdfExport';
import { toast } from 'sonner';

const Index = () => {
  const [formData, setFormData] = useState<FormData>(createInitialFormData);
  const [isExporting, setIsExporting] = useState(false);
  
  const updateFormData = (updates: Partial<FormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };
  
  const handleExport = async () => {
    // Validierung - nur Name und Vorname erforderlich
    // Die Unterschrift wird automatisch aus dem Nachnamen generiert
    if (!formData.mitgliedName || !formData.mitgliedVorname) {
      toast.error('Bitte geben Sie mindestens Name und Vorname des Mitglieds ein.');
      return;
    }
    
    const numberOfPDFs = Math.max(1, Math.ceil(formData.kinder.length / 3));
    if (numberOfPDFs > 1) {
      toast.info(`Es werden ${numberOfPDFs} PDFs erstellt (je max. 3 Kinder pro PDF).`);
    }
    
    setIsExporting(true);
    try {
      await exportFilledPDF(formData);
      toast.success('PDF erfolgreich exportiert!');
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
          <div className="flex items-center gap-3 mb-2">
            <FileText className="h-8 w-8" />
            <h1 className="text-2xl md:text-3xl font-bold">
              Fragebogen für die Familienversicherung
            </h1>
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
          <MemberSection formData={formData} updateFormData={updateFormData} />
          <SpouseSection formData={formData} updateFormData={updateFormData} />
          <ChildrenSection formData={formData} updateFormData={updateFormData} />
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
