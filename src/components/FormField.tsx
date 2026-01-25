import React, { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ValidationResult } from '@/utils/validation';
import { cn } from '@/lib/utils';
interface BaseFieldProps {
  label: string;
  id: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
  validate?: (value: string) => ValidationResult;
}
interface InputFieldProps extends BaseFieldProps {
  type: 'text' | 'date' | 'email' | 'tel';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}
interface SelectFieldProps extends BaseFieldProps {
  type: 'select';
  value: string;
  onChange: (value: string) => void;
  options: {
    value: string;
    label: string;
  }[];
  placeholder?: string;
}
interface CheckboxFieldProps extends BaseFieldProps {
  type: 'checkbox';
  checked: boolean;
  onChange: (checked: boolean) => void;
}
type FormFieldProps = InputFieldProps | SelectFieldProps | CheckboxFieldProps;

// Konvertiert deutsches Datum (TT.MM.JJJJ) zu ISO (JJJJ-MM-TT)
const germanToISO = (germanDate: string): string => {
  const parts = germanDate.split('.');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    if (day && month && year && year.length === 4) {
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }
  return germanDate;
};

// Konvertiert ISO (JJJJ-MM-TT) zu deutschem Datum (TT.MM.JJJJ)
const isoToGerman = (isoDate: string): string => {
  if (isoDate.includes('-')) {
    const parts = isoDate.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day}.${month}.${year}`;
    }
  }
  return isoDate;
};

// Prüft ob ein String ein deutsches Datumsformat hat
const isGermanFormat = (value: string): boolean => {
  return /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(value);
};
export const FormField: React.FC<FormFieldProps> = props => {
  const {
    label,
    id,
    disabled,
    className = '',
    required = false,
    validate
  } = props;
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  // Für Datumsfelder: lokaler Anzeige-Wert im deutschen Format
  const [localDateValue, setLocalDateValue] = useState<string>(() => {
    if (props.type === 'date' && props.value) {
      return isoToGerman(props.value);
    }
    return '';
  });
  const handleBlur = useCallback(() => {
    setTouched(true);
    if (props.type !== 'checkbox' && validate) {
      const valueToValidate = props.type === 'date' ? props.value : props.value;
      const result = validate(valueToValidate);
      setError(result.isValid ? null : result.message || 'Ungültige Eingabe');
    }
  }, [props, validate]);
  const handleChange = useCallback((value: string) => {
    if (props.type !== 'checkbox') {
      props.onChange(value);
      // Validiere bei Änderung nur wenn bereits touched
      if (touched && validate) {
        const result = validate(value);
        setError(result.isValid ? null : result.message || 'Ungültige Eingabe');
      }
    }
  }, [props, touched, validate]);
  const handleDateChange = useCallback((inputValue: string) => {
    setLocalDateValue(inputValue);

    // Wenn deutsches Format erkannt wird, konvertiere zu ISO
    if (isGermanFormat(inputValue)) {
      const isoValue = germanToISO(inputValue);
      props.type !== 'checkbox' && props.onChange(isoValue);
      if (touched && validate) {
        const result = validate(isoValue);
        setError(result.isValid ? null : result.message || 'Ungültige Eingabe');
      }
    } else if (inputValue.includes('-')) {
      // Bereits ISO-Format (z.B. aus nativer Datumsauswahl)
      props.type !== 'checkbox' && props.onChange(inputValue);
      setLocalDateValue(isoToGerman(inputValue));
      if (touched && validate) {
        const result = validate(inputValue);
        setError(result.isValid ? null : result.message || 'Ungültige Eingabe');
      }
    } else {
      // Unvollständige Eingabe - speichere trotzdem
      props.type !== 'checkbox' && props.onChange(inputValue);
    }
  }, [props, touched, validate]);

  // Sync localDateValue wenn sich props.value ändert (z.B. durch Reset)
  React.useEffect(() => {
    if (props.type === 'date' && props.value) {
      const germanValue = isoToGerman(props.value);
      if (germanValue !== localDateValue && props.value !== localDateValue) {
        setLocalDateValue(germanValue);
      }
    } else if (props.type === 'date' && !props.value) {
      setLocalDateValue('');
    }
  }, [props.type === 'date' ? props.value : null]);
  if (props.type === 'checkbox') {
    return <div className={cn('flex items-center space-x-2', className)}>
        <Checkbox id={id} checked={props.checked} onCheckedChange={props.onChange} disabled={disabled} />
        <Label htmlFor={id} className="text-sm font-medium cursor-pointer">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      </div>;
  }
  if (props.type === 'select') {
    return <div className={cn('space-y-2', className)}>
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Select value={props.value} onValueChange={value => {
        props.onChange(value);
        if (validate) {
          const result = validate(value);
          setError(result.isValid ? null : result.message || 'Ungültige Eingabe');
        }
      }} disabled={disabled}>
          <SelectTrigger id={id} className={cn('bg-card', touched && error && 'border-destructive focus:ring-destructive')} onBlur={handleBlur}>
            <SelectValue placeholder={props.placeholder || 'Auswählen...'} />
          </SelectTrigger>
          <SelectContent className="bg-card">
            {props.options.map(option => <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>)}
          </SelectContent>
        </Select>
        {touched && error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </div>;
  }

  // Spezielle Behandlung für Datumsfelder
  if (props.type === 'date') {
    return;
  }
  return <div className={cn('space-y-2', className)}>
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Input id={id} type={props.type} value={props.value} onChange={e => handleChange(e.target.value)} onBlur={handleBlur} placeholder={props.placeholder} disabled={disabled} className={cn('bg-card', touched && error && 'border-destructive focus:ring-destructive')} />
      {touched && error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>;
};