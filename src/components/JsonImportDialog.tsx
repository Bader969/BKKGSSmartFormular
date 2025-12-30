import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Copy, Check, Sparkles, Loader2, X, FileImage, Shield, Image } from 'lucide-react';
import { FormData } from '@/types/form';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';

interface JsonImportDialogProps {
  formData: FormData;
  setFormData: (data: FormData) => void;
}

interface UploadedFile {
  file: File;
  preview: string;
  base64: string;
  mimeType: string;
}

// Beispiel-JSON-Daten für alle Felder
const createExampleJson = (): FormData => ({
  mode: 'familienversicherung_und_rundum',
  mitgliedName: 'Mustermann',
  mitgliedVorname: 'Max',
  mitgliedGeburtsdatum: '15.05.1985',
  mitgliedKvNummer: 'A123456789',
  mitgliedKrankenkasse: 'BKK GS',
  familienstand: 'verheiratet',
  telefon: '0123456789',
  email: 'max.mustermann@example.com',
  beginnFamilienversicherung: '01.04.2026',
  datum: '2026-01-10',
  ort: 'Musterstadt',
  ehegatte: {
    name: 'Mustermann',
    vorname: 'Maria',
    geschlecht: 'w',
    geburtsdatum: '20.08.1987',
    abweichendeAnschrift: '',
    verwandtschaft: '',
    isEhegatteVerwandt: false,
    bisherigEndeteAm: '31.12.2025',
    bisherigBestandBei: 'AOK',
    bisherigArt: 'mitgliedschaft',
    bisherigVorname: 'Max',
    bisherigNachname: 'Mustermann',
    bisherigBestehtWeiter: true,
    bisherigBestehtWeiterBei: 'BKK GS',
    geburtsname: 'Musterfrau',
    geburtsort: 'Berlin',
    geburtsland: 'Deutschland',
    staatsangehoerigkeit: 'deutsch',
    versichertennummer: 'B987654321',
    familienversichert: true,
  },
  ehegatteKrankenkasse: 'AOK',
  kinder: [
    {
      name: 'Mustermann',
      vorname: 'Lisa',
      geschlecht: 'w',
      geburtsdatum: '10.03.2015',
      abweichendeAnschrift: '',
      verwandtschaft: 'leiblich',
      isEhegatteVerwandt: false,
      bisherigEndeteAm: '31.12.2025',
      bisherigBestandBei: 'AOK',
      bisherigArt: 'familienversicherung',
      bisherigVorname: 'Maria',
      bisherigNachname: 'Mustermann',
      bisherigBestehtWeiter: true,
      bisherigBestehtWeiterBei: 'BKK GS',
      geburtsname: '',
      geburtsort: 'Musterstadt',
      geburtsland: 'Deutschland',
      staatsangehoerigkeit: 'deutsch',
      versichertennummer: 'C111222333',
      familienversichert: true,
    },
    {
      name: 'Mustermann',
      vorname: 'Tom',
      geschlecht: 'm',
      geburtsdatum: '25.07.2018',
      abweichendeAnschrift: '',
      verwandtschaft: 'leiblich',
      isEhegatteVerwandt: false,
      bisherigEndeteAm: '31.12.2025',
      bisherigBestandBei: 'AOK',
      bisherigArt: 'familienversicherung',
      bisherigVorname: 'Maria',
      bisherigNachname: 'Mustermann',
      bisherigBestehtWeiter: true,
      bisherigBestehtWeiterBei: 'BKK GS',
      geburtsname: '',
      geburtsort: 'Musterstadt',
      geburtsland: 'Deutschland',
      staatsangehoerigkeit: 'deutsch',
      versichertennummer: 'D444555666',
      familienversichert: true,
    },
  ],
  unterschrift: '',
  unterschriftFamilie: '',
  rundumSicherPaket: {
    iban: 'DE89370400440532013000',
    kontoinhaber: 'Max Mustermann',
    zeitraumVon: '2026-01-01',
    zeitraumBis: '2026-12-31',
    datumRSP: '2026-01-10',
    arztMitglied: { name: 'Dr. Müller', ort: 'Musterstadt' },
    arztEhegatte: { name: 'Dr. Schmidt', ort: 'Musterstadt' },
    aerzteKinder: [
      { name: 'Dr. Kinderarzt', ort: 'Musterstadt' },
      { name: 'Dr. Kinderarzt', ort: 'Musterstadt' },
    ],
    zusatzversicherung1: 'zahnzusatz',
    zusatzversicherung2: 'unfall',
    jahresbeitrag: '500',
    datenschutz1: true,
    datenschutz2: true,
    unterschriftMakler: '',
  },
  mitgliedVersichertennummer: 'A123456789',
});

export const JsonImportDialog: React.FC<JsonImportDialogProps> = ({ formData, setFormData }) => {
  const [open, setOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [freitextInput, setFreitextInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);

  const exampleJson = JSON.stringify(createExampleJson(), null, 2);

  const handleCopyExample = async () => {
    try {
      await navigator.clipboard.writeText(exampleJson);
      setCopied(true);
      toast.success('Beispiel-JSON kopiert!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Kopieren fehlgeschlagen');
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data:image/xxx;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  const handleFileUpload = useCallback(async (files: FileList | File[]) => {
    const validFiles: UploadedFile[] = [];
    
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} ist kein Bild`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} ist zu groß (max. 10MB)`);
        continue;
      }
      
      try {
        const base64 = await fileToBase64(file);
        const preview = URL.createObjectURL(file);
        validFiles.push({
          file,
          preview,
          base64,
          mimeType: file.type
        });
      } catch (error) {
        console.error('Error processing file:', error);
        toast.error(`Fehler bei ${file.name}`);
      }
    }
    
    setUploadedFiles(prev => [...prev, ...validFiles]);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  }, [handleFileUpload]);

  const removeFile = (index: number) => {
    setUploadedFiles(prev => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const handleExtractWithGemini = async () => {
    const hasText = freitextInput.trim().length > 0;
    const hasImages = uploadedFiles.length > 0;

    if (!hasText && !hasImages) {
      toast.error('Bitte gib Text ein oder lade Dokumente hoch.');
      return;
    }

    setIsExtracting(true);
    setAnalysisProgress(10);

    try {
      const requestBody: { text?: string; images?: { base64: string; mimeType: string }[] } = {};
      
      if (hasImages) {
        requestBody.images = uploadedFiles.map(f => ({
          base64: f.base64,
          mimeType: f.mimeType
        }));
      }
      
      if (hasText) {
        requestBody.text = freitextInput;
      }

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

      // Set the extracted JSON to the JSON input field
      setJsonInput(JSON.stringify(data, null, 2));
      toast.success('Daten erfolgreich extrahiert!');
      
      // Clean up file previews
      uploadedFiles.forEach(f => URL.revokeObjectURL(f.preview));
      setUploadedFiles([]);
      setFreitextInput('');
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
      
      // Validierung der grundlegenden Struktur
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Ungültiges JSON-Format');
      }
      
      // Merge mit bestehenden Daten (behält Standardwerte bei)
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
      uploadedFiles.forEach(f => URL.revokeObjectURL(f.preview));
      setUploadedFiles([]);
    } catch (error) {
      toast.error('Ungültiges JSON-Format. Bitte überprüfen Sie die Eingabe.');
      console.error('JSON parse error:', error);
    }
  };

  const handleShowCurrentData = () => {
    setJsonInput(JSON.stringify(formData, null, 2));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="h-4 w-4" />
          JSON Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dokumente & Daten importieren</DialogTitle>
          <DialogDescription>
            Laden Sie Dokumente hoch oder fügen Sie Text ein – die KI extrahiert automatisch alle Versicherungsdaten.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Dokument-Upload Sektion */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2">
              <Image className="h-5 w-5 text-primary" />
              <label className="text-sm font-medium">Dokumente hochladen:</label>
            </div>
            
            {/* Drag and Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                relative border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer
                ${isDragging 
                  ? 'border-primary bg-primary/10' 
                  : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
                }
              `}
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <input
                id="file-upload"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
              />
              <FileImage className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">
                Dokumente hier ablegen oder klicken zum Hochladen
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Ausweise, Krankenkassenkarten, Bescheide (JPG, PNG) – max. 10MB pro Datei
              </p>
            </div>

            {/* Uploaded Files List */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {uploadedFiles.length} Dokument(e) ausgewählt:
                </p>
                <div className="flex flex-wrap gap-2">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={file.preview}
                        alt={file.file.name}
                        className="h-20 w-20 object-cover rounded-md border"
                      />
                      <button
                        onClick={() => removeFile(index)}
                        className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <p className="text-[10px] truncate max-w-[80px] mt-1">{file.file.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Security Notice */}
            <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <Shield className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-green-700 dark:text-green-400">
                <strong>Sichere Verarbeitung:</strong> Ihre Dokumente werden verschlüsselt analysiert und nach der Verarbeitung sofort gelöscht. Es erfolgt keine Speicherung.
              </p>
            </div>
          </div>

          {/* Freitext-Extraktion mit KI */}
          <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
            <label className="text-sm font-medium block">Oder Freitext hier einfügen:</label>
            <Textarea
              value={freitextInput}
              onChange={(e) => setFreitextInput(e.target.value)}
              placeholder="Füge hier beliebigen Text ein (z.B. E-Mail, Brief, Notizen), aus dem die Versicherungsdaten extrahiert werden sollen..."
              className="min-h-[100px]"
            />
          </div>

          {/* Extract Button with Progress */}
          <div className="space-y-2">
            <Button 
              onClick={handleExtractWithGemini} 
              disabled={isExtracting || (!freitextInput.trim() && uploadedFiles.length === 0)}
              className="w-full gap-2"
              size="lg"
            >
              {isExtracting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  KI analysiert Dokumente sicher...
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

          <div className="border-t pt-4">
            <div className="flex gap-2 flex-wrap mb-3">
              <Button variant="secondary" size="sm" onClick={handleCopyExample} className="gap-2">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                Beispiel-JSON kopieren
              </Button>
              <Button variant="secondary" size="sm" onClick={handleShowCurrentData}>
                Aktuelle Daten anzeigen
              </Button>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">JSON-Daten:</label>
              <Textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder='{"mitgliedName": "Mustermann", "mitgliedVorname": "Max", ...}'
                className="font-mono text-xs min-h-[200px]"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleImport} disabled={!jsonInput.trim()}>
              Importieren
            </Button>
          </div>
          
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Beispiel-JSON anzeigen
            </summary>
            <pre className="mt-2 p-4 bg-muted rounded-lg overflow-x-auto text-xs max-h-[300px] overflow-y-auto">
              {exampleJson}
            </pre>
          </details>
        </div>
      </DialogContent>
    </Dialog>
  );
};
