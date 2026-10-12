import React, { useState, useEffect, useRef } from 'react';
import { SupportTypeField, ActionLinkVar } from '../../types';
import {
  ACTION_LINK_SOURCES,
  slugifyActionLinkKey,
  extractActionLinkTokens,
} from '../../utils/supportActionLink';
import { formatSupportFieldValue } from '../../utils/fieldFormat';
import {
  Plus,
  Trash2,
  ExternalLink,
  Link as LinkIcon,
  Check,
  RotateCcw,
  FileText,
  CheckSquare,
  Info,
  Layers,
  Briefcase,
  Clock,
  Sparkles,
  X,
} from 'lucide-react';

export const SupportTypeFieldsEditor: React.FC<{
  fields: SupportTypeField[];
  onChange: (fields: SupportTypeField[]) => void;
}> = ({ fields, onChange }) => {
  const updateField = (idx: number, patch: Partial<SupportTypeField>) => {
    onChange(fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };
  const addField = () => {
    onChange([
      ...fields,
      {
        id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        label: '',
        required: false,
        uppercase: false,
      },
    ]);
  };
  const removeField = (idx: number) => onChange(fields.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--ink)]">
          Campos personalizados do chamado
        </span>
        <button
          type="button"
          onClick={addField}
          className="px-2 py-1 bg-violet-600/10 hover:bg-violet-600/20 text-violet-700 dark:text-violet-300 text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
        >
          <Plus className="w-3 h-3" />
          Adicionar campo
        </button>
      </div>
      <p className="text-[10px] text-[var(--muted)]">
        Ex.: "Código da Impressora", "Código do Produto". Cada campo vira um texto separado no formulário de suporte.
      </p>
      {fields.length === 0 && (
        <p className="text-[10px] text-[var(--muted)] italic bg-[var(--bg)] border border-[var(--line)] p-2 rounded-lg">
          Nenhum campo personalizado. O chamado usará o campo de texto simples padrão.
        </p>
      )}
      <div className="space-y-1.5">
        {fields.map((f, idx) => (
          <div key={f.id} className="bg-[var(--bg)] border border-[var(--line)] rounded-lg p-2 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={f.label}
                onChange={(e) => updateField(idx, { label: e.target.value })}
                placeholder="Rótulo do campo (ex.: Código da Impressora)"
                className="flex-1 min-w-0 px-2 py-1 text-[11px] bg-[var(--paper)] border border-[var(--line)] rounded-lg text-[var(--ink)] font-bold focus:outline-none focus:border-violet-500"
              />
              <button
                type="button"
                onClick={() => removeField(idx)}
                className="p-1.5 text-[var(--muted)] hover:text-rose-600 hover:bg-[var(--paper)] rounded-lg transition-colors cursor-pointer"
                title="Remover campo"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--muted)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={f.uppercase === true}
                  onChange={(e) => updateField(idx, { uppercase: e.target.checked })}
                  className="w-3 h-3 accent-violet-600 rounded"
                />
                Caixa alta
              </label>
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--muted)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={f.required === true}
                  onChange={(e) => updateField(idx, { required: e.target.checked })}
                  className="w-3 h-3 accent-violet-600 rounded"
                />
                Obrigatório
              </label>
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--muted)]">
                <span>Máx.</span>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={f.maxLength ?? ''}
                  onChange={(e) =>
                    updateField(idx, { maxLength: e.target.value ? Number(e.target.value) : undefined })
                  }
                  placeholder="caracteres"
                  className="w-20 px-2 py-0.5 text-[11px] bg-[var(--paper)] border border-[var(--line)] rounded-md text-[var(--ink)] font-bold focus:outline-none focus:border-violet-500"
                />
              </label>
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--muted)]">
                <span>Variável no link:</span>
                <input
                  type="text"
                  value={f.key ?? ''}
                  onChange={(e) => updateField(idx, { key: e.target.value })}
                  placeholder="ex: codigo_impressora"
                  className="w-40 px-2 py-0.5 text-[11px] bg-[var(--paper)] border border-[var(--line)] rounded-md text-[var(--ink)] font-mono font-bold focus:outline-none focus:border-violet-500"
                />
              </label>
            </div>
            {/* Formatação automática */}
            <div className="rounded-lg border border-dashed border-violet-500/30 bg-violet-500/5 p-2 space-y-1.5">
              <div className="text-[9.5px] font-extrabold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                Formatação automática (opcional)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                <label className="sm:col-span-1 block text-[9px] font-bold text-[var(--muted)]">
                  Exemplo do formato final
                  <input
                    type="text"
                    value={f.format?.example ?? ''}
                    onChange={(e) =>
                      updateField(idx, { format: { ...(f.format || {}), example: e.target.value } })
                    }
                    placeholder="ex: PS-1-104-136-02-01"
                    className="w-full mt-0.5 px-2 py-1 text-[11px] bg-[var(--paper)] border border-[var(--line)] rounded-md text-[var(--ink)] font-mono font-bold focus:outline-none focus:border-violet-500"
                  />
                </label>
                <label className="block text-[9px] font-bold text-[var(--muted)]">
                  Separadores de entrada
                  <input
                    type="text"
                    value={f.format?.inputSeparators ?? ''}
                    onChange={(e) =>
                      updateField(idx, { format: { ...(f.format || {}), inputSeparators: e.target.value } })
                    }
                    placeholder="ex:  . /  (vazio = auto)"
                    className="w-full mt-0.5 px-2 py-1 text-[11px] bg-[var(--paper)] border border-[var(--line)] rounded-md text-[var(--ink)] font-mono font-bold focus:outline-none focus:border-violet-500"
                  />
                </label>
                <label className="block text-[9px] font-bold text-[var(--muted)]">
                  Separador de saída
                  <input
                    type="text"
                    value={f.format?.outputSeparator ?? ''}
                    onChange={(e) =>
                      updateField(idx, { format: { ...(f.format || {}), outputSeparator: e.target.value } })
                    }
                    placeholder="ex: -  (vazio = do exemplo)"
                    className="w-full mt-0.5 px-2 py-1 text-[11px] bg-[var(--paper)] border border-[var(--line)] rounded-md text-[var(--ink)] font-mono font-bold focus:outline-none focus:border-violet-500"
                  />
                </label>
              </div>
              <p className="text-[9px] text-[var(--muted)]">
                Ex.: digitado <span className="font-mono font-bold">ps 1 104 136 2 1</span> vira{' '}
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {formatSupportFieldValue('ps 1 104 136 2 1', { ...f, uppercase: f.uppercase === true })}
                </span>
                {' '}ao enviar o pedido. Espaços, hífens, pontos, barras, vírgulas e sublinhados são aceitos na digitação.
              </p>
            </div>
            <p className="text-[9px] text-[var(--muted)]">
              A variável <span className="font-mono font-bold">{"{" + (f.key || f.id) + "}"}</span> poderá ser usada no
              link de ação rápida do tipo de chamado.
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

// Editor visual do link de ação rápida: cola o link, seleciona o trecho e
// vincula o trecho a um campo/valor. As substituições ficam registradas em vars.
export const SupportActionLinkEditor: React.FC<{
  value: string;
  vars: ActionLinkVar[];
  fields: SupportTypeField[];
  onValueChange: (value: string) => void;
  onVarsChange: (vars: ActionLinkVar[]) => void;
}> = ({ value, vars, fields, onValueChange, onVarsChange }) => {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const [sel, setSel] = useState<{ start: number; end: number } | null>(null);
  const [hint, setHint] = useState('');

  // Ao colar/editar o link, vincula automaticamente tokens que casam com campos ou fontes
  useEffect(() => {
    if (!value) return;
    const tokens = extractActionLinkTokens(value);
    const existing = new Set(vars.map((v) => v.token));
    const additions: ActionLinkVar[] = [];
    for (const t of tokens) {
      if (existing.has(t)) continue;
      const field = fields.find((f) => f.key === t || f.id === t);
      if (field) {
        additions.push({ token: t, source: 'field', fieldId: field.id, fieldKey: field.key, label: field.label });
        existing.add(t);
        continue;
      }
      const pre = ACTION_LINK_SOURCES.find((s) => s.value === t);
      if (pre) {
        additions.push({ token: t, source: pre.value, label: pre.label });
        existing.add(t);
      }
    }
    if (additions.length) onVarsChange([...vars, ...additions]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const bind = (source: ActionLinkVar['source'], field?: SupportTypeField) => {
    if (!sel || sel.start === sel.end) {
      setHint('Selecione um trecho do link acima e depois clique no campo/valor para substituí-lo.');
      return;
    }
    const baseToken =
      source === 'field'
        ? field?.key?.trim() || slugifyActionLinkKey(field?.label || 'campo') || field?.id || 'campo'
        : source;
    let token = baseToken;
    let n = 2;
    const taken = new Set(vars.map((v) => v.token));
    while (taken.has(token)) {
      token = `${baseToken}_${n}`;
      n++;
    }
    const label =
      source === 'field' ? field?.label : ACTION_LINK_SOURCES.find((s) => s.value === source)?.label;
    onValueChange(value.slice(0, sel.start) + `{${token}}` + value.slice(sel.end));
    onVarsChange([
      ...vars,
      { token, source, fieldId: field?.id, fieldKey: field?.key, label },
    ]);
    setSel(null);
    setHint('');
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (ta) {
        ta.focus();
        const pos = sel.start + token.length + 2;
        ta.setSelectionRange(pos, pos);
      }
    });
  };

  const unlink = (token: string) => {
    onVarsChange(vars.filter((v) => v.token !== token));
  };

  // Renderiza o link com os tokens destacados e vinculações coloridas
  const renderPreview = () => {
    const parts: React.ReactNode[] = [];
    const regex = /\{([a-zA-Z0-9_]+)\}/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let i = 0;
    while ((m = regex.exec(value)) !== null) {
      if (m.index > last) parts.push(<span key={`t${i++}`}>{value.slice(last, m.index)}</span>);
      const token = m[1];
      const v = vars.find((x) => x.token === token);
      parts.push(
        <mark
          key={`v${i++}`}
          className={`px-1 rounded font-mono font-bold text-[10px] border ${
            v
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30'
          }`}
        >
          {"{"}
          {token}
          {"}"}
          {v && (
            <span className="ml-1 not-italic font-sans font-extrabold">
              → {v.label || v.source}
            </span>
          )}
          {!v && <span className="ml-1 not-italic font-sans font-extrabold">→ sem vínculo</span>}
        </mark>
      );
      last = m.index + m[0].length;
    }
    if (last < value.length) parts.push(<span key={`t${i++}`}>{value.slice(last)}</span>);
    return parts;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <LinkIcon className="w-3.5 h-3.5 text-[var(--muted)]" />
        <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--ink)]">
          Link de ação rápida (Copiar & Abrir)
        </span>
      </div>

      <textarea
        ref={taRef}
        rows={2}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onSelect={(e) => {
          const ta = e.currentTarget;
          setSel({ start: ta.selectionStart, end: ta.selectionEnd });
        }}
        placeholder="Cole aqui o link do sistema, ex: https://sistema.empresa.com/consulta?codigo=VALOR&operador=NOME"
        className="w-full px-2.5 py-1.5 text-[11px] bg-[var(--bg)] border border-[var(--line)] rounded-lg text-[var(--ink)] font-mono font-bold focus:outline-none focus:border-violet-500 resize-y"
      />

      <p className="text-[9.5px] text-[var(--muted)]">
        <strong>Como funciona:</strong> selecione com o mouse o trecho do link que deve ser preenchido e clique no
        campo/valor abaixo. O trecho vira uma variável colorida no link.
      </p>
      {hint && <p className="text-[9.5px] font-bold text-amber-600 dark:text-amber-400">{hint}</p>}

      {/* Fontes de valores para vincular */}
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[9px] font-bold text-[var(--muted)]">Substituir seleção por:</span>
        {fields
          .filter((f) => f.label.trim())
          .map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => bind('field', f)}
              className="px-1.5 py-0.5 rounded-md bg-violet-600/10 hover:bg-violet-600/20 text-violet-700 dark:text-violet-300 text-[9px] font-bold cursor-pointer transition-colors"
              title={`Substituir o trecho selecionado pelo campo "${f.label}"`}
            >
              {f.label}
            </button>
          ))}
        {ACTION_LINK_SOURCES.filter((s) => s.value !== 'field').map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => bind(s.value)}
            className="px-1.5 py-0.5 rounded-md bg-[var(--bg)] border border-[var(--line)] hover:border-violet-500 text-[9px] font-mono font-bold text-[var(--ink)] cursor-pointer transition-colors"
            title={`Substituir o trecho selecionado por ${s.label}`}
          >
            {"{"}
            {s.value}
            {"}"}
          </button>
        ))}
      </div>

      {/* Prévia do link com variáveis */}
      <div className="rounded-lg border border-[var(--line)] bg-[var(--bg)] p-2 text-[10.5px] font-mono text-[var(--ink)] break-all leading-relaxed">
        {value ? renderPreview() : <span className="text-[var(--muted)]">Sem link configurado.</span>}
      </div>

      {/* Lista de vinculações */}
      {vars.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[9px] font-bold text-[var(--muted)]">Vínculos:</span>
          {vars.map((v) => (
            <span
              key={v.token}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[9px] font-bold text-emerald-700 dark:text-emerald-300"
            >
              <span className="font-mono">{"{"}
                {v.token}
                {"}"}</span>
              <span>→ {v.label || v.source}</span>
              <button
                type="button"
                onClick={() => unlink(v.token)}
                className="text-[var(--muted)] hover:text-rose-600 cursor-pointer"
                title="Remover vínculo"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
