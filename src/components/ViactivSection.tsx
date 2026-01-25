import React from 'react';
import { FormSection } from './FormSection';
import { FormField } from './FormField';
import { FormData, VIACTIV_GESCHLECHT_OPTIONS, VIACTIV_BESCHAEFTIGUNG_OPTIONS, VIACTIV_VERSICHERUNGSART_OPTIONS, ArbeitgeberDaten } from '@/types/form';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { validateName, validateStrasse, validateHausnummer, validatePlz, validateOrt, validateSelect } from '@/utils/validation';

interface ViactivSectionProps {
  formData: FormData;
  updateFormData: (updates: Partial<FormData>) => void;
}

export const ViactivSection: React.FC<ViactivSectionProps> = ({ formData, updateFormData }) => {
  const updateArbeitgeber = (updates: Partial<ArbeitgeberDaten>) => {
    updateFormData({
      viactivArbeitgeber: { ...formData.viactivArbeitgeber, ...updates }
    });
  };

  const geschlechtOptions = VIACTIV_GESCHLECHT_OPTIONS.map(opt => ({
    value: opt.value,
    label: opt.label,
  }));

  const beschaeftigungOptions = VIACTIV_BESCHAEFTIGUNG_OPTIONS.map(opt => ({
    value: opt.value,
    label: opt.label,
  }));

  const versicherungsartOptions = VIACTIV_VERSICHERUNGSART_OPTIONS.map(opt => ({
    value: opt.value,
    label: opt.label,
  }));

  return (
    <>
      {/* Zusätzliche persönliche Angaben für VIACTIV */}
      <FormSection title="Zusätzliche Angaben für VIACTIV" variant="member">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <FormField
            type="date"
            label="Geburtsdatum"
            id="viactivGeburtsdatum"
            value={formData.mitgliedGeburtsdatum}
            onChange={(value) => updateFormData({ mitgliedGeburtsdatum: value })}
            required
          />
          <FormField
            type="select"
            label="Geschlecht"
            id="viactivGeschlecht"
            value={formData.viactivGeschlecht}
            onChange={(value) => updateFormData({ viactivGeschlecht: value as FormData['viactivGeschlecht'] })}
            options={geschlechtOptions}
            placeholder="Auswählen..."
            required
            validate={validateSelect}
          />
          <FormField
            type="select"
            label="Beschäftigungsstatus"
            id="viactivBeschaeftigung"
            value={formData.viactivBeschaeftigung}
            onChange={(value) => updateFormData({ viactivBeschaeftigung: value as FormData['viactivBeschaeftigung'] })}
            options={beschaeftigungOptions}
            placeholder="Auswählen..."
            required
            validate={validateSelect}
          />
          <FormField
            type="select"
            label="Bisherige Versicherungsart"
            id="viactivVersicherungsart"
            value={formData.viactivVersicherungsart}
            onChange={(value) => updateFormData({ viactivVersicherungsart: value as FormData['viactivVersicherungsart'] })}
            options={versicherungsartOptions}
            placeholder="Auswählen..."
            required
            validate={validateSelect}
          />
        </div>
      </FormSection>

      {/* Arbeitgeber-Daten */}
      <FormSection title="Angaben zum Arbeitgeber" variant="member">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <FormField
              type="text"
              label="Name des Arbeitgebers"
              id="arbeitgeberName"
              value={formData.viactivArbeitgeber.name}
              onChange={(value) => updateArbeitgeber({ name: value })}
              placeholder="z.B. Musterfirma GmbH"
              validate={validateName}
            />
          </div>
          <FormField
            type="text"
            label="Straße"
            id="arbeitgeberStrasse"
            value={formData.viactivArbeitgeber.strasse}
            onChange={(value) => updateArbeitgeber({ strasse: value })}
            placeholder="z.B. Industriestraße"
            validate={validateStrasse}
          />
          <FormField
            type="text"
            label="Hausnummer"
            id="arbeitgeberHausnummer"
            value={formData.viactivArbeitgeber.hausnummer}
            onChange={(value) => updateArbeitgeber({ hausnummer: value })}
            placeholder="z.B. 5"
            validate={validateHausnummer}
          />
          <FormField
            type="text"
            label="PLZ"
            id="arbeitgeberPlz"
            value={formData.viactivArbeitgeber.plz}
            onChange={(value) => updateArbeitgeber({ plz: value })}
            placeholder="z.B. 12345"
            validate={validatePlz}
          />
          <FormField
            type="text"
            label="Ort"
            id="arbeitgeberOrt"
            value={formData.viactivArbeitgeber.ort}
            onChange={(value) => updateArbeitgeber({ ort: value })}
            placeholder="z.B. Berlin"
            validate={validateOrt}
          />
          <FormField
            type="date"
            label="Beschäftigt seit"
            id="arbeitgeberBeschaeftigtSeit"
            value={formData.viactivArbeitgeber.beschaeftigtSeit}
            onChange={(value) => updateArbeitgeber({ beschaeftigtSeit: value })}
          />
        </div>
      </FormSection>

      {/* Familienangehörige mitversichern Option */}
      <FormSection title="Familienversicherung" variant="member">
        <div className="flex items-center space-x-3 p-4 bg-muted/30 rounded-lg border">
          <Checkbox
            id="viactivFamilieMitversichern"
            checked={formData.viactivFamilienangehoerigeMitversichern}
            onCheckedChange={(checked) => 
              updateFormData({ viactivFamilienangehoerigeMitversichern: checked === true })
            }
          />
          <Label 
            htmlFor="viactivFamilieMitversichern" 
            className="text-sm font-medium cursor-pointer"
          >
            Familienangehörige sollen mitversichert werden
          </Label>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Aktivieren Sie diese Option, wenn Sie Familienangehörige über Ihre Mitgliedschaft mitversichern möchten.
        </p>
      </FormSection>
    </>
  );
};
