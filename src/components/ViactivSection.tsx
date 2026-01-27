import React from 'react';
import { FormSection } from './FormSection';
import { FormField } from './FormField';
import { FormData, VIACTIV_GESCHLECHT_OPTIONS, VIACTIV_BESCHAEFTIGUNG_OPTIONS, VIACTIV_VERSICHERUNGSART_OPTIONS, ArbeitgeberDaten, FamilyMember, createEmptyFamilyMember } from '@/types/form';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { validateName, validateStrasse, validateHausnummer, validatePlz, validateOrt, validateSelect } from '@/utils/validation';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { NATIONALITY_OPTIONS } from '@/utils/countries';
import { calculateDates } from '@/utils/dateUtils';

interface ViactivSectionProps {
  formData: FormData;
  updateFormData: (updates: Partial<FormData>) => void;
}

export const ViactivSection: React.FC<ViactivSectionProps> = ({ formData, updateFormData }) => {
  const { endDate } = calculateDates();
  
  const updateArbeitgeber = (updates: Partial<ArbeitgeberDaten>) => {
    updateFormData({
      viactivArbeitgeber: { ...formData.viactivArbeitgeber, ...updates }
    });
  };

  const updateEhegatte = (updates: Partial<FamilyMember>) => {
    updateFormData({
      ehegatte: { ...formData.ehegatte, ...updates }
    });
  };

  const updateKind = (index: number, updates: Partial<FamilyMember>) => {
    const newKinder = [...formData.kinder];
    newKinder[index] = { ...newKinder[index], ...updates };
    updateFormData({ kinder: newKinder });
  };

  const addChild = () => {
    updateFormData({
      kinder: [...formData.kinder, createEmptyFamilyMember()]
    });
  };

  const removeChild = (index: number) => {
    const newKinder = formData.kinder.filter((_, i) => i !== index);
    updateFormData({ kinder: newKinder });
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

  const familyGeschlechtOptions = [
    { value: 'm', label: 'Männlich' },
    { value: 'w', label: 'Weiblich' },
    { value: 'x', label: 'Unbestimmt' },
    { value: 'd', label: 'Divers' },
  ];

  const verwandtschaftOptions = [
    { value: 'leiblich', label: 'Leibliches Kind' },
    { value: 'stief', label: 'Stiefkind' },
    { value: 'enkel', label: 'Enkelkind' },
    { value: 'pflege', label: 'Pflegekind' },
  ];

  const nationalityOptions = NATIONALITY_OPTIONS.map(c => ({ value: c.code, label: c.name }));

  return (
    <>
      {/* Zusätzliche persönliche Angaben für VIACTIV */}
      <FormSection title="Zusätzliche Angaben für VIACTIV" variant="member">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            label="Staatsangehörigkeit"
            id="viactivStaatsangehoerigkeit"
            value={formData.viactivStaatsangehoerigkeit}
            onChange={(value) => updateFormData({ viactivStaatsangehoerigkeit: value })}
            options={nationalityOptions}
            placeholder="Land auswählen"
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

      {/* VIACTIV Bonus-Programm */}
      <FormSection title="VIACTIV Bonus-Programm" variant="member">
        <div className="p-4 bg-muted/30 rounded-lg border mb-4">
          <p className="text-sm text-muted-foreground">
            Diese Daten werden auf allen Bonus-PDFs (Erwachsene 170€ und Kinder 110€) eingetragen.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            type="text"
            label="Antrags-/Vertragsnummer"
            id="viactivBonusVertragsnummer"
            value={formData.viactivBonusVertragsnummer}
            onChange={(value) => updateFormData({ viactivBonusVertragsnummer: value })}
            placeholder="Vertragsnummer eingeben"
            required
          />
          <FormField
            type="text"
            label="Kontoinhaber"
            id="viactivBonusKontoinhaber"
            value={formData.viactivBonusKontoinhaber}
            onChange={(value) => updateFormData({ viactivBonusKontoinhaber: value })}
            placeholder="Name des Kontoinhabers"
            required
          />
          <FormField
            type="text"
            label="IBAN"
            id="viactivBonusIBAN"
            value={formData.viactivBonusIBAN}
            onChange={(value) => updateFormData({ viactivBonusIBAN: value })}
            placeholder="DE..."
            required
          />
        </div>
      </FormSection>

      {/* Ehepartner-Sektion - nur anzeigen wenn Familienversicherung aktiviert */}
      {formData.viactivFamilienangehoerigeMitversichern && (
        <>
          <FormSection title="Angaben zum Ehegatten / Lebenspartner (VIACTIV)" variant="spouse">
            {/* Frage ob Ehepartner selbst versichert */}
            <div className="mb-4 p-4 bg-muted/30 rounded-lg border">
              <Label className="text-sm font-medium mb-3 block">
                Ist Ihr Ehepartner/-in selbst versichert?
              </Label>
              <RadioGroup
                value={formData.ehegatte.bisherigArt === 'mitgliedschaft' ? 'ja' : formData.ehegatte.bisherigArt ? 'nein' : undefined}
                onValueChange={(value) => updateEhegatte({ bisherigArt: value === 'ja' ? 'mitgliedschaft' : 'familienversicherung' })}
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nein" id="viactiv-spouse-self-no" />
                  <Label htmlFor="viactiv-spouse-self-no" className="cursor-pointer">Nein</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ja" id="viactiv-spouse-self-yes" />
                  <Label htmlFor="viactiv-spouse-self-yes" className="cursor-pointer">Ja, versichert bei:</Label>
                </div>
              </RadioGroup>
              {formData.ehegatte.bisherigArt === 'mitgliedschaft' && (
                <FormField
                  type="text"
                  label=""
                  id="ehegatte-selbst-versichert-bei"
                  value={formData.ehegatte.bisherigBestehtWeiterBei || ''}
                  onChange={(value) => updateEhegatte({ bisherigBestehtWeiterBei: value })}
                  placeholder="Name der Krankenkasse"
                  className="mt-2"
                />
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <FormField
                type="text"
                label="Name"
                id="viactiv-ehegatte-name"
                value={formData.ehegatte.name}
                onChange={(value) => updateEhegatte({ name: value })}
                placeholder="Nachname"
                validate={validateName}
              />
              <FormField
                type="text"
                label="Vorname"
                id="viactiv-ehegatte-vorname"
                value={formData.ehegatte.vorname}
                onChange={(value) => updateEhegatte({ vorname: value })}
                placeholder="Vorname"
                validate={validateName}
              />
              <FormField
                type="date"
                label="Geburtsdatum"
                id="viactiv-ehegatte-geburtsdatum"
                value={formData.ehegatte.geburtsdatum}
                onChange={(value) => updateEhegatte({ geburtsdatum: value })}
              />
              <FormField
                type="select"
                label="Geschlecht"
                id="viactiv-ehegatte-geschlecht"
                value={formData.ehegatte.geschlecht}
                onChange={(value) => updateEhegatte({ geschlecht: value as FamilyMember['geschlecht'] })}
                options={familyGeschlechtOptions}
                placeholder="Auswählen..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              <FormField
                type="text"
                label="Geburtsname"
                id="viactiv-ehegatte-geburtsname"
                value={formData.ehegatte.geburtsname || formData.ehegatte.name}
                onChange={(value) => updateEhegatte({ geburtsname: value })}
                placeholder="Geburtsname"
                validate={validateName}
              />
              <FormField
                type="text"
                label="Geburtsort / Geburtsland"
                id="viactiv-ehegatte-geburtsort"
                value={formData.ehegatte.geburtsort}
                onChange={(value) => updateEhegatte({ geburtsort: value })}
                placeholder="z.B. Berlin, DE"
                validate={validateOrt}
              />
              <FormField
                type="select"
                label="Staatsangehörigkeit"
                id="viactiv-ehegatte-staatsangehoerigkeit"
                value={formData.ehegatte.staatsangehoerigkeit}
                onChange={(value) => updateEhegatte({ staatsangehoerigkeit: value })}
                options={nationalityOptions}
                placeholder="Land auswählen"
              />
              <FormField
                type="text"
                label="Abweichende Anschrift"
                id="viactiv-ehegatte-anschrift"
                value={formData.ehegatte.abweichendeAnschrift}
                onChange={(value) => updateEhegatte({ abweichendeAnschrift: value })}
                placeholder="Falls abweichend"
              />
            </div>

            {/* Versichertennummer Ehegatte */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <FormField
                type="text"
                label="Versichertennummer"
                id="viactiv-ehegatte-versichertennummer"
                value={formData.ehegatte.versichertennummer}
                onChange={(value) => updateEhegatte({ versichertennummer: value })}
                placeholder="Versichertennummer"
              />
            </div>

            {/* Bisherige Versicherung Ehegatte */}
            <div className="mt-4 p-4 bg-card/50 rounded-lg border">
              <h4 className="font-medium mb-3 text-sm">Bisherige Versicherung:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  type="text"
                  label="Versicherung endete am (TTMMJJJJ)"
                  id="viactiv-ehegatte-endete-am"
                  value={formData.ehegatte.bisherigEndeteAm || endDate.replace(/\./g, '')}
                  onChange={(value) => updateEhegatte({ bisherigEndeteAm: value })}
                  placeholder="z.B. 31032026"
                />
                <FormField
                  type="text"
                  label="Versicherung bestand bei"
                  id="viactiv-ehegatte-bestand-bei"
                  value={formData.ehegatte.bisherigBestandBei || formData.mitgliedKrankenkasse}
                  onChange={(value) => updateEhegatte({ bisherigBestandBei: value })}
                  placeholder="Name der Krankenkasse"
                />
              </div>
              <div className="mt-3">
                <Label className="text-sm font-medium mb-2 block">Bisherige Versicherungsart:</Label>
                <RadioGroup
                  value={formData.ehegatte.bisherigArt}
                  onValueChange={(value) => updateEhegatte({ bisherigArt: value as FamilyMember['bisherigArt'] })}
                  className="flex flex-wrap gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="mitgliedschaft" id="viactiv-ehegatte-art-mitglied" />
                    <Label htmlFor="viactiv-ehegatte-art-mitglied" className="cursor-pointer text-sm">Mitgliedschaft</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="familienversicherung" id="viactiv-ehegatte-art-familie" />
                    <Label htmlFor="viactiv-ehegatte-art-familie" className="cursor-pointer text-sm">Familienversichert</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="nicht_gesetzlich" id="viactiv-ehegatte-art-nicht" />
                    <Label htmlFor="viactiv-ehegatte-art-nicht" className="cursor-pointer text-sm">Nicht gesetzlich</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </FormSection>

          {/* Kinder-Sektion für VIACTIV */}
          <FormSection title="Angaben zu Kindern (VIACTIV)" variant="child">
            {formData.kinder.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <p className="mb-4">Keine Kinder hinzugefügt.</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addChild}
                  className="border-dashed border-accent text-accent hover:bg-accent/10"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Kind hinzufügen
                </Button>
              </div>
            ) : (
              <>
                {formData.kinder.map((kind, index) => (
                  <div key={index} className="relative mb-6">
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

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <FormField
                        type="text"
                        label="Name"
                        id={`viactiv-kind${index}-name`}
                        value={kind.name}
                        onChange={(value) => updateKind(index, { name: value })}
                        placeholder="Nachname"
                        validate={validateName}
                      />
                      <FormField
                        type="text"
                        label="Vorname"
                        id={`viactiv-kind${index}-vorname`}
                        value={kind.vorname}
                        onChange={(value) => updateKind(index, { vorname: value })}
                        placeholder="Vorname"
                        validate={validateName}
                      />
                      <FormField
                        type="date"
                        label="Geburtsdatum"
                        id={`viactiv-kind${index}-geburtsdatum`}
                        value={kind.geburtsdatum}
                        onChange={(value) => updateKind(index, { geburtsdatum: value })}
                      />
                      <FormField
                        type="select"
                        label="Geschlecht"
                        id={`viactiv-kind${index}-geschlecht`}
                        value={kind.geschlecht}
                        onChange={(value) => updateKind(index, { geschlecht: value as FamilyMember['geschlecht'] })}
                        options={familyGeschlechtOptions}
                        placeholder="Auswählen..."
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                      <FormField
                        type="text"
                        label="Geburtsname"
                        id={`viactiv-kind${index}-geburtsname`}
                        value={kind.geburtsname || kind.name}
                        onChange={(value) => updateKind(index, { geburtsname: value })}
                        placeholder="Geburtsname"
                        validate={validateName}
                      />
                      <FormField
                        type="text"
                        label="Geburtsort / Geburtsland"
                        id={`viactiv-kind${index}-geburtsort`}
                        value={kind.geburtsort}
                        onChange={(value) => updateKind(index, { geburtsort: value })}
                        placeholder="z.B. Berlin, DE"
                        validate={validateOrt}
                      />
                      <FormField
                        type="select"
                        label="Staatsangehörigkeit"
                        id={`viactiv-kind${index}-staatsangehoerigkeit`}
                        value={kind.staatsangehoerigkeit}
                        onChange={(value) => updateKind(index, { staatsangehoerigkeit: value })}
                        options={nationalityOptions}
                        placeholder="Land auswählen"
                      />
                      <FormField
                        type="text"
                        label="Abweichende Anschrift"
                        id={`viactiv-kind${index}-anschrift`}
                        value={kind.abweichendeAnschrift}
                        onChange={(value) => updateKind(index, { abweichendeAnschrift: value })}
                        placeholder="Falls abweichend"
                      />
                    </div>

                    {/* Versichertennummer Kind */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <FormField
                        type="text"
                        label="Versichertennummer"
                        id={`viactiv-kind${index}-versichertennummer`}
                        value={kind.versichertennummer}
                        onChange={(value) => updateKind(index, { versichertennummer: value })}
                        placeholder="Versichertennummer"
                      />
                    </div>

                    {/* Verwandtschaft */}
                    <div className="mt-4">
                      <FormField
                        type="select"
                        label="Verwandtschaftsverhältnis"
                        id={`viactiv-kind${index}-verwandtschaft`}
                        value={kind.verwandtschaft}
                        onChange={(value) => updateKind(index, { verwandtschaft: value as FamilyMember['verwandtschaft'] })}
                        options={verwandtschaftOptions}
                        placeholder="Auswählen..."
                      />
                    </div>

                    {/* Bisherige Versicherung Kind */}
                    <div className="mt-4 p-4 bg-card/50 rounded-lg border">
                      <h4 className="font-medium mb-3 text-sm">Bisherige Versicherung:</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          type="text"
                          label="Versicherung endete am (TTMMJJJJ)"
                          id={`viactiv-kind${index}-endete-am`}
                          value={kind.bisherigEndeteAm || endDate.replace(/\./g, '')}
                          onChange={(value) => updateKind(index, { bisherigEndeteAm: value })}
                          placeholder="z.B. 31032026"
                        />
                        <FormField
                          type="text"
                          label="Versicherung bestand bei"
                          id={`viactiv-kind${index}-bestand-bei`}
                          value={kind.bisherigBestandBei || formData.mitgliedKrankenkasse}
                          onChange={(value) => updateKind(index, { bisherigBestandBei: value })}
                          placeholder="Name der Krankenkasse"
                        />
                      </div>
                      <div className="mt-3">
                        <Label className="text-sm font-medium mb-2 block">Bisherige Versicherungsart:</Label>
                        <RadioGroup
                          value={kind.bisherigArt}
                          onValueChange={(value) => updateKind(index, { bisherigArt: value as FamilyMember['bisherigArt'] })}
                          className="flex flex-wrap gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="mitgliedschaft" id={`viactiv-kind${index}-art-mitglied`} />
                            <Label htmlFor={`viactiv-kind${index}-art-mitglied`} className="cursor-pointer text-sm">Mitgliedschaft</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="familienversicherung" id={`viactiv-kind${index}-art-familie`} />
                            <Label htmlFor={`viactiv-kind${index}-art-familie`} className="cursor-pointer text-sm">Familienversichert</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="nicht_gesetzlich" id={`viactiv-kind${index}-art-nicht`} />
                            <Label htmlFor={`viactiv-kind${index}-art-nicht`} className="cursor-pointer text-sm">Nicht gesetzlich</Label>
                          </div>
                        </RadioGroup>
                      </div>
                    </div>

                    {index < formData.kinder.length - 1 && (
                      <hr className="my-6 border-accent/30" />
                    )}
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={addChild}
                  className="mt-4 w-full border-dashed border-accent text-accent hover:bg-accent/10"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Weiteres Kind hinzufügen
                </Button>

                {formData.kinder.length > 3 && (
                  <p className="mt-3 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    <strong>Hinweis:</strong> Bei mehr als 3 Kindern werden mehrere Familienversicherungs-PDFs erstellt. 
                    Das erste PDF enthält die Kinder 1-3, das zweite PDF die Kinder 4-6, usw.
                  </p>
                )}
              </>
            )}
          </FormSection>
        </>
      )}
    </>
  );
};
