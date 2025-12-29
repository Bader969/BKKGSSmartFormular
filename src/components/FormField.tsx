import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

interface BaseFieldProps {
  label: string;
  id: string;
  disabled?: boolean;
  className?: string;
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
  options: { value: string; label: string }[];
  placeholder?: string;
}

interface CheckboxFieldProps extends BaseFieldProps {
  type: 'checkbox';
  checked: boolean;
  onChange: (checked: boolean) => void;
}

type FormFieldProps = InputFieldProps | SelectFieldProps | CheckboxFieldProps;

export const FormField: React.FC<FormFieldProps> = (props) => {
  const { label, id, disabled, className = '' } = props;
  
  if (props.type === 'checkbox') {
    return (
      <div className={`flex items-center space-x-3 ${className}`}>
        <Checkbox
          id={id}
          checked={props.checked}
          onCheckedChange={props.onChange}
          disabled={disabled}
        />
        <Label htmlFor={id} className="text-sm font-medium cursor-pointer">
          {label}
        </Label>
      </div>
    );
  }
  
  if (props.type === 'select') {
    return (
      <div className={`space-y-2 ${className}`}>
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <Select value={props.value} onValueChange={props.onChange} disabled={disabled}>
          <SelectTrigger id={id} className="bg-card">
            <SelectValue placeholder={props.placeholder || 'Auswählen...'} />
          </SelectTrigger>
          <SelectContent className="bg-card">
            {props.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  
  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <Input
        id={id}
        type={props.type}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        disabled={disabled}
        className="bg-card"
      />
    </div>
  );
};
