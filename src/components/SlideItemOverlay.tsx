import React, { useEffect, useRef, useState } from 'react';
import {
  Type,
  Image as ImageIcon,
  Trash2,
  Copy,
  X,
  Plus,
  Upload,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Edit3,
  Check,
  Shapes,
  Square,
  Circle,
  Minus,
  BringToFront,
  SendToBack,
} from 'lucide-react';
import type { SlideItem } from '../types';

const PRESET_ITEM_IMAGES = [
  { name: 'Segurança & Ergonomia', url: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=800&q=80' },
  { name: 'Trabalho em Equipe', url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80' },
  { name: 'Logística & Docas', url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80' },
  { name: 'Inspeção & Avarias', url: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=800&q=80' },
];

const compressImageLocal = (file: File, maxWidth = 1200): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('Falha ao carregar a imagem'));
      img.src = e.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const HANDLE_DIRS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;

interface SlideItemOverlayProps {
  items: SlideItem[];
  editMode?: boolean;
  onChange?: (items: SlideItem[]) => void;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
}

export const SlideItemOverlay: React.FC<SlideItemOverlayProps> = ({
  items,
  editMode = false,
  onChange,
  selectedId: externalSelectedId,
  onSelect,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const selectedId = externalSelectedId !== undefined ? externalSelectedId : internalSelectedId;
  const setSelectedId = (id: string | null) => {
    setInternalSelectedId(id);
    onSelect?.(id);
  };

  const [showImageAdder, setShowImageAdder] = useState(false);
  const [showShapePicker, setShowShapePicker] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [textDraft, setTextDraft] = useState('');
  const clipboardItemRef = useRef<SlideItem | null>(null);

  // Maintain local state synced with props when not actively dragging/resizing
  const [localItems, setLocalItems] = useState<SlideItem[]>(items);
  const interactionRef = useRef<{
    mode: 'move' | 'resize';
    startX: number;
    startY: number;
    item: SlideItem;
    dir?: string;
  } | null>(null);

  // Sync with prop when parent updates and no interaction is active
  useEffect(() => {
    if (!interactionRef.current) {
      setLocalItems(items);
    }
  }, [items]);

  const itemsRef = useRef(localItems);
  useEffect(() => {
    itemsRef.current = localItems;
  }, [localItems]);

  const displayedItems = localItems;

  const update = (next: SlideItem[]) => {
    setLocalItems(next);
    onChange?.(next);
  };

  const getContainerSize = () => {
    const el = containerRef.current;
    if (!el) return { w: 1, h: 1 };
    return { w: el.clientWidth || 1, h: el.clientHeight || 1 };
  };

  const beginDrag = (e: React.PointerEvent, item: SlideItem) => {
    if (!editMode) return;
    e.stopPropagation();
    setEditingTextId(null);
    setShowImageAdder(false);
    setShowShapePicker(false);
    setSelectedId(item.id);
    interactionRef.current = { mode: 'move', startX: e.clientX, startY: e.clientY, item };
  };

  const beginResize = (e: React.PointerEvent, item: SlideItem, dir: string) => {
    if (!editMode) return;
    e.stopPropagation();
    setSelectedId(item.id);
    interactionRef.current = { mode: 'resize', startX: e.clientX, startY: e.clientY, item, dir };
  };

  useEffect(() => {
    if (!editMode) return;
    const handleMove = (ev: PointerEvent) => {
      const inter = interactionRef.current;
      if (!inter) return;
      const { w: cw, h: ch } = getContainerSize();
      const dx = ((ev.clientX - inter.startX) / cw) * 100;
      const dy = ((ev.clientY - inter.startY) / ch) * 100;
      const item = inter.item;
      const current = itemsRef.current;
      if (inter.mode === 'move') {
        const newX = Math.min(100 - item.w, Math.max(0, item.x + dx));
        const newY = Math.min(100 - item.h, Math.max(0, item.y + dy));
        const next = current.map((i) => (i.id === item.id ? { ...i, x: newX, y: newY } : i));
        setLocalItems(next);
      } else {
        const dir = inter.dir || 'se';
        let newW = item.w;
        let newH = item.h;
        let newX = item.x;
        let newY = item.y;
        if (dir.includes('e')) newW = item.w + dx;
        if (dir.includes('s')) newH = item.h + dy;
        if (dir.includes('w')) {
          newW = item.w - dx;
          newX = item.x + dx;
        }
        if (dir.includes('n')) {
          newH = item.h - dy;
          newY = item.y + dy;
        }
        newW = Math.max(5, newW);
        newH = Math.max(5, newH);
        if (dir.includes('w')) newX = item.x + item.w - newW;
        if (dir.includes('n')) newY = item.y + item.h - newH;
        newX = Math.max(0, Math.min(100 - newW, newX));
        newY = Math.max(0, Math.min(100 - newH, newY));
        newW = Math.min(100 - newX, newW);
        newH = Math.min(100 - newY, newH);
        const next = current.map((i) =>
          i.id === item.id ? { ...i, x: newX, y: newY, w: newW, h: newH } : i
        );
        setLocalItems(next);
      }
    };
    const handleUp = () => {
      if (interactionRef.current) {
        onChange?.(itemsRef.current);
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

  const addTextItem = () => {
    const maxZ = items.reduce((m, i) => Math.max(m, i.z), 0) + 1;
    const newItem: SlideItem = {
      id: uid(),
      type: 'text',
      content: 'Novo texto aqui',
      x: 30,
      y: 42,
      w: 40,
      h: 12,
      z: maxZ,
      fontSize: 1.5,
      fontWeight: 900,
      align: 'center',
      color: '#ffffff',
    };
    update([...items, newItem]);
    setSelectedId(newItem.id);
    setEditingTextId(newItem.id);
    setTextDraft(newItem.content);
    setShowImageAdder(false);
    setShowShapePicker(false);
  };

  const addImageItem = (url: string) => {
    if (!url.trim()) return;
    const maxZ = items.reduce((m, i) => Math.max(m, i.z), 0) + 1;
    const newItem: SlideItem = {
      id: uid(),
      type: 'image',
      content: url.trim(),
      x: 30,
      y: 20,
      w: 40,
      h: 60,
      z: maxZ,
      objectFit: 'cover',
      borderRadius: 12,
    };
    update([...items, newItem]);
    setSelectedId(newItem.id);
    setShowImageAdder(false);
    setShowShapePicker(false);
    setImageUrlInput('');
  };

  const duplicateItem = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const maxZ = items.reduce((m, i) => Math.max(m, i.z), 0) + 1;
    const copy: SlideItem = {
      ...item,
      id: uid(),
      x: Math.min(90, item.x + 4),
      y: Math.min(90, item.y + 4),
      z: maxZ,
    };
    update([...items, copy]);
    setSelectedId(copy.id);
  };

  const removeItem = (id: string) => {
    update(items.filter((i) => i.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const addShapeItem = (kind: 'rect' | 'circle' | 'line') => {
    const maxZ = items.reduce((m, i) => Math.max(m, i.z), 0) + 1;
    const isLine = kind === 'line';
    const newItem: SlideItem = {
      id: uid(),
      type: 'shape',
      content: kind,
      x: 30,
      y: 25,
      w: isLine ? 40 : 25,
      h: isLine ? 1 : 30,
      z: maxZ,
      shape: kind,
      color: isLine ? '#ffffff' : '#4f46e5',
      opacity: 1,
      rotation: 0,
    };
    update([...items, newItem]);
    setSelectedId(newItem.id);
    setShowShapePicker(false);
  };

  const bringToFront = (id: string) => {
    const maxZ = items.reduce((m, i) => Math.max(m, i.z), 0);
    update(items.map((i) => (i.id === id ? { ...i, z: maxZ + 1 } : i)));
  };

  const sendToBack = (id: string) => {
    const minZ = items.reduce((m, i) => Math.min(m, i.z), 0);
    update(items.map((i) => (i.id === id ? { ...i, z: minZ - 1 } : i)));
  };

  const patchItem = (id: string, patch: Partial<SlideItem>) => {
    update(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    try {
      setIsUploadingImage(true);
      const dataUrl = await compressImageLocal(file, 1200);
      addImageItem(dataUrl);
    } catch {
      // ignore upload errors
    } finally {
      setIsUploadingImage(false);
    }
  };

  useEffect(() => {
    if (!editMode) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      const id = selectedId;
      if (!id) return;
      const item = itemsRef.current.find((i) => i.id === id);
      if (!item) return;
      const key = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        update(itemsRef.current.filter((i) => i.id !== id));
        setSelectedId(null);
      } else if (mod && key === 'd') {
        e.preventDefault();
        const maxZ = itemsRef.current.reduce((m, i) => Math.max(m, i.z), 0) + 1;
        const copy: SlideItem = {
          ...item,
          id: uid(),
          x: Math.min(90, item.x + 4),
          y: Math.min(90, item.y + 4),
          z: maxZ,
        };
        update([...itemsRef.current, copy]);
        setSelectedId(copy.id);
      } else if (mod && key === 'c') {
        e.preventDefault();
        clipboardItemRef.current = { ...item };
      } else if (mod && key === 'v') {
        e.preventDefault();
        const src = clipboardItemRef.current;
        if (src) {
          const maxZ = itemsRef.current.reduce((m, i) => Math.max(m, i.z), 0) + 1;
          const paste: SlideItem = {
            ...src,
            id: uid(),
            x: Math.min(90, src.x + 4),
            y: Math.min(90, src.y + 4),
            z: maxZ,
          };
          update([...itemsRef.current, paste]);
          setSelectedId(paste.id);
        }
      } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        let dx = 0;
        let dy = 0;
        if (e.key === 'ArrowUp') dy = -step;
        else if (e.key === 'ArrowDown') dy = step;
        else if (e.key === 'ArrowLeft') dx = -step;
        else dx = step;
        const nx = Math.min(100 - item.w, Math.max(0, item.x + dx));
        const ny = Math.min(100 - item.h, Math.max(0, item.y + dy));
        update(itemsRef.current.map((i) => (i.id === id ? { ...i, x: nx, y: ny } : i)));
      } else if (e.key === 'Escape') {
        setSelectedId(null);
        setEditingTextId(null);
        setShowImageAdder(false);
        setShowShapePicker(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editMode, selectedId]);

  const selectedItem = displayedItems.find((i) => i.id === selectedId) || null;
  const sortedItems = [...displayedItems].sort((a, b) => a.z - b.z);
  const fontOptions = [400, 600, 700, 900];

  const handleStyle = (label: string) =>
    `p-1 rounded-lg text-[10px] font-black text-white hover:bg-white/10 cursor-pointer flex items-center justify-center transition-colors`;

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
          setSelectedId(null);
          setEditingTextId(null);
          setShowImageAdder(false);
          setShowShapePicker(false);
        }
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Add-item toolbar (edit mode only) */}
      {editMode && (
        <div
          className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-1.5 bg-slate-950/90 border border-white/15 backdrop-blur-md px-2 py-1.5 rounded-xl shadow-xl"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline">
            Camadas
          </span>
          <button
            onClick={addTextItem}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <Type className="w-3.5 h-3.5" />
            <span>Texto</span>
          </button>
          <button
            onClick={() => {
              setShowImageAdder((v) => !v);
              setEditingTextId(null);
              setShowShapePicker(false);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Imagem</span>
          </button>
          <button
            onClick={() => {
              setShowShapePicker((v) => !v);
              setEditingTextId(null);
              setShowImageAdder(false);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-[11px] font-black cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <Shapes className="w-3.5 h-3.5" />
            <span>Forma</span>
          </button>

          {showShapePicker && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-slate-950/95 border border-white/15 backdrop-blur-md rounded-2xl p-3 shadow-2xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-white uppercase tracking-wider">
                  Adicionar Forma
                </span>
                <button
                  onClick={() => setShowShapePicker(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => addShapeItem('rect')}
                  className="flex flex-col items-center gap-1 p-3 rounded-lg bg-slate-900 border border-white/10 hover:border-fuchsia-500 cursor-pointer"
                >
                  <Square className="w-5 h-5 text-white" />
                  <span className="text-[10px] font-bold text-slate-300">Retângulo</span>
                </button>
                <button
                  onClick={() => addShapeItem('circle')}
                  className="flex flex-col items-center gap-1 p-3 rounded-lg bg-slate-900 border border-white/10 hover:border-fuchsia-500 cursor-pointer"
                >
                  <Circle className="w-5 h-5 text-white" />
                  <span className="text-[10px] font-bold text-slate-300">Círculo</span>
                </button>
                <button
                  onClick={() => addShapeItem('line')}
                  className="flex flex-col items-center gap-1 p-3 rounded-lg bg-slate-900 border border-white/10 hover:border-fuchsia-500 cursor-pointer"
                >
                  <Minus className="w-5 h-5 text-white" />
                  <span className="text-[10px] font-bold text-slate-300">Linha</span>
                </button>
              </div>
            </div>
          )}

          {showImageAdder && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-slate-950/95 border border-white/15 backdrop-blur-md rounded-2xl p-3 shadow-2xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-white uppercase tracking-wider">
                  Adicionar Imagem
                </span>
                <button
                  onClick={() => setShowImageAdder(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="url"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addImageItem(imageUrlInput);
                  }}
                  placeholder="https://... (URL da imagem)"
                  className="flex-1 p-2 bg-slate-900 border border-white/10 rounded-lg text-white text-[11px] font-bold placeholder:text-slate-500 focus:border-blue-500 outline-none"
                />
                <button
                  onClick={() => addImageItem(imageUrlInput)}
                  className="px-2.5 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white cursor-pointer"
                  title="Adicionar da URL"
                >
                  <Check />
                </button>
              </div>
              <label className="flex items-center justify-center gap-1.5 p-2 bg-slate-900 border border-dashed border-white/20 rounded-lg text-[11px] font-bold text-slate-300 hover:bg-slate-800 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>{isUploadingImage ? 'Enviando...' : 'Enviar imagem do computador'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    handleUpload(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {PRESET_ITEM_IMAGES.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => addImageItem(preset.url)}
                    title={preset.name}
                    className="aspect-square rounded-lg overflow-hidden bg-slate-900 border border-white/10 hover:border-blue-500 cursor-pointer"
                  >
                    <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Items */}
      {sortedItems.map((item) => {
        const isSelected = selectedId === item.id;
        const textBaseStyle: React.CSSProperties = {
          fontSize: `${item.fontSize ?? 1.5}cqw`,
          fontWeight: item.fontWeight ?? 900,
          textAlign: item.align ?? 'left',
          fontFamily: item.fontFamily || undefined,
          color: item.color ?? '#ffffff',
          backgroundColor: item.bgColor ?? 'transparent',
        };
        return (
          <div
            key={item.id}
            onPointerDown={(e) => beginDrag(e, item)}
            className={`absolute ${editMode ? 'cursor-move' : ''} select-none ${
              isSelected && editMode
                ? 'outline outline-2 outline-emerald-400/90 outline-offset-2 rounded-lg'
                : editMode
                  ? 'outline outline-1 outline-dashed outline-white/30 hover:outline-white/70'
                  : ''
            }`}
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
              width: `${item.w}%`,
              height: `${item.h}%`,
              zIndex: item.z,
            }}
          >
            {item.type === 'text' ? (
              editingTextId === item.id ? (
                <textarea
                  autoFocus
                  value={textDraft}
                  onChange={(e) => setTextDraft(e.target.value)}
                  onBlur={() => {
                    patchItem(item.id, { content: textDraft });
                    setEditingTextId(null);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="w-full h-full bg-transparent resize-none outline-none leading-tight rounded-lg"
                  style={textBaseStyle}
                />
              ) : (
                <div
                  onDoubleClick={() => {
                    if (!editMode) return;
                    setEditingTextId(item.id);
                    setTextDraft(item.content);
                  }}
                  className="w-full h-full overflow-hidden whitespace-pre-wrap leading-tight"
                  style={{
                    ...textBaseStyle,
                    textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                    opacity: item.opacity ?? 1,
                    transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined,
                  }}
                >
                  {item.content}
                </div>
              )
            ) : item.type === 'shape' ? (
              <div
                className="w-full h-full"
                style={{
                  backgroundColor:
                    item.shape === 'line'
                      ? 'transparent'
                      : (item.color ?? '#4f46e5'),
                  borderRadius:
                    item.shape === 'circle'
                      ? '50%'
                      : item.shape === 'rect'
                        ? (item.borderRadius ?? 12)
                        : 99,
                  opacity: item.opacity ?? 1,
                  transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined,
                  ...(item.shape === 'line'
                    ? {
                        backgroundImage: `linear-gradient(to right, ${item.color ?? '#ffffff'}, ${item.color ?? '#ffffff'})`,
                        backgroundSize: `100% ${item.lineWidth ?? 2}px`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'center',
                      }
                    : {}),
                }}
              />
            ) : (
              <img
                src={item.content}
                alt=""
                draggable={false}
                className="w-full h-full"
                style={{
                  objectFit: item.objectFit ?? 'cover',
                  borderRadius: item.borderRadius ?? 0,
                  backgroundColor: item.bgColor ?? 'rgba(0,0,0,0.25)',
                  opacity: item.opacity ?? 1,
                  transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined,
                }}
              />
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
                      onPointerDown={(e) => beginResize(e, item, dir)}
                      className="absolute w-3 h-3 bg-emerald-400 border-2 border-slate-950 rounded-[3px] z-[60]"
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
                    onClick={() => {
                      setEditingTextId(item.id);
                      setTextDraft(item.content);
                    }}
                    className={handleStyle('Editar conteúdo')}
                    title="Editar conteúdo"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => duplicateItem(item.id)} className={handleStyle('Duplicar')} title="Duplicar">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => bringToFront(item.id)}
                    className={handleStyle('Trazer para frente')}
                    title="Trazer para frente"
                  >
                    <BringToFront className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => sendToBack(item.id)}
                    className={handleStyle('Enviar para trás')}
                    title="Enviar para trás"
                  >
                    <SendToBack className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-1 rounded-lg text-[10px] font-black text-rose-400 hover:bg-rose-950/60 cursor-pointer flex items-center justify-center transition-colors"
                    title="Remover"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}

      {/* Inspector / style controls (edit mode only) */}
      {editMode && selectedItem && (
        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[1000] bg-slate-950/95 border border-white/15 backdrop-blur-md rounded-2xl px-3 py-2 shadow-2xl flex flex-wrap items-center gap-x-4 gap-y-2 max-w-[92%]"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {selectedItem.type === 'text' && (
            <>
              <label className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-wider">
                Tamanho
                <input
                  type="range"
                  min={0.6}
                  max={4}
                  step={0.1}
                  value={selectedItem.fontSize ?? 1.5}
                  onChange={(e) => patchItem(selectedItem.id, { fontSize: Number(e.target.value) })}
                  className="w-24 accent-emerald-500 cursor-pointer"
                />
                <span className="text-white w-8">{((selectedItem.fontSize ?? 1.5)).toFixed(1)}</span>
              </label>
              <div className="flex items-center gap-1">
                {fontOptions.map((fw) => (
                  <button
                    key={fw}
                    onClick={() => patchItem(selectedItem.id, { fontWeight: fw })}
                    className={`w-7 h-7 rounded-lg text-[10px] font-black cursor-pointer border transition-colors ${
                      (selectedItem.fontWeight ?? 900) === fw
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-slate-900 text-white border-white/10 hover:bg-slate-800'
                    }`}
                    style={{ fontWeight: fw }}
                  >
                    {fw}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                {(
                  [
                    { v: 'left', icon: <AlignLeft className="w-3.5 h-3.5" /> },
                    { v: 'center', icon: <AlignCenter className="w-3.5 h-3.5" /> },
                    { v: 'right', icon: <AlignRight className="w-3.5 h-3.5" /> },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.v}
                    onClick={() => patchItem(selectedItem.id, { align: opt.v })}
                    className={`p-1.5 rounded-lg cursor-pointer border transition-colors ${
                      (selectedItem.align ?? 'left') === opt.v
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-slate-900 text-white border-white/10 hover:bg-slate-800'
                    }`}
                  >
                    {opt.icon}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-300 uppercase tracking-wider">
                Fonte
                <select
                  value={selectedItem.fontFamily || ''}
                  onChange={(e) => patchItem(selectedItem.id, { fontFamily: e.target.value || undefined })}
                  className="bg-slate-900 text-white text-[11px] font-bold border border-white/15 rounded-lg px-2 py-1 outline-none cursor-pointer focus:border-emerald-400"
                >
                  <option value="">(Padrão do Slide)</option>
                  <option value="'Plus Jakarta Sans', sans-serif">Plus Jakarta (Sans)</option>
                  <option value="'Playfair Display', serif">Playfair Display (Serif)</option>
                  <option value="'Montserrat', sans-serif">Montserrat (Sans Bold)</option>
                  <option value="'Inter', sans-serif">Inter (Clean)</option>
                  <option value="'Fira Code', monospace">Fira Code (Tech / Mono)</option>
                  <option value="'Caveat', cursive">Caveat (Manuscrito)</option>
                  <option value="'Cinzel', serif">Cinzel (Clássico)</option>
                  <option value="'Impact', sans-serif">Impact (Display)</option>
                  <option value="'Georgia', serif">Georgia (Elegante)</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-wider">
                Cor
                <input
                  type="color"
                  value={selectedItem.color ?? '#ffffff'}
                  onChange={(e) => patchItem(selectedItem.id, { color: e.target.value })}
                  className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border border-white/15"
                />
              </label>
            </>
          )}

          {selectedItem.type === 'image' && (
            <>
              <div className="flex items-center gap-1">
                {(
                  [
                    { v: 'cover', label: 'Cobrir' },
                    { v: 'contain', label: 'Ajustar' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.v}
                    onClick={() => patchItem(selectedItem.id, { objectFit: opt.v })}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black cursor-pointer border transition-colors ${
                      (selectedItem.objectFit ?? 'cover') === opt.v
                        ? 'bg-blue-600 text-white border-blue-400'
                        : 'bg-slate-900 text-white border-white/10 hover:bg-slate-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-wider">
                Cantos
                <input
                  type="range"
                  min={0}
                  max={32}
                  step={1}
                  value={selectedItem.borderRadius ?? 0}
                  onChange={(e) => patchItem(selectedItem.id, { borderRadius: Number(e.target.value) })}
                  className="w-20 accent-blue-500 cursor-pointer"
                />
              </label>
            </>
          )}

          {selectedItem.type === 'shape' && (
            <>
              {selectedItem.shape === 'line' ? (
                <>
                  <label className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-wider">
                    Cor da linha
                    <input
                      type="color"
                      value={selectedItem.color ?? '#ffffff'}
                      onChange={(e) => patchItem(selectedItem.id, { color: e.target.value })}
                      className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border border-white/15"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-wider">
                    Espessura
                    <input
                      type="range"
                      min={1}
                      max={12}
                      step={1}
                      value={selectedItem.lineWidth ?? 2}
                      onChange={(e) => patchItem(selectedItem.id, { lineWidth: Number(e.target.value) })}
                      className="w-20 accent-fuchsia-500 cursor-pointer"
                    />
                    <span className="text-white w-8">{selectedItem.lineWidth ?? 2}px</span>
                  </label>
                </>
              ) : (
                <>
                  <label className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-wider">
                    Cor
                    <input
                      type="color"
                      value={selectedItem.color ?? '#4f46e5'}
                      onChange={(e) => patchItem(selectedItem.id, { color: e.target.value })}
                      className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border border-white/15"
                    />
                  </label>
                  {selectedItem.shape === 'rect' && (
                    <label className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-wider">
                      Cantos
                      <input
                        type="range"
                        min={0}
                        max={50}
                        step={1}
                        value={selectedItem.borderRadius ?? 12}
                        onChange={(e) => patchItem(selectedItem.id, { borderRadius: Number(e.target.value) })}
                        className="w-20 accent-fuchsia-500 cursor-pointer"
                      />
                    </label>
                  )}
                </>
              )}
            </>
          )}

          <label className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-wider">
            Opacidade
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round((selectedItem.opacity ?? 1) * 100)}
              onChange={(e) => patchItem(selectedItem.id, { opacity: Number(e.target.value) / 100 })}
              className="w-20 accent-emerald-500 cursor-pointer"
            />
            <span className="text-white w-8">{Math.round((selectedItem.opacity ?? 1) * 100)}%</span>
          </label>
          <label className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-wider">
            Rotação
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={selectedItem.rotation ?? 0}
              onChange={(e) => patchItem(selectedItem.id, { rotation: Number(e.target.value) })}
              className="w-20 accent-emerald-500 cursor-pointer"
            />
            <span className="text-white w-8">{selectedItem.rotation ?? 0}°</span>
          </label>

          {selectedItem.type !== 'shape' && (
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-wider">
              Fundo
              <input
                type="color"
                value={selectedItem.bgColor ?? '#00000000'}
                onChange={(e) => patchItem(selectedItem.id, { bgColor: e.target.value })}
                className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border border-white/15"
              />
              <button
                onClick={() => patchItem(selectedItem.id, { bgColor: undefined })}
                className="px-1.5 py-0.5 rounded-md bg-slate-900 border border-white/10 text-white text-[10px] font-black cursor-pointer hover:bg-slate-800"
                title="Sem fundo"
              >
                Sem
              </button>
            </label>
          )}
        </div>
      )}
    </div>
  );
};
