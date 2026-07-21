import React from 'react';
import { FormSection } from './FormSection';
import { FormField } from './FormField';
import type { ArbeitgeberDaten } from '@/types/form';
import { validateName, validateOrt, validatePlz, validateStrasse, validateHausnummer } from '@/utils/validation';

export interface NovitasEmployerBankValue {
  arbeitgeber: ArbeitgeberDaten;
  arbeitsentgelt: string;
  bank: { kontoinhaber: string; iban: string };
}

interface Props {
  title: string;
  idPrefix: string;
  value: NovitasEmployerBankValue;
  onChange: (updates: Partial<NovitasEmployerBankValue>) => void;
  required?: boolean;
  /** Wenn true (z.B. Jobcenter/Agentur), wird der AG-Block als "vorbelegt, bearbeitbar" gekennzeichnet. */
  autofilledHint?: string;
}

/**
 * Wiederverwendbarer Novitas-Block: Arbeitgeber (ohne "Beschäftigt seit") + Arbeitsentgelt + Bank.
 * Wird pro Person (Hauptmitglied oder Sub-Person mit eigener Mitgliedschaft) einmal gerendert.
 */
export const NovitasEmployerBank: React.FC<Props> = ({ title, idPrefix, value, onChange, required = true, autofilledHint }) => {
  const ag = value.arbeitgeber;
  const setAg = (u: Partial<ArbeitgeberDaten>) => onChange({ arbeitgeber: { ...ag, ...u } });
  const setBank = (u: Partial<NovitasEmployerBankValue['bank']>) => onChange({ bank: { ...value.bank, ...u } });

  return (
    <FormSection title={title} variant="member">
      {autofilledHint && (
        <p className="text-sm text-muted-foreground mb-3">{autofilledHint}</p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          type="text"
          label="Name des Arbeitgebers"
          id={`${idPrefix}-ag-name`}
          value={ag.name}
          onChange={(v) => setAg({ name: v })}
          placeholder="z.B. Musterfirma GmbH oder Jobcenter Kiel"
          required={required}
          validate={required ? validateName : undefined}
        />
        <FormField
          type="text"
          label="Monatliches Arbeitsentgelt (EUR)"
          id={`${idPrefix}-arbeitsentgelt`}
          value={value.arbeitsentgelt}
          onChange={(v) => onChange({ arbeitsentgelt: v.replace(/[^\d,.]/g, '') })}
          placeholder="z.B. 2500"
          required={required}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
        <FormField
          type="text"
          label="Straße"
          id={`${idPrefix}-ag-strasse`}
          value={ag.strasse}
          onChange={(v) => setAg({ strasse: v })}
          placeholder="Straße"
          required={required}
          validate={required ? validateStrasse : undefined}
        />
        <FormField
          type="text"
          label="Hausnummer"
          id={`${idPrefix}-ag-hausnummer`}
          value={ag.hausnummer}
          onChange={(v) => setAg({ hausnummer: v })}
          placeholder="z.B. 12"
          required={required}
          validate={required ? validateHausnummer : undefined}
        />
        <FormField
          type="text"
          label="PLZ"
          id={`${idPrefix}-ag-plz`}
          value={ag.plz}
          onChange={(v) => setAg({ plz: v })}
          placeholder="z.B. 24103"
          required={required}
          validate={required ? validatePlz : undefined}
        />
        <FormField
          type="text"
          label="Ort"
          id={`${idPrefix}-ag-ort`}
          value={ag.ort}
          onChange={(v) => setAg({ ort: v })}
          placeholder="z.B. Kiel"
          required={required}
          validate={required ? validateOrt : undefined}
        />
      </div>
      <div className="mt-6 pt-4 border-t border-secondary/20">
        <h3 className="text-sm font-semibold mb-3 text-foreground">Bankverbindung</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            type="text"
            label="Kontoinhaber"
            id={`${idPrefix}-bank-inhaber`}
            value={value.bank.kontoinhaber}
            onChange={(v) => setBank({ kontoinhaber: v })}
            placeholder="Vorname Nachname"
            required={required}
          />
          <FormField
            type="text"
            label="IBAN"
            id={`${idPrefix}-bank-iban`}
            value={value.bank.iban}
            onChange={(v) => setBank({ iban: v.toUpperCase().replace(/\s+/g, '') })}
            placeholder="DE.."
            required={required}
          />
        </div>
      </div>
    </FormSection>
  );
};