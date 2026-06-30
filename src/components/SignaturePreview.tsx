import React from 'react';
import { Info } from 'lucide-react';
import { pickSignatureFont } from '@/utils/generateSignature';

interface SignaturePreviewProps {
  lastName: string | null | undefined;
  emptyHint?: string;
  seed?: string;
}

export const SignaturePreview: React.FC<SignaturePreviewProps> = ({ lastName, emptyHint, seed }) => {
  const name = (lastName ?? '').trim();
  const font = pickSignatureFont(seed ?? name);
  return (
    <div className="space-y-2">
      <div className="relative bg-card rounded-lg h-40 flex items-end px-6 pb-3">
        {name ? (
          <span
            className="text-5xl leading-none"
            style={{ color: '#1a365d', fontFamily: `"${font}", "Caveat", cursive` }}
          >
            {name}
          </span>
        ) : (
          <span className="text-muted-foreground italic text-sm pb-2">
            {emptyHint || 'Wird automatisch aus dem Nachnamen erzeugt'}
          </span>
        )}
        <div className="absolute bottom-2 left-3 right-3 border-b border-foreground/20 pointer-events-none" />
      </div>
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Info className="h-3.5 w-3.5" />
        Diese Unterschrift wird automatisch beim Export ins PDF eingefügt.
      </p>
    </div>
  );
};
