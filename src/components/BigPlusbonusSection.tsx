import React from 'react';
import { FormSection } from './FormSection';
import { FormField } from './FormField';
import { FormData, BIG_GESCHLECHT_OPTIONS, BigBankDaten, BigGeschlecht, BigVersicherungsstatus, BigMitversicherte } from '@/types/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

interface Props {
  formData: FormData;
  updateFormData: (updates: Partial<FormData>) => void;
}

export const BigPlusbonusSection: React.FC<Props> = ({ formData, updateFormData }) => {
  const updateBank = (updates: Partial<BigBankDaten>) => {
    updateFormData({ bigBank: { ...formData.bigBank, ...updates } });
  };

  const updateArten = (key: keyof FormData['bigVersicherungsarten'], value: boolean) => {
    updateFormData({ bigVersicherungsarten: { ...formData.bigVersicherungsarten, [key]: value } });
  };

  const updateMitversichert = (idx: number, updates: Partial<BigMitversicherte>) => {
    const arr = [...formData.bigMitversicherte];
    arr[idx] = { ...arr[idx], ...updates };
    updateFormData({ bigMitversicherte: arr });
  };

  const addMitversichert = () => {
    if (formData.bigMitversicherte.length >= 3) return;
    updateFormData({ bigMitversicherte: [...formData.bigMitversicherte, { nameVorname: '', hoehePolice: '' }] });
  };

  const removeMitversichert = (idx: number) => {
    updateFormData({ bigMitversicherte: formData.bigMitversicherte.filter((_, i) => i !== idx) });
  };

  return (
    <>
      <FormSection title="Geschlecht" variant="member">
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

      <FormSection title="Versicherungsstatus & Versicherungsart" variant="info">
        <div className="space-y-4">
          <div>
            <Label className="font-medium mb-2 block">Status</Label>
            <RadioGroup
              value={formData.bigVersicherungsstatus}
              onValueChange={(v) => updateFormData({ bigVersicherungsstatus: v as BigVersicherungsstatus })}
              className="flex flex-wrap gap-4"
            >
              <Label htmlFor="big-status-neu" className="flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer hover:border-primary">
                <RadioGroupItem value="neuabschluss" id="big-status-neu" />
                Neuabschluss
              </Label>
              <Label htmlFor="big-status-best" className="flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer hover:border-primary">
                <RadioGroupItem value="bestehend" id="big-status-best" />
                bestehende Zusatzversicherung
              </Label>
            </RadioGroup>
          </div>

          <FormField
            type="text"
            id="big-hoehe-euro"
            label="Höhe in Euro"
            value={formData.bigHoeheEuro}
            onChange={(v) => updateFormData({ bigHoeheEuro: v })}
            placeholder="z.B. 25,00"
          />

          <div>
            <Label className="font-medium mb-2 block">Versicherungsart (Mehrfachauswahl)</Label>
            <div className="space-y-2">
              {[
                { key: 'privateZusatz' as const, label: 'private Zusatzversicherung im Sinne von §22 sowie §16' },
                { key: 'berufsunfaehigkeit' as const, label: 'Berufsunfähigkeitsversicherung' },
                { key: 'unfall' as const, label: 'Unfallversicherung' },
                { key: 'grundfaehigkeit' as const, label: 'Grundfähigkeitsversicherung' },
              ].map((opt) => (
                <Label key={opt.key} htmlFor={`big-art-${opt.key}`} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    id={`big-art-${opt.key}`}
                    checked={formData.bigVersicherungsarten[opt.key]}
                    onCheckedChange={(c) => updateArten(opt.key, !!c)}
                  />
                  <span>{opt.label}</span>
                </Label>
              ))}
            </div>
          </div>
        </div>
      </FormSection>

      <FormSection title="Gilt auch für folgende mitversicherte Angehörige (max. 3)" variant="info">
        <div className="space-y-3">
          {formData.bigMitversicherte.map((m, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-3 items-end">
              <FormField
                type="text"
                id={`big-mv-name-${idx}`}
                label={`Name Vorname ${idx + 1}`}
                value={m.nameVorname}
                onChange={(v) => updateMitversichert(idx, { nameVorname: v })}
              />
              <FormField
                type="text"
                id={`big-mv-hoehe-${idx}`}
                label="Höhe der Police (€)"
                value={m.hoehePolice}
                onChange={(v) => updateMitversichert(idx, { hoehePolice: v })}
              />
              <Button type="button" variant="outline" size="icon" onClick={() => removeMitversichert(idx)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {formData.bigMitversicherte.length < 3 && (
            <Button type="button" variant="outline" onClick={addMitversichert} className="gap-2">
              <Plus className="h-4 w-4" /> Angehörige hinzufügen
            </Button>
          )}
        </div>
      </FormSection>

      <FormSection title="Zahlungsempfänger*in (SEPA-Lastschriftmandat)" variant="info">
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
