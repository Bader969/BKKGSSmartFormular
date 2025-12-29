import React from 'react';
import { FormSection } from './FormSection';
import { FormField } from './FormField';
import { FormData } from '@/types/form';

interface MemberSectionProps {
  formData: FormData;
  updateFormData: (updates: Partial<FormData>) => void;
}

export const MemberSection: React.FC<MemberSectionProps> = ({ formData, updateFormData }) => {
  const familienstandOptions = [
    { value: 'ledig', label: 'Ledig' },
    { value: 'verheiratet', label: 'Verheiratet' },
    { value: 'getrennt', label: 'Getrennt lebend' },
    { value: 'geschieden', label: 'Geschieden' },
    { value: 'verwitwet', label: 'Verwitwet' },
  ];

  return (
    <FormSection title="Allgemeine Angaben des Mitglieds" variant="member">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <FormField
          type="text"
          label="Name"
          id="mitgliedName"
          value={formData.mitgliedName}
          onChange={(value) => updateFormData({ mitgliedName: value })}
          placeholder="Nachname"
        />
        <FormField
          type="text"
          label="Vorname"
          id="mitgliedVorname"
          value={formData.mitgliedVorname}
          onChange={(value) => updateFormData({ mitgliedVorname: value })}
          placeholder="Vorname"
        />
        <FormField
          type="date"
          label="Geburtsdatum"
          id="mitgliedGeburtsdatum"
          value={formData.mitgliedGeburtsdatum}
          onChange={(value) => updateFormData({ mitgliedGeburtsdatum: value })}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <FormField
          type="text"
          label="Anschrift"
          id="mitgliedAnschrift"
          value={formData.mitgliedAnschrift}
          onChange={(value) => updateFormData({ mitgliedAnschrift: value })}
          placeholder="Straße, Hausnummer, PLZ, Ort"
        />
        <FormField
          type="text"
          label="KV-Nummer"
          id="mitgliedKvNummer"
          value={formData.mitgliedKvNummer}
          onChange={(value) => updateFormData({ mitgliedKvNummer: value })}
          placeholder="Krankenversicherungsnummer"
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <FormField
          type="select"
          label="Familienstand"
          id="familienstand"
          value={formData.familienstand}
          onChange={(value) => updateFormData({ familienstand: value as FormData['familienstand'] })}
          options={familienstandOptions}
          placeholder="Auswählen..."
        />
        <FormField
          type="tel"
          label="Telefon (optional)"
          id="telefon"
          value={formData.telefon}
          onChange={(value) => updateFormData({ telefon: value })}
          placeholder="Telefonnummer"
        />
        <FormField
          type="email"
          label="E-Mail (optional)"
          id="email"
          value={formData.email}
          onChange={(value) => updateFormData({ email: value })}
          placeholder="E-Mail-Adresse"
        />
      </div>
      
      {/* Static info display */}
      <div className="mt-6 p-4 bg-card rounded-lg border">
        <h3 className="font-medium mb-3 text-foreground">Automatisch ausgefüllte Angaben:</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Ich war bisher:</span>
            <span className="font-medium">Im Rahmen einer eigenen Mitgliedschaft</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Anlass:</span>
            <span className="font-medium">Beginn meiner Mitgliedschaft</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Beginn Familienversicherung:</span>
            <span className="font-medium">{formData.beginnFamilienversicherung}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Informationsblatt erhalten:</span>
            <span className="font-medium">Ja</span>
          </div>
        </div>
      </div>
    </FormSection>
  );
};
