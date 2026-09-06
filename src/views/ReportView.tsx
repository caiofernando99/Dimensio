import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../context/AppContext';
import {
  Save,
  Download,
  CheckCircle2,
  BarChart3,
  Table2,
  Users,
  CalendarDays,
  Palmtree,
  Stethoscope,
  UserX,
  Shuffle,
  X,
  Gauge,
  Copy,
  ArrowUp,
  ArrowDown,
  Settings2,
  Check,
  Trash2,
  Eye,
  EyeOff,
  ClipboardList,
  Search,
  Lock,
  Layers,
  type LucideIcon,
} from 'lucide-react';
import {
  formatDateLongBR,
  getCollaboratorStatus,
  getCollaboratorAbsenteeismRate,
  isAbsenteeismStatus,
  escapeSearchTerm,
  type StatusType,
} from '../utils/helpers';
import { getConsolidatedTaskGroups } from '../utils/taskTreeHelpers';
import { CsvExportModal } from '../components/CsvExportModal';
import { ShiftClosingModal } from '../components/ShiftClosingModal';
import { ReportAttachedTaskMetrics } from '../components/ReportAttachedTaskMetrics';
import { ReportDataAnalytics } from '../components/ReportDataAnalytics';
import {
  PageHeader,
  Card,
  CardHeader,
  SectionHeader,
  Button,
  Badge,
  StatCard,
  Tabs,
  Toolbar,
  EmptyState,
  Field,
  Input,
  Textarea,
  Modal,
  type BadgeTone,
} from '../components/ui';

export const ReportView: React.FC = () => {
  const {
    state,
    setAbsenceReason,
    setOccurrence,
    setGeneralNotes,
    saveDailyReport,
    syncToOnlineSpreadsheet,
    showNotice,
    showSubtasks,
  } = useApp();

  const activeDate = state.selectedDate;
  const dayReport = state.dailyReports[activeDate] || {};

  // Strictly 2 tabs: Início/Passagem de Turno and Análise de Dados
  const [reportTab, setReportTab] = useState<'inicio_turno' | 'analise_dados'>('inicio_turno');

  const [csvOpen, setCsvOpen] = useState(false);
  const [isShiftClosingOpen, setIsShiftClosingOpen] = useState(false);
  const [occurSearch, setOccurSearch] = useState('');
  const [attachedMetricsSummary, setAttachedMetricsSummary] = useState('');

  // Presence & Shift Report Export Configuration
  const [presenceExportKeys, setPresenceExportKeys] = useState<string[]>([
    'hc_total',
    'presentes',
    'atraso',
    'folgas',
    'banco_horas',
    'ferias',
    'atestado',
    'falta_injustificada',
    'licenca',
    'treinamento',
  ]);

  const [customExportLabels, setCustomExportLabels] = useState<Record<string, string>>({
    hc_total: 'HC Total',
    presentes: 'Presentes',
    atraso: 'Atraso',
    folgas: 'Folgas',
    banco_horas: 'Banco de Horas',
    ferias: 'Férias',
    atestado: 'Atestado Médico',
    falta_injustificada: 'Falta Injustificada',
    licenca: 'Licença Médica',
    treinamento: 'Treinamento',
  });

  interface MergedField {
    id: string;
    label: string;
    sourceKeys: string[];
  }
  const [mergedFields, setMergedFields] = useState<MergedField[]>([]);
  const [isMergingModalOpen, setIsMergingModalOpen] = useState(false);
  const [newMergeName, setNewMergeName] = useState('');
  const [newMergeSourceKeys, setNewMergeSourceKeys] = useState<string[]>([]);

  const [isExportConfigModalOpen, setIsExportConfigModalOpen] = useState(false);
  const [copiedTSVSuccess, setCopiedTSVSuccess] = useState(false);

  // Configurable Task Sequence Order
  const [taskOrderIds, setTaskOrderIds] = useState<string[]>([]);

  // Hidden Fields Configuration for Spreadsheet Export
  const [hiddenExportKeys, setHiddenExportKeys] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('custom_export_hidden_keys');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [hiddenTaskExportIds, setHiddenTaskExportIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('custom_export_hidden_task_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      const savedKeys = localStorage.getItem('custom_export_presence_keys');
      if (savedKeys) setPresenceExportKeys(JSON.parse(savedKeys));

      const savedLabels = localStorage.getItem('custom_export_labels');
      if (savedLabels) setCustomExportLabels(JSON.parse(savedLabels));

      const savedMerged = localStorage.getItem('custom_export_merged_fields');
      if (savedMerged) setMergedFields(JSON.parse(savedMerged));

      const savedOrder = localStorage.getItem('custom_export_task_order');
      if (savedOrder) setTaskOrderIds(JSON.parse(savedOrder));
    } catch (e) {
      console.error('Erro ao carregar configurações salvas de exportação', e);
    }
  }, []);

  const toggleHidePresenceKey = (key: string) => {
    setHiddenExportKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleHideTask = (id: string) => {
    setHiddenTaskExportIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSaveReport = async () => {
    saveDailyReport();
    if (state.onlineSpreadsheet) {
      await syncToOnlineSpreadsheet();
    }
  };

  const handleDownloadReport = () => {
    const data = {
      teamName: state.teamName,
      sector: state.sector,
      date: activeDate,
      ...dayReport,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-diario-${activeDate}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Interactive dashboard metrics ---
  const activeShift = state.selectedShiftFilter || state.teamShift || 'ALL';

  const filteredCollaboratorsForReport = state.collaborators.filter((c) => {
    const colShift = c.shift || 'Geral';
    return activeShift === 'ALL' || activeShift === 'todos' || colShift === activeShift;
  });

  const statusInfoByCollab = filteredCollaboratorsForReport.map((c) => ({
    collaborator: c,
    ...getCollaboratorStatus(c, activeDate, state),
  }));

  const presentIds = new Set(
    statusInfoByCollab.filter((s) => s.status === 'presente' || s.status === 'atraso').map((s) => s.collaborator.id)
  );

  const statusCounts: Record<StatusType, number> = {
    presente: 0,
    atraso: 0,
    ausente: 0,
    folga: 0,
    ferias: 0,
    licenca: 0,
    treinamento: 0,
    atestado: 0,
    banco_horas: 0,
    falta_injustificada: 0,
  };
  statusInfoByCollab.forEach(({ status }) => {
    statusCounts[status] += 1;
  });

  // Absenteeism metrics
  const totalCols = filteredCollaboratorsForReport.length;
  const totalAbsentInReport = filteredCollaboratorsForReport.filter(
    (c) => isAbsenteeismStatus(getCollaboratorStatus(c, activeDate, state).status)
  ).length;
  const teamAbsenteeismRate = totalCols > 0 ? Math.round((totalAbsentInReport / totalCols) * 100) : 0;

  // --- Início/Passagem de Turno report data ---
  const shiftLabel = state.teamShift || 'T2';

  // Consolidated Task Groups (Hierarchy aware)
  const dimensioningGroups = useMemo(() => {
    return getConsolidatedTaskGroups(state.tasks, true);
  }, [state.tasks]);

  const dimensioningCounts = useMemo(() => {
    const counts = dimensioningGroups.map((g) => ({
      id: g.rootTask.id,
      name: g.rootTask.name,
      total: g.totalCount,
      hasSubtasks: g.hasSubtasks,
      directTotal: g.directMembers.length,
      subtasks: g.subtasks.map((st) => ({
        id: st.id,
        name: st.name,
        total: (st.members || []).length,
      })),
      allMembers: g.allMembers,
    }));

    if (taskOrderIds.length > 0) {
      const ordered: typeof counts = [];
      taskOrderIds.forEach((id) => {
        const item = counts.find((c) => c.id === id);
        if (item) ordered.push(item);
      });
      counts.forEach((c) => {
        if (!taskOrderIds.includes(c.id)) ordered.push(c);
      });
      return ordered;
    }

    return counts.sort((a, b) => b.total - a.total);
  }, [dimensioningGroups, taskOrderIds]);

  const nonPresent = statusInfoByCollab
    .filter((s) => s.status !== 'presente')
    .map((s) => {
      const collaborator = s.collaborator;
      const reason =
        dayReport.absenceReasons?.[collaborator.id] ||
        (s.absenceDetail ? `${s.absenceDetail.type}: ${s.absenceDetail.notes || ''}`.trim() : '') ||
        (s.absenceReason || 'Não informada');
      return {
        id: collaborator.id,
        name: collaborator.name,
        role: collaborator.role || 'Sem cargo',
        status: s.status,
        reason,
      };
    });

  // Helper functions for dynamic customizable export fields and merging
  const getFieldValue = (key: string): number => {
    if (key === 'hc_total') return totalCols;
    if (key === 'presentes') return statusCounts.presente + statusCounts.atraso;
    if (key === 'atraso') return statusCounts.atraso;
    if (key === 'folgas') return statusCounts.folga;
    if (key === 'banco_horas') return statusCounts.banco_horas;
    if (key === 'ferias') return statusCounts.ferias;
    if (key === 'atestado') return statusCounts.atestado;
    if (key === 'falta_injustificada') return statusCounts.falta_injustificada;
    if (key === 'licenca') return statusCounts.licenca;
    if (key === 'treinamento') return statusCounts.treinamento;

    const merged = mergedFields.find((m) => m.id === key);
    if (merged) {
      return merged.sourceKeys.reduce((sum, srcKey) => sum + getFieldValue(srcKey), 0);
    }
    return 0;
  };

  const getFieldLabel = (key: string): string => {
    const merged = mergedFields.find((m) => m.id === key);
    if (merged) return merged.label;
    return customExportLabels[key] || key;
  };

  const movePresenceKey = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === presenceExportKeys.length - 1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const newKeys = [...presenceExportKeys];
    const temp = newKeys[index];
    newKeys[index] = newKeys[targetIndex];
    newKeys[targetIndex] = temp;
    setPresenceExportKeys(newKeys);
  };

  const moveTask = (id: string, direction: 'up' | 'down') => {
    const currentOrder = dimensioningCounts.map((t) => t.id);
    const index = currentOrder.indexOf(id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === currentOrder.length - 1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const newOrder = [...currentOrder];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;
    setTaskOrderIds(newOrder);
  };

  const buildExportTSVString = () => {
    const lines: string[] = [];

    presenceExportKeys.forEach((key) => {
      if (hiddenExportKeys.includes(key)) return;
      const label = getFieldLabel(key);
      const val = getFieldValue(key);
      lines.push(`${label}\t${val}`);
    });

    lines.push('');

    dimensioningCounts.forEach((t) => {
      if (hiddenTaskExportIds.includes(t.id)) return;
      lines.push(`${t.name}\t${t.total}`);
    });

    return lines.join('\n');
  };

  const handleCopyTSVToClipboard = () => {
    const text = buildExportTSVString();
    navigator.clipboard.writeText(text);
    setCopiedTSVSuccess(true);
    setTimeout(() => setCopiedTSVSuccess(false), 2500);
    showNotice('✅ Campos e valores copiados! Cole diretamente nas células da planilha.');
  };

  const summaryMetrics: Array<{
    label: string;
    value: number | string;
    color: string;
  }> = [
    { label: 'HC Total', value: totalCols, color: 'text-slate-700 dark:text-slate-300' },
    { label: 'Presentes', value: statusCounts.presente + statusCounts.atraso, color: 'text-emerald-700 dark:text-emerald-400' },
    { label: 'Atrasos', value: statusCounts.atraso, color: 'text-amber-700 dark:text-amber-400' },
    { label: 'Folgas', value: statusCounts.folga, color: 'text-slate-600 dark:text-slate-300' },
    { label: 'Banco de Horas', value: statusCounts.banco_horas, color: 'text-teal-700 dark:text-teal-400' },
    { label: 'Férias', value: statusCounts.ferias, color: 'text-purple-700 dark:text-purple-400' },
    { label: 'Atestado', value: statusCounts.atestado, color: 'text-blue-700 dark:text-blue-400' },
    { label: 'Falta Injustificada', value: statusCounts.falta_injustificada, color: 'text-rose-700 dark:text-rose-400' },
    { label: 'Licença Médica', value: statusCounts.licenca, color: 'text-amber-700 dark:text-amber-400' },
    { label: 'Treinamento', value: statusCounts.treinamento, color: 'text-cyan-700 dark:text-cyan-400' },
    { label: 'Absenteísmo', value: `${teamAbsenteeismRate}%`, color: 'text-rose-700 dark:text-rose-400' },
  ];

  const statusTone = (status: StatusType): BadgeTone =>
    status === 'presente'
      ? 'success'
      : status === 'ferias'
      ? 'purple'
      : status === 'licenca' || status === 'treinamento'
      ? 'warning'
      : status === 'folga'
      ? 'neutral'
      : 'danger';

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <PageHeader
        icon={BarChart3}
        title={`Relatório Diário — ${formatDateLongBR(activeDate)}`}
        subtitle="Passagem de turno consolidada, ocorrências integradas, métricas anexadas e central de análise de dados."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={Lock}
              className="border-amber-500/50 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 font-black"
              onClick={() => setIsShiftClosingOpen(true)}
              title="Realizar o fechamento e gravação imutável do turno na nuvem"
            >
              Fechar Turno (Nuvem)
            </Button>
            <Button variant="outline" size="sm" icon={Download} onClick={() => setCsvOpen(true)}>
              CSV
            </Button>
            <Button variant="outline" size="sm" icon={Download} onClick={handleDownloadReport}>
              JSON
            </Button>
            <Button variant="primary" size="sm" icon={Save} onClick={handleSaveReport}>
              Salvar Relatório
            </Button>
          </div>
        }
      />

      {dayReport.generatedAt && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Último relatório gravado em: {dayReport.generatedAt}</span>
        </div>
      )}

      {/* Strictly 2 Main Tabs */}
      <Tabs
        value={reportTab}
        onChange={(v) => setReportTab(v as 'inicio_turno' | 'analise_dados')}
        items={[
          { value: 'inicio_turno', label: 'Início / Passagem de Turno', icon: Users },
          { value: 'analise_dados', label: 'Análise de Dados', icon: BarChart3 },
        ]}
      />

      {/* TAB 1: INÍCIO / PASSAGEM DE TURNO */}
      {reportTab === 'inicio_turno' && (
        <div className="space-y-5">
          {/* Header Card with quick actions */}
          <Card>
            <CardHeader
              icon={<Users className="w-4.5 h-4.5" />}
              title={`Passagem de Turno — ${state.teamName || 'Equipe Principal'}`}
              subtitle={`${formatDateLongBR(activeDate)} • Turno ${shiftLabel} • ${state.sector || 'Operacional'}`}
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Lock}
                    className="border-amber-500/50 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 font-bold"
                    onClick={() => setIsShiftClosingOpen(true)}
                  >
                    Fechar Turno (Nuvem)
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={copiedTSVSuccess ? Check : Copy}
                    onClick={handleCopyTSVToClipboard}
                    title="Copiar relatório formatado em tabela TSV para colar diretamente no Excel ou Google Sheets"
                  >
                    {copiedTSVSuccess ? 'Copiado!' : 'Copiar p/ Planilha (TSV)'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Settings2}
                    onClick={() => setIsExportConfigModalOpen(true)}
                    title="Configurar a ordem dos campos de Presença e o formato de exportação"
                  >
                    Configurar Exportação
                  </Button>
                </div>
              }
            />
          </Card>

          {/* Row 1: Dimensioning, Presence summary, Absent collaborators */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            <Card className="flex flex-col">
              <SectionHeader
                icon={<Shuffle className="w-3.5 h-3.5" />}
                title="Dimensionamento por Atividade"
                right={
                  <span className="text-[10px] font-bold text-[var(--muted)]">
                    {dimensioningCounts.length} Atividades Principais
                  </span>
                }
              />
              {dimensioningCounts.length === 0 ? (
                <EmptyState icon={Shuffle} title="Nenhuma tarefa cadastrada." className="py-8" />
              ) : (
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 flex-1">
                  {dimensioningCounts.map((t) => (
                    <div
                      key={t.id}
                      className="bg-[var(--surface-2)] border border-[var(--line)] rounded-xl p-2.5 space-y-1.5 shadow-[var(--shadow-card)] transition-all hover:border-[var(--primary-border)]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="text-xs font-black text-[var(--ink)] truncate">{t.name}</p>
                          {t.hasSubtasks && (
                            <Badge tone="primary" className="border border-[var(--primary-border)] text-[9px]">
                              {t.subtasks.length} subdivisões
                            </Badge>
                          )}
                        </div>
                        <span className="text-base font-black text-[var(--primary)] bg-[var(--paper)] border border-[var(--line)] px-2 py-0.5 rounded-lg shrink-0">
                          {t.total}
                        </span>
                      </div>

                      {showSubtasks && t.hasSubtasks && t.subtasks.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-[var(--line)]/50">
                          {t.directTotal > 0 && (
                            <Badge tone="neutral" className="border border-[var(--line)] text-[9px]">
                              Geral: <strong className="text-[var(--ink)]">{t.directTotal}</strong>
                            </Badge>
                          )}
                          {t.subtasks.map((st) => (
                            <Badge key={st.id} tone="neutral" className="border border-[var(--line)] text-[9px]">
                              <span>{st.name}:</span>
                              <strong className="text-[var(--primary)] font-black">{st.total}</strong>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="flex flex-col">
              <SectionHeader
                icon={<Gauge className="w-3.5 h-3.5 text-rose-500" />}
                title="Resumo de Presença & Ausências"
              />
              <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1 flex-1">
                {summaryMetrics.map((m) => (
                  <StatCard key={m.label} label={m.label} value={<span className={m.color}>{m.value}</span>} />
                ))}
              </div>
            </Card>

            <Card className="flex flex-col">
              <SectionHeader
                icon={<UserX className="w-3.5 h-3.5 text-rose-500" />}
                title={`Colaboradores Ausentes (${nonPresent.length})`}
              />
              {nonPresent.length === 0 ? (
                <EmptyState icon={UserX} title="Todos os colaboradores estão presentes hoje." className="py-8" />
              ) : (
                <div className="overflow-x-auto max-h-[300px] overflow-y-auto pr-1 flex-1">
                  <table className="w-full text-left text-xs border-collapse min-w-[280px]">
                    <thead className="sticky top-0 bg-[var(--paper)] z-10">
                      <tr className="border-b border-[var(--line)] text-[var(--muted)] font-bold uppercase text-[9px]">
                        <th className="p-1.5">Colaborador</th>
                        <th className="p-1.5">Status</th>
                        <th className="p-1.5">Motivo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--line)]">
                      {nonPresent.map((c) => (
                        <tr key={c.id} className="hover:bg-[var(--surface-2)]">
                          <td className="p-1.5 font-bold text-[var(--ink)]">
                            <div>{c.name}</div>
                            <div className="text-[9px] text-[var(--muted)] font-normal">{c.role}</div>
                          </td>
                          <td className="p-1.5">
                            <Badge tone={statusTone(c.status)} className="uppercase text-[8px]">{c.status}</Badge>
                          </td>
                          <td className="p-1.5 text-[var(--ink)] text-[11px]">{c.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          {/* Row 2: Configurable Attached Task Metrics & Pending Indicators */}
          <ReportAttachedTaskMetrics onMetricsComputed={setAttachedMetricsSummary} />

          {/* Row 3: Integrated Quadro de Ocorrências & Observações Gerais do Turno */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 xl:col-span-8 min-w-0">
              <Card>
                <SectionHeader
                  icon={<Table2 className="w-3.5 h-3.5 text-[var(--primary)]" />}
                  title="Quadro Integrado de Ocorrências & Status"
                  subtitle="Justificativas e ocorrências registradas diretamente no fluxo da passagem."
                  right={
                    <div className="relative w-full sm:w-56">
                      <Input
                        type="text"
                        value={occurSearch}
                        onChange={(e) => setOccurSearch(e.target.value)}
                        placeholder="Buscar colaborador ou motivo..."
                        className="h-8! pl-8! text-xs"
                      />
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                      {occurSearch && (
                        <button
                          onClick={() => setOccurSearch('')}
                          aria-label="Limpar busca"
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  }
                />

                <div className="overflow-x-auto max-h-[380px] overflow-y-auto pr-1">
                  <table className="w-full text-left text-xs border-collapse min-w-[550px]">
                    <thead className="sticky top-0 bg-[var(--paper)] z-10 shadow-[var(--shadow-card)]">
                      <tr className="border-b border-[var(--line)] text-[var(--muted)] font-bold uppercase text-[9.5px]">
                        <th className="p-2">Colaborador</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">Justificativa / Ausência</th>
                        <th className="p-2">Ocorrência Individual</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--line)]">
                      {state.collaborators
                        .filter((c) => {
                          if (!occurSearch) return true;
                          const q = escapeSearchTerm(occurSearch);
                          const currentReason = dayReport.absenceReasons?.[c.id] || '';
                          const currentOccur = dayReport.occurrences?.[c.id] || '';
                          return (
                            (c.name && escapeSearchTerm(c.name).includes(q)) ||
                            (c.role && escapeSearchTerm(c.role).includes(q)) ||
                            escapeSearchTerm(currentReason).includes(q) ||
                            escapeSearchTerm(currentOccur).includes(q)
                          );
                        })
                        .map((c) => {
                          const statusInfo = getCollaboratorStatus(c, activeDate, state);
                          const currentReason = dayReport.absenceReasons?.[c.id] || '';
                          const currentOccur = dayReport.occurrences?.[c.id] || '';

                          return (
                            <tr key={c.id} className="hover:bg-[var(--surface-2)]">
                              <td className="p-2 font-bold text-[var(--ink)]">
                                <div>{c.name}</div>
                                <div className="text-[10px] text-[var(--muted)] font-normal">{c.role}</div>
                              </td>

                              <td className="p-2">
                                <Badge tone={statusTone(statusInfo.status)} className="uppercase text-[9px]">
                                  {statusInfo.status}
                                </Badge>
                              </td>

                              <td className="p-2">
                                {statusInfo.status === 'presente' ? (
                                  <span className="text-[var(--muted)] text-[11px]">—</span>
                                ) : (
                                  <input
                                    type="text"
                                    value={currentReason}
                                    onChange={(e) => setAbsenceReason(c.id, e.target.value)}
                                    placeholder="Justificativa..."
                                    className="w-full px-2 py-1 bg-[var(--surface-2)] border border-[var(--line)] rounded-lg text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
                                  />
                                )}
                              </td>

                              <td className="p-2">
                                <input
                                  type="text"
                                  value={currentOccur}
                                  onChange={(e) => setOccurrence(c.id, e.target.value)}
                                  placeholder="Ocorrência individual..."
                                  className="w-full px-2 py-1 bg-[var(--surface-2)] border border-[var(--line)] rounded-lg text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
                                />
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            <div className="lg:col-span-5 xl:col-span-4 min-w-0">
              <Card className="h-full flex flex-col">
                <SectionHeader
                  icon={<ClipboardList className="w-3.5 h-3.5 text-[var(--primary)]" />}
                  title="Observações Gerais do Turno"
                  subtitle="Notas para a próxima liderança."
                />
                <Textarea
                  rows={14}
                  value={dayReport.generalNotes || ''}
                  onChange={(e) => setGeneralNotes(e.target.value)}
                  placeholder="Registre gargalos, pendências para o próximo turno, metas alcançadas, ocorrências gerais e observações importantes..."
                  className="flex-1 text-xs leading-relaxed resize-none mt-2"
                />
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ANÁLISE DE DADOS (DATA ANALYTICS) */}
      {reportTab === 'analise_dados' && (
        <ReportDataAnalytics />
      )}

      {/* Modals */}
      {csvOpen && <CsvExportModal onClose={() => setCsvOpen(false)} />}

      <Modal
        isOpen={isExportConfigModalOpen}
        onClose={() => setIsExportConfigModalOpen(false)}
        title="Configurar Exportação para Planilha"
        icon={<Settings2 className="w-4.5 h-4.5" />}
        size="md"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPresenceExportKeys([
                  'hc_total',
                  'presentes',
                  'atraso',
                  'folgas',
                  'banco_horas',
                  'ferias',
                  'atestado',
                  'falta_injustificada',
                  'licenca',
                  'treinamento',
                ]);
                setTaskOrderIds([]);
                setHiddenExportKeys([]);
                setHiddenTaskExportIds([]);
                setMergedFields([]);
                setCustomExportLabels({
                  hc_total: 'HC Total',
                  presentes: 'Presentes',
                  atraso: 'Atraso',
                  folgas: 'Folgas',
                  banco_horas: 'Banco de Horas',
                  ferias: 'Férias',
                  atestado: 'Atestado Médico',
                  falta_injustificada: 'Falta Injustificada',
                  licenca: 'Licença Médica',
                  treinamento: 'Treinamento',
                });
                localStorage.removeItem('custom_export_presence_keys');
                localStorage.removeItem('custom_export_task_order');
                localStorage.removeItem('custom_export_hidden_keys');
                localStorage.removeItem('custom_export_hidden_task_ids');
                localStorage.removeItem('custom_export_labels');
                localStorage.removeItem('custom_export_merged_fields');
                showNotice('Configurações salvas e restauradas para o padrão.');
              }}
            >
              Restaurar Padrão
            </Button>
            <Button variant="secondary" size="sm" icon={Copy} onClick={handleCopyTSVToClipboard}>
              Copiar Agora
            </Button>
            <Button variant="primary" size="sm" onClick={() => setIsExportConfigModalOpen(false)}>
              Concluído
            </Button>
          </>
        }
      >
        <Toolbar className="justify-between mb-5">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="xs"
              onClick={() => {
                setPresenceExportKeys([
                  'hc_total',
                  'presentes',
                  'atraso',
                  'folgas',
                  'banco_horas',
                  'ferias',
                  'atestado',
                  'falta_injustificada',
                  'licenca',
                  'treinamento',
                ]);
                setTaskOrderIds([]);
                setHiddenExportKeys([]);
                setHiddenTaskExportIds([]);
                setMergedFields([]);
                setCustomExportLabels({
                  hc_total: 'HC Total',
                  presentes: 'Presentes',
                  atraso: 'Atraso',
                  folgas: 'Folgas',
                  banco_horas: 'Banco de Horas',
                  ferias: 'Férias',
                  atestado: 'Atestado Médico',
                  falta_injustificada: 'Falta Injustificada',
                  licenca: 'Licença Médica',
                  treinamento: 'Treinamento',
                });
                localStorage.removeItem('custom_export_presence_keys');
                localStorage.removeItem('custom_export_task_order');
                localStorage.removeItem('custom_export_hidden_keys');
                localStorage.removeItem('custom_export_hidden_task_ids');
                localStorage.removeItem('custom_export_labels');
                localStorage.removeItem('custom_export_merged_fields');
                showNotice('Configurações restauradas para o padrão.');
              }}
              title="Restaurar visualização, ordem e campos ocultos para o padrão"
            >
              Restaurar Padrão
            </Button>
            <Button
              variant="primary"
              size="xs"
              icon={Save}
              onClick={async () => {
                localStorage.setItem('custom_export_presence_keys', JSON.stringify(presenceExportKeys));
                localStorage.setItem('custom_export_task_order', JSON.stringify(taskOrderIds));
                localStorage.setItem('custom_export_hidden_keys', JSON.stringify(hiddenExportKeys));
                localStorage.setItem('custom_export_hidden_task_ids', JSON.stringify(hiddenTaskExportIds));
                localStorage.setItem('custom_export_labels', JSON.stringify(customExportLabels));
                localStorage.setItem('custom_export_merged_fields', JSON.stringify(mergedFields));

                if (state.onlineSpreadsheet?.webhookUrl) {
                  showNotice('🔄 Sincronizando dados com a Planilha Online...');
                  const ok = await syncToOnlineSpreadsheet();
                  if (ok) {
                    showNotice(`✅ Configurações salvas e planilha "${state.onlineSpreadsheet.name || 'Online'}" atualizada!`);
                  }
                } else {
                  showNotice('✅ Configurações de exportação salvas localmente!');
                }
              }}
              title="Salvar configurações e sincronizar dados com a planilha online do Google Sheets"
            >
              Salvar & Sincronizar
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="xs" icon={Copy} onClick={handleCopyTSVToClipboard}>
              Copiar Agora
            </Button>
            <Button variant="primary" size="xs" onClick={() => setIsExportConfigModalOpen(false)}>
              Concluído
            </Button>
          </div>
        </Toolbar>

        <div className="space-y-2">
          <SectionHeader
            icon={<Gauge className="w-3.5 h-3.5" />}
            title="Títulos, Ordem e Ocultar Campos:"
            right={
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 text-[10px]">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setHiddenExportKeys([...presenceExportKeys])}
                    title="Ocultar todos os campos da planilha"
                  >
                    Ocultar todos
                  </Button>
                  <span className="text-[var(--muted)]">•</span>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setHiddenExportKeys([])}
                    title="Exibir todos os campos na planilha"
                  >
                    Exibir todos
                  </Button>
                </div>
                <Button variant="secondary" size="xs" onClick={() => setIsMergingModalOpen(!isMergingModalOpen)}>
                  + Mesclar Campos
                </Button>
              </div>
            }
          />

          {isMergingModalOpen && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-3 text-xs">
              <div className="font-black text-[var(--ink)]">Criar Campo Mesclado (Somar Valores)</div>
              <Field label="Nome do Campo Mesclado:">
                <Input
                  type="text"
                  placeholder="Ex: Falta Injustificada / Atraso"
                  value={newMergeName}
                  onChange={(e) => setNewMergeName(e.target.value)}
                />
              </Field>
              <div>
                <label className="block text-[10px] font-bold text-[var(--muted)] mb-1">Selecione os campos a juntar:</label>
                <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto">
                  {[
                    { key: 'hc_total', label: 'HC Total' },
                    { key: 'presentes', label: 'Presentes' },
                    { key: 'atraso', label: 'Atraso' },
                    { key: 'folgas', label: 'Folgas' },
                    { key: 'banco_horas', label: 'Banco de Horas' },
                    { key: 'ferias', label: 'Férias' },
                    { key: 'atestado', label: 'Atestado' },
                    { key: 'falta_injustificada', label: 'Falta Injustificada' },
                    { key: 'licenca', label: 'Licença' },
                    { key: 'treinamento', label: 'Treinamento' },
                  ].map((item) => (
                    <label key={item.key} className="flex items-center gap-1.5 cursor-pointer text-[11px] font-medium text-[var(--ink)]">
                      <input
                        type="checkbox"
                        checked={newMergeSourceKeys.includes(item.key)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewMergeSourceKeys([...newMergeSourceKeys, item.key]);
                          } else {
                            setNewMergeSourceKeys(newMergeSourceKeys.filter((k) => k !== item.key));
                          }
                        }}
                        className="accent-[var(--primary)] rounded"
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setIsMergingModalOpen(false);
                    setNewMergeName('');
                    setNewMergeSourceKeys([]);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  size="xs"
                  onClick={() => {
                    if (!newMergeName.trim()) {
                      showNotice('Digite um nome para o campo mesclado.');
                      return;
                    }
                    if (newMergeSourceKeys.length < 2) {
                      showNotice('Selecione ao menos 2 campos para mesclar.');
                      return;
                    }
                    const mergeId = 'merge_' + Date.now();
                    const newMerged: MergedField = {
                      id: mergeId,
                      label: newMergeName.trim(),
                      sourceKeys: newMergeSourceKeys,
                    };
                    setMergedFields([...mergedFields, newMerged]);
                    setPresenceExportKeys([...presenceExportKeys, mergeId]);
                    setNewMergeName('');
                    setNewMergeSourceKeys([]);
                    setIsMergingModalOpen(false);
                    showNotice(`✅ Campo mesclado "${newMerged.label}" criado com sucesso!`);
                  }}
                >
                  Salvar Mesclagem
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-1.5 bg-[var(--surface-2)] p-2 rounded-xl border border-[var(--line)]">
            {presenceExportKeys.map((key, idx) => {
              const label = getFieldLabel(key);
              const val = getFieldValue(key);
              const merged = mergedFields.find((m) => m.id === key);
              const isHidden = hiddenExportKeys.includes(key);

              return (
                <div
                  key={key}
                  className={`flex items-center justify-between gap-2 p-2 border rounded-lg shadow-[var(--shadow-card)] transition-all ${
                    isHidden
                      ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 opacity-70'
                      : 'bg-[var(--paper)] border-[var(--line)]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span
                      className={`w-5 h-5 rounded-full font-black text-[10px] flex items-center justify-center shrink-0 ${
                        isHidden
                          ? 'bg-rose-200 text-rose-800 dark:bg-rose-900 dark:text-rose-200'
                          : 'bg-[var(--primary-soft)] text-[var(--primary)]'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={label}
                      onChange={(e) => {
                        const newLabel = e.target.value;
                        if (merged) {
                          setMergedFields(
                            mergedFields.map((m) => (m.id === key ? { ...m, label: newLabel } : m))
                          );
                        } else {
                          setCustomExportLabels({ ...customExportLabels, [key]: newLabel });
                        }
                      }}
                      className={`w-full px-2 py-1 bg-[var(--surface-2)] border rounded-lg font-bold text-xs focus:outline-none focus:border-[var(--primary)] ${
                        isHidden
                          ? 'line-through text-rose-700 dark:text-rose-300 border-rose-200'
                          : 'text-[var(--ink)] border-[var(--line)]'
                      }`}
                    />
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge tone="neutral" className="text-[10px]" title="Valor atual">
                      {val}
                    </Badge>

                    <button
                      type="button"
                      onClick={() => toggleHidePresenceKey(key)}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                        isHidden
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200 font-black text-[10px]'
                          : 'hover:bg-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'
                      }`}
                      title={isHidden ? 'Campo OCULTO da planilha — Clique para exibir' : 'Clique para ocultar este campo na exportação'}
                    >
                      {isHidden ? <EyeOff className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" /> : <Eye className="w-3.5 h-3.5 text-slate-500" />}
                      {isHidden && <span className="text-[9px] uppercase tracking-wide">Oculto</span>}
                    </button>

                    {merged && (
                      <button
                        type="button"
                        onClick={() => {
                          setMergedFields(mergedFields.filter((m) => m.id !== key));
                          setPresenceExportKeys(presenceExportKeys.filter((k) => k !== key));
                          setHiddenExportKeys(hiddenExportKeys.filter((k) => k !== key));
                        }}
                        className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500 cursor-pointer"
                        title="Remover campo mesclado"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <Button
                      variant="ghost"
                      size="xs"
                      icon={ArrowUp}
                      disabled={idx === 0}
                      onClick={() => movePresenceKey(idx, 'up')}
                      title="Mover para cima"
                    />
                    <Button
                      variant="ghost"
                      size="xs"
                      icon={ArrowDown}
                      disabled={idx === presenceExportKeys.length - 1}
                      onClick={() => movePresenceKey(idx, 'down')}
                      title="Mover para baixo"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-2 mt-5">
          <SectionHeader
            icon={<Shuffle className="w-3.5 h-3.5" />}
            title="Ordem e Ocultar Tarefas na Sequência:"
            right={
              <div className="flex items-center gap-1 text-[10px] flex-wrap">
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setHiddenTaskExportIds(dimensioningCounts.map((t) => t.id))}
                  title="Ocultar todas as tarefas da planilha"
                >
                  Ocultar todas
                </Button>
                <span className="text-[var(--muted)]">•</span>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setHiddenTaskExportIds([])}
                  title="Exibir todas as tarefas na planilha"
                >
                  Exibir todas
                </Button>
                {taskOrderIds.length > 0 && (
                  <>
                    <span className="text-[var(--muted)]">•</span>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => setTaskOrderIds([])}
                      title="Restaurar a ordem padrão (por quantidade de membros)"
                    >
                      Restaurar Ordem
                    </Button>
                  </>
                )}
              </div>
            }
          />

          {dimensioningCounts.length === 0 ? (
            <EmptyState icon={Shuffle} title="Nenhuma tarefa cadastrada para ordenar." className="py-6" />
          ) : (
            <div className="space-y-1 bg-[var(--surface-2)] p-2 rounded-xl border border-[var(--line)]">
              {dimensioningCounts.map((t, idx) => {
                const isTaskHidden = hiddenTaskExportIds.includes(t.id);
                return (
                  <div
                    key={t.id}
                    className={`flex items-center justify-between gap-2 p-2 border rounded-lg shadow-[var(--shadow-card)] transition-all ${
                      isTaskHidden
                        ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 opacity-70'
                        : 'bg-[var(--paper)] border-[var(--line)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-5 h-5 rounded-full font-black text-[10px] flex items-center justify-center shrink-0 ${
                          isTaskHidden
                            ? 'bg-rose-200 text-rose-800 dark:bg-rose-900 dark:text-rose-200'
                            : 'bg-[var(--primary-soft)] text-[var(--primary)]'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <span className={`font-bold truncate ${isTaskHidden ? 'line-through text-rose-700 dark:text-rose-300' : 'text-[var(--ink)]'}`}>
                        {t.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge tone="neutral" className="text-[10px]">
                        {t.total}
                      </Badge>

                      <button
                        type="button"
                        onClick={() => toggleHideTask(t.id)}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                          isTaskHidden
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200 font-black text-[10px]'
                            : 'hover:bg-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'
                        }`}
                        title={isTaskHidden ? 'Tarefa OCULTA da exportação — Clique para exibir' : 'Clique para ocultar esta tarefa na exportação'}
                      >
                        {isTaskHidden ? <EyeOff className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" /> : <Eye className="w-3.5 h-3.5 text-slate-500" />}
                        {isTaskHidden && <span className="text-[9px] uppercase tracking-wide">Oculta</span>}
                      </button>

                      <Button
                        variant="ghost"
                        size="xs"
                        icon={ArrowUp}
                        disabled={idx === 0}
                        onClick={() => moveTask(t.id, 'up')}
                        title="Mover para cima"
                      />
                      <Button
                        variant="ghost"
                        size="xs"
                        icon={ArrowDown}
                        disabled={idx === dimensioningCounts.length - 1}
                        onClick={() => moveTask(t.id, 'down')}
                        title="Mover para baixo"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      <ShiftClosingModal
        isOpen={isShiftClosingOpen}
        onClose={() => setIsShiftClosingOpen(false)}
      />
    </div>
  );
};
