import React from 'react';
import { FormSection } from './FormSection';
import { FormField } from './FormField';
import { FormData, BIG_GESCHLECHT_OPTIONS, BigBankDaten, BigGeschlecht } from '@/types/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { CreditCard, User } from 'lucide-react';

interface Props {
  formData: FormData;
  updateFormData: (updates: Partial<FormData>) => void;
}

export const BigPlusbonusSection: React.FC<Props> = ({ formData, updateFormData }) => {
  const updateBank = (updates: Partial<BigBankDaten>) => {
    updateFormData({ bigBank: { ...formData.bigBank, ...updates } });
  };

  return (
    <>
      <FormSection title="Geschlecht" icon={User}>
        <RadioGroup
          value={formData.bigGeschlecht}
          onValueChange={(v) => updateFormData({ bigGeschlecht: v as BigGeschlecht })}
          className="flex flex-wrap gap-4"
        >
          {BIG_GESCHLECHT_OPTIONS.map((opt) => (
            <Label
              key={opt.value}
              htmlFor={`big-g-${opt.value}`}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer hover:border-primary"
            >
              <RadioGroupItem value={opt.value} id={`big-g-${opt.value}`} />
              {opt.label}
            </Label>
          ))}
        </RadioGroup>
      </FormSection>

      <FormSection title="Zahlungsempfänger*in (SEPA-Lastschriftmandat)" icon={CreditCard}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            type="text"
            id="big-kontoinhaber"
            label="Kontoinhaber*in"
            value={formData.bigBank.kontoinhaber}
            onChange={(v) => updateBank({ kontoinhaber: v })}
            required
          />
          <FormField
            type="text"
            id="big-kreditinstitut"
            label="Kreditinstitut"
            value={formData.bigBank.kreditinstitut}
            onChange={(v) => updateBank({ kreditinstitut: v })}
            required
          />
          <FormField
            type="text"
            id="big-iban"
            label="IBAN"
            value={formData.bigBank.iban}
            onChange={(v) => updateBank({ iban: v.toUpperCase() })}
            required
          />
          <FormField
            type="text"
            id="big-bic"
            label="BIC"
            value={formData.bigBank.bic}
            onChange={(v) => updateBank({ bic: v.toUpperCase() })}
            required
          />
          <FormField
            type="text"
            id="big-ort"
            label="Ort (Unterschrift)"
            value={formData.bigBank.ort}
            onChange={(v) => updateBank({ ort: v })}
            required
          />
          <FormField
            type="date"
            id="big-datum"
            label="Datum"
            value={formData.bigBank.datum}
            onChange={(v) => updateBank({ datum: v })}
            required
          />
        </div>
        <p className="text-sm text-muted-foreground mt-3">
          Die Unterschrift des Kontoinhabers wird automatisch aus der Mitglieds-Unterschrift übernommen und neben dem Datum platziert.
        </p>
      </FormSection>
    </>
  );
};
