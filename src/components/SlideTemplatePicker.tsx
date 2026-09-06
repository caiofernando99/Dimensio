import React from 'react';
import { LayoutTemplate, Check } from 'lucide-react';

export interface SlideTemplate {
  id: string;
  name: string;
  bgUrl: string;
  bgColor: string;
  accent: string;
}

interface SlideTemplatePickerProps {
  templates: SlideTemplate[];
  activeUrl?: string;
  activeColor?: string;
  onApply: (tpl: SlideTemplate) => void;
}

export const SlideTemplatePicker: React.FC<SlideTemplatePickerProps> = ({
  templates,
  activeUrl,
  activeColor,
  onApply,
}) => {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider block flex items-center gap-1.5">
        <LayoutTemplate className="w-3.5 h-3.5 text-[var(--primary)]" />
        <span>Modelos Prontos (Templates)</span>
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {templates.map((tpl) => {
          const isActive = (activeUrl && tpl.bgUrl === activeUrl) || (!activeUrl && activeColor === tpl.bgColor);
          return (
            <button
              key={tpl.id}
              onClick={() => onApply(tpl)}
              className={`relative rounded-xl overflow-hidden border-2 h-16 cursor-pointer transition-all hover:scale-[1.03] group ${
                isActive
                  ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/40 shadow-md'
                  : 'border-[var(--line)] hover:border-[var(--primary-border)]'
              }`}
              title={`Aplicar template "${tpl.name}"`}
            >
              <img src={tpl.bgUrl} alt={tpl.name} className="w-full h-full object-cover" />
              <div
                className="absolute inset-0 bg-black/45 flex items-center justify-center"
                style={{ boxShadow: `inset 0 0 0 3px ${tpl.accent}` }}
              />
              {isActive && (
                <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md">
                  <Check className="w-3 h-3" />
                </span>
              )}
              <span
                className="absolute inset-x-0 bottom-0 px-1.5 py-1 text-[9px] font-black text-white text-center leading-tight"
                style={{ backgroundColor: tpl.accent }}
              >
                {tpl.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
