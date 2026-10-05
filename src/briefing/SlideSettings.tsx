import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { BriefSlide, BriefSlideData } from './types';
import { BRIEF_SECTIONS } from './types';
import { Field, Input, Textarea, Select, Toggle, Button } from '../components/ui';
import { compressImageDataUrl } from '../utils/helpers';
import { detectEmbedProvider, providerLabel } from './embed';

const BG_PRESETS = [
  'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80',
];

/** Editor de lista simples (perguntas, avisos). */
const ListEditor: React.FC<{ items: string[]; placeholder: string; onChange: (items: string[]) => void }> = ({
  items,
  placeholder,
  onChange,
}) => {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft('');
  };
  return (
    <div className="space-y-1.5">
      {(items || []).map((item, i) => (
        <div key={i} className="flex items-start gap-1.5 p-2 rounded-lg bg-[var(--surface-2)] border border-[var(--line)]">
          <span className="text-[10px] font-black text-[var(--muted)] mt-0.5">{i + 1}</span>
          <span className="flex-1 text-xs font-semibold text-[var(--ink)] whitespace-pre-line">{item}</span>
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-[var(--muted)] hover:text-rose-500 text-sm leading-none cursor-pointer" title="Remover">
            ×
          </button>
        </div>
      ))}
      <div className="flex gap-1.5">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder={placeholder} className="!text-xs" />
        <Button size="sm" variant="outline" onClick={add}>Add</Button>
      </div>
    </div>
  );
};

interface SlideSettingsProps {
  slide: BriefSlide;
  onTitle: (title: string) => void;
  onData: (data: Partial<BriefSlideData>) => void;
  onTheme: (theme: Partial<BriefSlide['theme']>) => void;
  onToggleSection: (sectionId: string) => void;
}

/** Painel direito: só o que faz sentido para o tipo atual, em linguagem simples. */
export const SlideSettings: React.FC<SlideSettingsProps> = ({ slide, onTitle, onData, onTheme, onToggleSection }) => {
  const { state } = useApp();
  const d = slide.data;
  const sections = BRIEF_SECTIONS[slide.kind];

  const bgUpload = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      onTheme({ bgImage: await compressImageDataUrl(dataUrl, 1200, 0.75) });
    } catch {
      // ignora
    }
  };

  return (
    <div className="space-y-4">
      <Field label="Nome do slide (só para organizar)">
        <Input value={slide.title} onChange={(e) => onTitle(e.target.value)} className="!text-xs" />
      </Field>

      {/* ---------- CONTEÚDO POR TIPO ---------- */}
      {slide.kind === 'cover' && (
        <div className="space-y-2.5">
          <Field label="Etiqueta de cima"><Input value={d.kicker || ''} onChange={(e) => onData({ kicker: e.target.value })} placeholder="Briefing operacional" className="!text-xs" /></Field>
          <Field label="Título grande"><Input value={d.title || ''} onChange={(e) => onData({ title: e.target.value })} placeholder="Ex: Turno da noite" className="!text-xs" /></Field>
          <Field label="Equipe"><Input value={d.team || ''} onChange={(e) => onData({ team: e.target.value })} placeholder={`${state.teamName || 'Equipe'}`} className="!text-xs" /></Field>
          <Field label="Setor / turno"><Input value={d.sectorShift || ''} onChange={(e) => onData({ sectorShift: e.target.value })} placeholder={`${state.sector || 'Operação'} • ${state.teamShift || ''}`} className="!text-xs" /></Field>
          <Field label="Frase do dia"><Input value={d.quote || ''} onChange={(e) => onData({ quote: e.target.value })} placeholder="Ex: Segurança em primeiro lugar" className="!text-xs" /></Field>
          <Toggle checked={d.showQuote !== false} onChange={(v) => onData({ showQuote: v })} label="Mostrar frase do dia" />
          <Field label="Rodapé extra"><Input value={d.footerNote || ''} onChange={(e) => onData({ footerNote: e.target.value })} placeholder="Opcional" className="!text-xs" /></Field>
          <Toggle checked={d.showStats !== false} onChange={(v) => onData({ showStats: v })} label="Mostrar nº de presentes" />
          <Toggle checked={d.showManager !== false} onChange={(v) => onData({ showManager: v })} label="Mostrar gestor" />
        </div>
      )}

      {slide.kind === 'scale' && (
        <div className="space-y-2.5">
          <Field label="Título"><Input value={d.title || ''} onChange={(e) => onData({ title: e.target.value })} placeholder="Escala do turno" className="!text-xs" /></Field>
          <Field label="Subtítulo"><Input value={d.subtitle || ''} onChange={(e) => onData({ subtitle: e.target.value })} placeholder="Opcional" className="!text-xs" /></Field>
          <Field label="Rodapé"><Input value={d.footer || ''} onChange={(e) => onData({ footer: e.target.value })} placeholder="Opcional" className="!text-xs" /></Field>
          <Toggle checked={d.showIntervals !== false} onChange={(v) => onData({ showIntervals: v })} label="Mostrar intervalos ao lado do nome" />
          <Field label="Densidade">
            <Select value={d.density || 'comfortable'} onChange={(e) => onData({ density: e.target.value as 'comfortable' | 'compact' })}>
              <option value="comfortable">Confortável (até 6 postos grandes)</option>
              <option value="compact">Compacta (até 9 postos)</option>
            </Select>
          </Field>
          <p className="text-[11px] text-[var(--muted)] font-medium">Os postos e pessoas vêm da tela Dimensionamento, do dia selecionado.</p>
        </div>
      )}

      {slide.kind === 'embed' && (
        <div className="space-y-2.5">
          <Field label="Título"><Input value={d.label || ''} onChange={(e) => onData({ label: e.target.value })} placeholder="Documento da operação" className="!text-xs" /></Field>
          <Field label="Link (PDF, Drive ou Google Apresentações)">
            <Input value={d.url || ''} onChange={(e) => onData({ url: e.target.value })} placeholder="Cole o link de compartilhamento" className="!text-xs" />
          </Field>
          {d.url && <p className="text-[11px] font-bold text-emerald-600">✓ Detectado: {providerLabel(detectEmbedProvider(d.url))} — só o link fica salvo.</p>}
          <Field label="Página / slide inicial"><Input type="number" min={1} value={d.page || 1} onChange={(e) => onData({ page: Math.max(1, Number(e.target.value) || 1) })} className="!text-xs" /></Field>
          <Field label="Anotação (opcional)"><Textarea value={d.notes || ''} onChange={(e) => onData({ notes: e.target.value })} rows={2} placeholder="Ex: revisar a página 3 com a equipe" /></Field>
        </div>
      )}

      {slide.kind === 'process' && (
        <div className="space-y-2.5">
          <Field label="Cartão em destaque">
            <Select value={d.cardId || ''} onChange={(e) => onData({ cardId: e.target.value || undefined })}>
              <option value="">Automático (primeiro da base)</option>
              {(state.processKnowledgeList || []).map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </Select>
          </Field>
          <p className="text-[11px] text-[var(--muted)] font-medium">Os cartões são gerenciados na base de conhecimento de processo.</p>
        </div>
      )}

      {slide.kind === 'qa' && (
        <div className="space-y-2.5">
          <Field label="Título"><Input value={d.title || ''} onChange={(e) => onData({ title: e.target.value })} placeholder="Perguntas & dúvidas" className="!text-xs" /></Field>
          <Field label="Subtítulo"><Input value={d.subtitle || ''} onChange={(e) => onData({ subtitle: e.target.value })} placeholder="Opcional" className="!text-xs" /></Field>
          <Field label="Descrição"><Textarea value={d.description || ''} onChange={(e) => onData({ description: e.target.value })} rows={2} /></Field>
          <Field label="Perguntas"><ListEditor items={d.questions || []} placeholder="Ex: Alguma dúvida sobre a meta de hoje?" onChange={(questions) => onData({ questions })} /></Field>
          <Field label="Mensagem final"><Input value={d.closing || ''} onChange={(e) => onData({ closing: e.target.value })} placeholder="Ex: Bom turno!" className="!text-xs" /></Field>
        </div>
      )}

      {slide.kind === 'notice' && (
        <div className="space-y-2.5">
          <Field label="Título"><Input value={d.title || ''} onChange={(e) => onData({ title: e.target.value })} placeholder="Avisos do turno" className="!text-xs" /></Field>
          <Field label="Recados (vale **negrito**)"><ListEditor items={d.items || []} placeholder="Ex: **Atenção** à doca 4 hoje" onChange={(items) => onData({ items })} /></Field>
        </div>
      )}

      {slide.kind === 'blank' && (
        <p className="text-[11px] text-[var(--muted)] font-medium">Monte este slide com texto, imagens e formas na área de edição. O fundo pode ser ajustado abaixo.</p>
      )}

      {/* ---------- O QUE MOSTRAR ---------- */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-black uppercase tracking-wider text-[var(--muted)]">O que mostrar</div>
        {sections.map((s) => {
          const hidden = slide.hiddenSections.includes(s.id);
          return <Toggle key={s.id} checked={!hidden} onChange={() => onToggleSection(s.id)} label={s.label} />;
        })}
      </div>

      {/* ---------- APARÊNCIA ---------- */}
      <div className="space-y-2.5">
        <div className="text-[11px] font-black uppercase tracking-wider text-[var(--muted)]">Aparência</div>
        <div className="flex items-center gap-2">
          <Field label="Fundo">
            <input type="color" value={slide.theme.bg} onChange={(e) => onTheme({ bg: e.target.value })} className="w-10 h-8 rounded cursor-pointer bg-transparent border-0" />
          </Field>
          <Field label="Destaque">
            <input type="color" value={slide.theme.accent} onChange={(e) => onTheme({ accent: e.target.value })} className="w-10 h-8 rounded cursor-pointer bg-transparent border-0" />
          </Field>
          {slide.theme.bgImage && (
            <Button size="sm" variant="outline" onClick={() => onTheme({ bgImage: undefined })}>Tirar foto</Button>
          )}
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {BG_PRESETS.map((url) => (
            <button
              key={url}
              onClick={() => onTheme({ bgImage: slide.theme.bgImage === url ? undefined : url })}
              className={`h-10 rounded-lg bg-cover bg-center border-2 cursor-pointer ${slide.theme.bgImage === url ? 'border-[var(--primary)]' : 'border-transparent'}`}
              style={{ backgroundImage: `url(${url})` }}
              title="Foto de fundo"
            />
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--muted)] cursor-pointer">
          <Upload className="w-3.5 h-3.5" /> ou envie uma foto
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const dataUrl = await new Promise<string>((resolve, reject) => {
                  const r = new FileReader();
                  r.onload = () => resolve(r.result as string);
                  r.onerror = reject;
                  r.readAsDataURL(f);
                });
                onTheme({ bgImage: await compressImageDataUrl(dataUrl, 1200, 0.75) });
              } catch {
                // ignora
              }
              e.target.value = '';
            }}
          />
        </label>
      </div>
    </div>
  );
};
