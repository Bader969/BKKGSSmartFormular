import React from 'react';
import { FormSection } from './FormSection';
import { FormField } from './FormField';
import { SignaturePreview } from './SignaturePreview';
import { FormData } from '@/types/form';

interface SignatureSectionProps {
  formData: FormData;
  updateFormData: (updates: Partial<FormData>) => void;
}

export const SignatureSection: React.FC<SignatureSectionProps> = ({ formData, updateFormData }) => {
  return (
    <FormSection title="Ort, Datum und Unterschriften" variant="signature">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <FormField
          type="text"
          label="Ort"
          id="ort"
          value={formData.ort}
          onChange={(value) => updateFormData({ ort: value })}
          placeholder="Ort der Unterschrift"
        />
        <FormField
          type="date"
          label="Datum"
          id="datum"
          value={formData.datum}
          onChange={(value) => updateFormData({ datum: value })}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Unterschrift des Mitglieds */}
        <div>
          <FormField
            type="text"
            label="Nachname des Mitglieds (für Unterschrift)"
            id="unterschriftMitgliedName"
            value={formData.mitgliedName}
            onChange={(value) => updateFormData({ mitgliedName: value })}
            placeholder="Nachname eingeben"
          />
          <SignaturePreview 
            name={formData.mitgliedName} 
            label="Unterschrift des Mitglieds" 
          />
        </div>
        
        {/* Unterschrift der Familienangehörigen */}
        <div>
          <FormField
            type="text"
            label="Nachname des Ehegatten (für Unterschrift)"
            id="unterschriftEhegatteName"
            value={formData.ehegatte.name}
            onChange={(value) => updateFormData({ 
              ehegatte: { ...formData.ehegatte, name: value } 
            })}
            placeholder="Nachname eingeben"
          />
          <SignaturePreview 
            name={formData.ehegatte.name} 
            label="Unterschrift der Familienangehörigen" 
          />
        </div>
      </div>
      
      <p className="mt-6 text-xs text-muted-foreground leading-relaxed">
        Mit der Unterschrift erkläre ich, die Zustimmung der Familienangehörigen zur Abgabe 
        der erforderlichen Daten erhalten zu haben. Ich bestätige die Richtigkeit der Angaben 
        und werde über Änderungen umgehend informieren.
      </p>
    </FormSection>
  );
};

