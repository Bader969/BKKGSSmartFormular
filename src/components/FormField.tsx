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

  const handleBlur = useCallback(() => {
    setTouched(true);
    if (props.type !== 'checkbox' && validate) {
      const result = validate(props.value);
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

  if (props.type === 'checkbox') {
    return (
      <div className={cn('flex items-center space-x-2', className)}>
        <Checkbox
          id={id}
          checked={props.checked}
          onCheckedChange={props.onChange}
          disabled={disabled}
        />
        <Label htmlFor={id} className="text-sm font-medium cursor-pointer">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      </div>
    );
  }

  if (props.type === 'select') {
    return (
      <div className={cn('space-y-2', className)}>
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Select 
          value={props.value} 
          onValueChange={(value) => {
            props.onChange(value);
            if (validate) {
              const result = validate(value);
              setError(result.isValid ? null : result.message || 'Ungültige Eingabe');
            }
          }} 
          disabled={disabled}
        >
          <SelectTrigger 
            id={id} 
            className={cn('bg-card', touched && error && 'border-destructive focus:ring-destructive')}
            onBlur={handleBlur}
          >
            <SelectValue placeholder={props.placeholder || 'Auswählen...'} />
          </SelectTrigger>
          <SelectContent className="bg-card">
            {props.options.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {touched && error && (
          <p className="text-xs text-destructive mt-1">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Input 
        id={id} 
        type={props.type} 
        value={props.value} 
        onChange={e => handleChange(e.target.value)} 
        onBlur={handleBlur}
        placeholder={props.placeholder} 
        disabled={disabled} 
        className={cn('bg-card', touched && error && 'border-destructive focus:ring-destructive')} 
      />
      {touched && error && (
        <p className="text-xs text-destructive mt-1">{error}</p>
      )}
    </div>
  );
};