import React from 'react';
import type { BriefLayer, BriefSlide } from './types';
import { SlideContent } from './SlideContent';

/** Render visual puro de uma camada (usado no readonly e no canvas). */
export const LayerView: React.FC<{ layer: BriefLayer }> = ({ layer }) => {
  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${layer.x}%`,
    top: `${layer.y}%`,
    width: `${layer.w}%`,
    height: `${layer.h}%`,
    zIndex: layer.z,
    opacity: layer.opacity ?? 1,
    transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
  };
  if (layer.type === 'text') {
    return (
      <div
        style={{
          ...style,
          fontSize: `${layer.fontSize ?? 3}cqw`,
          fontWeight: layer.fontWeight ?? 700,
          textAlign: layer.align ?? 'center',
          color: layer.color || '#fff',
          backgroundColor: layer.bg || 'transparent',
          borderRadius: 8,
          padding: layer.bg ? '0.4cqw 0.8cqw' : 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: layer.align === 'left' ? 'flex-start' : layer.align === 'right' ? 'flex-end' : 'center',
          whiteSpace: 'pre-wrap',
          overflow: 'hidden',
          lineHeight: 1.2,
        }}
      >
        <span style={{ width: '100%' }}>{layer.content}</span>
      </div>
    );
  }
  if (layer.type === 'image') {
    if (!layer.content) {
      return (
        <div
          style={{ ...style, border: '2px dashed rgba(255,255,255,0.4)', borderRadius: layer.radius ?? 12 }}
          className="flex items-center justify-center text-white/60 text-[1.2cqw] font-bold"
        >
          🖼️ imagem
        </div>
      );
    }
    return (
      <img
        src={layer.content}
        alt=""
        draggable={false}
        style={{ ...style, objectFit: 'cover', borderRadius: layer.radius ?? 12 }}
      />
    );
  }
  // shape
  if (layer.content === 'circle') {
    return <div style={{ ...style, backgroundColor: layer.color || '#4f46e5', borderRadius: '50%' }} />;
  }
  if (layer.content === 'line') {
    return (
      <div style={{ ...style, display: 'flex', alignItems: 'center' }}>
        <div style={{ width: '100%', height: `${layer.lineWidth ?? 4}px`, backgroundColor: layer.color || '#fff', borderRadius: 4 }} />
      </div>
    );
  }
  return (
    <div
      style={{ ...style, backgroundColor: layer.color || '#4f46e5', borderRadius: layer.radius ?? 8 }}
    />
  );
};

interface SlideFrameProps {
  slide: BriefSlide;
  /** mostra dica de edição quando não há conteúdo (modo montar) */
  editHint?: boolean;
}

/** Palco 16:9: fundo do tema + conteúdo do tipo + camadas (só leitura). */
export const SlideFrame: React.FC<SlideFrameProps> = ({ slide, editHint }) => {
  const layers = [...slide.layers].sort((a, b) => a.z - b.z);
  return (
    <div
      className="relative w-full aspect-video overflow-hidden rounded-xl select-none"
      style={{
        backgroundColor: slide.theme.bg,
        backgroundImage: slide.theme.bgImage ? `url(${slide.theme.bgImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        containerType: 'inline-size',
      }}
    >
      {slide.theme.bgImage && <div className="absolute inset-0 bg-black/55" />}
      <div className="absolute inset-0">
        <SlideContent slide={slide} />
      </div>
      {layers.map((l) => (
        <LayerView key={l.id} layer={l} />
      ))}
      {editHint && layers.length === 0 && slide.kind === 'blank' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-white/45 text-[1.3cqw] font-bold">Use os botões acima para adicionar texto, imagens e formas ✏️</p>
        </div>
      )}
    </div>
  );
};
