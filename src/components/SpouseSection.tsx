import React from 'react';
import { FormSection } from './FormSection';
import { FamilyMemberForm } from './FamilyMemberForm';
import { FormField } from './FormField';
import { FormData, FamilyMember } from '@/types/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SpouseSectionProps {
  formData: FormData;
  updateFormData: (updates: Partial<FormData>) => void;
}

export const SpouseSection: React.FC<SpouseSectionProps> = ({ formData, updateFormData }) => {
  const updateEhegatte = (updates: Partial<FamilyMember>) => {
    updateFormData({
      ehegatte: { ...formData.ehegatte, ...updates }
    });
  };

  return (
    <FormSection title="Angaben zum Ehegatten / Lebenspartner" variant="spouse">
      <FamilyMemberForm
        member={formData.ehegatte}
        updateMember={updateEhegatte}
        type="spouse"
      />
      
      {/* Neue Felder für Ehegatte */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        <FormField
          type="text"
          label="Geburtsname"
          id="ehegatte-geburtsname"
          value={formData.ehegatte.geburtsname || formData.ehegatte.name}
          onChange={(value) => updateEhegatte({ geburtsname: value })}
          placeholder="Wird automatisch vom Nachnamen übernommen"
        />
        <FormField
          type="text"
          label="Geburtsort"
          id="ehegatte-geburtsort"
          value={formData.ehegatte.geburtsort}
          onChange={(value) => updateEhegatte({ geburtsort: value })}
          placeholder="z.B. Berlin"
        />
        <FormField
          type="text"
          label="Geburtsland"
          id="ehegatte-geburtsland"
          value={formData.ehegatte.geburtsland}
          onChange={(value) => updateEhegatte({ geburtsland: value })}
          placeholder="z.B. Deutschland"
        />
        <FormField
          type="text"
          label="Staatsangehörigkeit"
          id="ehegatte-staatsangehoerigkeit"
          value={formData.ehegatte.staatsangehoerigkeit}
          onChange={(value) => updateEhegatte({ staatsangehoerigkeit: value })}
          placeholder="z.B. Deutsch"
        />
      </div>
      
      <div className="mt-4 pt-4 border-t border-secondary/20">
        <FormField
          type="text"
          label="Name der bisherigen Krankenkasse (Ehegatte)"
          id="ehegatteKrankenkasse"
          value={formData.ehegatteKrankenkasse}
          onChange={(value) => updateFormData({ ehegatteKrankenkasse: value })}
          placeholder="z.B. BKK GS"
        />
      </div>
      
      {/* Pre-filled Felder anzeigen (automatisch vom Antragsteller) */}
      <div className="mt-4 pt-4 border-t border-secondary/20">
        <p className="text-sm text-muted-foreground mb-3">Automatisch ausgefüllte Felder (vom Antragsteller):</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Vorname (letzte Versicherung)</Label>
            <Input 
              value={formData.mitgliedVorname || ''} 
              disabled 
              className="bg-muted/50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">Nachname (letzte Versicherung)</Label>
            <Input 
              value={formData.mitgliedName || ''} 
              disabled 
              className="bg-muted/50"
            />
          </div>
        </div>
      </div>
    </FormSection>
  );
};
