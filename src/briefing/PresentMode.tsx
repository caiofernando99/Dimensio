import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X, Maximize, Minimize } from 'lucide-react';
import type { BriefSlide } from './types';
import { SlideFrame } from './SlideFrame';

interface PresentModeProps {
  slides: BriefSlide[];
  startIndex: number;
  onExit: () => void;
}

/** Apresentação em tela cheia: setas navegam, Esc sai. Controles mínimos. */
export const PresentMode: React.FC<PresentModeProps> = ({ slides, startIndex, onExit }) => {
  const [idx, setIdx] = useState(Math.min(startIndex, Math.max(0, slides.length - 1)));
  const [isFull, setIsFull] = useState(false);

  const go = useCallback(
    (dir: 1 | -1) => setIdx((i) => Math.min(slides.length - 1, Math.max(0, i + dir))),
    [slides.length]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        go(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        go(-1);
      } else if (e.key === 'Escape') {
        onExit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onExit]);

  useEffect(() => {
    const onFs = () => setIsFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const toggleFull = () => {
    try {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen();
    } catch {
      // sem fullscreen nativo
    }
  };

  const slide = slides[idx];
  if (!slide) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950 flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 text-white">
        <span className="text-xs font-black opacity-70">
          {slide.title} • {idx + 1} de {slides.length}
        </span>
        <div className="flex items-center gap-1.5">
          <button onClick={toggleFull} className="p-2 rounded-lg hover:bg-white/10 cursor-pointer" title="Tela cheia">
            {isFull ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
          <button onClick={onExit} className="p-2 rounded-lg hover:bg-white/10 cursor-pointer" title="Sair (Esc)">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center px-4 sm:px-14 pb-2">
        <button onClick={() => go(-1)} disabled={idx === 0} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 cursor-pointer mr-2 shrink-0">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="w-full max-w-[1100px]">
          <SlideFrame slide={slide} />
        </div>
        <button onClick={() => go(1)} disabled={idx === slides.length - 1} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 cursor-pointer ml-2 shrink-0">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
      <div className="flex items-center justify-center gap-1.5 pb-3">
        {slides.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setIdx(i)}
            className={`h-1.5 rounded-full transition-all cursor-pointer ${i === idx ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/70'}`}
            title={s.title}
          />
        ))}
      </div>
    </div>
  );
};
