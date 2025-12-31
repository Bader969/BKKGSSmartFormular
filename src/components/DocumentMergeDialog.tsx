import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, X, FileImage, Image, Download, FileText, Files } from 'lucide-react';
import { toast } from 'sonner';
import { createCombinedPdf, downloadBlob } from '@/utils/pdfUtils';

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

interface UploadedFile {
  file: File;
  preview: string;
  base64: string;
  mimeType: string;
}

export const DocumentMergeDialog: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [outputFilename, setOutputFilename] = useState('');

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
      const filename = outputFilename.trim() 
        ? `${outputFilename.trim().replace(/\.pdf$/i, '')}.pdf`
        : `Dokumente_${new Date().toISOString().slice(0, 10)}.pdf`;
      downloadBlob(pdfBlob, filename);
      toast.success('PDF erfolgreich erstellt!');
    } catch (error) {
      console.error('Error creating PDF:', error);
      toast.error('Fehler beim Erstellen der PDF');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDialogClose = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      // Clean up previews when closing
      uploadedFiles.forEach(f => URL.revokeObjectURL(f.preview));
      setUploadedFiles([]);
      setOutputFilename('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Files className="h-4 w-4" />
          PDF Zusammenfassen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dokumente als PDF zusammenfassen</DialogTitle>
          <DialogDescription>
            Laden Sie Bilder und PDFs hoch, um sie zu einem einzigen PDF zusammenzufassen.
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
              onClick={() => document.getElementById('merge-file-upload')?.click()}
            >
              <input
                id="merge-file-upload"
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
                Bilder und PDFs (JPG, PNG, PDF) – max. 20MB pro Datei
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
              </div>
            )}
          </div>

          {/* Filename Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Dateiname (optional):</label>
            <input
              type="text"
              value={outputFilename}
              onChange={(e) => setOutputFilename(e.target.value)}
              placeholder="z.B. Vorname_Nachname"
              className="w-full px-3 py-2 border rounded-md bg-background text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Leer lassen für automatischen Namen mit Datum
            </p>
          </div>

          {/* Export Button */}
          <Button
            onClick={handleExportPdf}
            disabled={isExportingPdf || uploadedFiles.length === 0}
            className="w-full gap-2"
            size="lg"
          >
            {isExportingPdf ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Erstelle PDF...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Als PDF zusammenfassen
              </>
            )}
          </Button>
          
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => handleDialogClose(false)}>
              Schließen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
