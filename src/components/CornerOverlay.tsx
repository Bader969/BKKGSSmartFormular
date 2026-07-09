import React, { useCallback, useRef } from "react";
import type { Corners, Point } from "@/utils/documentScanner";

interface Props {
  corners: Corners;
  natWidth: number;
  natHeight: number;
  onChange: (next: Corners) => void;
  className?: string;
}

const HANDLE_R = 14; // in image-natural units; scaled by viewBox

/**
 * SVG overlay rendered on top of an <img> that fills the same box
 * (object-fit: fill). The viewBox uses natural image coordinates so
 * corner coordinates map 1:1 to detected pixels.
 */
export const CornerOverlay: React.FC<Props> = ({
  corners,
  natWidth,
  natHeight,
  onChange,
  className,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const draggingRef = useRef<number | null>(null);

  const toImageCoords = useCallback(
    (clientX: number, clientY: number): Point => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * natWidth;
      const y = ((clientY - rect.top) / rect.height) * natHeight;
      return {
        x: Math.max(0, Math.min(natWidth, x)),
        y: Math.max(0, Math.min(natHeight, y)),
      };
    },
    [natWidth, natHeight]
  );

  const handleDown = (idx: number) => (e: React.PointerEvent<SVGCircleElement>) => {
    e.preventDefault();
    draggingRef.current = idx;
    (e.target as SVGCircleElement).setPointerCapture(e.pointerId);
  };

  const handleMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const idx = draggingRef.current;
    if (idx === null) return;
    const p = toImageCoords(e.clientX, e.clientY);
    const next = corners.slice() as Corners;
    next[idx] = p;
    onChange(next);
  };

  const handleUp = (e: React.PointerEvent<SVGSVGElement | SVGCircleElement>) => {
    if (draggingRef.current !== null) {
      try {
        (e.target as Element).releasePointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    draggingRef.current = null;
  };

  const scale = Math.max(natWidth, natHeight) / 400;
  const r = Math.max(6, HANDLE_R * scale);
  const strokeW = Math.max(2, 3 * scale);

  const polyPoints = corners.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${natWidth} ${natHeight}`}
      preserveAspectRatio="none"
      className={className}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      style={{ touchAction: "none" }}
    >
      <polygon
        points={polyPoints}
        fill="hsl(var(--primary) / 0.15)"
        stroke="hsl(var(--primary))"
        strokeWidth={strokeW}
      />
      {corners.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={r}
          fill="hsl(var(--background))"
          stroke="hsl(var(--primary))"
          strokeWidth={strokeW}
          style={{ cursor: "grab" }}
          onPointerDown={handleDown(i)}
          onPointerUp={handleUp}
        />
      ))}
    </svg>
  );
};