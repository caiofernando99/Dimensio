import React from 'react';
import { createPortal } from 'react-dom';
import { Collaborator } from '../../types';
import { Megaphone, X, Send } from 'lucide-react';

interface GlobalSearchBatchRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMultiIds: string[];
  collaborators: Collaborator[];
  batchReqType: 'acao_sistemica' | 'aviso';
  setBatchReqType: (val: 'acao_sistemica' | 'aviso') => void;
  batchReqPriority: 'baixa' | 'media' | 'alta' | 'urgente';
  setBatchReqPriority: (val: 'baixa' | 'media' | 'alta' | 'urgente') => void;
  batchReqAudience: 'todos' | 'atual' | 'proximo' | 'proximos';
  setBatchReqAudience: (val: 'todos' | 'atual' | 'proximo' | 'proximos') => void;
  batchReqTitle: string;
  setBatchReqTitle: (val: string) => void;
  batchReqDescription: string;
  setBatchReqDescription: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const GlobalSearchBatchRequestModal: React.FC<GlobalSearchBatchRequestModalProps> = ({
  isOpen,
  onClose,
  selectedMultiIds,
  collaborators,
  batchReqType,
  setBatchReqType,
  batchReqPriority,
  setBatchReqPriority,
  batchReqAudience,
  setBatchReqAudience,
  batchReqTitle,
  setBatchReqTitle,
  batchReqDescription,
  setBatchReqDescription,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-[var(--paper)] border border-[var(--line)] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--bg)] px-4 py-3">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-black text-[var(--ink)]">
              Criar Pedido / Aviso em Lote ({selectedMultiIds.length})
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[var(--muted)] hover:text-[var(--ink)] rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-4 space-y-3">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-300 font-bold space-y-1">
            <div>
              Pedido com conteúdo composto por <strong>{selectedMultiIds.length} colaborador(es)</strong> selecionados.
            </div>
            <div className="text-[10.5px] opacity-90 truncate">
              {collaborators
                .filter((c) => selectedMultiIds.includes(c.id))
                .map((c) => c.name)
                .join(', ')}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="block text-[11px] font-black uppercase text-[var(--muted)] mb-1">
                Tipo do Pedido
              </label>
              <select
                value={batchReqType}
                onChange={(e) => setBatchReqType(e.target.value as any)}
                className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-lg p-2 font-bold text-[var(--ink)]"
              >
                <option value="acao_sistemica">Ação / Pedido Operacional</option>
                <option value="aviso">Aviso / Comunicado Geral</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-black uppercase text-[var(--muted)] mb-1">
                Prioridade
              </label>
              <select
                value={batchReqPriority}
                onChange={(e) => setBatchReqPriority(e.target.value as any)}
                className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-lg p-2 font-bold text-[var(--ink)]"
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média (Normal)</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-black uppercase text-[var(--muted)] mb-1">
              Público / Turno Alvo
            </label>
            <select
              value={batchReqAudience}
              onChange={(e) => setBatchReqAudience(e.target.value as any)}
              className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-lg p-2 font-bold text-[var(--ink)]"
            >
              <option value="todos">Todos os Turnos (Geral)</option>
              <option value="atual">Turno Atual</option>
              <option value="proximo">Próximo Turno</option>
              <option value="proximos">Próximos Turnos</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-black uppercase text-[var(--muted)] mb-1">
              Título do Pedido
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Treinamento obrigatório de segurança / remanejamento"
              value={batchReqTitle}
              onChange={(e) => setBatchReqTitle(e.target.value)}
              className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-lg p-2 text-xs font-bold text-[var(--ink)]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-black uppercase text-[var(--muted)] mb-1">
              Descrição e Orientações
            </label>
            <textarea
              rows={3}
              placeholder="Descreva detalhes das ações exigidas ou aviso da operação..."
              value={batchReqDescription}
              onChange={(e) => setBatchReqDescription(e.target.value)}
              className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-lg p-2 text-xs font-medium text-[var(--ink)]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--line)]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] rounded-xl text-xs font-extrabold hover:bg-[var(--line)] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Enviar Pedido ({selectedMultiIds.length})</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
