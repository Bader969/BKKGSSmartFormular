import React from 'react';
import { cn } from '@/lib/utils';

interface FormSectionProps {
  title: string;
  variant: 'member' | 'spouse' | 'child' | 'signature' | 'info';
  children: React.ReactNode;
}

// Elegante, harmonische Farbpalette mit sanften, professionellen Tönen
const variantStyles = {
  member: {
    cardBg: '#f0f4f8',
    borderColor: '#4a6fa5',
    titleColor: '#3d5a80'
  },
  spouse: {
    cardBg: '#f2f7f5',
    borderColor: '#6b9080',
    titleColor: '#4a7c67'
  },
  child: {
    cardBg: '#fef9f3',
    borderColor: '#d4a373',
    titleColor: '#b08650'
  },
  signature: {
    cardBg: '#f5f3f7',
    borderColor: '#8e7ba4',
    titleColor: '#6b5a82'
  },
  info: {
    cardBg: '#f3f6f9',
    borderColor: '#7895a8',
    titleColor: '#5a7a8f'
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
