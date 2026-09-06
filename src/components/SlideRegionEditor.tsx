import React, { useEffect, useRef, useState } from 'react';
import { EyeOff, RotateCcw } from 'lucide-react';
import type { SlideElementLayout } from '../types';

export interface RegionDef {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

const HANDLE_DIRS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;

interface SlideRegionEditorProps {
  regions: Record<string, RegionDef>;
  layout: Record<string, SlideElementLayout>;
  editMode?: boolean;
  onChange?: (layout: Record<string, SlideElementLayout>) => void;
  selectedId?: string | null;
  onSelectRegion?: (id: string | null) => void;
}

export const SlideRegionEditor: React.FC<SlideRegionEditorProps> = ({
  regions,
  layout,
  editMode = false,
  onChange,
  selectedId = null,
  onSelectRegion,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const [localLayout, setLocalLayout] = useState<Record<string, SlideElementLayout>>(layout);

  useEffect(() => {
    if (!interactionRef.current) {
      setLocalLayout(layout);
    }
  }, [layout]);

  const layoutRef = useRef(localLayout);
  useEffect(() => {
    layoutRef.current = localLayout;
  }, [localLayout]);

  const interactionRef = useRef<{
    mode: 'move' | 'resize';
    startX: number;
    startY: number;
    regionId: string;
    base: { x: number; y: number; w: number; h: number };
    dir?: string;
  } | null>(null);

  const displayedLayout = localLayout;

  const getRect = (regionId: string): { x: number; y: number; w: number; h: number; hidden: boolean } => {
    const def = regions[regionId];
    const ov = displayedLayout[regionId];
    if (!def) return { x: 0, y: 0, w: 0, h: 0, hidden: false };
    return {
      x: ov?.x ?? def.x,
      y: ov?.y ?? def.y,
      w: ov?.w ?? def.w,
      h: ov?.h ?? def.h,
      hidden: ov?.hidden ?? false,
    };
  };

  const getContainerSize = () => {
    const el = containerRef.current;
    if (!el) return { w: 1, h: 1 };
    return { w: el.clientWidth || 1, h: el.clientHeight || 1 };
  };

  const beginDrag = (e: React.PointerEvent, regionId: string) => {
    if (!editMode) return;
    e.stopPropagation();
    onSelectRegion?.(regionId);
    const r = getRect(regionId);
    interactionRef.current = { mode: 'move', startX: e.clientX, startY: e.clientY, regionId, base: r };
  };

  const beginResize = (e: React.PointerEvent, regionId: string, dir: string) => {
    if (!editMode) return;
    e.stopPropagation();
    onSelectRegion?.(regionId);
    const r = getRect(regionId);
    interactionRef.current = { mode: 'resize', startX: e.clientX, startY: e.clientY, regionId, base: r, dir };
  };

  useEffect(() => {
    if (!editMode) return;
    const handleMove = (ev: PointerEvent) => {
      const inter = interactionRef.current;
      if (!inter) return;
      const { w: cw, h: ch } = getContainerSize();
      const dx = ((ev.clientX - inter.startX) / cw) * 100;
      const dy = ((ev.clientY - inter.startY) / ch) * 100;
      const base = inter.base;
      const current = layoutRef.current;
      let rect = { x: base.x, y: base.y, w: base.w, h: base.h };
      if (inter.mode === 'move') {
        rect = {
          x: Math.min(100 - base.w, Math.max(0, base.x + dx)),
          y: Math.min(100 - base.h, Math.max(0, base.y + dy)),
          w: base.w,
          h: base.h,
        };
      } else {
        const dir = inter.dir || 'se';
        let newW = base.w;
        let newH = base.h;
        let newX = base.x;
        let newY = base.y;
        if (dir.includes('e')) newW = base.w + dx;
        if (dir.includes('s')) newH = base.h + dy;
        if (dir.includes('w')) {
          newW = base.w - dx;
          newX = base.x + dx;
        }
        if (dir.includes('n')) {
          newH = base.h - dy;
          newY = base.y + dy;
        }
        newW = Math.max(8, newW);
        newH = Math.max(6, newH);
        if (dir.includes('w')) newX = base.x + base.w - newW;
        if (dir.includes('n')) newY = base.y + base.h - newH;
        newX = Math.max(0, Math.min(100 - newW, newX));
        newY = Math.max(0, Math.min(100 - newH, newY));
        newW = Math.min(100 - newX, newW);
        newH = Math.min(100 - newY, newH);
        rect = { x: newX, y: newY, w: newW, h: newH };
      }
      const next: Record<string, SlideElementLayout> = {
        ...current,
        [inter.regionId]: rect,
      };
      setLocalLayout(next);
    };
    const handleUp = () => {
      if (interactionRef.current) {
        onChange?.(layoutRef.current);
      }
      interactionRef.current = null;
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [editMode, onChange]);

  const patchRegion = (regionId: string, patch: Partial<SlideElementLayout>) => {
    const current = layoutRef.current;
    onChange?.({ ...current, [regionId]: { ...getRect(regionId), ...patch } });
  };

  const resetRegion = (regionId: string) => {
    const current = layoutRef.current;
    const rest = { ...current };
    delete rest[regionId];
    onChange?.(rest);
  };

  const regionIds = Object.keys(regions);

  return (
    <div
      ref={containerRef}
      className={`absolute z-20 ${editMode ? 'pointer-events-auto' : 'pointer-events-none'}`}
      style={{
        width: 'min(100cqw, calc(100cqh * 16 / 9))',
        height: 'min(100cqh, calc(100cqw * 9 / 16))',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) {
          onSelectRegion?.(null);
        }
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {regionIds.map((regionId) => {
        const rect = getRect(regionId);
        if (rect.hidden) return null;
        const isSelected = selectedId === regionId;
        return (
          <div
            key={regionId}
            onPointerDown={(e) => beginDrag(e, regionId)}
            className={`absolute select-none rounded-md ${
              editMode
                ? isSelected
                  ? 'outline outline-2 outline-sky-400/90 outline-offset-1 cursor-move bg-sky-400/5'
                  : 'outline outline-1 outline-dashed outline-sky-300/40 hover:outline-sky-300/80 cursor-move bg-transparent'
                : ''
            }`}
            style={{
              left: `${rect.x}%`,
              top: `${rect.y}%`,
              width: `${rect.w}%`,
              height: `${rect.h}%`,
            }}
          >
            {editMode && (
              <span
                className={`absolute -top-5 left-0 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider whitespace-nowrap pointer-events-none ${
                  isSelected ? 'bg-sky-500 text-white' : 'bg-slate-950/80 text-sky-200 border border-sky-400/30'
                }`}
              >
                {regions[regionId].label}
              </span>
            )}

            {editMode && isSelected && (
              <>
                {HANDLE_DIRS.map((dir) => {
                  const styleMap: Record<(typeof HANDLE_DIRS)[number], React.CSSProperties> = {
                    nw: { left: -5, top: -5, cursor: 'nwse-resize' },
                    n: { left: '50%', top: -5, transform: 'translateX(-50%)', cursor: 'ns-resize' },
                    ne: { right: -5, top: -5, cursor: 'nesw-resize' },
                    e: { right: -5, top: '50%', transform: 'translateY(-50%)', cursor: 'ew-resize' },
                    se: { right: -5, bottom: -5, cursor: 'nwse-resize' },
                    s: { left: '50%', bottom: -5, transform: 'translateX(-50%)', cursor: 'ns-resize' },
                    sw: { left: -5, bottom: -5, cursor: 'nesw-resize' },
                    w: { left: -5, top: '50%', transform: 'translateY(-50%)', cursor: 'ew-resize' },
                  };
                  return (
                    <div
                      key={dir}
                      onPointerDown={(e) => beginResize(e, regionId, dir)}
                      className="absolute w-3 h-3 bg-sky-400 border-2 border-slate-950 rounded-[3px] z-[60]"
                      style={styleMap[dir]}
                    />
                  );
                })}
                <div
                  className="absolute -top-9 right-0 flex items-center gap-0.5 bg-slate-950/95 border border-white/15 rounded-lg px-1 py-0.5 z-[60] shadow-lg"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => patchRegion(regionId, { hidden: true })}
                    className="p-1 rounded-lg text-white hover:bg-white/10 cursor-pointer"
                    title="Ocultar elemento"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => resetRegion(regionId)}
                    className="p-1 rounded-lg text-white hover:bg-white/10 cursor-pointer"
                    title="Restaurar posição padrão"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};
