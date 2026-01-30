import React, { useState, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Upload, Copy, Check, Sparkles, Loader2, X, FileImage, Shield, Image, Download, FileText, Lock, AlertTriangle } from 'lucide-react';
import { FormData, FormMode, Krankenkasse } from '@/types/form';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { createCombinedPdf, downloadBlob } from '@/utils/pdfUtils';
import { formatDateForInput } from '@/utils/dateUtils';
import { applyKrankenkassenMapping } from '@/utils/krankenkassenMapping';

// Passwort für den Zugang zum Import-Dialog
const IMPORT_PASSWORD = 'Ahmad19Bader96';

/**
 * Convert a File to base64 string (without data URL prefix)
 */
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

interface JsonImportDialogProps {
  formData: FormData;
  setFormData: (data: FormData) => void;
  currentMode: FormMode;
  selectedKrankenkasse?: Krankenkasse;
}

interface UploadedFile {
  file: File;
  preview: string;
  base64: string;
  mimeType: string;
}

// Beispiel-JSON-Daten für Familienversicherung + Rundum
const createFamilyExampleJson = (): Partial<FormData> => ({
  mode: 'familienversicherung_und_rundum',
  mitgliedName: 'Mustermann',
  mitgliedVorname: 'Max',
  mitgliedGeburtsdatum: '15.05.1985',
  mitgliedGeburtsort: 'Berlin',
  mitgliedGeburtsland: 'Deutschland',
  mitgliedStrasse: 'Musterstraße',
  mitgliedHausnummer: '12a',
  mitgliedPlz: '12345',
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
    bisherigBestehtWeiterBei: '',
    geburtsname: 'Musterfrau',
    geburtsort: 'Berlin',
    geburtsland: 'Deutschland',
    staatsangehoerigkeit: 'deutsch',
    versichertennummer: 'B987654321',
    familienversichert: true,
    beschaeftigung: '',
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
      bisherigBestehtWeiterBei: '',
      geburtsname: '',
      geburtsort: 'Musterstadt',
      geburtsland: 'Deutschland',
      staatsangehoerigkeit: 'deutsch',
      versichertennummer: 'C111222333',
      familienversichert: true,
      beschaeftigung: '',
    },
  ],
  rundumSicherPaket: {
    iban: 'DE89370400440532013000',
    kontoinhaber: 'Max Mustermann',
    zeitraumVon: '2026-01-01',
    zeitraumBis: '2026-12-31',
    datumRSP: '2026-01-10',
    arztMitglied: { name: 'Dr. Müller', ort: 'Musterstadt' },
    arztEhegatte: { name: 'Dr. Schmidt', ort: 'Musterstadt' },
    aerzteKinder: [{ name: 'Dr. Kinderarzt', ort: 'Musterstadt' }],
    zusatzversicherung1: 'zahnzusatz',
    zusatzversicherung2: 'unfall',
    jahresbeitrag: '500',
    datenschutz1: true,
    datenschutz2: true,
  },
  mitgliedVersichertennummer: 'A123456789',
});

// Vereinfachtes JSON nur für Rundum-Sicher-Paket (ohne Ehegatte/Kinder)
const createRundumOnlyExampleJson = (): Partial<FormData> => ({
  mode: 'nur_rundum',
  mitgliedName: 'Mustermann',
  mitgliedVorname: 'Max',
  mitgliedGeburtsdatum: '15.05.1985',
  mitgliedGeburtsort: 'Berlin',
  mitgliedGeburtsland: 'Deutschland',
  mitgliedStrasse: 'Musterstraße',
  mitgliedHausnummer: '12a',
  mitgliedPlz: '12345',
  mitgliedKvNummer: 'A123456789',
  mitgliedKrankenkasse: 'BKK GS',
  familienstand: 'ledig',
  telefon: '0123456789',
  email: 'max.mustermann@example.com',
  datum: '2026-01-10',
  ort: 'Musterstadt',
  rundumSicherPaket: {
    iban: 'DE89370400440532013000',
    kontoinhaber: 'Max Mustermann',
    zeitraumVon: '2026-01-01',
    zeitraumBis: '2026-12-31',
    datumRSP: '2026-01-10',
    arztMitglied: { name: 'Dr. Müller', ort: 'Musterstadt' },
    arztEhegatte: { name: '', ort: '' },
    aerzteKinder: [],
    zusatzversicherung1: 'zahnzusatz',
    zusatzversicherung2: '',
    jahresbeitrag: '500',
    datenschutz1: true,
    datenschutz2: true,
  },
  mitgliedVersichertennummer: 'A123456789',
});

export const JsonImportDialog: React.FC<JsonImportDialogProps> = ({ formData, setFormData, currentMode, selectedKrankenkasse = '' }) => {
  const [open, setOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  // Modus-abhängiges Beispiel-JSON
  const exampleJson = useMemo(() => {
    const exampleData = currentMode === 'nur_rundum' 
      ? createRundumOnlyExampleJson() 
      : createFamilyExampleJson();
    return JSON.stringify(exampleData, null, 2);
  }, [currentMode]);

  const isRundumOnlyMode = currentMode === 'nur_rundum';

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

  const handleFileUpload = useCallback(async (files: FileList | File[]) => {
    const validFiles: UploadedFile[] = [];
    
    for (const file of Array.from(files)) {
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf';
      
      if (!isImage && !isPdf) {
        toast.error(`${file.name} ist keine gültige Datei (JPG, PNG, PDF)`);
        continue;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name} ist zu groß (max. 20MB)`);
        continue;
      }
      
      try {
        const base64 = await fileToBase64(file);
        const preview = URL.createObjectURL(file);
        validFiles.push({
          file,
          preview,
          base64,
          mimeType: file.type,
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

  // Export all files as combined PDF
  const handleExportPdf = async () => {
    if (uploadedFiles.length === 0) {
      toast.error('Keine Dateien für PDF-Export vorhanden');
      return;
    }

    setIsExportingPdf(true);

    try {
      const filesForPdf = uploadedFiles.map(f => ({
        base64: f.base64,
        mimeType: f.mimeType
      }));

      const pdfBlob = await createCombinedPdf(filesForPdf);
      const memberName = `${formData.mitgliedVorname || ''}_${formData.mitgliedName || ''}`.replace(/^_|_$/g, '') || 'Dokumente';
      const filename = `${memberName}.pdf`;
      downloadBlob(pdfBlob, filename);
      toast.success('PDF erfolgreich erstellt!');
    } catch (error) {
      console.error('Error creating PDF:', error);
      toast.error('Fehler beim Erstellen der PDF');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExtractWithGemini = async () => {
    if (uploadedFiles.length === 0) {
      toast.error('Bitte lade Dokumente hoch.');
      return;
    }

    setIsExtracting(true);
    setAnalysisProgress(10);

    try {
      const requestBody: { 
        text?: string; 
        images?: { base64: string; mimeType: string }[];
        mode: FormMode;
        selectedKrankenkasse: string;
      } = {
        mode: currentMode,
        selectedKrankenkasse: selectedKrankenkasse || formData.selectedKrankenkasse || '',
        images: uploadedFiles.map(f => ({
          base64: f.base64,
          mimeType: f.mimeType
        }))
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

      // Extract the actual form data (exclude improvedImages if present)
      const { improvedImages, ...formDataFromAi } = data;
      
      // Apply Krankenkassen-specific mapping
      const activeKrankenkasse = selectedKrankenkasse || formData.selectedKrankenkasse || '';
      const mappedData = applyKrankenkassenMapping(formDataFromAi, activeKrankenkasse as Krankenkasse, formData);
      
      // Auto-Import: Direkt nach erfolgreicher Extraktion importieren
      const todayForInput = formatDateForInput(new Date());
      
      // Synchronisierung
      const mitgliedVersichertennummer = formDataFromAi.mitgliedKvNummer || formDataFromAi.mitgliedVersichertennummer || formData.mitgliedVersichertennummer;
      const ehegatteKrankenkasse = formDataFromAi.ehegatteKrankenkasse || formDataFromAi.mitgliedKrankenkasse || formData.ehegatteKrankenkasse;
      
      setFormData({
        ...formData,
        ...mappedData,
        datum: todayForInput,
        mitgliedVersichertennummer: mitgliedVersichertennummer,
        ehegatteKrankenkasse: ehegatteKrankenkasse,
      });
      
      toast.success('Daten erfolgreich extrahiert und importiert!');
      setOpen(false);
      setJsonInput('');
      uploadedFiles.forEach(f => URL.revokeObjectURL(f.preview));
      setUploadedFiles([]);
      
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
      
      // Immer heutiges Datum für Unterschrift setzen
      const todayForInput = formatDateForInput(new Date());
      
      // Bei Kindern immer bisherigBestehtWeiter = true, bisherigBestehtWeiterBei bleibt leer (wird dynamisch in UI gesetzt)
      const processedKinder = parsed.kinder?.map(kind => ({
        ...kind,
        bisherigBestehtWeiter: true,
        bisherigBestehtWeiterBei: kind.bisherigBestehtWeiterBei || '',
      })) || formData.kinder;
      
      // Synchronisierung: mitgliedVersichertennummer = mitgliedKvNummer
      const mitgliedVersichertennummer = parsed.mitgliedKvNummer || parsed.mitgliedVersichertennummer || formData.mitgliedVersichertennummer;
      
      // Synchronisierung: ehegatteKrankenkasse → vom mitgliedKrankenkasse falls nicht gesetzt
      const ehegatteKrankenkasse = parsed.ehegatteKrankenkasse || parsed.mitgliedKrankenkasse || formData.ehegatteKrankenkasse;
      
      setFormData({
        ...formData,
        ...parsed,
        datum: todayForInput, // Immer heutiges Datum
        mitgliedVersichertennummer: mitgliedVersichertennummer,
        ehegatteKrankenkasse: ehegatteKrankenkasse,
        ehegatte: parsed.ehegatte ? { ...formData.ehegatte, ...parsed.ehegatte } : formData.ehegatte,
        kinder: processedKinder,
        rundumSicherPaket: parsed.rundumSicherPaket
          ? { ...formData.rundumSicherPaket, ...parsed.rundumSicherPaket }
          : formData.rundumSicherPaket,
      });
      
      toast.success('JSON erfolgreich importiert!');
      setOpen(false);
      setJsonInput('');
      uploadedFiles.forEach(f => URL.revokeObjectURL(f.preview));
      setUploadedFiles([]);
    } catch (error) {
      toast.error('Ungültiges JSON-Format. Bitte überprüfen Sie die Eingabe.');
      console.error('JSON parse error:', error);
    }
  };

  // Zeigt aktuelle Daten an - im nur_rundum Modus ohne ehegatte/kinder
  const handleShowCurrentData = () => {
    if (isRundumOnlyMode) {
      const { ehegatte, kinder, ehegatteKrankenkasse, beginnFamilienversicherung, unterschriftFamilie, ...restData } = formData;
      setJsonInput(JSON.stringify(restData, null, 2));
    } else {
      setJsonInput(JSON.stringify(formData, null, 2));
    }
  };

  const hasImages = uploadedFiles.some(f => f.mimeType.startsWith('image/'));
  const hasPdfs = uploadedFiles.some(f => f.mimeType === 'application/pdf');

  const handlePasswordSubmit = () => {
    if (passwordInput === IMPORT_PASSWORD) {
      setIsAuthenticated(true);
      setPasswordError(false);
      setPasswordInput('');
    } else {
      setPasswordError(true);
      toast.error('Falsches Passwort');
    }
  };

  const handleDialogClose = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      // Reset password state when dialog closes
      setIsAuthenticated(false);
      setPasswordInput('');
      setPasswordError(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="h-4 w-4" />
          JSON Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        {!isAuthenticated ? (
          // Password Screen
          <div className="py-8">
            <DialogHeader className="mb-6">
              <DialogTitle className="flex items-center gap-2 justify-center">
                <Lock className="h-5 w-5" />
                Passwort erforderlich
              </DialogTitle>
              <DialogDescription className="text-center">
                Bitte geben Sie das Passwort ein, um auf den Import zuzugreifen.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 max-w-xs mx-auto">
              <Input
                type="password"
                placeholder="Passwort eingeben..."
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setPasswordError(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handlePasswordSubmit();
                  }
                }}
                className={passwordError ? 'border-destructive' : ''}
              />
              <Button onClick={handlePasswordSubmit} className="w-full gap-2">
                <Lock className="h-4 w-4" />
                Entsperren
              </Button>
            </div>
          </div>
        ) : (
          // Main Content (after password)
          <>
            <DialogHeader>
              <DialogTitle>Dokumente & Daten importieren</DialogTitle>
              <DialogDescription>
                Laden Sie Dokumente hoch oder fügen Sie Text ein – die KI extrahiert automatisch alle Versicherungsdaten.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Warnung wenn keine Krankenkasse ausgewählt */}
              {!formData.selectedKrankenkasse && (
                <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                      Keine Krankenkasse ausgewählt
                    </p>
                    <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                      Bitte wählen Sie zuerst eine Krankenkasse aus, um die optimale Datenextraktion zu gewährleisten.
                    </p>
                  </div>
                </div>
              )}
              
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
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
              />
              <FileImage className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">
                Dokumente hier ablegen oder klicken zum Hochladen
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Ausweise, Krankenkassenkarten, Bescheide (JPG, PNG, PDF) – max. 20MB pro Datei
              </p>
            </div>

            {/* Uploaded Files List */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {uploadedFiles.length} Dokument(e) ausgewählt:
                </p>
                <div className="flex flex-wrap gap-3">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="relative group">
                      {file.mimeType === 'application/pdf' ? (
                        <div className="h-24 w-24 flex items-center justify-center rounded-md border bg-muted">
                          <FileText className="h-8 w-8 text-muted-foreground" />
                        </div>
                      ) : (
                        <img
                          src={file.preview}
                          alt={file.file.name}
                          className="h-24 w-24 object-cover rounded-md border"
                        />
                      )}
                      <button
                        onClick={() => removeFile(index)}
                        className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <p className="text-[10px] truncate max-w-[96px] mt-1">{file.file.name}</p>
                    </div>
                  ))}
                </div>

                {/* PDF Export Button */}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleExportPdf}
                  disabled={isExportingPdf}
                  className="gap-2 mt-2"
                >
                  {isExportingPdf ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Erstelle PDF...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Alle Dateien als PDF zusammenfassen
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Security Notice */}
            <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <Shield className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-green-700 dark:text-green-400">
                <strong>Sichere Verarbeitung:</strong> Ihre Dokumente werden verschlüsselt analysiert und nach der Verarbeitung sofort gelöscht.
              </p>
            </div>
          </div>


          {/* Extract Button with Progress */}
          <div className="space-y-2">
            <Button 
              onClick={handleExtractWithGemini} 
              disabled={isExtracting || uploadedFiles.length === 0}
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
                  Daten Validieren {hasPdfs && '(inkl. PDFs)'}
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
