import React from 'react';
import { FormSection } from './FormSection';
import { FormField } from './FormField';
import { FormData, RundumSicherPaketData, ArztDaten } from '@/types/form';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

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

  const updateArzt = (index: number, updates: Partial<ArztDaten>) => {
    const newAerzte = [...formData.rundumSicherPaket.aerzte];
    newAerzte[index] = { ...newAerzte[index], ...updates };
    updateRundumSicherPaket({ aerzte: newAerzte });
  };

  return (
    <FormSection title="Rundum-Sicher-Paket (Zusatzversicherung)" variant="info">
      <p className="text-sm text-muted-foreground mb-4">
        Diese Angaben werden für jede versicherte Person (Mitglied, Ehegatte, Kinder) als separates PDF erstellt.
      </p>

      {/* Versichertennummern */}
      <div className="space-y-4 mb-6">
        <h4 className="font-medium text-foreground">Versichertennummern</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormField
            type="text"
            label="Versichertennr. Mitglied"
            id="mitgliedVersichertennummer"
            value={formData.mitgliedVersichertennummer}
            onChange={(value) => updateFormData({ mitgliedVersichertennummer: value })}
            placeholder="Versichertennummer"
          />
          {(formData.ehegatte.name || formData.ehegatte.vorname) && (
            <FormField
              type="text"
              label="Versichertennr. Ehegatte"
              id="ehegatteVersichertennummer"
              value={formData.ehegatte.versichertennummer}
              onChange={(value) => updateFormData({
                ehegatte: { ...formData.ehegatte, versichertennummer: value }
              })}
              placeholder="Versichertennummer"
            />
          )}
          {formData.kinder.map((kind, index) => (
            <FormField
              key={`kind-versichertennr-${index}`}
              type="text"
              label={`Versichertennr. Kind ${index + 1}`}
              id={`kindVersichertennummer${index}`}
              value={kind.versichertennummer}
              onChange={(value) => {
                const newKinder = [...formData.kinder];
                newKinder[index] = { ...newKinder[index], versichertennummer: value };
                updateFormData({ kinder: newKinder });
              }}
              placeholder="Versichertennummer"
            />
          ))}
        </div>
      </div>

      {/* Bankdaten */}
      <div className="space-y-4 mb-6">
        <h4 className="font-medium text-foreground">Bankverbindung</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            type="text"
            label="IBAN"
            id="iban"
            value={formData.rundumSicherPaket.iban}
            onChange={(value) => updateRundumSicherPaket({ iban: value })}
            placeholder="DE89 3704 0044 0532 0130 00"
          />
          <FormField
            type="text"
            label="Name des Kontoinhabers"
            id="kontoinhaber"
            value={formData.rundumSicherPaket.kontoinhaber}
            onChange={(value) => updateRundumSicherPaket({ kontoinhaber: value })}
            placeholder="Vor- und Nachname"
          />
        </div>
      </div>

      {/* Zeitraum */}
      <div className="space-y-4 mb-6">
        <h4 className="font-medium text-foreground">Zeitraum</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            type="date"
            label="Von"
            id="zeitraumVon"
            value={formData.rundumSicherPaket.zeitraumVon}
            onChange={(value) => updateRundumSicherPaket({ zeitraumVon: value })}
          />
          <FormField
            type="date"
            label="Bis"
            id="zeitraumBis"
            value={formData.rundumSicherPaket.zeitraumBis}
            onChange={(value) => updateRundumSicherPaket({ zeitraumBis: value })}
          />
        </div>
      </div>

      {/* Ärzte */}
      <div className="space-y-4 mb-6">
        <h4 className="font-medium text-foreground">Ärzte (optional)</h4>
        {formData.rundumSicherPaket.aerzte.map((arzt, index) => (
          <div key={`arzt-${index}`} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              type="text"
              label={`Name Arzt ${index + 1}`}
              id={`nameArzt${index + 1}`}
              value={arzt.name}
              onChange={(value) => updateArzt(index, { name: value })}
              placeholder="Name des Arztes"
            />
            <FormField
              type="text"
              label={`Ort Arzt ${index + 1}`}
              id={`ortArzt${index + 1}`}
              value={arzt.ort}
              onChange={(value) => updateArzt(index, { ort: value })}
              placeholder="Ort"
            />
          </div>
        ))}
      </div>

      {/* Zusatzversicherung */}
      <div className="space-y-4 mb-6">
        <h4 className="font-medium text-foreground">Zusatzversicherung</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            type="text"
            label="Art der Zusatzversicherung"
            id="artZusatzversicherung"
            value={formData.rundumSicherPaket.artZusatzversicherung}
            onChange={(value) => updateRundumSicherPaket({ artZusatzversicherung: value })}
            placeholder="z.B. Zahnzusatz"
          />
          <FormField
            type="text"
            label="Jahresbeitrag"
            id="jahresbeitrag"
            value={formData.rundumSicherPaket.jahresbeitrag}
            onChange={(value) => updateRundumSicherPaket({ jahresbeitrag: value })}
            placeholder="z.B. 120,00 €"
          />
        </div>
      </div>

      {/* Datenschutz */}
      <div className="space-y-4">
        <h4 className="font-medium text-foreground">Datenschutz</h4>
        <div className="space-y-3">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="datenschutz1"
              checked={formData.rundumSicherPaket.datenschutz1}
              onCheckedChange={(checked) => updateRundumSicherPaket({ datenschutz1: checked === true })}
            />
            <Label htmlFor="datenschutz1" className="text-sm leading-relaxed cursor-pointer">
              Ich bin damit einverstanden, dass meine Daten zur Bearbeitung des Antrags verwendet werden.
            </Label>
          </div>
          <div className="flex items-start space-x-3">
            <Checkbox
              id="datenschutz2"
              checked={formData.rundumSicherPaket.datenschutz2}
              onCheckedChange={(checked) => updateRundumSicherPaket({ datenschutz2: checked === true })}
            />
            <Label htmlFor="datenschutz2" className="text-sm leading-relaxed cursor-pointer">
              Ich bin damit einverstanden, dass meine Gesundheitsdaten an Dritte weitergegeben werden dürfen.
            </Label>
          </div>
        </div>
      </div>
    </FormSection>
  );
};
