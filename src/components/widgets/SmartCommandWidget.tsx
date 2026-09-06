import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Terminal, Send, CheckCircle2, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { parseSmartSearchAction } from '../../utils/smartSearchEngine';

interface SmartCommandWidgetProps {
  onOpenGlobalSearch?: () => void;
}

export const SmartCommandWidget: React.FC<SmartCommandWidgetProps> = ({ onOpenGlobalSearch }) => {
  const appContext = useApp();
  const { state, identifiedUser, showNotice } = appContext;
  const [query, setQuery] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);

  const parsedAction = parseSmartSearchAction(query, { state, identifiedUser });

  const handleRunCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedAction) return;

    setIsExecuting(true);
    try {
      const result = parsedAction.execute(appContext);
      if (result.success) {
        showNotice(result.message);
        setQuery('');
      } else {
        showNotice(result.message || 'Não foi possível concluir a ação inteligente.');
      }
    } catch (err: any) {
      showNotice(`Erro: ${err?.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="bg-[var(--paper)] border border-[var(--line)] rounded-2xl p-4 flex flex-col justify-between h-full shadow-xs hover:border-[var(--primary)]/30 transition-all">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[var(--ink)]">Busca & Comando Inteligente</h3>
              <p className="text-[10px] text-[var(--muted)]">Ações em linguagem natural</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenGlobalSearch}
            className="text-[10px] font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400 flex items-center gap-0.5 cursor-pointer"
          >
            Expandir <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Input */}
        <form onSubmit={handleRunCommand} className="relative mb-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Ex: /tarefa: feedback com Lucas 16/09'
            className="w-full pl-3 pr-8 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-xs text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none focus:border-purple-500"
          />
          {query && (
            <button
              type="submit"
              disabled={!parsedAction || isExecuting}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-lg bg-purple-600 text-white disabled:opacity-30 cursor-pointer"
            >
              <Send className="w-3 h-3" />
            </button>
          )}
        </form>

        {/* Action Preview */}
        <AnimatePresence>
          {parsedAction ? (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs"
            >
              <div className="flex items-center gap-1.5 font-bold text-purple-800 dark:text-purple-200 text-[11px] mb-1">
                <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                <span className="truncate">{parsedAction.title}</span>
              </div>
              <p className="text-[10px] text-[var(--muted)] line-clamp-2">{parsedAction.description}</p>

              <button
                type="button"
                onClick={handleRunCommand}
                disabled={isExecuting}
                className="mt-2 w-full py-1 px-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
              >
                <CheckCircle2 className="w-3 h-3" /> Executar Comando Agora
              </button>
            </motion.div>
          ) : (
            <div className="p-2 rounded-xl bg-[var(--bg)] border border-[var(--line)] text-center text-[10px] text-[var(--muted)]">
              Digite comandos contextuais como <code className="font-mono text-purple-600 dark:text-purple-400">/alocar</code>, <code className="font-mono text-purple-600 dark:text-purple-400">/intervalo</code> ou <code className="font-mono text-purple-600 dark:text-purple-400">/tarefa</code>.
            </div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-3 pt-2.5 border-t border-[var(--line)] flex items-center justify-between text-[10px] text-[var(--muted)]">
        <span>Atalho global: <kbd className="px-1 py-0.5 rounded bg-[var(--bg)] font-mono text-[9px]">Ctrl+K</kbd></span>
        <span className="font-semibold text-purple-600 dark:text-purple-400">Smart Engine v2.0</span>
      </div>
    </div>
  );
};
