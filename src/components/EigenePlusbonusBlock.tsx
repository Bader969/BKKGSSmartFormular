import React from 'react';
import { FormSection } from './FormSection';
import { FormField } from './FormField';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  EigenePlusbonusDaten,
  BigVersicherungsstatus,
  createEmptyEigenePlusbonus,
} from '@/types/form';

interface Props {
  personLabel: string;
  value: EigenePlusbonusDaten | undefined;
  onChange: (next: EigenePlusbonusDaten) => void;
  idPrefix: string;
}

export const EigenePlusbonusBlock: React.FC<Props> = ({ personLabel, value, onChange, idPrefix }) => {
  const v: EigenePlusbonusDaten = value ?? createEmptyEigenePlusbonus();
  const updateArt = (k: keyof EigenePlusbonusDaten['versicherungsarten'], on: boolean) =>
    onChange({ ...v, versicherungsarten: { ...v.versicherungsarten, [k]: on } });

  return (
    <FormSection title={`Eigener Plusbonus für ${personLabel}`} variant="info">
      <div className="space-y-4">
        <div>
          <Label className="font-medium mb-2 block">Status</Label>
          <RadioGroup
            value={v.versicherungsstatus}
            onValueChange={(val) => onChange({ ...v, versicherungsstatus: val as BigVersicherungsstatus })}
            className="flex flex-wrap gap-4"
          >
            <Label htmlFor={`${idPrefix}-status-neu`} className="flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer hover:border-primary">
              <RadioGroupItem value="neuabschluss" id={`${idPrefix}-status-neu`} />
              Neuabschluss
            </Label>
            <Label htmlFor={`${idPrefix}-status-best`} className="flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer hover:border-primary">
              <RadioGroupItem value="bestehend" id={`${idPrefix}-status-best`} />
              bestehende Zusatzversicherung
            </Label>
          </RadioGroup>
        </div>

        <FormField
          type="text"
          id={`${idPrefix}-hoehe`}
          label="Höhe in Euro"
          value={v.hoeheEuro}
          onChange={(val) => onChange({ ...v, hoeheEuro: val })}
          placeholder="z.B. 25,00"
        />

        <div>
          <Label className="font-medium mb-2 block">Versicherungsart (Mehrfachauswahl)</Label>
          <div className="space-y-2">
            {([
              { key: 'privateZusatz', label: 'private Zusatzversicherung im Sinne von §22 sowie §16' },
              { key: 'berufsunfaehigkeit', label: 'Berufsunfähigkeitsversicherung' },
              { key: 'unfall', label: 'Unfallversicherung' },
              { key: 'grundfaehigkeit', label: 'Grundfähigkeitsversicherung' },
            ] as const).map((opt) => (
              <Label key={opt.key} htmlFor={`${idPrefix}-art-${opt.key}`} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  id={`${idPrefix}-art-${opt.key}`}
                  checked={v.versicherungsarten[opt.key]}
                  onCheckedChange={(c) => updateArt(opt.key, !!c)}
                />
                <span>{opt.label}</span>
              </Label>
            ))}
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Bankdaten / SEPA-Lastschriftmandat sowie Unterschrift werden zentral
          aus dem Hauptantrag (Abschnitt <em>Zahlungsempfänger*in</em>) übernommen
          und gelten für alle Plusbonus-Anträge.
        </p>
      </div>
    </FormSection>
  );
};