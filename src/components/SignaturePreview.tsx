import React, { useEffect, useState } from 'react';
import { Info, PenLine, Type } from 'lucide-react';
import { pickSignatureFont, pickLoadedSignatureFont, ensureSignatureFontReady } from '@/utils/generateSignature';
import { SignatureDrawPad } from './SignatureDrawPad';
import { Button } from '@/components/ui/button';

interface SignaturePreviewProps {
  lastName: string | null | undefined;
  emptyHint?: string;
  seed?: string;
  /** Manuell gezeichnete Unterschrift (PNG-DataURL) – wenn gesetzt, hat sie Vorrang */
  manualSignature?: string;
  onManualSignatureChange?: (dataUrl: string) => void;
}

export const SignaturePreview: React.FC<SignaturePreviewProps> = ({
  lastName,
  emptyHint,
  seed,
  manualSignature,
  onManualSignatureChange,
}) => {
  const name = (lastName ?? '').trim();
  const [fontsReady, setFontsReady] = useState(false);
  const [mode, setMode] = useState<'font' | 'draw'>(manualSignature ? 'draw' : 'font');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try { await ensureSignatureFontReady(); } catch { /* noop */ }
      try { if ('fonts' in document) await (document as any).fonts.ready; } catch { /* noop */ }
      if (!cancelled) setFontsReady(true);
    })();
    return () => { cancelled = true; };
  }, []);
  const font = fontsReady
    ? pickLoadedSignatureFont(seed ?? name, name || 'Abc')
    : pickSignatureFont(seed ?? name);

  const canDraw = !!onManualSignatureChange;
  const drawMode = canDraw && mode === 'draw';

  return (
    <div className="space-y-2">
      {canDraw && (
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === 'font' ? 'secondary' : 'outline'}
            className="min-h-[36px]"
            onClick={() => {
              setMode('font');
              onManualSignatureChange?.('');
            }}
          >
            <Type className="h-3.5 w-3.5 mr-1.5" />
            Schrift
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'draw' ? 'secondary' : 'outline'}
            className="min-h-[36px]"
            onClick={() => setMode('draw')}
          >
            <PenLine className="h-3.5 w-3.5 mr-1.5" />
            Manuell zeichnen
          </Button>
        </div>
      )}

      {drawMode ? (
        <SignatureDrawPad value={manualSignature} onChange={(v) => onManualSignatureChange?.(v)} />
      ) : (
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
      )}

      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Info className="h-3.5 w-3.5" />
        {drawMode
          ? 'Die handschriftliche Unterschrift wird beim Export ins PDF eingefügt.'
          : 'Diese Unterschrift wird automatisch beim Export ins PDF eingefügt.'}
      </p>
    </div>
  );
};

