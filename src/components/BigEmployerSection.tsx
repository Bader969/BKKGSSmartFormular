import React from 'react';
import { FormSection } from './FormSection';
import { FormField } from './FormField';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import type { ArbeitgeberDaten } from '@/types/form';
import { validateName, validateOrt, validatePlz, validateStrasse, validateHausnummer } from '@/utils/validation';

export type BigBeschaeftigungsstatus = '' | 'beschaeftigt' | 'ausbildung' | 'al_geld_2' | 'al_geld_1';

interface Props {
  title: string;
  idPrefix: string;
  status: BigBeschaeftigungsstatus;
  value: ArbeitgeberDaten;
  onChange: (updates: Partial<ArbeitgeberDaten>) => void;
  /** Wenn gesetzt: Button „Angaben vom Hauptmitglied übernehmen". */
  onCopyFromMain?: () => void;
  required?: boolean;
}

const isBehoerde = (s: BigBeschaeftigungsstatus) => s === 'al_geld_1' || s === 'al_geld_2';

/**
 * BIG direkt: Name und Anschrift des Arbeitgebers bzw. — bei Leistungsbezug —
 * des Jobcenters / der Agentur für Arbeit. Pro Person (Hauptmitglied und jede
 * eigene Mitgliedschaft) einmal gerendert. „Beschäftigt seit" bleibt bewusst weg.
 */
export const BigEmployerSection: React.FC<Props> = ({
  title, idPrefix, status, value, onChange, onCopyFromMain, required = true,
}) => {
  const behoerde = isBehoerde(status);
  const nameLabel = behoerde
    ? (status === 'al_geld_1' ? 'Name der Agentur für Arbeit' : 'Name des Jobcenters')
    : 'Name des Arbeitgebers';
  const hint = behoerde
    ? 'Bitte Name und Anschrift der Behörde (Jobcenter bzw. Agentur für Arbeit) eintragen.'
    : 'Bitte Name und vollständige Anschrift des Arbeitgebers eintragen.';

  return (
    <FormSection title={title} variant="member">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-sm text-muted-foreground">{hint}</p>
        {onCopyFromMain && (
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={onCopyFromMain}>
            <Copy className="h-4 w-4" /> Angaben vom Hauptmitglied übernehmen
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          type="text"
          label={nameLabel}
          id={`${idPrefix}-ag-name`}
          value={value.name}
          onChange={(v) => onChange({ name: v })}
          placeholder={behoerde ? 'z.B. Jobcenter Kiel' : 'z.B. Musterfirma GmbH'}
          required={required}
          validate={required ? validateName : undefined}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
        <div className="md:col-span-2">
          <FormField
            type="text"
            label="Straße"
            id={`${idPrefix}-ag-strasse`}
            value={value.strasse}
            onChange={(v) => onChange({ strasse: v })}
            required={required}
            validate={required ? validateStrasse : undefined}
          />
        </div>
        <FormField
          type="text"
          label="Hausnummer"
          id={`${idPrefix}-ag-hausnummer`}
          value={value.hausnummer}
          onChange={(v) => onChange({ hausnummer: v })}
          required={required}
          validate={required ? validateHausnummer : undefined}
        />
        <FormField
          type="text"
          label="PLZ"
          id={`${idPrefix}-ag-plz`}
          value={value.plz}
          onChange={(v) => onChange({ plz: v })}
          required={required}
          validate={required ? validatePlz : undefined}
        />
        <div className="md:col-span-2">
          <FormField
            type="text"
            label="Ort"
            id={`${idPrefix}-ag-ort`}
            value={value.ort}
            onChange={(v) => onChange({ ort: v })}
            required={required}
            validate={required ? validateOrt : undefined}
          />
        </div>
      </div>
    </FormSection>
  );
};
