import React, { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ValidationResult } from '@/utils/validation';
import { cn } from '@/lib/utils';
import { CalendarIcon } from 'lucide-react';
import { format, parse, isValid } from 'date-fns';
import { de } from 'date-fns/locale';

interface BaseFieldProps {
  label: string;
  id: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
  validate?: (value: string) => ValidationResult;
}

interface InputFieldProps extends BaseFieldProps {
  type: 'text' | 'email' | 'tel';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

interface DateFieldProps extends BaseFieldProps {
  type: 'date';
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

type FormFieldProps = InputFieldProps | DateFieldProps | SelectFieldProps | CheckboxFieldProps;

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
    if (props.type !== 'checkbox' && props.type !== 'date' && validate) {
      const result = validate(props.value);
      setError(result.isValid ? null : result.message || 'Ungültige Eingabe');
    }
  }, [props, validate]);

  const handleChange = useCallback((value: string) => {
    if (props.type !== 'checkbox' && props.type !== 'date') {
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

  // Date picker with calendar popup
  if (props.type === 'date') {
    // Parse the date string (format: DD.MM.YYYY or YYYY-MM-DD)
    const parseDate = (dateStr: string): Date | undefined => {
      if (!dateStr) return undefined;
      
      // Try DD.MM.YYYY format first
      let parsed = parse(dateStr, 'dd.MM.yyyy', new Date());
      if (isValid(parsed)) return parsed;
      
      // Try YYYY-MM-DD format
      parsed = parse(dateStr, 'yyyy-MM-dd', new Date());
      if (isValid(parsed)) return parsed;
      
      return undefined;
    };

    const selectedDate = parseDate(props.value);

    const handleDateSelect = (date: Date | undefined) => {
      if (date) {
        const formattedDate = format(date, 'dd.MM.yyyy');
        props.onChange(formattedDate);
        setTouched(true);
        if (validate) {
          const result = validate(formattedDate);
          setError(result.isValid ? null : result.message || 'Ungültige Eingabe');
        }
      }
    };

    return (
      <div className={cn('space-y-2', className)}>
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id={id}
              variant="outline"
              disabled={disabled}
              className={cn(
                'w-full justify-start text-left font-normal bg-card',
                !props.value && 'text-muted-foreground',
                touched && error && 'border-destructive focus:ring-destructive'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {props.value || <span>Datum auswählen</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              initialFocus
              locale={de}
              className={cn("p-3 pointer-events-auto")}
              captionLayout="dropdown-buttons"
              fromYear={1920}
              toYear={new Date().getFullYear()}
            />
          </PopoverContent>
        </Popover>
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