import React, { useEffect } from 'react';
import { FormSection } from './FormSection';
import { FormField } from './FormField';
import { FormData } from '@/types/form';
import { generateSignatureImage } from '@/utils/signatureGenerator';

interface SignatureSectionProps {
  formData: FormData;
  updateFormData: (updates: Partial<FormData>) => void;
}

export const SignatureSection: React.FC<SignatureSectionProps> = ({ formData, updateFormData }) => {
  const isNurRundumMode = formData.mode === 'nur_rundum';
  
  // Generiere automatisch Unterschriften aus den Nachnamen
  useEffect(() => {
    const generateAutoSignatures = async () => {
      if (formData.mitgliedName && !formData.unterschrift) {
        const sig = await generateSignatureImage(formData.mitgliedName);
        updateFormData({ unterschrift: sig });
      }
    };
    generateAutoSignatures();
  }, [formData.mitgliedName]);

  // Generiere Unterschrift für Ehegatte
  useEffect(() => {
    const generateSpouseSignature = async () => {
      if (formData.ehegatte?.name && !formData.unterschriftFamilie) {
        const sig = await generateSignatureImage(formData.ehegatte.name);
        updateFormData({ unterschriftFamilie: sig });
      }
    };
    generateSpouseSignature();
  }, [formData.ehegatte?.name]);
  
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
      
      {/* Unterschriften Vorschau */}
      <div className={`grid gap-6 ${isNurRundumMode ? 'grid-cols-1 max-w-md' : 'grid-cols-1 md:grid-cols-2'}`}>
        {/* Unterschrift Mitglied */}
        <div className="p-4 bg-card rounded-lg border border-border">
          <label className="block text-sm font-medium mb-3">
            Unterschrift des Mitglieds
          </label>
          {formData.mitgliedName ? (
            <div className="bg-white p-4 rounded border border-border/50 min-h-[80px] flex items-center">
              <p 
                className="font-signature text-3xl italic"
                style={{ color: '#1a4d80' }}
              >
                {formData.mitgliedName}
              </p>
            </div>
          ) : (
            <div className="bg-muted/50 p-4 rounded border border-dashed border-border min-h-[80px] flex items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Bitte Nachname des Mitglieds eingeben
              </p>
            </div>
          )}
        </div>
        
        {/* Unterschrift Familienangehörige (Ehegatte) */}
        {!isNurRundumMode && (
          <div className="p-4 bg-card rounded-lg border border-border">
            <label className="block text-sm font-medium mb-3">
              ggf. Unterschrift der Familienangehörigen
            </label>
            {formData.ehegatte?.name ? (
              <div className="bg-white p-4 rounded border border-border/50 min-h-[80px] flex items-center">
                <p 
                  className="font-signature text-3xl italic"
                  style={{ color: '#1a4d80' }}
                >
                  {formData.ehegatte.name}
                </p>
              </div>
            ) : (
              <div className="bg-muted/50 p-4 rounded border border-dashed border-border min-h-[80px] flex items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  Bitte Nachname des Ehegatten eingeben
                </p>
              </div>
            )}
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
