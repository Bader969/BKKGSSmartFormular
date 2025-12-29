import React from 'react';
import { FormSection } from './FormSection';
import { FamilyMemberForm } from './FamilyMemberForm';
import { FormData, FamilyMember, createEmptyFamilyMember } from '@/types/form';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

interface ChildrenSectionProps {
  formData: FormData;
  updateFormData: (updates: Partial<FormData>) => void;
}

export const ChildrenSection: React.FC<ChildrenSectionProps> = ({ formData, updateFormData }) => {
  const updateKind = (index: number, updates: Partial<FamilyMember>) => {
    const newKinder = [...formData.kinder];
    newKinder[index] = { ...newKinder[index], ...updates };
    updateFormData({ kinder: newKinder });
  };
  
  const addChild = () => {
    if (formData.kinder.length < 3) {
      updateFormData({
        kinder: [...formData.kinder, createEmptyFamilyMember()]
      });
    }
  };
  
  const removeChild = (index: number) => {
    if (formData.kinder.length > 1) {
      const newKinder = formData.kinder.filter((_, i) => i !== index);
      updateFormData({ kinder: newKinder });
    }
  };

  return (
    <FormSection title="Angaben zu Kindern" variant="child">
      {formData.kinder.map((kind, index) => (
        <div key={index} className="relative">
          {formData.kinder.length > 1 && (
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium">Kind {index + 1}</h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeChild(index)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Entfernen
              </Button>
            </div>
          )}
          <FamilyMemberForm
            member={kind}
            updateMember={(updates) => updateKind(index, updates)}
            type="child"
            childIndex={index + 1}
          />
          {index < formData.kinder.length - 1 && (
            <hr className="my-6 border-accent/30" />
          )}
        </div>
      ))}
      
      {formData.kinder.length < 3 && (
        <Button
          type="button"
          variant="outline"
          onClick={addChild}
          className="mt-4 w-full border-dashed border-accent text-accent hover:bg-accent/10"
        >
          <Plus className="h-4 w-4 mr-2" />
          Weiteres Kind hinzufügen
        </Button>
      )}
    </FormSection>
  );
};
