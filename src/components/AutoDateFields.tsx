import React from 'react';
import { CalendarClock, Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FormData } from '@/types/form';
import { resolveFormDates } from '@/utils/dateUtils';

interface AutoDateFieldsProps {
  formData: FormData;
  updateFormData: (updates: Partial<FormData>) => void;
}

type OverrideKey =
  | 'versicherungsbeginnManuell'
  | 'bisherigeVersicherungEndeManuell'
  | 'antragsdatumManuell';

const rows: { key: OverrideKey; label: string; hint: string }[] = [
  { key: 'versicherungsbeginnManuell', label: 'Versicherungsbeginn', hint: 'Standard: 1. des Monats in 3 Monaten' },
  { key: 'bisherigeVersicherungEndeManuell', label: 'Bisherige Versicherung endet am', hint: 'Standard: Tag vor dem Beginn' },
  { key: 'antragsdatumManuell', label: 'Antrags-/Unterschriftsdatum', hint: 'Standard: heute' },
];

export const AutoDateFields: React.FC<AutoDateFieldsProps> = ({ formData, updateFormData }) => {
  const dates = resolveFormDates(formData);
  const defaults: Record<OverrideKey, string> = {
    versicherungsbeginnManuell: dates.beginForInput,
    bisherigeVersicherungEndeManuell: dates.endForInput,
    antragsdatumManuell: dates.todayForInput,
  };

  return (
    <div className="bg-card rounded-2xl shadow-card border border-border/60 p-6 mb-4 animate-fade-in-up">
      <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
        <CalendarClock className="h-5 w-5 text-primary" />
        Termine (automatisch)
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Diese Daten werden automatisch berechnet und in allen Anträgen, PDFs und Autofill-Übertragungen verwendet.
        Zum Anpassen einfach entsperren.
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        {rows.map(({ key, label, hint }) => {
          const manual = !!formData[key];
          return (
            <div key={key} className="space-y-2">
              <Label htmlFor={`autodate-${key}`} className="flex items-center gap-2">
                {label}
                {manual ? (
                  <span className="text-xs text-primary">manuell</span>
                ) : (
                  <span className="text-xs text-muted-foreground">automatisch</span>
                )}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id={`autodate-${key}`}
                  type="date"
                  value={manual ? (formData[key] as string) : defaults[key]}
                  disabled={!manual}
                  onChange={(e) => updateFormData({ [key]: e.target.value } as Partial<FormData>)}
                  className="min-h-11"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="min-h-11 min-w-11 shrink-0"
                  aria-label={manual ? `${label} zurücksetzen` : `${label} bearbeiten`}
                  title={manual ? 'Auf automatisch zurücksetzen' : 'Manuell bearbeiten'}
                  onClick={() =>
                    updateFormData({ [key]: manual ? '' : defaults[key] } as Partial<FormData>)
                  }
                >
                  {manual ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{hint}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
