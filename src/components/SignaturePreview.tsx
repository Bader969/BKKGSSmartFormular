import React from 'react';

interface SignaturePreviewProps {
  name: string;
  label: string;
}

export const SignaturePreview: React.FC<SignaturePreviewProps> = ({ name, label }) => {
  return (
    <div className="mt-4 p-4 bg-card rounded-lg border border-border">
      <div className="flex flex-col items-center">
        {/* Signature text */}
        <div className="min-h-[50px] flex items-end justify-center">
          {name ? (
            <span 
              className="font-signature text-4xl md:text-5xl italic tracking-wide -rotate-2 relative translate-y-2"
              style={{ color: '#1a4d80', lineHeight: 1, marginBottom: 0 }}
            >
              {name}
            </span>
          ) : (
            <span className="text-muted-foreground text-sm italic relative translate-y-1">
              Vorschau erscheint hier...
            </span>
          )}
        </div>
        {/* Signature line */}
        <div className="w-64 border-t border-foreground/50 mt-0" />
        <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
          {label}
        </span>
      </div>
    </div>
  );
};
