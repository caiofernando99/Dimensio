import React, { useState } from 'react';
import { Info, Copy, Check, ExternalLink, ArrowUpRight, Plus, Sparkles, Pin } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface InfoHubWidgetProps {
  onOpenFull?: () => void;
  className?: string;
}

export const InfoHubWidget: React.FC<InfoHubWidgetProps> = ({ onOpenFull, className = '' }) => {
  const { state, addInfoHubReminder, showNotice } = useApp();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isAddingReminder, setIsAddingReminder] = useState(false);
  const [newReminderText, setNewReminderText] = useState('');

  const reminders = (state.infoHubReminders || []).slice(0, 3);
  const quickFills = (state.infoHubQuickFills || []).slice(0, 4);
  const links = (state.infoHubLinks || []).slice(0, 3);

  const handleCopy = (text: string, id: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      showNotice(`Copiado: "${text}"`);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showNotice('Não foi possível copiar automaticamente.');
    }
  };

  const handleCreateReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReminderText.trim()) return;
    addInfoHubReminder({
      text: newReminderText.trim(),
      shift: 'Todos',
      priority: 'normal',
      authorName: 'Líder / Gestor',
    });
    setNewReminderText('');
    setIsAddingReminder(false);
  };

  return (
    <div
      id="widget-info-hub"
      className={`bg-[var(--paper)] border border-[var(--line)] rounded-xl p-4 shadow-[var(--shadow-card)] flex flex-col justify-between transition-all hover:border-[var(--primary-border)] ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Info className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black uppercase tracking-wider text-[var(--muted)] truncate">Widget de Apoio</div>
            <div className="text-sm font-bold text-[var(--ink)] truncate">Hub de Informações</div>
          </div>
        </div>

        {onOpenFull && (
          <button
            type="button"
            onClick={onOpenFull}
            className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--primary)] hover:bg-[var(--line)]/50 transition-colors"
            title="Abrir Hub de Informações Completo"
          >
            <ArrowUpRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Reminders / Pinned Notes */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-[11px] font-bold text-[var(--muted)] mb-1.5">
          <span className="flex items-center gap-1"><Pin className="w-3 h-3 text-amber-500" /> Avisos & Lembretes</span>
          <button
            type="button"
            onClick={() => setIsAddingReminder(!isAddingReminder)}
            className="text-[10.5px] text-[var(--primary)] hover:underline flex items-center gap-0.5 cursor-pointer font-bold"
          >
            <Plus className="w-3 h-3" /> Adicionar
          </button>
        </div>

        {isAddingReminder && (
          <form onSubmit={handleCreateReminder} className="mb-2 flex gap-1.5">
            <input
              type="text"
              value={newReminderText}
              onChange={(e) => setNewReminderText(e.target.value)}
              placeholder="Digite o lembrete rápido..."
              className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
              autoFocus
            />
            <button
              type="submit"
              className="px-2.5 py-1 text-xs bg-[var(--primary)] text-white rounded-lg font-bold hover:opacity-90"
            >
              Salvar
            </button>
          </form>
        )}

        {reminders.length > 0 ? (
          <div className="space-y-1.5">
            {reminders.map((r) => (
              <div
                key={r.id}
                className="text-xs p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[var(--ink)] flex items-start justify-between gap-2"
              >
                <p className="line-clamp-2 leading-relaxed flex-1">{r.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-[var(--muted)] italic p-2 bg-[var(--bg)] rounded-xl border border-[var(--line)] text-center">
            Nenhum lembrete fixado no momento.
          </div>
        )}
      </div>

      {/* Quick Fills / Preenchimento Rápido */}
      {quickFills.length > 0 && (
        <div className="border-t border-[var(--line)] pt-2.5">
          <div className="text-[10.5px] font-bold text-[var(--muted)] mb-1.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-blue-500" />
            <span>Códigos & Cópias Rápidas</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {quickFills.flatMap((q) => {
              if (q.items && q.items.length > 0) {
                return q.items.slice(0, 2).map((item) => ({
                  id: item.id,
                  label: item.label,
                  codeValue: item.codeValue,
                }));
              }
              return [{
                id: q.id,
                label: q.title,
                codeValue: q.codeValue || '',
              }];
            }).map((q) => {
              const isCopied = copiedId === q.id;
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => handleCopy(q.codeValue, q.id)}
                  className="flex items-center justify-between gap-1 p-1.5 rounded-lg bg-[var(--bg)] border border-[var(--line)] hover:border-[var(--primary)] transition-all text-left cursor-pointer group"
                  title={`Clique para copiar: ${q.codeValue}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold text-[var(--ink)] truncate">{q.label}</div>
                    <div className="text-[9.5px] text-[var(--muted)] font-mono truncate">{q.codeValue}</div>
                  </div>
                  {isCopied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-[var(--muted)] group-hover:text-[var(--primary)] shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Links */}
      {links.length > 0 && (
        <div className="border-t border-[var(--line)] pt-2 mt-2">
          <div className="flex items-center gap-2 flex-wrap">
            {links.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--primary)] hover:underline bg-[var(--bg)] px-2 py-0.5 rounded-md border border-[var(--line)]"
              >
                <span>{link.title}</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
