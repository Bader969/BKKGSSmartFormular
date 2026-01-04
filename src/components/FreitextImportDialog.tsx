import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { FileText, Sparkles, Loader2, Copy, Check, Clipboard } from 'lucide-react';
import { FormData, FormMode } from '@/types/form';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';

interface CopyBlockData {
  copyBlockMitglied: string;
  copyBlockEhegatte: string;
}

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
  const [copyBlockData, setCopyBlockData] = useState<CopyBlockData | null>(null);
  const [copiedBlock, setCopiedBlock] = useState<string | null>(null);

  // Map FormMode to simple formMode for API
  const mapFormMode = (mode: FormMode): 'familie' | 'einzel' => {
    return mode === 'familienversicherung_und_rundum' ? 'familie' : 'einzel';
  };

  const handleCopyBlock = async (blockType: 'mitglied' | 'ehegatte', text: string) => {
    if (!text.trim()) {
      toast.error('Kein Text zum Kopieren');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopiedBlock(blockType);
      toast.success('Block in Zwischenablage kopiert!');
      setTimeout(() => setCopiedBlock(null), 2500);
    } catch {
      toast.error('Kopieren fehlgeschlagen');
    }
  };

  // Build compact formatted copy block from extracted data
  const buildCopyBlock = (data: any, type: 'mitglied' | 'ehegatte'): string => {
    const lines: string[] = [];
    
    if (type === 'mitglied') {
      // Zeile 1: Name Vorname  Geburtsdatum, Geburtsort, Nationalität
      const nameParts = [data.mitgliedName, data.mitgliedVorname].filter(Boolean).join(' ');
      const birthParts = [data.mitgliedGeburtsdatum, data.mitgliedGeburtsort, data.mitgliedStaatsangehoerigkeit || 'DE'].filter(Boolean).join(', ');
      if (nameParts || birthParts) {
        lines.push([nameParts, birthParts].filter(Boolean).join('  '));
      }
      
      // Zeile 2: Straße Hausnummer, PLZ Ort
      const streetParts = [data.mitgliedStrasse, data.mitgliedHausnummer].filter(Boolean).join(' ');
      const cityParts = [data.mitgliedPlz, data.ort].filter(Boolean).join(' ');
      const addressParts = [streetParts, cityParts].filter(Boolean).join(', ');
      if (addressParts) lines.push(addressParts);
      
      // Zeile 3: Bisherige Kasse: KV-Nummer
      if (data.mitgliedKrankenkasse || data.mitgliedKvNummer) {
        const kasseParts = [data.mitgliedKrankenkasse, data.mitgliedKvNummer].filter(Boolean).join(': ');
        if (kasseParts) lines.push(kasseParts);
      }
      
      // Zeile 4: Email, Telefon
      const contactParts = [data.email, data.telefon].filter(Boolean).join(', ');
      if (contactParts) lines.push(contactParts);
      
      // Zeile 5: Arbeitgeber * Arbeitgeber-Adresse
      if (data.arbeitgeberName || data.arbeitgeberAdresse) {
        const arbeitgeberParts = [data.arbeitgeberName, data.arbeitgeberAdresse].filter(Boolean).join(' * ');
        if (arbeitgeberParts) lines.push(arbeitgeberParts);
      }
      
      // Zeile 6: Familienstand
      if (data.familienstand) {
        lines.push(data.familienstand);
      }
      
      // Zeile 7: IBAN (falls vorhanden)
      if (data.rundumSicherPaket?.iban) {
        lines.push(`IBAN: ${data.rundumSicherPaket.iban}`);
      }
    } else if (type === 'ehegatte' && data.ehegatte) {
      const e = data.ehegatte;
      
      // Zeile 1: Name Vorname  Geburtsdatum, Geburtsort, Nationalität
      const nameParts = [e.name, e.vorname].filter(Boolean).join(' ');
      const birthParts = [e.geburtsdatum, e.geburtsort, e.staatsangehoerigkeit || 'DE'].filter(Boolean).join(', ');
      if (nameParts || birthParts) {
        lines.push([nameParts, birthParts].filter(Boolean).join('  '));
      }
      
      // Zeile 2: Straße PLZ Ort
      const addressParts = [e.strasse, e.plz, e.ort].filter(Boolean).join(' ');
      if (addressParts) lines.push(addressParts);
      
      // Zeile 3: Bisherige Kasse: Mitgliedsnummer
      if (e.bisherigKrankenkasse || e.mitgliedsnummer) {
        const kasseParts = [e.bisherigKrankenkasse, e.mitgliedsnummer].filter(Boolean).join(': ');
        if (kasseParts) lines.push(kasseParts);
      }
      
      // Zeile 4: Email, Telefon
      const contactParts = [e.email, e.telefon].filter(Boolean).join(', ');
      if (contactParts) lines.push(contactParts);
      
      // Zeile 5: Arbeitgeber (falls vorhanden)
      if (e.arbeitgeber) {
        lines.push(e.arbeitgeber);
      }
      
      // Zeile 6: Familienstand
      if (e.familienstand) {
        lines.push(e.familienstand);
      }
    }
    
    return lines.join('\n');
  };

  const handleExtractWithGemini = async () => {
    if (!freitextInput.trim()) {
      toast.error('Bitte gib Text ein.');
      return;
    }

    setIsExtracting(true);
    setAnalysisProgress(10);
    setCopyBlockData(null);

    try {
      const formMode = mapFormMode(currentMode);
      
      const requestBody = {
        text: freitextInput,
        mode: currentMode,
        formMode: formMode  // Send mapped mode
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
      
      // Build copy blocks
      const mitgliedBlock = buildCopyBlock(data, 'mitglied');
      const ehegatteBlock = data.ehegatte ? buildCopyBlock(data, 'ehegatte') : '';
      
      setCopyBlockData({
        copyBlockMitglied: mitgliedBlock,
        copyBlockEhegatte: ehegatteBlock
      });
      
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
      
      // Bei Kindern immer bisherigBestehtWeiter = true und bisherigBestehtWeiterBei = 'BKK GS' setzen
      const processedKinder = parsed.kinder?.map(kind => ({
        ...kind,
        bisherigBestehtWeiter: true,
        bisherigBestehtWeiterBei: 'BKK GS',
      })) || formData.kinder;
      
      setFormData({
        ...formData,
        ...parsed,
        ehegatte: parsed.ehegatte ? { ...formData.ehegatte, ...parsed.ehegatte } : formData.ehegatte,
        kinder: processedKinder,
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
      setCopyBlockData(null);
      setCopiedBlock(null);
    }
  };

  const CopyBlockSection = ({ 
    label, 
    text, 
    blockType 
  }: { 
    label: string; 
    text: string; 
    blockType: 'mitglied' | 'ehegatte';
  }) => (
    <div className="space-y-2 p-4 rounded-lg bg-muted/30 border border-border">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-foreground">{label}</label>
        <Button
          onClick={() => handleCopyBlock(blockType, text)}
          disabled={!text.trim()}
          size="sm"
          className={`gap-2 transition-all duration-300 ${
            copiedBlock === blockType 
              ? 'bg-green-600 hover:bg-green-600 text-white' 
              : ''
          }`}
        >
          {copiedBlock === blockType ? (
            <>
              <Check className="h-4 w-4 animate-scale-in" />
              Kopiert!
            </>
          ) : (
            <>
              <Clipboard className="h-4 w-4" />
              Gesamten Block kopieren
            </>
          )}
        </Button>
      </div>
      <Textarea
        value={text}
        readOnly
        className="font-mono text-sm bg-background/50 min-h-[120px] resize-none"
        placeholder="Keine Daten verfügbar"
      />
    </div>
  );

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
                  analysiert...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Daten Validieren
                </>
              )}
            </Button>
            
            {isExtracting && (
              <Progress value={analysisProgress} className="h-2" />
            )}
          </div>

          {/* Daten-Kopie Section */}
          {copyBlockData && (
            <div className="border-t pt-4 space-y-4">
              <label className="text-base font-semibold block text-foreground">📋 Daten-Kopie</label>
              
              {/* Mitglied Block */}
              {copyBlockData.copyBlockMitglied && (
                <CopyBlockSection 
                  label="Mitglied-Daten" 
                  text={copyBlockData.copyBlockMitglied}
                  blockType="mitglied"
                />
              )}
              
              {/* Ehegatte Block (only if data exists) */}
              {copyBlockData.copyBlockEhegatte && (
                <CopyBlockSection 
                  label="Ehegatte-Daten (als eigenes Mitglied)" 
                  text={copyBlockData.copyBlockEhegatte}
                  blockType="ehegatte"
                />
              )}
            </div>
          )}

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
