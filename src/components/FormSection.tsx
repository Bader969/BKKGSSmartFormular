import React from 'react';
import { cn } from '@/lib/utils';

interface FormSectionProps {
  title: string;
  variant: 'member' | 'spouse' | 'child' | 'signature' | 'info';
  children: React.ReactNode;
}

const variantStyles = {
  member: {
    cardBg: '#c7ddf5',
    borderColor: '#1d4ed8',
    titleColor: '#1d4ed8'
  },
  spouse: {
    cardBg: '#b8e8e0',
    borderColor: '#0d9488',
    titleColor: '#0d9488'
  },
  child: {
    cardBg: '#fde68a',
    borderColor: '#ca8a04',
    titleColor: '#a16207'
  },
  signature: {
    cardBg: '#ddd6f3',
    borderColor: '#7c3aed',
    titleColor: '#7c3aed'
  },
  info: {
    cardBg: '#bae6fd',
    borderColor: '#0284c7',
    titleColor: '#0284c7'
  }
};

export const FormSection: React.FC<FormSectionProps> = ({ title, variant, children }) => {
  const styles = variantStyles[variant];
  
  return (
    <div 
      className="rounded-xl border-l-4 p-6 mb-6 shadow-md transition-all duration-200"
      style={{ 
        backgroundColor: styles.cardBg,
        borderLeftColor: styles.borderColor
      }}
    >
      <h2 
        className="text-lg font-semibold mb-4 pb-2 border-b"
        style={{ 
          color: styles.titleColor,
          borderBottomColor: `${styles.borderColor}40`
        }}
      >
        {title}
      </h2>
      <div className="grid gap-4">
        {children}
      </div>
    </div>
  );
};
