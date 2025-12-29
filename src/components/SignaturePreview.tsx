import React from 'react';

interface SignaturePreviewProps {
  name: string;
  label: string;
}

export const SignaturePreview: React.FC<SignaturePreviewProps> = ({ name, label }) => {
  return (
    <div className="mt-4 p-4 bg-card rounded-lg border border-border">
      <div className="min-h-[60px] flex flex-col justify-end items-center relative">
        {name ? (
          <span 
            className="font-signature text-4xl md:text-5xl italic tracking-wide transform -rotate-2 mb-1"
            style={{ color: '#1a4d80' }}
          >
            {name}
          </span>
        ) : (
          <span className="text-muted-foreground text-sm italic mb-2">
            Vorschau erscheint hier...
          </span>
        )}
      </div>
      <div className="border-t border-foreground/50 pt-1">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
      </div>
    </div>
  );
};
