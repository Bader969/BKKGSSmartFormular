import React from 'react';
import { FormSection } from './FormSection';
import { FamilyMemberForm } from './FamilyMemberForm';
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
    </FormSection>
  );
};
