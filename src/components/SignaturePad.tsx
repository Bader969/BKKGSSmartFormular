import React, { useRef, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { Eraser } from 'lucide-react';

interface SignaturePadProps {
  onSignatureChange: (signature: string) => void;
  signature: string;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ onSignatureChange, signature }) => {
  const sigCanvas = useRef<SignatureCanvas>(null);
  
  useEffect(() => {
    if (signature && sigCanvas.current) {
      sigCanvas.current.fromDataURL(signature);
    }
  }, []);
  
  const handleEnd = () => {
    if (sigCanvas.current) {
      const dataUrl = sigCanvas.current.toDataURL('image/png');
      onSignatureChange(dataUrl);
    }
  };
  
  const handleClear = () => {
    if (sigCanvas.current) {
      sigCanvas.current.clear();
      onSignatureChange('');
    }
  };
  
  return (
    <div className="space-y-3">
      <div className="relative">
        <SignatureCanvas
          ref={sigCanvas}
          penColor="#1a365d"
          canvasProps={{
            className: 'signature-canvas w-full h-40 bg-card rounded-lg',
          }}
          onEnd={handleEnd}
        />
        <div className="absolute bottom-2 left-2 right-2 border-b border-foreground/20 pointer-events-none" />
      </div>
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Unterschreiben Sie mit der Maus oder Touchscreen
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClear}
          className="gap-2"
        >
          <Eraser className="h-4 w-4" />
          Löschen
        </Button>
      </div>
    </div>
  );
};
