import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser, Check } from 'lucide-react';

interface SignatureDrawPadProps {
  value?: string;
  onChange: (dataUrl: string) => void;
}

const WIDTH = 600;
const HEIGHT = 160;

export const SignatureDrawPad: React.FC<SignatureDrawPadProps> = ({ value, onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const [hasStroke, setHasStroke] = useState(!!value);

  const getCtx = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1a365d';
    return ctx;
  };

  // Vorhandene Unterschrift beim Mount wieder anzeigen
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawing.current = true;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    dirty.current = true;
    if (!hasStroke) setHasStroke(true);
  };

  const end = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    if (dirty.current) save();
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(canvas.toDataURL('image/png'));
    dirty.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    dirty.current = false;
    setHasStroke(false);
    onChange('');
  };

  return (
    <div className="space-y-2">
      <div className="relative bg-card rounded-lg border border-dashed border-border">
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className="w-full h-40 touch-none cursor-crosshair rounded-lg"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
        />
        {!hasStroke && (
          <span className="absolute inset-0 flex items-center justify-center text-sm italic text-muted-foreground pointer-events-none">
            Hier mit Maus, Stift oder Finger unterschreiben
          </span>
        )}
        <div className="absolute bottom-2 left-3 right-3 border-b border-foreground/20 pointer-events-none" />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={clear} className="min-h-[36px]">
          <Eraser className="h-3.5 w-3.5 mr-1.5" />
          Löschen
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={save} className="min-h-[36px]">
          <Check className="h-3.5 w-3.5 mr-1.5" />
          Übernehmen
        </Button>
      </div>
    </div>
  );
};
