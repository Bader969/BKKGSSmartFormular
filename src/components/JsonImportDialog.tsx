import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Copy, Check } from 'lucide-react';
import { FormData } from '@/types/form';
import { toast } from 'sonner';

interface JsonImportDialogProps {
  formData: FormData;
  setFormData: (data: FormData) => void;
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
  const [copied, setCopied] = useState(false);

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
          <DialogTitle>JSON-Daten importieren</DialogTitle>
          <DialogDescription>
            Fügen Sie JSON-Daten ein, um alle Formularfelder auf einmal auszufüllen.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
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
              className="font-mono text-xs min-h-[400px]"
            />
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
