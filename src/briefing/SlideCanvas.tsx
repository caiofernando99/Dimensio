import React, { useRef, useState } from 'react';
import {
  Type,
  Image as ImageIcon,
  Shapes,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  Crosshair,
  Upload,
} from 'lucide-react';
import type { BriefLayer, BriefSlide } from './types';
import { createLayer } from './deck';
import { LayerView } from './SlideFrame';
import { SlideContent } from './SlideContent';
import { compressImageDataUrl } from '../utils/helpers';

interface SlideCanvasProps {
  slide: BriefSlide;
  onLayers: (layers: BriefLayer[]) => void;
}

type DragMode = { kind: 'move'; dx: number; dy: number } | { kind: 'resize'; corner: 'nw' | 'ne' | 'sw' | 'se'; startX: number; startY: number; startW: number; startH: number } | null;

const MIN_SIZE = 4;

/**
 * Canvas de edição: UM modo só (sem Camadas x Elementos).
 * Arrastar para mover (com guias de centro), alças nos 4 cantos,
 * inspetor simples da camada selecionada. Sem atalhos Ctrl (conflitavam).
 */
export const SlideCanvas: React.FC<SlideCanvasProps> = ({ slide, onLayers }) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dragRef = useRef<DragMode>(null);
  const [guides, setGuides] = useState<{ v: boolean; h: boolean }>({ v: false, h: false });

  const layers = slide.layers;
  const maxZ = layers.reduce((a, l) => Math.max(a, l.z), 0);
  const selected = layers.find((l) => l.id === selectedId) || null;

  const patch = (id: string, p: Partial<BriefLayer>) => {
    onLayers(layers.map((l) => (l.id === id ? { ...l, ...p } : l)));
  };

  const toPct = (clientX: number, clientY: number) => {
    const r = stageRef.current!.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * 100, y: ((clientY - r.top) / r.height) * 100 };
  };

  const onLayerDown = (e: React.PointerEvent, layer: BriefLayer) => {
    e.stopPropagation();
    setSelectedId(layer.id);
    const p = toPct(e.clientX, e.clientY);
    dragRef.current = { kind: 'move', dx: p.x - layer.x, dy: p.y - layer.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onHandleDown = (e: React.PointerEvent, layer: BriefLayer, corner: 'nw' | 'ne' | 'sw' | 'se') => {
    e.stopPropagation();
    setSelectedId(layer.id);
    dragRef.current = { kind: 'resize', corner, startX: layer.x, startY: layer.y, startW: layer.w, startH: layer.h };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onStageMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !selectedId) return;
    const layer = layers.find((l) => l.id === selectedId);
    if (!layer) return;
    const p = toPct(e.clientX, e.clientY);
    if (drag.kind === 'move') {
      let nx = Math.min(100 - layer.w, Math.max(0, p.x - drag.dx));
      let ny = Math.min(100 - layer.h, Math.max(0, p.y - drag.dy));
      // snap no centro
      const cx = nx + layer.w / 2;
      const cy = ny + layer.h / 2;
      const snapV = Math.abs(cx - 50) < 2;
      const snapH = Math.abs(cy - 50) < 2;
      if (snapV) nx = 50 - layer.w / 2;
      if (snapH) ny = 50 - layer.h / 2;
      setGuides({ v: snapV, h: snapH });
      patch(selectedId, { x: Math.round(nx * 10) / 10, y: Math.round(ny * 10) / 10 });
    } else {
      const sx = toPct(e.clientX, e.clientY);
      // delta em % desde o início do gesto: aproxima via posição atual
      const dxPct = sx.x - (drag.corner.includes('w') ? drag.startX + drag.startW : drag.startX);
      const dyPct = sx.y - (drag.corner.includes('n') ? drag.startY + drag.startH : drag.startY);
      const sx0 = drag.startX;
      const sy0 = drag.startY;
      const sw0 = drag.startW;
      const sh0 = drag.startH;
      let x = sx0;
      let y = sy0;
      let w = sw0;
      let h = sh0;
      if (drag.corner.includes('e')) w = Math.max(MIN_SIZE, sw0 + dxPct);
      if (drag.corner.includes('s')) h = Math.max(MIN_SIZE, sh0 + dyPct);
      if (drag.corner.includes('w')) {
        const nw = Math.max(MIN_SIZE, sw0 - dxPct);
        x = Math.min(sx0 + sw0 - MIN_SIZE, sx0 + (sw0 - nw));
        w = nw;
      }
      if (drag.corner.includes('n')) {
        const nh = Math.max(MIN_SIZE, sh0 - dyPct);
        y = Math.min(sy0 + sh0 - MIN_SIZE, sy0 + (sh0 - nh));
        h = nh;
      }
      x = Math.max(0, Math.min(100 - w, x));
      y = Math.max(0, Math.min(100 - h, y));
      patch(selectedId, {
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        w: Math.round(w * 10) / 10,
        h: Math.round(h * 10) / 10,
      });
    }
  };

  const endDrag = () => {
    dragRef.current = null;
    setGuides({ v: false, h: false });
  };

  const addLayer = (type: BriefLayer['type'], content?: string) => {
    const layer = createLayer(type, maxZ);
    if (content !== undefined) layer.content = content;
    onLayers([...layers, layer]);
    setSelectedId(layer.id);
  };

  const duplicate = () => {
    if (!selected) return;
    const copy: BriefLayer = {
      ...JSON.parse(JSON.stringify(selected)),
      id: `layer_${Date.now().toString(36)}`,
      x: Math.min(100 - selected.w, selected.x + 3),
      y: Math.min(100 - selected.h, selected.y + 3),
      z: maxZ + 1,
    };
    onLayers([...layers, copy]);
    setSelectedId(copy.id);
  };

  const removeSelected = () => {
    if (!selectedId) return;
    onLayers(layers.filter((l) => l.id !== selectedId));
    setSelectedId(null);
  };

  const bring = (dir: 1 | -1) => {
    if (!selected) return;
    const sorted = [...layers].sort((a, b) => a.z - b.z);
    const idx = sorted.findIndex((l) => l.id === selected.id);
    const j = idx + dir;
    if (j < 0 || j >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[j];
    const nz = a.z;
    a.z = b.z;
    b.z = nz;
    onLayers([...layers]);
  };

  const centerSelected = () => {
    if (!selected) return;
    patch(selected.id, { x: Math.round((50 - selected.w / 2) * 10) / 10, y: Math.round((50 - selected.h / 2) * 10) / 10 });
  };

  const onPickImage = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const compressed = await compressImageDataUrl(dataUrl, 1200, 0.8);
      if (selected && selected.type === 'image') {
        patch(selected.id, { content: compressed });
      } else {
        addLayer('image', compressed);
      }
    } catch {
      // ignora
    }
  };

  const onStageKey = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget || !selected) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      removeSelected();
    } else if (e.key === 'Escape') {
      setSelectedId(null);
    } else if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      const step = e.shiftKey ? 3 : 1;
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
      patch(selected.id, {
        x: Math.max(0, Math.min(100 - selected.w, selected.x + dx)),
        y: Math.max(0, Math.min(100 - selected.h, selected.y + dy)),
      });
    }
  };

  const toolBtn =
    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer border border-[var(--line)] bg-[var(--paper)] text-[var(--ink)] hover:border-[var(--primary)]';

  return (
    <div className="space-y-2">
      {/* Barra única de camadas */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button className={toolBtn} onClick={() => addLayer('text')}>
          <Type className="w-3.5 h-3.5" /> Texto
        </button>
        <button className={toolBtn} onClick={() => fileRef.current?.click()}>
          <ImageIcon className="w-3.5 h-3.5" /> Imagem
        </button>
        <button className={toolBtn} onClick={() => addLayer('shape', 'rect')}>
          <Shapes className="w-3.5 h-3.5" /> Forma
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPickImage(e.target.files?.[0])} />
        <span className="w-px h-5 bg-[var(--line)] mx-1" />
        <button className={toolBtn} disabled={!selected} onClick={centerSelected} title="Centralizar no slide">
          <Crosshair className="w-3.5 h-3.5" /> Centralizar
        </button>
        <button className={toolBtn} disabled={!selected} onClick={duplicate} title="Duplicar camada">
          <Copy className="w-3.5 h-3.5" /> Duplicar
        </button>
        <button className={toolBtn} disabled={!selected} onClick={() => bring(1)} title="Trazer para frente">
          <ArrowUp className="w-3.5 h-3.5" /> Frente
        </button>
        <button className={toolBtn} disabled={!selected} onClick={() => bring(-1)} title="Enviar para trás">
          <ArrowDown className="w-3.5 h-3.5" /> Trás
        </button>
        <button
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer border border-rose-300 text-rose-600 hover:bg-rose-500/10 disabled:opacity-40"
          disabled={!selected}
          onClick={removeSelected}
        >
          <Trash2 className="w-3.5 h-3.5" /> Excluir
        </button>
        <span className="ml-auto text-[10px] text-[var(--muted)] font-semibold hidden sm:block">
          Arraste para mover • cantos para redimensionar • setas ajustam fino
        </span>
      </div>

      {/* Palco */}
      <div
        ref={stageRef}
        tabIndex={0}
        onKeyDown={onStageKey}
        onPointerMove={onStageMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onPointerDown={() => setSelectedId(null)}
        className="relative w-full aspect-video overflow-hidden rounded-xl outline-none focus:ring-2 focus:ring-[var(--primary)] cursor-default"
        style={{
          backgroundColor: slide.theme.bg,
          backgroundImage: slide.theme.bgImage ? `url(${slide.theme.bgImage})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          containerType: 'inline-size',
        }}
      >
        {slide.theme.bgImage && <div className="absolute inset-0 bg-black/55 pointer-events-none" />}
        <div className="absolute inset-0 pointer-events-none">
          <SlideContent slide={slide} />
        </div>
        {[...layers].sort((a, b) => a.z - b.z).map((l) => {
          const isSel = l.id === selectedId;
          return (
            <div
              key={l.id}
              onPointerDown={(e) => onLayerDown(e, l)}
              className={`absolute ${isSel ? 'ring-2 ring-emerald-400' : 'hover:ring-1 hover:ring-white/60'} rounded`}
              style={{ left: `${l.x}%`, top: `${l.y}%`, width: `${l.w}%`, height: `${l.h}%`, zIndex: 50 + l.z, touchAction: 'none', cursor: 'move' }}
            >
              <div className="w-full h-full pointer-events-none">
                <LayerView layer={l} />
              </div>
              {isSel &&
                (['nw', 'ne', 'sw', 'se'] as const).map((c) => (
                  <span
                    key={c}
                    onPointerDown={(e) => onHandleDown(e, l, c)}
                    className="absolute w-3 h-3 rounded-full bg-emerald-400 border-2 border-white shadow"
                    style={{
                      cursor: `${c}-resize`,
                      left: c.includes('w') ? -6 : undefined,
                      right: c.includes('e') ? -6 : undefined,
                      top: c.includes('n') ? -6 : undefined,
                      bottom: c.includes('s') ? -6 : undefined,
                    }}
                  />
                ))}
            </div>
          );
        })}
        {guides.v && <div className="absolute top-0 bottom-0 left-1/2 w-px bg-emerald-300 pointer-events-none" />}
        {guides.h && <div className="absolute left-0 right-0 top-1/2 h-px bg-emerald-300 pointer-events-none" />}
        {layers.length === 0 && slide.kind === 'blank' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-white/45 text-[1.3cqw] font-bold">Adicione texto, imagens e formas pelos botões acima ✏️</p>
          </div>
        )}
      </div>

      {/* Inspetor da camada selecionada */}
      {selected && (
        <div className="p-3 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] space-y-2">
          <div className="text-[11px] font-black text-[var(--ink)] uppercase tracking-wide">
            Editando: {selected.type === 'text' ? 'texto' : selected.type === 'image' ? 'imagem' : 'forma'}
          </div>
          {selected.type === 'text' && (
            <>
              <textarea
                value={selected.content}
                onChange={(e) => patch(selected.id, { content: e.target.value })}
                rows={2}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[var(--line)] bg-[var(--paper)] text-[var(--ink)] resize-y"
              />
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-[var(--muted)]">
                <label className="flex items-center gap-1">
                  Tam.
                  <input type="range" min={1} max={8} step={0.25} value={selected.fontSize ?? 3} onChange={(e) => patch(selected.id, { fontSize: Number(e.target.value) })} className="w-20 accent-[var(--primary)]" />
                  {(selected.fontSize ?? 3).toFixed(2).replace(/\.?0+$/, '')}
                </label>
                <div className="flex gap-1">
                  {([400, 700, 900] as const).map((w) => (
                    <button key={w} onClick={() => patch(selected.id, { fontWeight: w })} className={`px-2 py-1 rounded-md border cursor-pointer ${selected.fontWeight === w ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-[var(--line)]'}`}>
                      {w === 400 ? 'Normal' : w === 700 ? 'Forte' : 'Super'}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1">
                  {(['left', 'center', 'right'] as const).map((a) => (
                    <button key={a} onClick={() => patch(selected.id, { align: a })} className={`px-2 py-1 rounded-md border cursor-pointer ${selected.align === a ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-[var(--line)]'}`}>
                      {a === 'left' ? 'Esq' : a === 'center' ? 'Centro' : 'Dir'}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-1">
                  Cor <input type="color" value={selected.color || '#ffffff'} onChange={(e) => patch(selected.id, { color: e.target.value })} className="w-7 h-6 rounded cursor-pointer bg-transparent border-0" />
                </label>
                <label className="flex items-center gap-1">
                  Fundo
                  <input type="color" value={selected.bg && selected.bg !== 'transparent' ? selected.bg : '#000000'} onChange={(e) => patch(selected.id, { bg: e.target.value })} className="w-7 h-6 rounded cursor-pointer bg-transparent border-0" />
                  <button onClick={() => patch(selected.id, { bg: undefined })} className="px-1.5 py-0.5 rounded border border-[var(--line)] cursor-pointer" title="Sem fundo">∅</button>
                </label>
              </div>
            </>
          )}
          {selected.type === 'image' && (
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-[var(--muted)]">
              <input
                value={selected.content}
                onChange={(e) => patch(selected.id, { content: e.target.value })}
                placeholder="Cole a URL da imagem ou envie pelo botão"
                className="flex-1 min-w-[200px] px-2.5 py-1.5 text-xs rounded-lg border border-[var(--line)] bg-[var(--paper)] text-[var(--ink)]"
              />
              <button onClick={() => fileRef.current?.click()} className="px-2.5 py-1.5 rounded-lg border border-[var(--line)] cursor-pointer flex items-center gap-1">
                <Upload className="w-3.5 h-3.5" /> Enviar
              </button>
              <label className="flex items-center gap-1">
                Cantos
                <input type="range" min={0} max={32} value={selected.radius ?? 12} onChange={(e) => patch(selected.id, { radius: Number(e.target.value) })} className="w-20 accent-[var(--primary)]" />
              </label>
            </div>
          )}
          {selected.type === 'shape' && (
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-[var(--muted)]">
              <div className="flex gap-1">
                {(['rect', 'circle', 'line'] as const).map((s) => (
                  <button key={s} onClick={() => patch(selected.id, { content: s })} className={`px-2 py-1 rounded-md border cursor-pointer ${selected.content === s ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-[var(--line)]'}`}>
                    {s === 'rect' ? 'Retângulo' : s === 'circle' ? 'Círculo' : 'Linha'}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-1">
                Cor <input type="color" value={selected.color || '#4f46e5'} onChange={(e) => patch(selected.id, { color: e.target.value })} className="w-7 h-6 rounded cursor-pointer bg-transparent border-0" />
              </label>
              {selected.content === 'line' && (
                <label className="flex items-center gap-1">
                  Espessura
                  <input type="range" min={1} max={12} value={selected.lineWidth ?? 4} onChange={(e) => patch(selected.id, { lineWidth: Number(e.target.value) })} className="w-20 accent-[var(--primary)]" />
                </label>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-[var(--muted)]">
            <label className="flex items-center gap-1">
              Transparência
              <input type="range" min={10} max={100} value={Math.round((selected.opacity ?? 1) * 100)} onChange={(e) => patch(selected.id, { opacity: Number(e.target.value) / 100 })} className="w-20 accent-[var(--primary)]" />
            </label>
            <label className="flex items-center gap-1">
              Girar
              <input type="range" min={-45} max={45} value={selected.rotation ?? 0} onChange={(e) => patch(selected.id, { rotation: Number(e.target.value) })} className="w-20 accent-[var(--primary)]" />
              {selected.rotation ?? 0}°
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
