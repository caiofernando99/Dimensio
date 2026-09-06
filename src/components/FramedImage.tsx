import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { PdfFitMode } from './PdfPageViewer';

interface FramedImageProps {
  src: string;
  alt?: string;
  className?: string;
  fitMode?: PdfFitMode;
  zoom?: number;
  panX?: number;
  panY?: number;
}

/**
 * Renders an <img> with the same CSS-transform fit/zoom/pan framing used by
 * PdfPageViewer, so uploaded slide images honor the framing panel too.
 */
export const FramedImage: React.FC<FramedImageProps> = ({
  src,
  alt,
  className,
  fitMode = 'contain',
  zoom = 1,
  panX = 0.5,
  panY = 0.5,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  const applyLayout = useCallback(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img || !natural) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (!cw || !ch) return;

    const { w, h } = natural;
    const fitScale =
      fitMode === 'width'
        ? cw / w
        : fitMode === 'cover'
          ? Math.max(cw / w, ch / h)
          : Math.min(cw / w, ch / h);
    const s = fitScale * zoom;
    const dispW = w * s;
    const dispH = h * s;

    const maxX = Math.max(0, dispW - cw);
    const maxY = Math.max(0, dispH - ch);
    const tx = Math.max(0, (cw - dispW) / 2) - panX * maxX;
    const ty = Math.max(0, (ch - dispH) / 2) - panY * maxY;

    img.style.width = `${dispW}px`;
    img.style.height = `${dispH}px`;
    img.style.transform = `translate(${tx}px, ${ty}px)`;
  }, [natural, fitMode, zoom, panX, panY]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => applyLayout());
    ro.observe(el);
    return () => ro.disconnect();
  }, [applyLayout]);

  useEffect(() => {
    applyLayout();
  }, [applyLayout, src]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full relative overflow-hidden ${className || ''}`}
    >
      <img
        key={src}
        ref={imgRef}
        src={src}
        alt={alt}
        draggable={false}
        className="absolute top-0 left-0 block max-w-none max-h-none rounded-[2px] shadow-lg"
        style={{ willChange: 'transform' }}
        onLoad={(e) => {
          const el = e.currentTarget;
          setNatural({ w: el.naturalWidth || 1, h: el.naturalHeight || 1 });
        }}
      />
    </div>
  );
};
