import React from 'react';
import { Type, RotateCcw } from 'lucide-react';
import { SlideTypography } from '../types';

const FONT_OPTIONS = [
  { label: 'Padrão do Sistema', value: '' },
  { label: 'Inter', value: "'Inter', system-ui, sans-serif" },
  { label: 'Poppins', value: "'Poppins', system-ui, sans-serif" },
  { label: 'Montserrat', value: "'Montserrat', system-ui, sans-serif" },
  { label: 'Open Sans', value: "'Open Sans', system-ui, sans-serif" },
  { label: 'Space Grotesk', value: "'Space Grotesk', system-ui, sans-serif" },
  { label: 'Roboto', value: "'Roboto', system-ui, sans-serif" },
  { label: 'Lato', value: "'Lato', system-ui, sans-serif" },
  { label: 'Merriweather (Serif)', value: "'Merriweather', Georgia, serif" },
  { label: 'Playfair Display (Serif)', value: "'Playfair Display', Georgia, serif" },
];

interface SlideTypographyControlsProps {
  value: SlideTypography;
  onChange: (patch: Partial<SlideTypography>) => void;
}

export const SlideTypographyControls: React.FC<SlideTypographyControlsProps> = ({ value, onChange }) => {
  const hasCustom =
    !!value.fontFamily || value.titleSize != null || value.bodySize != null || value.footerSize != null;

  const sizeSlider = (
    label: string,
    field: 'titleSize' | 'bodySize' | 'footerSize',
    min: number,
    max: number,
    fallback: number
  ) => (
    <div>
      <label className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider flex items-center justify-between mb-1">
        <span>{label}</span>
        <span className="text-[var(--primary)]">{value[field] ?? fallback}px</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        value={value[field] ?? fallback}
        onChange={(e) => onChange({ [field]: Number(e.target.value) })}
        className="w-full accent-[var(--primary)] cursor-pointer"
      />
    </div>
  );

  return (
    <div className="space-y-3 border-t border-[var(--line)] pt-3">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-black uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5">
          <Type className="w-3.5 h-3.5 text-[var(--primary)]" />
          <span>Tipografia do Slide (Fonte & Tamanhos)</span>
        </label>
        {hasCustom && (
          <button
            onClick={() => onChange({ fontFamily: '', titleSize: undefined, bodySize: undefined, footerSize: undefined })}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-900 text-[10px] font-black cursor-pointer hover:bg-rose-100 transition-colors"
            title="Restaurar fonte e tamanhos padrão deste slide"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Padrão</span>
          </button>
        )}
      </div>

      <div>
        <label className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider block mb-1">
          Família de Fonte
        </label>
        <select
          value={value.fontFamily || ''}
          onChange={(e) => onChange({ fontFamily: e.target.value })}
          className="w-full p-2 bg-[var(--bg)] border border-[var(--line)] rounded-xl font-bold text-xs text-[var(--ink)] cursor-pointer focus:border-[var(--primary)]"
          style={value.fontFamily ? { fontFamily: value.fontFamily } : undefined}
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f.label} value={f.value} style={f.value ? { fontFamily: f.value } : undefined}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        {sizeSlider('Tamanho do Título', 'titleSize', 14, 42, 20)}
        {sizeSlider('Tamanho do Corpo', 'bodySize', 10, 28, 12)}
        {sizeSlider('Tamanho do Rodapé', 'footerSize', 8, 20, 10)}
      </div>
    </div>
  );
};
