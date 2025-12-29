import React from 'react';
import { FormSection } from './FormSection';
import { FamilyMemberForm } from './FamilyMemberForm';
import { FormField } from './FormField';
import { FormData, FamilyMember } from '@/types/form';
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
      
      {/* Pre-filled Felder (bearbeitbar, aber vorausgefüllt) */}
      <div className="mt-4 pt-4 border-t border-secondary/20">
        <p className="text-sm text-muted-foreground mb-3">Vorausgefüllte Felder (vom Antragsteller - bearbeitbar):</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            type="text"
            label="Vorname (letzte Versicherung)"
            id="ehegatte-letzte-vers-vorname"
            value={formData.ehegatte.bisherigVorname || formData.mitgliedVorname}
            onChange={(value) => updateEhegatte({ bisherigVorname: value })}
            placeholder="Vorname des Antragstellers"
          />
          <FormField
            type="text"
            label="Nachname (letzte Versicherung)"
            id="ehegatte-letzte-vers-nachname"
            value={formData.ehegatte.bisherigNachname || formData.mitgliedName}
            onChange={(value) => updateEhegatte({ bisherigNachname: value })}
            placeholder="Nachname des Antragstellers"
          />
        </div>
      </div>
      
      {/* Versicherungsart Checkboxen */}
      <div className="mt-4 pt-4 border-t border-secondary/20">
        <p className="text-sm text-muted-foreground mb-3">Bisherige Versicherungsart:</p>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="ehegatte-versicherungsart"
              checked={formData.ehegatte.bisherigArt === 'mitgliedschaft'}
              onChange={() => updateEhegatte({ bisherigArt: 'mitgliedschaft' })}
              className="w-4 h-4 text-primary"
            />
            <span className="text-sm">Mitgliedschaft</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="ehegatte-versicherungsart"
              checked={formData.ehegatte.bisherigArt === 'familienversicherung'}
              onChange={() => updateEhegatte({ bisherigArt: 'familienversicherung' })}
              className="w-4 h-4 text-primary"
            />
            <span className="text-sm">Familienversicherung</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="ehegatte-versicherungsart"
              checked={formData.ehegatte.bisherigArt === 'nicht_gesetzlich'}
              onChange={() => updateEhegatte({ bisherigArt: 'nicht_gesetzlich' })}
              className="w-4 h-4 text-primary"
            />
            <span className="text-sm">Nicht gesetzlich versichert</span>
          </label>
        </div>
      </div>
    </FormSection>
  );
};
