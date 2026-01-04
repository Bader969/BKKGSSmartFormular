import React from 'react';
import { FormSection } from './FormSection';
import { FormField } from './FormField';
import { FormData } from '@/types/form';
import { CopyBlockButton } from './CopyBlockButton';
import { 
  validateName, 
  validateGeburtsdatum, 
  validateKvNummer, 
  validateKrankenkasse,
  validateSelect,
  validateTelefon,
  validateEmail,
  validateOrt
} from '@/utils/validation';

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
          label="Vorname"
          id="mitgliedVorname"
          value={formData.mitgliedVorname}
          onChange={(value) => updateFormData({ mitgliedVorname: value })}
          placeholder="Vorname"
          required
          validate={validateName}
        />
        <FormField
          type="text"
          label="Name"
          id="mitgliedName"
          value={formData.mitgliedName}
          onChange={(value) => updateFormData({ mitgliedName: value })}
          placeholder="Nachname"
          required
          validate={validateName}
        />
        <FormField
          type="date"
          label="Geburtsdatum"
          id="mitgliedGeburtsdatum"
          value={formData.mitgliedGeburtsdatum}
          onChange={(value) => updateFormData({ mitgliedGeburtsdatum: value })}
          required
          validate={validateGeburtsdatum}
        />
        <FormField
          type="text"
          label="Geburtsort"
          id="mitgliedGeburtsort"
          value={formData.mitgliedGeburtsort}
          onChange={(value) => updateFormData({ mitgliedGeburtsort: value })}
          placeholder="z.B. Berlin"
          validate={validateOrt}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
        <FormField
          type="text"
          label="Straße"
          id="mitgliedStrasse"
          value={formData.mitgliedStrasse}
          onChange={(value) => updateFormData({ mitgliedStrasse: value })}
          placeholder="z.B. Musterstraße"
          required
          validate={validateOrt}
        />
        <FormField
          type="text"
          label="Hausnummer"
          id="mitgliedHausnummer"
          value={formData.mitgliedHausnummer}
          onChange={(value) => updateFormData({ mitgliedHausnummer: value })}
          placeholder="z.B. 12a"
          required
        />
        <FormField
          type="text"
          label="PLZ"
          id="mitgliedPlz"
          value={formData.mitgliedPlz}
          onChange={(value) => updateFormData({ mitgliedPlz: value })}
          placeholder="z.B. 12345"
          required
        />
        <FormField
          type="text"
          label="Ort"
          id="ort"
          value={formData.ort}
          onChange={(value) => updateFormData({ ort: value })}
          placeholder="z.B. Berlin"
          required
          validate={validateOrt}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <FormField
          type="text"
          label="KV-Nummer"
          id="mitgliedKvNummer"
          value={formData.mitgliedKvNummer}
          onChange={(value) => updateFormData({ 
            mitgliedKvNummer: value,
            mitgliedVersichertennummer: value  // Synchronisiert mit Versichertennr. im Rundum-Sicher-Paket
          })}
          placeholder="Krankenversicherungsnummer"
          required
          validate={validateKvNummer}
        />
        <FormField
          type="text"
          label="Name der Krankenkasse"
          id="mitgliedKrankenkasse"
          value={formData.mitgliedKrankenkasse}
          onChange={(value) => updateFormData({ 
            mitgliedKrankenkasse: value,
            ehegatteKrankenkasse: value  // Synchronisiert mit Name der bisherigen Krankenkasse (Ehegatte)
          })}
          placeholder="z.B. BKK GS"
          required
          validate={validateKrankenkasse}
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
          required
          validate={validateSelect}
        />
        <FormField
          type="tel"
          label="Telefon (optional)"
          id="telefon"
          value={formData.telefon}
          onChange={(value) => updateFormData({ telefon: value })}
          placeholder="Telefonnummer"
          validate={validateTelefon}
        />
        <FormField
          type="email"
          label="E-Mail (optional)"
          id="email"
          value={formData.email}
          onChange={(value) => updateFormData({ email: value })}
          placeholder="E-Mail-Adresse"
          validate={validateEmail}
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
      
      {/* Copy Block für Mitglied-Daten */}
      <CopyBlockButton
        label="Mitglied-Daten"
        data={{
          vorname: formData.mitgliedVorname,
          name: formData.mitgliedName,
          geburtsdatum: formData.mitgliedGeburtsdatum,
          geburtsort: formData.mitgliedGeburtsort,
          strasse: formData.mitgliedStrasse,
          hausnummer: formData.mitgliedHausnummer,
          plz: formData.mitgliedPlz,
          ort: formData.ort,
          kvNummer: formData.mitgliedKvNummer,
          krankenkasse: formData.mitgliedKrankenkasse,
          familienstand: formData.familienstand,
          telefon: formData.telefon,
          email: formData.email,
        }}
        fieldLabels={{
          vorname: 'Vorname',
          name: 'Name',
          geburtsdatum: 'Geburtsdatum',
          geburtsort: 'Geburtsort',
          strasse: 'Straße',
          hausnummer: 'Hausnummer',
          plz: 'PLZ',
          ort: 'Ort',
          kvNummer: 'KV-Nummer',
          krankenkasse: 'Krankenkasse',
          familienstand: 'Familienstand',
          telefon: 'Telefon',
          email: 'E-Mail',
        }}
      />
    </FormSection>
  );
};
