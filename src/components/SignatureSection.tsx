import React from 'react';
import { FormSection } from './FormSection';
import { FormField } from './FormField';
import { SignaturePad } from './SignaturePad';
import { FormData } from '@/types/form';

interface SignatureSectionProps {
  formData: FormData;
  updateFormData: (updates: Partial<FormData>) => void;
}

export const SignatureSection: React.FC<SignatureSectionProps> = ({ formData, updateFormData }) => {
  const isNurRundumMode = formData.mode === 'nur_rundum';
  
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
      
      <div className={`grid gap-6 ${isNurRundumMode ? 'grid-cols-1 max-w-md' : 'grid-cols-1 md:grid-cols-2'}`}>
        <div>
          <label className="block text-sm font-medium mb-2">
            Unterschrift des Mitglieds
          </label>
          <SignaturePad
            signature={formData.unterschrift}
            onSignatureChange={(sig) => updateFormData({ unterschrift: sig })}
          />
        </div>
        
        {!isNurRundumMode && (
          <div>
            <label className="block text-sm font-medium mb-2">
              ggf. Unterschrift der Familienangehörigen
            </label>
            <SignaturePad
              signature={formData.unterschriftFamilie}
              onSignatureChange={(sig) => updateFormData({ unterschriftFamilie: sig })}
            />
          </div>
        )}
      </div>
      
      <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
        Mit der Unterschrift erkläre ich, die Zustimmung der Familienangehörigen zur Abgabe 
        der erforderlichen Daten erhalten zu haben. Ich bestätige die Richtigkeit der Angaben 
        und werde über Änderungen umgehend informieren.
      </p>
    </FormSection>
  );
};
