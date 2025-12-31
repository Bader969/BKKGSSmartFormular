import React, { useState } from 'react';
import { FormSection } from './FormSection';
import { FamilyMemberForm } from './FamilyMemberForm';
import { FormField } from './FormField';
import { FormData, FamilyMember } from '@/types/form';
import { CopyBlockButton } from './CopyBlockButton';
import { validateName, validateOrt, validateStaatsangehoerigkeit, validateKrankenkasse } from '@/utils/validation';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface SpouseSectionProps {
  formData: FormData;
  updateFormData: (updates: Partial<FormData>) => void;
}

export const SpouseSection: React.FC<SpouseSectionProps> = ({ formData, updateFormData }) => {
  const [hasSpouse, setHasSpouse] = useState<boolean | null>(null);

  const updateEhegatte = (updates: Partial<FamilyMember>) => {
    updateFormData({
      ehegatte: { ...formData.ehegatte, ...updates }
    });
  };

  return (
    <FormSection title="Angaben zum Ehegatten / Lebenspartner" variant="spouse">
      {/* Frage ob Partner vorhanden */}
      <div className="mb-6">
        <Label className="text-sm font-medium mb-3 block">
          Haben Sie einen Ehegatten / Lebenspartner? <span className="text-destructive">*</span>
        </Label>
        <RadioGroup
          value={hasSpouse === null ? undefined : hasSpouse ? "ja" : "nein"}
          onValueChange={(value) => setHasSpouse(value === "ja")}
          className="flex gap-6"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="ja" id="spouse-yes" />
            <Label htmlFor="spouse-yes" className="cursor-pointer">Ja</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="nein" id="spouse-no" />
            <Label htmlFor="spouse-no" className="cursor-pointer">Nein</Label>
          </div>
        </RadioGroup>
      </div>

      {/* Ehegatte-Formular nur anzeigen wenn "Ja" ausgewählt */}
      {hasSpouse === true && (
        <>
          <FamilyMemberForm
            member={formData.ehegatte}
            updateMember={updateEhegatte}
            type="spouse"
          />
          
          {/* Neue Felder für Ehegatte */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <FormField
              type="text"
              label="Geburtsname"
              id="ehegatte-geburtsname"
              value={formData.ehegatte.geburtsname || formData.ehegatte.name}
              onChange={(value) => updateEhegatte({ geburtsname: value })}
              placeholder="Wird automatisch vom Nachnamen übernommen"
              required
              validate={validateName}
            />
            <FormField
              type="text"
              label="Geburtsort"
              id="ehegatte-geburtsort"
              value={formData.ehegatte.geburtsort}
              onChange={(value) => updateEhegatte({ geburtsort: value })}
              placeholder="z.B. Berlin"
              required
              validate={validateOrt}
            />
            <FormField
              type="text"
              label="Geburtsland"
              id="ehegatte-geburtsland"
              value={formData.ehegatte.geburtsland}
              onChange={(value) => updateEhegatte({ geburtsland: value })}
              placeholder="z.B. Deutschland"
              required
              validate={validateOrt}
            />
            <FormField
              type="text"
              label="Staatsangehörigkeit"
              id="ehegatte-staatsangehoerigkeit"
              value={formData.ehegatte.staatsangehoerigkeit}
              onChange={(value) => updateEhegatte({ staatsangehoerigkeit: value })}
              placeholder="z.B. Deutsch"
              required
              validate={validateStaatsangehoerigkeit}
            />
          </div>
          
          <div className="mt-4 pt-4 border-t border-secondary/20">
            <FormField
              type="text"
              label="Name der bisherigen Krankenkasse (Ehegatte)"
              id="ehegatteKrankenkasse"
              value={formData.ehegatteKrankenkasse}
              onChange={(value) => updateFormData({ 
                ehegatteKrankenkasse: value,
                mitgliedKrankenkasse: value  // Synchronisiert mit Name der Krankenkasse (Mitglied)
              })}
              placeholder="z.B. BKK GS"
              required
              validate={validateKrankenkasse}
            />
          </div>
          
          {/* Pre-filled Felder (bearbeitbar, aber vorausgefüllt) */}
          <div className="mt-4 pt-4 border-t border-secondary/20">
            <p className="text-sm text-muted-foreground mb-3">Vorausgefüllte Felder (vom Antragsteller - bearbeitbar):</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                type="text"
                label="Vorname (letzte Versicherung)"
                id="ehegatte-letzte-vers-vorname"
                value={formData.ehegatte.bisherigVorname || formData.mitgliedVorname}
                onChange={(value) => updateEhegatte({ bisherigVorname: value })}
                placeholder="Vorname des Antragstellers"
                required
                validate={validateName}
              />
              <FormField
                type="text"
                label="Nachname (letzte Versicherung)"
                id="ehegatte-letzte-vers-nachname"
                value={formData.ehegatte.bisherigNachname || formData.mitgliedName}
                onChange={(value) => updateEhegatte({ bisherigNachname: value })}
                placeholder="Nachname des Antragstellers"
                required
                validate={validateName}
              />
            </div>
          </div>
          
          {/* Versicherungsart Checkboxen */}
          <div className="mt-4 pt-4 border-t border-secondary/20">
            <p className="text-sm text-muted-foreground mb-3">Bisherige Versicherungsart: <span className="text-destructive">*</span></p>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="ehegatte-versicherungsart"
                  checked={formData.ehegatte.bisherigArt === 'mitgliedschaft'}
                  onChange={() => updateEhegatte({ bisherigArt: 'mitgliedschaft' })}
                  className="w-4 h-4 text-primary"
                />
                <span className="text-sm">Mitgliedschaft</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="ehegatte-versicherungsart"
                  checked={formData.ehegatte.bisherigArt === 'familienversicherung'}
                  onChange={() => updateEhegatte({ bisherigArt: 'familienversicherung' })}
                  className="w-4 h-4 text-primary"
                />
                <span className="text-sm">Familienversicherung</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="ehegatte-versicherungsart"
                  checked={formData.ehegatte.bisherigArt === 'nicht_gesetzlich'}
                  onChange={() => updateEhegatte({ bisherigArt: 'nicht_gesetzlich' })}
                  className="w-4 h-4 text-primary"
                />
                <span className="text-sm">Nicht gesetzlich versichert</span>
              </label>
            </div>
          </div>
          
          {/* Copy Block für Ehegatte-Daten */}
          <CopyBlockButton
            label="Ehegatte-Daten"
            data={{
              vorname: formData.ehegatte.vorname,
              name: formData.ehegatte.name,
              geburtsdatum: formData.ehegatte.geburtsdatum,
              geburtsname: formData.ehegatte.geburtsname || formData.ehegatte.name,
              geburtsort: formData.ehegatte.geburtsort,
              geburtsland: formData.ehegatte.geburtsland,
              staatsangehoerigkeit: formData.ehegatte.staatsangehoerigkeit,
              krankenkasse: formData.ehegatteKrankenkasse,
              geschlecht: formData.ehegatte.geschlecht === 'm' ? 'Männlich' : formData.ehegatte.geschlecht === 'w' ? 'Weiblich' : formData.ehegatte.geschlecht,
            }}
            fieldLabels={{
              vorname: 'Vorname',
              name: 'Name',
              geburtsdatum: 'Geburtsdatum',
              geburtsname: 'Geburtsname',
              geburtsort: 'Geburtsort',
              geburtsland: 'Geburtsland',
              staatsangehoerigkeit: 'Staatsangehörigkeit',
              krankenkasse: 'Krankenkasse',
              geschlecht: 'Geschlecht',
            }}
          />
        </>
      )}
    </FormSection>
  );
};
