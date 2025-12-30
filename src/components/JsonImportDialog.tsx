import React, { useState, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Copy, Check, Sparkles, Loader2, X, FileImage, Shield, Image, Download, Settings2, FileText, RotateCcw } from 'lucide-react';
import { FormData, FormMode } from '@/types/form';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { 
  processImage, 
  fileToBase64, 
  dataUrlToBase64, 
  getMimeTypeFromDataUrl,
  defaultProcessingOptions,
  type ProcessingOptions 
} from '@/utils/imageProcessing';
import { createPdfFromImages, downloadBlob, getImageDimensions, type ImageForPdf } from '@/utils/pdfUtils';

interface JsonImportDialogProps {
  formData: FormData;
  setFormData: (data: FormData) => void;
  currentMode: FormMode;
}

interface UploadedFile {
  file: File;
  preview: string;
  originalPreview: string; // Keep original for restore
  processedPreview?: string;
  aiImprovedPreview?: string; // AI-enhanced version from edge function
  aiImprovedBase64?: string;
  base64: string;
  mimeType: string;
  isProcessed: boolean;
  isAiImproved: boolean;
  useOriginal: boolean; // Flag to use original instead of AI version
}

// Beispiel-JSON-Daten für Familienversicherung + Rundum
const createFamilyExampleJson = (): Partial<FormData> => ({
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
    unterschriftMakler: '',
  },
  mitgliedVersichertennummer: 'A123456789',
});

// Vereinfachtes JSON nur für Rundum-Sicher-Paket (ohne Ehegatte/Kinder)
const createRundumOnlyExampleJson = (): Partial<FormData> => ({
  mode: 'nur_rundum',
  mitgliedName: 'Mustermann',
  mitgliedVorname: 'Max',
  mitgliedGeburtsdatum: '15.05.1985',
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
    unterschriftMakler: '',
  },
  mitgliedVersichertennummer: 'A123456789',
});

export const JsonImportDialog: React.FC<JsonImportDialogProps> = ({ formData, setFormData, currentMode }) => {
  const [open, setOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [freitextInput, setFreitextInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [showScannerSettings, setShowScannerSettings] = useState(false);
  const [processingOptions, setProcessingOptions] = useState<ProcessingOptions>(defaultProcessingOptions);

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
      // Accept images and PDFs
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
          originalPreview: preview,
          base64,
          mimeType: file.type,
          isProcessed: false,
          isAiImproved: false,
          useOriginal: false
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
      if (newFiles[index].processedPreview) {
        URL.revokeObjectURL(newFiles[index].processedPreview);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  // Process images with scanner filters
  const handleProcessImages = async () => {
    const imageFiles = uploadedFiles.filter(f => f.mimeType.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      toast.error('Keine Bilder zum Verarbeiten vorhanden');
      return;
    }

    setIsProcessingImages(true);
    toast.info('Dokumente werden lokal optimiert...');

    try {
      const processedFiles = await Promise.all(
        uploadedFiles.map(async (uploadedFile) => {
          // Skip PDFs - they can't be processed as images
          if (uploadedFile.mimeType === 'application/pdf') {
            return uploadedFile;
          }

          const { dataUrl, blob } = await processImage(uploadedFile.preview, processingOptions);
          
          // Revoke old preview if it was processed before
          if (uploadedFile.processedPreview) {
            URL.revokeObjectURL(uploadedFile.processedPreview);
          }
          
          // Revoke original preview - we don't need it anymore (privacy)
          URL.revokeObjectURL(uploadedFile.preview);

          return {
            ...uploadedFile,
            preview: dataUrl,
            processedPreview: URL.createObjectURL(blob),
            base64: dataUrlToBase64(dataUrl),
            mimeType: 'image/jpeg',
            isProcessed: true,
            isAiImproved: uploadedFile.isAiImproved,
            useOriginal: uploadedFile.useOriginal
          };
        })
      );

      setUploadedFiles(processedFiles);
      toast.success('Dokumente erfolgreich optimiert!');
    } catch (error) {
      console.error('Error processing images:', error);
      toast.error('Fehler beim Verarbeiten der Bilder');
    } finally {
      setIsProcessingImages(false);
    }
  };

  // Export processed images as PDF - uses AI-improved versions when available
  const handleExportPdf = async () => {
    const processedImages = uploadedFiles.filter(f => f.mimeType.startsWith('image/'));
    
    if (processedImages.length === 0) {
      toast.error('Keine Bilder für PDF-Export vorhanden');
      return;
    }

    setIsExportingPdf(true);

    try {
      const imagesForPdf: ImageForPdf[] = await Promise.all(
        processedImages.map(async (file) => {
          // Use AI-improved image if available and not overridden
          const activePreview = getActivePreview(file);
          const dimensions = await getImageDimensions(activePreview);
          return {
            dataUrl: activePreview,
            width: dimensions.width,
            height: dimensions.height
          };
        })
      );

      const pdfBlob = await createPdfFromImages(imagesForPdf);
      const filename = `dokumente-scan-${new Date().toISOString().slice(0, 10)}.pdf`;
      downloadBlob(pdfBlob, filename);
      toast.success('PDF mit KI-verbesserten Bildern erstellt!');
    } catch (error) {
      console.error('Error creating PDF:', error);
      toast.error('Fehler beim Erstellen der PDF');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExtractWithGemini = async () => {
    const hasText = freitextInput.trim().length > 0;
    const hasFiles = uploadedFiles.length > 0;

    if (!hasText && !hasFiles) {
      toast.error('Bitte gib Text ein oder lade Dokumente hoch.');
      return;
    }

    setIsExtracting(true);
    setAnalysisProgress(10);

    try {
      const requestBody: { 
        text?: string; 
        images?: { base64: string; mimeType: string }[];
        mode: FormMode;
      } = {
        mode: currentMode
      };
      
      if (hasFiles) {
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

      // Check if we have AI-improved images in the response
      if (data.improvedImages && Array.isArray(data.improvedImages)) {
        const updatedFiles = uploadedFiles.map((file, index) => {
          const improvedImage = data.improvedImages[index];
          if (improvedImage && file.mimeType.startsWith('image/')) {
            const aiDataUrl = `data:image/jpeg;base64,${improvedImage}`;
            return {
              ...file,
              aiImprovedPreview: aiDataUrl,
              aiImprovedBase64: improvedImage,
              isAiImproved: true,
              useOriginal: false
            };
          }
          return file;
        });
        setUploadedFiles(updatedFiles);
        toast.success('Daten extrahiert & Bilder magisch verbessert!');
      } else {
        toast.success('Daten erfolgreich extrahiert!');
      }

      // Extract the actual form data (exclude improvedImages)
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

  // Toggle between AI-improved and original image
  const handleRestoreOriginal = (index: number) => {
    setUploadedFiles(prev => prev.map((file, i) => {
      if (i === index) {
        return { ...file, useOriginal: !file.useOriginal };
      }
      return file;
    }));
  };

  // Get the best preview for display and export
  const getActivePreview = (file: UploadedFile): string => {
    if (file.useOriginal) {
      return file.processedPreview || file.originalPreview;
    }
    if (file.aiImprovedPreview) {
      return file.aiImprovedPreview;
    }
    return file.processedPreview || file.preview;
  };

  // Get base64 for PDF export (prefers AI-improved unless useOriginal)
  const getActiveBase64 = (file: UploadedFile): string => {
    if (file.useOriginal) {
      return file.base64;
    }
    if (file.aiImprovedBase64) {
      return file.aiImprovedBase64;
    }
    return file.base64;
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
      uploadedFiles.forEach(f => {
        URL.revokeObjectURL(f.preview);
        if (f.processedPreview) URL.revokeObjectURL(f.processedPreview);
      });
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
                        <div className="relative">
                          <img
                            src={getActivePreview(file)}
                            alt={file.file.name}
                            className={`h-24 w-24 object-cover rounded-md border transition-all ${
                              file.isAiImproved && !file.useOriginal 
                                ? 'ring-2 ring-purple-500' 
                                : file.isProcessed 
                                  ? 'ring-2 ring-green-500' 
                                  : ''
                            }`}
                          />
                          {/* AI Improved Badge */}
                          {file.isAiImproved && !file.useOriginal && (
                            <span className="absolute top-1 left-1 bg-purple-500 text-white text-[8px] px-1 py-0.5 rounded font-medium">
                              ✨ KI
                            </span>
                          )}
                          {/* Restore Original Button */}
                          {file.isAiImproved && (
                            <button
                              onClick={() => handleRestoreOriginal(index)}
                              className="absolute bottom-1 left-1 right-1 bg-background/90 hover:bg-background text-[9px] px-1 py-0.5 rounded border flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              title={file.useOriginal ? 'KI-Version verwenden' : 'Original wiederherstellen'}
                            >
                              <RotateCcw className="h-2.5 w-2.5" />
                              {file.useOriginal ? 'KI-Version' : 'Original'}
                            </button>
                          )}
                        </div>
                      )}
                      <button
                        onClick={() => removeFile(index)}
                        className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <p className="text-[10px] truncate max-w-[96px] mt-1">{file.file.name}</p>
                      {file.isProcessed && !file.isAiImproved && (
                        <span className="text-[8px] text-center text-green-600 font-medium block">
                          Optimiert
                        </span>
                      )}
                      {file.useOriginal && file.isAiImproved && (
                        <span className="text-[8px] text-center text-amber-600 font-medium block">
                          Original
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Scanner Settings */}
            {hasImages && (
              <div className="space-y-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowScannerSettings(!showScannerSettings)}
                  className="gap-2"
                >
                  <Settings2 className="h-4 w-4" />
                  Scanner-Einstellungen
                </Button>

                {showScannerSettings && (
                  <div className="p-4 border rounded-lg bg-background space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Kontrast: {processingOptions.contrast.toFixed(1)}</Label>
                      <Slider
                        value={[processingOptions.contrast]}
                        onValueChange={([value]) => setProcessingOptions(prev => ({ ...prev, contrast: value }))}
                        min={0.5}
                        max={2}
                        step={0.1}
                        className="w-full"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm">Helligkeit: {processingOptions.brightness}</Label>
                      <Slider
                        value={[processingOptions.brightness]}
                        onValueChange={([value]) => setProcessingOptions(prev => ({ ...prev, brightness: value }))}
                        min={-50}
                        max={50}
                        step={5}
                        className="w-full"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Auto-Crop (Hintergrund entfernen)</Label>
                      <Switch
                        checked={processingOptions.autoCrop}
                        onCheckedChange={(checked) => setProcessingOptions(prev => ({ ...prev, autoCrop: checked }))}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Graustufen</Label>
                      <Switch
                        checked={processingOptions.grayscale}
                        onCheckedChange={(checked) => setProcessingOptions(prev => ({ ...prev, grayscale: checked }))}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Rauschen reduzieren</Label>
                      <Switch
                        checked={processingOptions.denoise}
                        onCheckedChange={(checked) => setProcessingOptions(prev => ({ ...prev, denoise: checked }))}
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleProcessImages}
                    disabled={isProcessingImages || !hasImages}
                    className="gap-2"
                  >
                    {isProcessingImages ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Optimiere...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Bilder optimieren (Scanner-Filter)
                      </>
                    )}
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleExportPdf}
                    disabled={isExportingPdf || !hasImages}
                    className="gap-2"
                  >
                    {isExportingPdf ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Erstelle PDF...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        Dokumente als gescanntes PDF speichern
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Security Notice */}
            <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <Shield className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-green-700 dark:text-green-400">
                <strong>Sichere Verarbeitung:</strong> Ihre Dokumente werden verschlüsselt analysiert und nach der Verarbeitung sofort gelöscht. Originalfotos werden nach dem Cropping verworfen – nur bereinigte Dokumente bleiben im Speicher.
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
                  Daten mit KI extrahieren {hasPdfs && '(inkl. PDFs)'}
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
