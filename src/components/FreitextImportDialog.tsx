import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Sparkles, Loader2, Copy, Check } from 'lucide-react';
import { FormData, FormMode } from '@/types/form';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';

interface FreitextImportDialogProps {
  formData: FormData;
  setFormData: (data: FormData) => void;
  currentMode: FormMode;
}

export const FreitextImportDialog: React.FC<FreitextImportDialogProps> = ({ formData, setFormData, currentMode }) => {
  const [open, setOpen] = useState(false);
  const [freitextInput, setFreitextInput] = useState('');
  const [jsonInput, setJsonInput] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [copied, setCopied] = useState(false);

  const handleExtractWithGemini = async () => {
    if (!freitextInput.trim()) {
      toast.error('Bitte gib Text ein.');
      return;
    }

    setIsExtracting(true);
    setAnalysisProgress(10);

    try {
      const requestBody: { 
        text: string; 
        mode: FormMode;
      } = {
        text: freitextInput,
        mode: currentMode
      };

      setAnalysisProgress(30);

      const { data, error } = await supabase.functions.invoke('process-insurance-gemini3', {
        body: requestBody
      });

      setAnalysisProgress(80);

      if (error) {
        console.error('Edge function error:', error);
        toast.error('Fehler beim Aufrufen der KI-Funktion.');
        return;
      }

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setAnalysisProgress(100);
      toast.success('Daten erfolgreich extrahiert!');

      // Extract the actual form data (exclude improvedImages if present)
      const { improvedImages, ...formDataFromAi } = data;
      setJsonInput(JSON.stringify(formDataFromAi, null, 2));
      
    } catch (error) {
      console.error('Error extracting data:', error);
      toast.error('Fehler bei der Datenextraktion. Bitte versuche es erneut.');
    } finally {
      setIsExtracting(false);
      setAnalysisProgress(0);
    }
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(jsonInput) as FormData;
      
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Ungültiges JSON-Format');
      }
      
      setFormData({
        ...formData,
        ...parsed,
        ehegatte: parsed.ehegatte ? { ...formData.ehegatte, ...parsed.ehegatte } : formData.ehegatte,
        kinder: parsed.kinder || formData.kinder,
        rundumSicherPaket: parsed.rundumSicherPaket 
          ? { ...formData.rundumSicherPaket, ...parsed.rundumSicherPaket }
          : formData.rundumSicherPaket,
      });
      
      toast.success('JSON erfolgreich importiert!');
      setOpen(false);
      setJsonInput('');
      setFreitextInput('');
    } catch (error) {
      toast.error('Ungültiges JSON-Format. Bitte überprüfen Sie die Eingabe.');
      console.error('JSON parse error:', error);
    }
  };

  const handleCopyJson = async () => {
    if (!jsonInput.trim()) {
      toast.error('Keine JSON-Daten zum Kopieren');
      return;
    }
    try {
      await navigator.clipboard.writeText(jsonInput);
      setCopied(true);
      toast.success('JSON kopiert!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Kopieren fehlgeschlagen');
    }
  };

  const handleDialogClose = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setFreitextInput('');
      setJsonInput('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileText className="h-4 w-4" />
          Freitext Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Freitext mit KI analysieren</DialogTitle>
          <DialogDescription>
            Fügen Sie beliebigen Text ein – die KI extrahiert automatisch alle Versicherungsdaten.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Freitext-Eingabe */}
          <div className="space-y-2">
            <label className="text-sm font-medium block">Freitext hier einfügen:</label>
            <Textarea
              value={freitextInput}
              onChange={(e) => setFreitextInput(e.target.value)}
              placeholder="Füge hier beliebigen Text ein (z.B. E-Mail, Brief, Notizen), aus dem die Versicherungsdaten extrahiert werden sollen..."
              className="min-h-[150px]"
            />
          </div>

          {/* Extract Button with Progress */}
          <div className="space-y-2">
            <Button 
              onClick={handleExtractWithGemini} 
              disabled={isExtracting || !freitextInput.trim()}
              className="w-full gap-2"
              size="lg"
            >
              {isExtracting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  KI analysiert Text...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Daten mit KI extrahieren
                </>
              )}
            </Button>
            
            {isExtracting && (
              <Progress value={analysisProgress} className="h-2" />
            )}
          </div>

          {/* JSON Ergebnis */}
          {jsonInput && (
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Extrahierte JSON-Daten:</label>
                <Button variant="secondary" size="sm" onClick={handleCopyJson} className="gap-2">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  JSON kopieren
                </Button>
              </div>
              <Textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                className="font-mono text-xs min-h-[200px]"
              />
            </div>
          )}
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleImport} disabled={!jsonInput.trim()}>
              In Formular importieren
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
