import React from 'react';

interface FormSectionProps {
  title: string;
  variant: 'member' | 'spouse' | 'child' | 'signature' | 'info';
  children: React.ReactNode;
}

export const FormSection: React.FC<FormSectionProps> = ({ title, variant, children }) => {
  const sectionClass = `section-card section-${variant}`;
  const titleClass = `section-title section-title-${variant}`;
  
  return (
    <div className={sectionClass}>
      <h2 className={titleClass}>{title}</h2>
      <div className="form-grid">
        {children}
      </div>
    </div>
  );
};
