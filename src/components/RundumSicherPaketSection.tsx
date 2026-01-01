import React from 'react';
import { FormSection } from './FormSection';
import { FormField } from './FormField';
import { SignaturePad } from './SignaturePad';
import { FormData, RundumSicherPaketData, ArztDaten, createEmptyArztDaten, ZUSATZVERSICHERUNG_OPTIONS, ZusatzversicherungOption } from '@/types/form';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { 
  validateVersichertennummer, 
  validateIBAN, 
  validateName,
  validateArztName, 
  validateDate, 
  validateJahresbeitrag,
  validateOrt,
  validateSelect
} from '@/utils/validation';

interface RundumSicherPaketSectionProps {
  formData: FormData;
  updateFormData: (updates: Partial<FormData>) => void;
}

export const RundumSicherPaketSection: React.FC<RundumSicherPaketSectionProps> = ({ 
  formData, 
  updateFormData 
}) => {
  const updateRundumSicherPaket = (updates: Partial<RundumSicherPaketData>) => {
    updateFormData({
      rundumSicherPaket: { ...formData.rundumSicherPaket, ...updates }
    });
  };

  const updateArztKind = (index: number, updates: Partial<ArztDaten>) => {
    const newAerzteKinder = [...formData.rundumSicherPaket.aerzteKinder];
    // Ensure array is large enough
    while (newAerzteKinder.length <= index) {
      newAerzteKinder.push(createEmptyArztDaten());
    }
    newAerzteKinder[index] = { ...newAerzteKinder[index], ...updates };
    updateRundumSicherPaket({ aerzteKinder: newAerzteKinder });
  };

  const isNurRundumMode = formData.mode === 'nur_rundum';

  return (
    <FormSection title="Rundum-Sicher-Paket (Zusatzversicherung)" variant="info">
      <p className="text-sm text-muted-foreground mb-4">
        {isNurRundumMode 
          ? 'Diese Angaben werden für das Mitglied als PDF erstellt.'
          : 'Diese Angaben werden für jede versicherte Person (Mitglied, Ehegatte, Kinder) als separates PDF erstellt.'
        }
      </p>

      {/* Versichertennummern - für jede Person separat */}
      <div className="space-y-4 mb-6">
        <h4 className="font-medium text-foreground">Versichertennummern <span className="text-destructive">*</span></h4>
        <p className="text-xs text-muted-foreground">
          Geben Sie für jede Person die individuelle Versichertennummer ein.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Mitglied */}
          <FormField
            type="text"
            label="Versichertennr. Mitglied"
            id="mitgliedVersichertennummer"
            value={formData.mitgliedVersichertennummer}
            onChange={(value) => updateFormData({ 
              mitgliedVersichertennummer: value,
              mitgliedKvNummer: value  // Synchronisiert mit KV-Nummer im Mitglied-Bereich
            })}
            placeholder="z.B. A123456789"
            required
            validate={validateVersichertennummer}
          />
          
          {/* Ehegatte - nur anzeigen wenn vorhanden und nicht nur Rundum-Modus */}
          {!isNurRundumMode && (formData.ehegatte.name || formData.ehegatte.vorname) && (
            <FormField
              type="text"
              label="Versichertennr. Ehegatte"
              id="ehegatteVersichertennummer"
              value={formData.ehegatte.versichertennummer || ''}
              onChange={(value) => updateFormData({
                ehegatte: { ...formData.ehegatte, versichertennummer: value }
              })}
              placeholder="z.B. A123456789"
              required
              validate={validateVersichertennummer}
            />
          )}
          
          {/* Kinder - nur anzeigen wenn vorhanden und nicht nur Rundum-Modus */}
          {!isNurRundumMode && formData.kinder.map((kind, index) => (
            <FormField
              key={`kind-versichertennummer-${index}`}
              type="text"
              label={`Versichertennr. Kind ${index + 1}`}
              id={`kindVersichertennummer${index}`}
              value={kind.versichertennummer || ''}
              onChange={(value) => {
                const newKinder = [...formData.kinder];
                newKinder[index] = { ...newKinder[index], versichertennummer: value };
                updateFormData({ kinder: newKinder });
              }}
              placeholder={`z.B. A123456789`}
              required
              validate={validateVersichertennummer}
            />
          ))}
        </div>
      </div>

      {/* Bankdaten */}
      <div className="space-y-4 mb-6">
        <h4 className="font-medium text-foreground">Bankverbindung <span className="text-destructive">*</span></h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            type="text"
            label="IBAN"
            id="iban"
            value={formData.rundumSicherPaket.iban}
            onChange={(value) => updateRundumSicherPaket({ iban: value })}
            placeholder="DE89 3704 0044 0532 0130 00"
            required
            validate={validateIBAN}
          />
          <FormField
            type="text"
            label="Name des Kontoinhabers"
            id="kontoinhaber"
            value={formData.rundumSicherPaket.kontoinhaber}
            onChange={(value) => updateRundumSicherPaket({ kontoinhaber: value })}
            placeholder="Vor- und Nachname"
            required
            validate={validateName}
          />
        </div>
      </div>

      {/* Datum (pre-filled mit 10.01.2026) */}
      <div className="space-y-4 mb-6">
        <h4 className="font-medium text-foreground">Datum <span className="text-destructive">*</span></h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            type="date"
            label="Datum (für Makler & Unterschrift)"
            id="datumRSP"
            value={formData.rundumSicherPaket.datumRSP}
            onChange={(value) => updateRundumSicherPaket({ datumRSP: value })}
            required
            validate={validateDate}
          />
        </div>
      </div>

      {/* Zeitraum (pre-filled) */}
      <div className="space-y-4 mb-6">
        <h4 className="font-medium text-foreground">Zeitraum <span className="text-destructive">*</span></h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            type="date"
            label="Von"
            id="zeitraumVon"
            value={formData.rundumSicherPaket.zeitraumVon}
            onChange={(value) => updateRundumSicherPaket({ zeitraumVon: value })}
            required
            validate={validateDate}
          />
          <FormField
            type="date"
            label="Bis"
            id="zeitraumBis"
            value={formData.rundumSicherPaket.zeitraumBis}
            onChange={(value) => updateRundumSicherPaket({ zeitraumBis: value })}
            required
            validate={validateDate}
          />
        </div>
      </div>

      {/* Ärzte - pro Person */}
      <div className="space-y-4 mb-6">
        <h4 className="font-medium text-foreground">Ärzte (optional)</h4>
        <p className="text-xs text-muted-foreground">
          Der Ort wird automatisch vom Unterschrifts-Ort übernommen. Im Formular wird die vollständige Adresse angezeigt, im PDF nur der Ort.
        </p>
        
        {/* Arzt für Mitglied */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            type="text"
            label="Name Arzt (Mitglied)"
            id="arztMitgliedName"
            value={formData.rundumSicherPaket.arztMitglied?.name || ''}
            onChange={(value) => updateRundumSicherPaket({ 
              arztMitglied: { ...(formData.rundumSicherPaket.arztMitglied || { name: '', ort: '' }), name: value }
            })}
            placeholder="Name des Arztes"
            validate={validateArztName}
          />
          <FormField
            type="text"
            label="Ort Arzt (Mitglied)"
            id="arztMitgliedOrt"
            value={formData.ort}
            onChange={(value) => updateFormData({ ort: value })}
            placeholder="Straße + Hausnummer, PLZ Ort"
          />
        </div>

        {/* Arzt für Ehegatte (nur wenn vorhanden und nicht nur Rundum-Modus) */}
        {!isNurRundumMode && (formData.ehegatte.name || formData.ehegatte.vorname) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              type="text"
              label="Name Arzt (Ehegatte)"
              id="arztEhegatteName"
              value={formData.rundumSicherPaket.arztEhegatte?.name || ''}
              onChange={(value) => updateRundumSicherPaket({ 
                arztEhegatte: { ...(formData.rundumSicherPaket.arztEhegatte || { name: '', ort: '' }), name: value }
              })}
              placeholder="Name des Arztes"
              validate={validateArztName}
            />
            <FormField
              type="text"
              label="Ort Arzt (Ehegatte)"
              id="arztEhegatteOrt"
              value={formData.rundumSicherPaket.arztEhegatte?.ort || formData.ort}
              onChange={(value) => updateRundumSicherPaket({ 
                arztEhegatte: { ...(formData.rundumSicherPaket.arztEhegatte || { name: '', ort: '' }), ort: value }
              })}
              placeholder="Wird vom Unterschrifts-Ort übernommen"
            />
          </div>
        )}

        {/* Ärzte für Kinder */}
        {!isNurRundumMode && formData.kinder.map((kind, index) => (
          <div key={`arzt-kind-${index}`} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              type="text"
              label={`Name Arzt (Kind ${index + 1})`}
              id={`arztKindName${index}`}
              value={formData.rundumSicherPaket.aerzteKinder[index]?.name || ''}
              onChange={(value) => updateArztKind(index, { name: value })}
              placeholder="Name des Arztes"
              validate={validateArztName}
            />
            <div className="space-y-2">
              <label className="text-sm font-medium">Ort Arzt (Kind {index + 1})</label>
              <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">{formData.ort || 'Wird automatisch übernommen'}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Zusatzversicherung */}
      <div className="space-y-4 mb-6">
        <h4 className="font-medium text-foreground">Zusatzversicherung <span className="text-destructive">*</span></h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Pflicht-Dropdown */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Zusatzversicherung 1 <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.rundumSicherPaket.zusatzversicherung1}
              onValueChange={(value) => updateRundumSicherPaket({ zusatzversicherung1: value as ZusatzversicherungOption })}
            >
              <SelectTrigger className="bg-card">
                <SelectValue placeholder="Bitte wählen (Pflicht)" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {ZUSATZVERSICHERUNG_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Optional-Dropdown */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Zusatzversicherung 2 (optional)
            </Label>
            <Select
              value={formData.rundumSicherPaket.zusatzversicherung2}
              onValueChange={(value) => updateRundumSicherPaket({ zusatzversicherung2: value === "__clear__" ? "" as ZusatzversicherungOption : value as ZusatzversicherungOption })}
            >
              <SelectTrigger className="bg-card">
                <SelectValue placeholder="Bitte wählen (optional)" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="__clear__" className="text-muted-foreground">
                  Keine Auswahl
                </SelectItem>
                {ZUSATZVERSICHERUNG_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <FormField
            type="text"
            label="Jahresbeitrag"
            id="jahresbeitrag"
            value={formData.rundumSicherPaket.jahresbeitrag}
            onChange={(value) => updateRundumSicherPaket({ jahresbeitrag: value })}
            placeholder="mind. 300 €"
            required
            validate={validateJahresbeitrag}
          />
        </div>
      </div>

      {/* Unterschrift Makler */}
      <div className="space-y-4 mb-6">
        <h4 className="font-medium text-foreground">Unterschrift Makler <span className="text-destructive">*</span></h4>
        <SignaturePad
          signature={formData.rundumSicherPaket.unterschriftMakler}
          onSignatureChange={(sig) => updateRundumSicherPaket({ unterschriftMakler: sig })}
        />
      </div>

      {/* Datenschutz - Pflichtfelder */}
      <div className="space-y-4">
        <h4 className="font-medium text-foreground">Datenschutz <span className="text-destructive">*</span></h4>
        <div className="space-y-3">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="datenschutz1"
              checked={formData.rundumSicherPaket.datenschutz1}
              onCheckedChange={(checked) => updateRundumSicherPaket({ datenschutz1: checked === true })}
              required
            />
            <Label htmlFor="datenschutz1" className="text-sm leading-relaxed cursor-pointer">
              Ich bin damit einverstanden, dass meine Daten zur Bearbeitung des Antrags verwendet werden. <span className="text-destructive">*</span>
            </Label>
          </div>
          <div className="flex items-start space-x-3">
            <Checkbox
              id="datenschutz2"
              checked={formData.rundumSicherPaket.datenschutz2}
              onCheckedChange={(checked) => updateRundumSicherPaket({ datenschutz2: checked === true })}
              required
            />
            <Label htmlFor="datenschutz2" className="text-sm leading-relaxed cursor-pointer">
              Ich bin damit einverstanden, dass meine Gesundheitsdaten an Dritte weitergegeben werden dürfen. <span className="text-destructive">*</span>
            </Label>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">* Pflichtfelder - Diese Zustimmungen sind für den Antrag erforderlich.</p>
      </div>
    </FormSection>
  );
};
