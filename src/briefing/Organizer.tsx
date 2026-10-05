import React from 'react';
import {
  Presentation,
  LayoutGrid,
  Link2,
  Cpu,
  HelpCircle,
  Megaphone,
  PenSquare,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Copy,
  Trash2,
  Plus,
} from 'lucide-react';
import type { BriefDeck, BriefKind } from './types';
import { BRIEF_KINDS } from './types';

export const KIND_ICONS: Record<BriefKind, React.ReactNode> = {
  cover: <Presentation className="w-4 h-4" />,
  scale: <LayoutGrid className="w-4 h-4" />,
  embed: <Link2 className="w-4 h-4" />,
  process: <Cpu className="w-4 h-4" />,
  qa: <HelpCircle className="w-4 h-4" />,
  notice: <Megaphone className="w-4 h-4" />,
  blank: <PenSquare className="w-4 h-4" />,
};

export function kindLabel(kind: BriefKind): string {
  return BRIEF_KINDS.find((k) => k.kind === kind)?.label || kind;
}

interface OrganizerProps {
  deck: BriefDeck;
  activeId: string;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: (kind: BriefKind) => void;
}

/** Trilho de slides: ordem, liga/desliga, duplicar, excluir. */
export const Organizer: React.FC<OrganizerProps> = ({
  deck,
  activeId,
  onSelect,
  onToggle,
  onMove,
  onDuplicate,
  onRemove,
  onAdd,
}) => {
  const [galleryOpen, setGalleryOpen] = React.useState(false);
  const activeSlides = deck.slides.filter((s) => s.enabled);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black uppercase tracking-wider text-[var(--muted)]">
          Slides ({activeSlides.length}/{deck.slides.length} na apresentação)
        </h3>
        <button
          onClick={() => setGalleryOpen(true)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--primary)] text-white text-[11px] font-black cursor-pointer hover:opacity-90"
        >
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </button>
      </div>

      <div className="space-y-1.5 max-h-[52vh] overflow-y-auto pr-0.5">
        {deck.slides.map((s, idx) => {
          const active = s.id === activeId;
          return (
            <div
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={`p-2 rounded-xl border cursor-pointer transition-all ${
                active
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                  : 'border-[var(--line)] bg-[var(--paper)] hover:border-[var(--primary-border)]'
              } ${s.enabled ? '' : 'opacity-60'}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-[var(--muted)] w-4 shrink-0">{idx + 1}</span>
                <span style={{ color: s.theme.accent }} className="shrink-0">{KIND_ICONS[s.kind]}</span>
                <span className="flex-1 min-w-0 text-xs font-black text-[var(--ink)] truncate">{s.title}</span>
                <button
                  title={s.enabled ? 'Ocultar da apresentação' : 'Mostrar na apresentação'}
                  onClick={(e) => { e.stopPropagation(); onToggle(s.id); }}
                  className="p-1 rounded-md text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer shrink-0"
                >
                  {s.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
              </div>
              {active && (
                <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-[var(--line)]/60" onClick={(e) => e.stopPropagation()}>
                  <button title="Mover para cima" onClick={() => onMove(s.id, -1)} disabled={idx === 0} className="p-1 rounded-md text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-30 cursor-pointer">
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button title="Mover para baixo" onClick={() => onMove(s.id, 1)} disabled={idx === deck.slides.length - 1} className="p-1 rounded-md text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-30 cursor-pointer">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button title="Duplicar" onClick={() => onDuplicate(s.id)} className="p-1 rounded-md text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button title="Excluir slide" onClick={() => onRemove(s.id)} disabled={deck.slides.length <= 1} className="p-1 rounded-md text-[var(--muted)] hover:text-rose-500 disabled:opacity-30 cursor-pointer ml-auto">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {galleryOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60" onClick={() => setGalleryOpen(false)}>
          <div className="w-full max-w-lg bg-[var(--paper)] border border-[var(--line)] rounded-2xl p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-black text-[var(--ink)]">Adicionar slide</h3>
            <p className="text-[11px] text-[var(--muted)] font-semibold mt-0.5">Escolha o tipo — o conteúdo automático já vem preenchido.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
              {BRIEF_KINDS.map((k) => (
                <button
                  key={k.kind}
                  onClick={() => { onAdd(k.kind); setGalleryOpen(false); }}
                  className="p-3 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-left hover:border-[var(--primary)] transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2 text-[var(--ink)] font-black text-xs">
                    {KIND_ICONS[k.kind]} {k.label}
                  </div>
                  <p className="text-[10.5px] text-[var(--muted)] font-medium mt-1 leading-snug">{k.desc}</p>
                </button>
              ))}
            </div>
            <button onClick={() => setGalleryOpen(false)} className="mt-3 w-full py-2 rounded-xl border border-[var(--line)] text-xs font-bold text-[var(--muted)] cursor-pointer">
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
