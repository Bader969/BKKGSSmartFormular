import React from 'react';
import { FormField } from './FormField';
import { FamilyMember } from '@/types/form';
import { calculateDates } from '@/utils/dateUtils';
import { NATIONALITY_OPTIONS } from '@/utils/countries';
import { 
  validateName, 
  validateGeburtsdatum, 
  validateSelect, 
  validateOrt,
  validateVersichertennummer
} from '@/utils/validation';

interface FamilyMemberFormProps {
  member: FamilyMember;
  updateMember: (updates: Partial<FamilyMember>) => void;
  type: 'spouse' | 'child';
  childIndex?: number;
}

export const FamilyMemberForm: React.FC<FamilyMemberFormProps> = ({ 
  member, 
  updateMember, 
  type,
  childIndex 
}) => {
  const { endDate } = calculateDates();
  
  const geschlechtOptions = [
    { value: 'm', label: 'Männlich (m)' },
    { value: 'w', label: 'Weiblich (w)' },
    { value: 'x', label: 'Unbestimmt (X)' },
    { value: 'd', label: 'Divers (D)' },
  ];
  
  const verwandtschaftOptions = [
    { value: 'leiblich', label: 'Leibliches Kind' },
    { value: 'stief', label: 'Stiefkind' },
    { value: 'enkel', label: 'Enkel' },
    { value: 'pflege', label: 'Pflegekind' },
  ];
  
  const prefix = type === 'spouse' ? 'ehegatte' : `kind${childIndex}`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <FormField
          type="text"
          label="Vorname"
          id={`${prefix}-vorname`}
          value={member.vorname}
          onChange={(value) => updateMember({ vorname: value })}
          placeholder="Vorname"
          required
          validate={validateName}
        />
        <FormField
          type="text"
          label="Name"
          id={`${prefix}-name`}
          value={member.name}
          onChange={(value) => updateMember({ name: value })}
          placeholder="Nachname"
          required
          validate={validateName}
        />
        <FormField
          type="select"
          label="Geschlecht"
          id={`${prefix}-geschlecht`}
          value={member.geschlecht}
          onChange={(value) => updateMember({ geschlecht: value as FamilyMember['geschlecht'] })}
          options={geschlechtOptions}
          required
          validate={validateSelect}
        />
        <FormField
          type="date"
          label="Geburtsdatum"
          id={`${prefix}-geburtsdatum`}
          value={member.geburtsdatum}
          onChange={(value) => updateMember({ geburtsdatum: value })}
          required
          validate={validateGeburtsdatum}
        />
      </div>
      
      {type === 'child' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <FormField
            type="text"
            label="Geburtsname"
            id={`${prefix}-geburtsname`}
            value={member.geburtsname || member.name}
            onChange={(value) => updateMember({ geburtsname: value })}
            placeholder="Wird automatisch vom Nachnamen übernommen"
            required
            validate={validateName}
          />
          <FormField
            type="text"
            label="Geburtsort"
            id={`${prefix}-geburtsort`}
            value={member.geburtsort}
            onChange={(value) => updateMember({ geburtsort: value })}
            placeholder="z.B. Berlin"
            required
            validate={validateOrt}
          />
          <FormField
            type="text"
            label="Geburtsland"
            id={`${prefix}-geburtsland`}
            value={member.geburtsland}
            onChange={(value) => updateMember({ geburtsland: value })}
            placeholder="z.B. Deutschland"
            required
            validate={validateOrt}
          />
          <FormField
            type="select"
            label="Staatsangehörigkeit"
            id={`${prefix}-staatsangehoerigkeit`}
            value={member.staatsangehoerigkeit}
            onChange={(value) => updateMember({ staatsangehoerigkeit: value })}
            options={NATIONALITY_OPTIONS.map(c => ({ value: c.code, label: c.name }))}
            placeholder="Land auswählen"
            required
            validate={validateSelect}
          />
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          type="text"
          label="Versichertennummer"
          id={`${prefix}-versichertennummer`}
          value={member.versichertennummer}
          onChange={(value) => updateMember({ versichertennummer: value })}
          placeholder="Versichertennummer"
          required
          validate={validateVersichertennummer}
        />
        {type === 'child' && (
          <FormField
            type="select"
            label="Verwandtschaftsverhältnis"
            id={`${prefix}-verwandtschaft`}
            value={member.verwandtschaft}
            onChange={(value) => updateMember({ verwandtschaft: value as FamilyMember['verwandtschaft'] })}
            options={verwandtschaftOptions}
            required
            validate={validateSelect}
          />
        )}
      </div>
      
      {/* Bisherige Versicherung - automatisch ausgefüllt */}
      <div className="p-4 bg-card/50 rounded-lg border mt-4">
        <h4 className="font-medium mb-3 text-sm">Bisherige Versicherung (vorausgefüllt - bearbeitbar):</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            type="text"
            label="Bisherige Versicherung endete am"
            id={`${prefix}-endeteAm`}
            value={member.bisherigEndeteAm || endDate}
            onChange={(value) => updateMember({ bisherigEndeteAm: value })}
            placeholder="TT.MM.JJJJ"
            required
          />
          <div className="space-y-2">
            <FormField
              type="checkbox"
              label="Bisherige Versicherung besteht weiter"
              id={`${prefix}-bestehtWeiter`}
              checked={member.bisherigBestehtWeiter}
              onChange={(checked) => updateMember({ bisherigBestehtWeiter: checked })}
            />
            <FormField
              type="text"
              label="Bei"
              id={`${prefix}-bestehtWeiterBei`}
              value={member.bisherigBestehtWeiterBei}
              onChange={(value) => updateMember({ bisherigBestehtWeiterBei: value })}
              placeholder="Name der Krankenkasse"
              required
            />
          </div>
        </div>
        <div className="mt-3">
          <FormField
            type="checkbox"
            label="Familienversichert"
            id={`${prefix}-familienversichert`}
            checked={member.familienversichert !== false}
            onChange={(checked) => updateMember({ familienversichert: checked })}
          />
        </div>
      </div>
    </div>
  );
};
