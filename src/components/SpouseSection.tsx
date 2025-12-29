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
    </FormSection>
  );
};
