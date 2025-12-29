import React from 'react';

interface SignaturePreviewProps {
  name: string;
  label: string;
}

export const SignaturePreview: React.FC<SignaturePreviewProps> = ({ name, label }) => {
  return (
    <div className="mt-4 p-4 bg-card rounded-lg border border-border">
      <div className="min-h-[80px] flex flex-col justify-end">
        {name ? (
          <span 
            className="font-signature text-4xl md:text-5xl text-primary italic tracking-wide"
            style={{ color: '#1a4d80' }}
          >
            {name}
          </span>
        ) : (
          <span className="text-muted-foreground text-sm italic">
            Vorschau erscheint hier...
          </span>
        )}
      </div>
      <div className="border-t border-foreground/30 mt-2 pt-1">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
      </div>
    </div>
  );
};
