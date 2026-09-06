import React, { useState } from 'react';
import { Plus, Trash2, Megaphone, Lightbulb, PaintBucket, Upload, Pencil, Check, X } from 'lucide-react';
import { SimpleSlideConfig, SlideTypography } from '../types';
import { SlideTemplatePicker, SlideTemplate } from './SlideTemplatePicker';
import { SlideTypographyControls } from './SlideTypographyControls';
import { MarkdownContent } from './MarkdownContent';

interface SimpleSlideControlsProps {
  config: SimpleSlideConfig;
  templates: SlideTemplate[];
  icon: 'megaphone' | 'lightbulb';
  colorClass: string;
  accentLabel: string;
  onChange: (patch: Partial<SimpleSlideConfig>) => void;
  typography: SlideTypography;
  onTypographyChange: (patch: Partial<SlideTypography>) => void;
}

const ACCENT_PRESETS = ['#f59e0b', '#10b981', '#38bdf8', '#a78bfa', '#fb7185', '#f97316', '#22d3ee', '#facc15'];

export const SimpleSlideControls: React.FC<SimpleSlideControlsProps> = ({
  config,
  templates,
  icon,
  colorClass,
  accentLabel,
  onChange,
  typography,
  onTypographyChange,
}) => {
  const [newItem, setNewItem] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const Icon = icon === 'megaphone' ? Megaphone : Lightbulb;

  const addItem = () => {
    if (!newItem.trim()) return;
    onChange({ items: [...(config.items || []), newItem.trim()] });
    setNewItem('');
  };

  const startEditItem = (idx: number, currentText: string) => {
    setEditingIndex(idx);
    setEditingValue(currentText);
  };

  const saveEditItem = (idx: number) => {
    if (!editingValue.trim()) return;
    const copy = [...(config.items || [])];
    copy[idx] = editingValue.trim();
    onChange({ items: copy });
    setEditingIndex(null);
    setEditingValue('');
  };

  const cancelEditItem = () => {
    setEditingIndex(null);
    setEditingValue('');
  };

  return (
    <div className="bg-[var(--paper)] border border-[var(--line)] p-4 rounded-2xl shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
        <h4 className="text-xs font-black text-[var(--ink)] uppercase tracking-wider flex items-center gap-1.5">
          <Icon className={`w-4 h-4 ${colorClass}`} />
          <span>{icon === 'megaphone' ? 'Avisos & Alinhamentos' : 'Dicas Rápidas'}</span>
        </h4>
        <span className="text-[10px] font-bold text-[var(--muted)]">
          {config.items?.length || 0} {icon === 'megaphone' ? 'avisos' : 'dicas'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div>
          <label className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider block mb-1">
            Título do Slide
          </label>
          <input
            type="text"
            value={config.title || ''}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder={icon === 'megaphone' ? 'Avisos & Alinhamentos do Turno' : 'Dicas Rápidas para a Operação'}
            className="w-full p-2 bg-[var(--bg)] border border-[var(--line)] rounded-xl font-bold text-[var(--ink)] focus:border-[var(--primary)]"
          />
        </div>
        <div>
          <label className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider block mb-1">
            Subtítulo do Slide
          </label>
          <input
            type="text"
            value={config.subtitle || ''}
            onChange={(e) => onChange({ subtitle: e.target.value })}
            placeholder="Comunicados importantes da liderança"
            className="w-full p-2 bg-[var(--bg)] border border-[var(--line)] rounded-xl font-bold text-[var(--ink)] focus:border-[var(--primary)]"
          />
        </div>
      </div>

      <div className="space-y-2.5 border-t border-[var(--line)] pt-3">
        <label className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider block">
          {icon === 'megaphone' ? 'Itens de Aviso / Alinhamento' : 'Itens de Dica'} (Suporta Markdown **negrito**, listas e quebras de linha)
        </label>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-2">
          <textarea
            rows={2}
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                addItem();
              }
            }}
            placeholder={icon === 'megaphone' ? 'Digite um novo aviso (Ctrl+Enter para salvar)...' : 'Digite uma nova dica (Ctrl+Enter para salvar)...'}
            className="flex-1 p-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl font-bold text-xs text-[var(--ink)] focus:border-[var(--primary)] resize-y"
          />
          <button
            onClick={addItem}
            className="px-4 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar</span>
          </button>
        </div>

        <div className="space-y-1.5">
          {(config.items || []).map((item, idx) => {
            const isEditing = editingIndex === idx;

            if (isEditing) {
              return (
                <div
                  key={idx}
                  className="p-2.5 bg-[var(--primary-soft)] border border-[var(--primary)] rounded-xl space-y-2 text-xs"
                >
                  <div className="flex items-center gap-1 text-[10px] font-black uppercase text-[var(--primary)]">
                    <Pencil className="w-3 h-3" />
                    <span>Editando item #{idx + 1}</span>
                  </div>
                  <textarea
                    rows={2}
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        saveEditItem(idx);
                      } else if (e.key === 'Escape') {
                        cancelEditItem();
                      }
                    }}
                    className="w-full p-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg font-bold text-xs text-[var(--ink)] focus:border-[var(--primary)]"
                    autoFocus
                  />
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={cancelEditItem}
                      className="px-2.5 py-1 text-[10px] font-bold rounded-lg border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] bg-[var(--bg)] cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => saveEditItem(idx)}
                      className="px-3 py-1 text-[10px] font-black rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <Check className="w-3 h-3" />
                      <span>Salvar</span>
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={idx}
                className="flex items-start justify-between p-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-xs font-bold text-[var(--ink)] gap-2 group hover:border-[var(--line-strong)]"
              >
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <span
                    className="w-5 h-5 rounded-md text-white font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5"
                    style={{ backgroundColor: config.accent || '#f59e0b' }}
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <MarkdownContent content={item} sizeClass="text-xs" />
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => startEditItem(idx, item)}
                    className="p-1.5 text-[var(--muted)] hover:text-[var(--primary)] hover:bg-[var(--primary-soft)] rounded-lg cursor-pointer transition-colors"
                    title="Editar item"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onChange({ items: (config.items || []).filter((_, i) => i !== idx) })}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer transition-colors"
                    title="Excluir item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
          {(config.items || []).length === 0 && (
            <p className="text-[11px] text-[var(--muted)] font-medium">
              Nenhum item ainda. Adicione {icon === 'megaphone' ? 'avisos' : 'dicas'} para exibir neste slide.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2 border-t border-[var(--line)] pt-3">
        <label className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider block flex items-center gap-1.5">
          <PaintBucket className="w-3.5 h-3.5 text-[var(--primary)]" />
          <span>Cor de Destaque ({accentLabel})</span>
        </label>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="color"
            value={config.accent || '#f59e0b'}
            onChange={(e) => onChange({ accent: e.target.value })}
            className="w-10 h-9 rounded-xl border border-[var(--line)] bg-transparent cursor-pointer"
          />
          {ACCENT_PRESETS.map((c) => (
            <button
              key={c}
              onClick={() => onChange({ accent: c })}
              className="w-7 h-7 rounded-lg border border-white/30 cursor-pointer transition-transform hover:scale-110"
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-[11px] font-bold text-[var(--ink)] cursor-pointer hover:bg-[var(--primary-soft)] transition-colors">
            <Upload className="w-3.5 h-3.5 text-[var(--primary)]" />
            <span>Imagem de Fundo (URL)</span>
            <input
              type="text"
              value={config.bgUrl || ''}
              onChange={(e) => onChange({ bgUrl: e.target.value })}
              className="flex-1 min-w-0 bg-transparent outline-none font-bold text-xs text-[var(--ink)]"
              placeholder="https://..."
            />
          </label>
          {config.bgUrl && (
            <button
              onClick={() => onChange({ bgUrl: '' })}
              className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-xl cursor-pointer"
              title="Remover imagem de fundo"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider">Cor de Fundo:</span>
          <input
            type="color"
            value={config.bgColor || '#0f172a'}
            onChange={(e) => onChange({ bgColor: e.target.value })}
            className="w-9 h-8 rounded-lg border border-[var(--line)] bg-transparent cursor-pointer"
          />
        </div>
      </div>

      <div className="border-t border-[var(--line)] pt-3">
        <SlideTemplatePicker
          templates={templates}
          activeUrl={config.bgUrl}
          activeColor={config.bgColor}
          onApply={(tpl) => onChange({ bgUrl: tpl.bgUrl, bgColor: tpl.bgColor, accent: tpl.accent })}
        />
      </div>

      <SlideTypographyControls value={typography} onChange={onTypographyChange} />
    </div>
  );
};
