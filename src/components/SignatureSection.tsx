import React, { useEffect, useState } from 'react';
import { FormSection } from './FormSection';
import { FormField } from './FormField';
import { SignaturePad } from './SignaturePad';
import { FormData } from '@/types/form';
import { generateSignatureImage } from '@/utils/signatureGenerator';

interface SignatureSectionProps {
  formData: FormData;
  updateFormData: (updates: Partial<FormData>) => void;
}

export const SignatureSection: React.FC<SignatureSectionProps> = ({ formData, updateFormData }) => {
  const isNurRundumMode = formData.mode === 'nur_rundum';
  const [generatedSignature, setGeneratedSignature] = useState<string>('');
  
  // Generiere automatisch eine Unterschrift aus dem Nachnamen
  useEffect(() => {
    const generateAutoSignature = async () => {
      if (formData.mitgliedName && !formData.unterschrift) {
        const sig = await generateSignatureImage(formData.mitgliedName);
        setGeneratedSignature(sig);
        // Setze die generierte Unterschrift als Standard
        updateFormData({ unterschrift: sig });
      }
    };
    generateAutoSignature();
  }, [formData.mitgliedName]);
  
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
      
      {/* Generierte Handschrift-Vorschau */}
      {formData.mitgliedName && (
        <div className="mb-6 p-4 bg-card/50 rounded-lg border border-border/50">
          <p className="text-sm text-muted-foreground mb-2">
            Automatisch generierte Unterschrift (basierend auf Nachname):
          </p>
          <div className="flex items-center gap-4">
            <p 
              className="font-signature text-3xl italic"
              style={{ color: '#1a4d80' }}
            >
              {formData.mitgliedName}
            </p>
            <span className="text-xs text-muted-foreground">
              (Diese wird verwendet, falls keine manuelle Unterschrift erfolgt)
            </span>
          </div>
        </div>
      )}
      
      <div className={`grid gap-6 ${isNurRundumMode ? 'grid-cols-1 max-w-md' : 'grid-cols-1 md:grid-cols-2'}`}>
        <div>
          <label className="block text-sm font-medium mb-2">
            Unterschrift des Mitglieds (optional - oder manuelle Unterschrift)
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
