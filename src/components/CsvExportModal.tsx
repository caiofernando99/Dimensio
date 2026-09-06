import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { getCollaboratorStatus, type StatusType } from '../utils/helpers';
import { Download, X, ChevronUp, ChevronDown, Table2, SlidersHorizontal, Check, RotateCcw } from 'lucide-react';

type FieldKey =
  | 'name'
  | 'login'
  | 'registration'
  | 'role'
  | 'category'
  | 'shift'
  | 'scale'
  | 'teamLeader'
  | 'status'
  | 'task'
  | 'interval'
  | 'absenceReason'
  | 'occurrence';

interface FieldDef {
  key: FieldKey;
  label: string;
}

const ALL_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Colaborador' },
  { key: 'login', label: 'LDAP' },
  { key: 'registration', label: 'Matrícula' },
  { key: 'role', label: 'Cargo' },
  { key: 'category', label: 'Categoria' },
  { key: 'shift', label: 'Turno' },
  { key: 'scale', label: 'Escala' },
  { key: 'teamLeader', label: 'Time / TL' },
  { key: 'status', label: 'Status' },
  { key: 'task', label: 'Tarefa' },
  { key: 'interval', label: 'Intervalo' },
  { key: 'absenceReason', label: 'Motivo da Ausência / Justificativa' },
  { key: 'occurrence', label: 'Ocorrência Individual' },
];

// Colunas padrão: exatamente as exibidas no Quadro de Ocorrências do app
const DEFAULT_KEYS: FieldKey[] = ['name', 'status', 'task', 'absenceReason', 'occurrence'];

const STATUS_LABEL: Record<StatusType, string> = {
  presente: 'Presente',
  atraso: 'Atraso',
  ausente: 'Ausente',
  folga: 'Folga',
  ferias: 'Férias',
  licenca: 'Licença',
  treinamento: 'Treinamento',
  atestado: 'Atestado',
  banco_horas: 'Banco de Horas',
  falta_injustificada: 'Falta Injustificada',
};

const csvCell = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;

interface CsvExportModalProps {
  onClose: () => void;
}

export const CsvExportModal: React.FC<CsvExportModalProps> = ({ onClose }) => {
  const { state } = useApp();

  const [mode, setMode] = useState<'padrao' | 'custom'>('padrao');
  const [delimiter, setDelimiter] = useState<';' | ','>(';');

  const [cols, setCols] = useState<Array<{ key: FieldKey; enabled: boolean; label: string }>>(() =>
    ALL_FIELDS.map((f) => ({ key: f.key, enabled: DEFAULT_KEYS.includes(f.key), label: f.label }))
  );
  const [rowLabels, setRowLabels] = useState<Record<string, string>>({});
  const [rowOrder, setRowOrder] = useState<string[]>(() => state.collaborators.map((c) => c.id));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const activeDate = state.selectedDate;
  const dayIntervals = state.intervals[activeDate] || {};

  const statusInfoMap = useMemo(
    () =>
      new Map(
        state.collaborators.map((c) => [
          c.id,
          { ...getCollaboratorStatus(c, activeDate, state) },
        ])
      ),
    [state, activeDate]
  );

  const fieldValue = (c: (typeof state.collaborators)[number], key: FieldKey, customName?: string): string => {
    switch (key) {
      case 'name':
        return customName || c.name || '';
      case 'login':
        return c.login || '';
      case 'registration':
        return c.registration || '';
      case 'role':
        return c.role || '';
      case 'category':
        return c.category || '';
      case 'shift':
        return c.shift || '';
      case 'scale':
        return c.scale || '';
      case 'teamLeader':
        return c.teamLeader || state.defaultTeamLeader || '';
      case 'status': {
        const info = statusInfoMap.get(c.id);
        return info ? STATUS_LABEL[info.status] || info.status : '';
      }
      case 'task':
        return state.tasks.find((t) => t.members.includes(c.id))?.name || 'Não direcionado';
      case 'interval': {
        const b = state.breaks.find((bs) => (dayIntervals[bs.id] || []).includes(c.id));
        return b?.time || 'Sem intervalo';
      }
      case 'absenceReason':
        return state.dailyReports[activeDate]?.absenceReasons?.[c.id] || '';
      case 'occurrence':
        return state.dailyReports[activeDate]?.occurrences?.[c.id] || '';
    }
  };

  const buildCsv = (colConfig: Array<{ key: FieldKey; label: string }>) => {
    const header = colConfig.map((col) => csvCell(col.label));
    const body = rowOrder.map((id) => {
      const c = state.collaborators.find((x) => x.id === id);
      if (!c) return null;
      return colConfig.map((col) => csvCell(fieldValue(c, col.key, rowLabels[id]))).join(delimiter);
    });
    return [header.join(delimiter), ...body.filter((r): r is string => Boolean(r))].join('\n');
  };

  const handleDownloadStandard = () => {
    const colConfig = ALL_FIELDS.filter((f) => DEFAULT_KEYS.includes(f.key)).map((f) => ({
      key: f.key,
      label: f.label,
    }));
    downloadCsv(buildCsv(colConfig), `relatorio-csv-${activeDate}.csv`);
  };

  const handleDownloadCustom = () => {
    const colConfig = cols.filter((c) => c.enabled).map((c) => ({ key: c.key, label: c.label }));
    downloadCsv(buildCsv(colConfig), `relatorio-custom-${activeDate}.csv`);
  };

  const downloadCsv = (content: string, filename: string) => {
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const moveItem = <T,>(arr: T[], from: number, to: number): T[] => {
    if (to < 0 || to >= arr.length) return arr;
    const copy = [...arr];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    return copy;
  };

  const moveCol = (index: number, dir: -1 | 1) =>
    setCols((prev) => {
      const enabledPositions = prev
        .map((c, j) => (c.enabled ? j : -1))
        .filter((j) => j >= 0);
      const pos = enabledPositions.indexOf(index);
      if (pos === -1) return prev;
      const target = enabledPositions[pos + dir];
      if (target === undefined) return prev;
      return moveItem(prev, index, target);
    });

  const moveRow = (index: number, dir: -1 | 1) =>
    setRowOrder((prev) => moveItem(prev, index, index + dir));

  const resetCustom = () => {
    setCols(ALL_FIELDS.map((f) => ({ key: f.key, enabled: DEFAULT_KEYS.includes(f.key), label: f.label })));
    setRowLabels({});
    setRowOrder(state.collaborators.map((c) => c.id));
  };

  const enabledCount = cols.filter((c) => c.enabled).length;

  // Preview (limitado)
  const previewCols = cols.filter((c) => c.enabled);
  const previewRows = rowOrder.slice(0, 5);
  const previewHeader = previewCols.map((col) => csvCell(col.label)).join(delimiter);
  const previewBody = previewRows
    .map((id) => {
      const c = state.collaborators.find((x) => x.id === id);
      if (!c) return null;
      return previewCols.map((col) => csvCell(fieldValue(c, col.key, rowLabels[id]))).join(delimiter);
    })
    .filter((r): r is string => Boolean(r));

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl max-h-[calc(100dvh-2rem)] overflow-y-auto bg-[var(--paper)] border border-[var(--line)] rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-[var(--line)] bg-[var(--paper)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 shrink-0 rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center border border-[var(--primary-border)]">
              <Table2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-base font-extrabold text-[var(--ink)] truncate">Exportar relatório em CSV</div>
              <div className="text-[11px] font-semibold text-[var(--muted)]">
                {state.teamName} • {new Date(activeDate + 'T12:00:00').toLocaleDateString('pt-BR')}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--bg)] transition-colors cursor-pointer"
            title="Fechar"
            tabIndex={-1}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Modo */}
          <div className="flex items-center gap-1 bg-[var(--bg)] border border-[var(--line)] p-1 rounded-xl text-xs font-bold w-fit">
            <button
              onClick={() => setMode('padrao')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                mode === 'padrao'
                  ? 'bg-[var(--paper)] text-[var(--primary)] shadow-2xs font-black'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              Padrão
            </button>
            <button
              onClick={() => setMode('custom')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                mode === 'custom'
                  ? 'bg-[var(--paper)] text-[var(--primary)] shadow-2xs font-black'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Personalizado
            </button>
          </div>

          {/* Delimitador */}
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--muted)]">
            <span>Separador:</span>
            {([';', ','] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDelimiter(d)}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-black transition-colors cursor-pointer ${
                  delimiter === d
                    ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                    : 'bg-[var(--bg)] text-[var(--muted)] border-[var(--line)] hover:text-[var(--ink)]'
                }`}
              >
                {d}
              </button>
            ))}
            <span className="text-[10px] text-[var(--muted)]">(para o Excel em pt-BR use ;)</span>
          </div>

          {mode === 'padrao' ? (
            <div className="space-y-4">
              <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-4 space-y-2">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">
                  Colunas incluídas (como exibidas no app)
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_FIELDS.filter((f) => DEFAULT_KEYS.includes(f.key)).map((f) => (
                    <span
                      key={f.key}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-[var(--paper)] border border-[var(--line)] rounded-lg text-[11px] font-extrabold text-[var(--ink)]"
                    >
                      <Check className="w-3 h-3 text-emerald-600" />
                      {f.label}
                    </span>
                  ))}
                </div>
                <p className="text-[10px] font-semibold text-[var(--muted)]">
                  Uma linha por colaborador, na ordem da equipe, com status, tarefa, justificativa e ocorrência do dia.
                </p>
              </div>
              <button
                onClick={handleDownloadStandard}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--primary)] text-white rounded-xl text-sm font-black hover:bg-[var(--primary-hover)] shadow-2xs transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Baixar CSV padrão
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Configuração de colunas */}
              <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">
                    Colunas ({enabledCount}/{cols.length}) — ative, renomeie e reordene
                  </h4>
                  <button
                    onClick={resetCustom}
                    className="px-2 py-1 text-[10px] font-black text-[var(--muted)] hover:text-[var(--ink)] border border-[var(--line)] rounded-lg bg-[var(--paper)] transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Restaurar padrão
                  </button>
                </div>
                <div className="space-y-1.5">
                  {cols.map((col, i) => (
                    <div
                      key={col.key}
                      className={`flex items-center gap-2 p-1.5 rounded-lg border transition-colors ${
                        col.enabled
                          ? 'border-[var(--primary-border)] bg-[var(--paper)]'
                          : 'border-[var(--line)] bg-[var(--bg)] opacity-70'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={col.enabled}
                        onChange={() => setCols((prev) => prev.map((c, j) => (j === i ? { ...c, enabled: !c.enabled } : c)))}
                        className="w-4 h-4 accent-[var(--primary)] cursor-pointer shrink-0"
                      />
                      <input
                        type="text"
                        value={col.label}
                        disabled={!col.enabled}
                        onChange={(e) => setCols((prev) => prev.map((c, j) => (j === i ? { ...c, label: e.target.value } : c)))}
                        className="flex-1 min-w-0 px-2 py-1 bg-[var(--bg)] border border-[var(--line)] rounded-md text-xs font-bold text-[var(--ink)] disabled:opacity-50 focus:outline-none focus:border-[var(--primary)]"
                      />
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => moveCol(i, -1)}
                          disabled={i === 0}
                          className="p-1 rounded-md text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--bg)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                          title="Mover para cima"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => moveCol(i, 1)}
                          disabled={i === cols.length - 1}
                          className="p-1 rounded-md text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--bg)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                          title="Mover para baixo"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Configuração de linhas */}
              <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-4 space-y-2.5">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">
                  Linhas ({rowOrder.length}) — renomeie o rótulo e reordene
                </h4>
                <div className="space-y-1.5">
                  {rowOrder.map((id, i) => {
                    const c = state.collaborators.find((x) => x.id === id);
                    if (!c) return null;
                    return (
                      <div key={id} className="flex items-center gap-2 p-1.5 rounded-lg border border-[var(--line)] bg-[var(--paper)]">
                        <span className="text-[10px] font-black text-[var(--muted)] w-6 text-right shrink-0">{i + 1}</span>
                        <input
                          type="text"
                          value={rowLabels[id] ?? c.name}
                          placeholder={c.name}
                          onChange={(e) =>
                            setRowLabels((prev) => ({ ...prev, [id]: e.target.value }))
                          }
                          className="flex-1 min-w-0 px-2 py-1 bg-[var(--bg)] border border-[var(--line)] rounded-md text-xs font-bold text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
                        />
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            onClick={() => moveRow(i, -1)}
                            disabled={i === 0}
                            className="p-1 rounded-md text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--bg)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            title="Mover para cima"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => moveRow(i, 1)}
                            disabled={i === rowOrder.length - 1}
                            className="p-1 rounded-md text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--bg)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            title="Mover para baixo"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Preview */}
              <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-4 space-y-2">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">
                  Prévia ({enabledCount} colunas, mostrando até 5 linhas)
                </h4>
                <div className="overflow-x-auto">
                  <pre className="text-[10px] font-mono text-[var(--ink)] bg-[var(--paper)] border border-[var(--line)] rounded-lg p-2.5 whitespace-pre min-w-max">
                    {previewHeader}
                    {'\n'}
                    {previewBody.join('\n')}
                  </pre>
                </div>
              </div>

              <button
                onClick={handleDownloadCustom}
                disabled={enabledCount === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--primary)] text-white rounded-xl text-sm font-black hover:bg-[var(--primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Baixar CSV personalizado
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
