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
  const updateBank = (u: Partial<EigenePlusbonusDaten['bank']>) =>
    onChange({ ...v, bank: { ...v.bank, ...u } });
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            type="text"
            id={`${idPrefix}-ki-vn`}
            label="Kontoinhaber*in — Vorname"
            value={v.bank.kontoinhaberVorname}
            onChange={(val) => updateBank({
              kontoinhaberVorname: val,
              kontoinhaber: [val, v.bank.kontoinhaberNachname].filter(Boolean).join(' ').trim(),
            })}
            required
          />
          <FormField
            type="text"
            id={`${idPrefix}-ki-nn`}
            label="Kontoinhaber*in — Nachname"
            value={v.bank.kontoinhaberNachname}
            onChange={(val) => updateBank({
              kontoinhaberNachname: val,
              kontoinhaber: [v.bank.kontoinhaberVorname, val].filter(Boolean).join(' ').trim(),
            })}
            required
          />
          <FormField type="text" id={`${idPrefix}-kreditinstitut`} label="Kreditinstitut" value={v.bank.kreditinstitut} onChange={(val) => updateBank({ kreditinstitut: val })} />
          <FormField type="text" id={`${idPrefix}-iban`} label="IBAN" value={v.bank.iban} onChange={(val) => updateBank({ iban: val.toUpperCase() })} required />
          <FormField type="text" id={`${idPrefix}-bic`} label="BIC" value={v.bank.bic} onChange={(val) => updateBank({ bic: val.toUpperCase() })} />
          <FormField type="text" id={`${idPrefix}-ort`} label="Ort (Unterschrift)" value={v.bank.ort} onChange={(val) => updateBank({ ort: val })} required />
          <FormField type="date" id={`${idPrefix}-datum`} label="Datum" value={v.bank.datum} onChange={(val) => updateBank({ datum: val })} required />
        </div>
        <p className="text-sm text-muted-foreground">
          Die Unterschrift wird automatisch aus dem Nachnamen des Kontoinhabers erzeugt.
        </p>
      </div>
    </FormSection>
  );
};