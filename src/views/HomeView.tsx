import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { SingleSelectFilter } from '../components/SingleSelectFilter';
import { DashboardWidgetsContainer } from '../components/widgets/DashboardWidgetsContainer';
import { OperationalMonitorPanel } from '../components/OperationalMonitorPanel';
import {
  Users,
  Calendar,
  Users as UsersIcon,
  Briefcase,
  CheckCircle2,
  Palmtree,
  Stethoscope,
  UserX,
  Shuffle,
  LayoutDashboard,
  CalendarDays,
  FileText,
  PiggyBank,
  ShieldAlert,
  BookOpen,
  ClipboardList,
  Activity,
  Gauge,
  SlidersHorizontal,
  ListTodo,
  CheckSquare,
  Square,
  Repeat,
  Clock,
  ArrowRight,
  Zap,
  Sparkles,
  Upload,
  Download,
  type LucideIcon,
} from 'lucide-react';
import {
  getCollaboratorStatus,
  getTeamAbsenteeismRate,
  getCollaboratorAbsenteeismRate,
  formatDateLongBR,
  isAbsenteeismStatus,
  type StatusType,
} from '../utils/helpers';
import { isTaskDueOnDate, formatRecurrenceLabel } from '../utils/routineHelpers';
import { getConsolidatedTaskGroups } from '../utils/taskTreeHelpers';
import { PageHeader, Card, CardHeader, StatCard, Badge, SectionHeader, EmptyState, Button } from '../components/ui';

interface HomeViewProps {
  onNavigate: (view: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onNavigate }) => {
  const [activeHomeTab, setActiveHomeTab] = useState<'overview' | 'monitor'>('overview');

  const {
    state,
    setDate,
    setSelectedGlobalFilters,
    setAbsenteeismPeriodDays,
    showSubtasks,
    toggleScheduledTaskComplete,
    openSetupWizard,
    loadSampleBackupData,
    downloadSampleBackupFile,
  } = useApp();

  const activeDate = state.selectedDate;

  // Rotinas e Tarefas Agendadas
  const allScheduled = state.scheduledTasks || [];
  const scheduledTasksForToday = allScheduled.filter((t) => isTaskDueOnDate(t, activeDate, state.calendar));
  const completedTasksForToday = scheduledTasksForToday.filter((t) => t.status === 'concluida');
  const pendingTasksForToday = scheduledTasksForToday.filter((t) => t.status !== 'concluida');
  const activeRoutines = allScheduled.filter((t) => t.recurrence && t.recurrence.type !== 'none');

  const selectedShift = state.selectedShiftFilter || 'ALL';
  const selectedTL = state.selectedTLFilter || 'ALL';

  const colShifts = state.collaborators.map((c) => c.shift || 'Geral');
  const availableShifts = Array.from(new Set([...(state.shifts || []), ...colShifts]));
  if (!availableShifts.includes('Geral')) availableShifts.unshift('Geral');

  const filteredCollaborators = state.collaborators.filter((c) => {
    const colShift = c.shift || 'Geral';
    const colTL = c.teamLeader || state.defaultTeamLeader || 'Sem Time';

    const matchesShift = selectedShift === 'ALL' || selectedShift === 'todos' || colShift === selectedShift;
    const matchesTL = selectedTL === 'ALL' || selectedTL === 'todos' || colTL === selectedTL;

    return matchesShift && matchesTL;
  });

  const availableTLsForShift = Array.from(
    new Set(
      state.collaborators
        .filter((c) => selectedShift === 'ALL' || selectedShift === 'todos' || (c.shift || 'Geral') === selectedShift)
        .map((c) => c.teamLeader || state.defaultTeamLeader || 'Sem Time')
    )
  );

  const statusByCollab = new Map<string, StatusType>();
  filteredCollaborators.forEach((c) => {
    statusByCollab.set(c.id, getCollaboratorStatus(c, activeDate, state).status);
  });

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
  statusByCollab.forEach((status) => {
    statusCounts[status] += 1;
  });

  const absenteeismPeriodDays = state.absenteeismPeriodDays || 30;
  const totalAbsentCount = filteredCollaborators.filter((c) =>
    isAbsenteeismStatus(statusByCollab.get(c.id) || '')
  ).length;

  const teamAbsenteeismRate =
    filteredCollaborators.length > 0
      ? Math.round((totalAbsentCount / filteredCollaborators.length) * 100)
      : 0;

  const collabAbsenteeism = filteredCollaborators
    .map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role || 'Sem cargo',
      rate: Math.round(getCollaboratorAbsenteeismRate(state, c, activeDate, absenteeismPeriodDays)),
      absentNow: isAbsenteeismStatus(statusByCollab.get(c.id) || ''),
    }))
    .sort((a, b) => b.rate - a.rate || Number(b.absentNow) - Number(a.absentNow));

  const presentIds = new Set(
    filteredCollaborators.filter((c) => statusByCollab.get(c.id) === 'presente' || statusByCollab.get(c.id) === 'atraso').map((c) => c.id)
  );
  const assignedCount = new Set(
    state.tasks.flatMap((t) => t.members.filter((m) => presentIds.has(m)))
  ).size;

  const taskGroups = getConsolidatedTaskGroups(state.tasks, true);

  const taskStats = taskGroups
    .map((g) => ({
      id: g.rootTask.id,
      name: g.rootTask.name,
      total: g.totalCount,
      present: g.allMembers.filter((m) => presentIds.has(m)).length,
      hasSubtasks: g.hasSubtasks,
      subtasks: g.subtaskBreakdown.map((s) => ({
        name: s.task.name,
        total: s.count,
        present: s.members.filter((m) => presentIds.has(m)).length,
      })),
      directTotal: g.directMembers.length,
    }))
    .sort((a, b) => b.total - a.total);
  const totalAssigned = taskStats.reduce((acc, t) => acc + t.total, 0);

  const statusCards: Array<{
    key: StatusType;
    label: string;
    value: number;
    icon: LucideIcon;
    tone: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
  }> = [
    { key: 'presente', label: 'Presentes', value: statusCounts.presente, icon: CheckCircle2, tone: 'success' },
    { key: 'folga', label: 'Folgas', value: statusCounts.folga, icon: CalendarDays, tone: 'default' },
    { key: 'ferias', label: 'Férias', value: statusCounts.ferias, icon: Palmtree, tone: 'purple' },
    { key: 'licenca', label: 'Licença Médica', value: statusCounts.licenca, icon: Stethoscope, tone: 'warning' },
    { key: 'atestado', label: 'Atestado', value: statusCounts.atestado, icon: FileText, tone: 'info' },
    { key: 'banco_horas', label: 'Banco de Horas', value: statusCounts.banco_horas, icon: PiggyBank, tone: 'success' },
    { key: 'falta_injustificada', label: 'Falta Injustificada', value: statusCounts.falta_injustificada, icon: ShieldAlert, tone: 'danger' },
    { key: 'treinamento', label: 'Treinamento', value: statusCounts.treinamento, icon: BookOpen, tone: 'info' },
    { key: 'ausente', label: 'Ausentes', value: statusCounts.ausente, icon: UserX, tone: 'danger' },
  ];

  const hasActiveFilters =
    (selectedShift !== 'ALL' && selectedShift !== 'todos') || (selectedTL !== 'ALL' && selectedTL !== 'todos');

  return (
    <div className="space-y-5">
      <PageHeader
        icon={LayoutDashboard}
        title={`Painel da Operação — ${state.teamName || 'Equipe Principal'}`}
        subtitle="Acompanhe a disponibilidade da equipe, afastamentos, dimensionamento e escala em tempo real."
        actions={
          <>
            <div className="flex items-center gap-2 bg-[var(--paper)] border border-[var(--line)] px-2.5 py-1.5 rounded-lg shadow-[var(--shadow-card)]">
              <Calendar className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
              <input
                type="date"
                value={activeDate}
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-[var(--ink)] focus:outline-none cursor-pointer"
              />
            </div>
            {hasActiveFilters && (
              <button
                onClick={() => setSelectedGlobalFilters({ shift: 'ALL', teamLeader: 'ALL' })}
                className="px-3 py-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 text-xs font-bold rounded-lg transition-colors cursor-pointer border border-amber-500/30"
              >
                Limpar Filtros
              </button>
            )}
          </>
        }
      />

      {/* Navigation Tabs between Overview and Operational Monitor */}
      <div className="flex items-center gap-2 border-b border-[var(--line)] pb-2">
        <button
          type="button"
          onClick={() => setActiveHomeTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeHomeTab === 'overview'
              ? 'bg-[var(--primary)] text-white shadow-sm shadow-[var(--primary)]/20'
              : 'bg-[var(--paper)] text-[var(--muted)] hover:text-[var(--ink)] border border-[var(--line)]'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Visão Geral & Indicadores</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveHomeTab('monitor')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer relative ${
            activeHomeTab === 'monitor'
              ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm shadow-indigo-500/25'
              : 'bg-[var(--paper)] text-[var(--muted)] hover:text-[var(--ink)] border border-[var(--line)] hover:border-indigo-500/30'
          }`}
        >
          <Activity className="w-4 h-4 text-indigo-400 animate-pulse" />
          <span>Monitor Operacional</span>
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        </button>
      </div>

      {activeHomeTab === 'monitor' ? (
        <OperationalMonitorPanel />
      ) : (
        <>
          {/* Banner de Estado Inicial Limpo / Injeção de Dados de Teste */}
          {state.collaborators.length === 0 && (
            <div className="bg-gradient-to-r from-violet-500/10 via-indigo-500/10 to-transparent border border-violet-500/20 p-5 rounded-2xl space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center font-black shadow-sm shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[var(--ink)]">
                      Sistema Pronto em Estado Limpo
                    </h3>
                    <p className="text-xs text-[var(--muted)] font-medium">
                      Nenhum colaborador ou cargo pré-cadastrado. Inicie com seus dados reais ou carregue a base de testes para homologação.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => loadSampleBackupData()}
                    className="px-3.5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Carregar Exemplos</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadSampleBackupFile()}
                    className="px-3.5 py-2 bg-[var(--paper)] hover:bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar Backup JSON</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openSetupWizard()}
                    className="px-3.5 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Configurar Operação</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Identificação do usuário / filtros globais */}
          <Card>
        <CardHeader
          icon={<Users className="w-4.5 h-4.5" />}
          title="Identificação do Usuário (TL / Turno)"
          subtitle="Configuração ativa para as demais telas da aplicação (Presença, Dimensionamento, Intervalos)."
          actions={
            <div className="flex items-center gap-2">
              <Badge tone="neutral">
                Mostrando {filteredCollaborators.length} de {state.collaborators.length}
              </Badge>
            </div>
          }
        />
        <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
          <SingleSelectFilter
            key={`shift-filter-${selectedShift}`}
            label="Turno"
            options={availableShifts.map((s) => ({ label: `Turno ${s}`, value: s }))}
            value={selectedShift === 'ALL' || selectedShift === 'todos' ? null : selectedShift}
            onChange={(v) => setSelectedGlobalFilters({ shift: v ?? 'ALL', teamLeader: 'ALL' })}
            allLabel="Todos os Turnos"
            icon={<UsersIcon className="w-3 h-3 text-blue-500" />}
            className="flex-1 min-w-[180px] max-w-xs"
          />

          <SingleSelectFilter
            key={`tl-filter-${selectedShift}-${availableTLsForShift.join(',')}`}
            label="Time / TL"
            options={availableTLsForShift.map((tl) => ({ label: tl, value: tl }))}
            value={selectedTL === 'ALL' || selectedTL === 'todos' ? null : selectedTL}
            onChange={(v) => setSelectedGlobalFilters({ shift: selectedShift, teamLeader: v ?? 'ALL' })}
            allLabel={selectedShift !== 'ALL' && selectedShift !== 'todos' ? `Todos do Turno ${selectedShift}` : 'Todos os Times'}
            icon={<Briefcase className="w-3 h-3 text-emerald-500" />}
            className="flex-1 min-w-[180px] max-w-xs"
          />

          <div className="flex items-center gap-1.5 ml-auto">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--primary)]" />
            <span className="text-xs font-bold text-[var(--muted)]">
              Filtro ativo: {selectedShift === 'ALL' || selectedShift === 'todos' ? 'Todos os turnos' : `Turno ${selectedShift}`}
              {selectedTL !== 'ALL' && selectedTL !== 'todos' ? ` • ${selectedTL}` : ''}
            </span>
          </div>
        </div>
      </Card>

      {/* Widgets rápidos */}
      {state.showWidgetsModule !== false && state.widgetsConfig?.enabled !== false && (
        <DashboardWidgetsContainer onNavigate={onNavigate} />
      )}

      {/* Programação de Rotinas & Tarefas Operacionais */}
      {state.showRoutinesModule !== false && (
        <Card flush>
          <div className="px-4 py-3.5 border-b border-[var(--line)] flex flex-wrap items-center justify-between gap-3">
            <CardHeader
              icon={<ListTodo className="w-4.5 h-4.5 text-[var(--primary)]" />}
              title="Programação & Acompanhamento de Rotinas"
              subtitle={`${scheduledTasksForToday.length} tarefa(s) agendada(s) para hoje • ${activeRoutines.length} rotina(s) ativa(s)`}
              actions={
                <Button
                  variant="outline"
                  size="sm"
                  icon={ArrowRight}
                  onClick={() => onNavigate('routines')}
                  title="Abrir módulo completo de rotinas e tarefas"
                >
                  Abrir Módulo de Tarefas
                </Button>
              }
            />
          </div>

          <div className="p-4 space-y-4">
            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                label="Tarefas Hoje"
                value={scheduledTasksForToday.length}
                icon={ListTodo}
                tone="primary"
                hint="Programadas para a data"
              />
              <StatCard
                label="Pendentes"
                value={pendingTasksForToday.length}
                icon={Clock}
                tone={pendingTasksForToday.length > 0 ? 'warning' : 'success'}
                hint="Aguardando conclusão"
              />
              <StatCard
                label="Concluídas"
                value={completedTasksForToday.length}
                icon={CheckSquare}
                tone="success"
                hint="Finalizadas hoje"
              />
              <StatCard
                label="Rotinas Recorrentes"
                value={activeRoutines.length}
                icon={Repeat}
                tone="default"
                hint="Ciclos automáticos"
              />
            </div>

            {/* List of Tasks for Today */}
            {scheduledTasksForToday.length > 0 ? (
              <div className="space-y-2 pt-2 border-t border-[var(--line)]">
                <div className="flex items-center justify-between text-xs font-black text-[var(--ink)]">
                  <span>Próximas Tarefas e Rotinas de Hoje:</span>
                  <span className="text-[10px] text-[var(--muted)]">Clique na caixa para marcar conclusão</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {scheduledTasksForToday.slice(0, 6).map((t) => {
                    const isDone = t.status === 'concluida';
                    const list = state.scheduledTaskLists?.find((l) => l.id === t.listId);
                    return (
                      <div
                        key={t.id}
                        className={`p-2.5 rounded-lg border text-xs flex items-start gap-2.5 transition-all ${
                          isDone
                            ? 'bg-[var(--surface-2)]/50 border-[var(--line)] opacity-70'
                            : 'bg-[var(--surface-2)] border-[var(--line)] hover:border-[var(--primary-border)]'
                        }`}
                      >
                        <button
                          onClick={() => toggleScheduledTaskComplete(t.id)}
                          className="mt-0.5 text-[var(--muted)] hover:text-[var(--primary)] transition-colors cursor-pointer"
                        >
                          {isDone ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-bold text-xs truncate ${
                                isDone ? 'line-through text-[var(--muted)]' : 'text-[var(--ink)]'
                              }`}
                            >
                              {t.title}
                            </span>
                            {t.priority === 'urgente' && (
                              <Badge tone="danger" className="text-[9px] py-0 px-1">Urgente</Badge>
                            )}
                            {t.priority === 'alta' && (
                              <Badge tone="warning" className="text-[9px] py-0 px-1">Alta</Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-[var(--muted)] mt-1">
                            {list && (
                              <span
                                className="font-extrabold px-1 rounded"
                                style={{ color: list.color }}
                              >
                                {list.name}
                              </span>
                            )}
                            {t.dueTime && (
                              <span>⏰ {t.dueTime}</span>
                            )}
                            {t.recurrence && t.recurrence.type !== 'none' && (
                              <span className="text-[var(--primary)] font-bold">
                                🔄 {formatRecurrenceLabel(t.recurrence)}
                              </span>
                            )}
                            {t.subtasks && t.subtasks.length > 0 && (
                              <span>
                                ☑️ {t.subtasks.filter((st) => st.completed).length}/{t.subtasks.length}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="py-4 text-center bg-[var(--surface-2)] rounded-lg border border-dashed border-[var(--line)]">
                <p className="text-xs text-[var(--muted)] font-medium">
                  Nenhuma tarefa ou rotina pendente programada para a data selecionada ({formatDateLongBR(activeDate)}).
                </p>
                <button
                  onClick={() => onNavigate('routines')}
                  className="mt-2 text-xs font-bold text-[var(--primary)] hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  Agendar uma nova rotina <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Resumo operacional */}
      <Card>
        <CardHeader
          icon={<Activity className="w-4.5 h-4.5" />}
          title="Resumo Operacional do Dia"
          subtitle={formatDateLongBR(activeDate)}
          actions={
            <Badge tone="primary">
              {filteredCollaborators.length} de {state.collaborators.length} colaboradores
            </Badge>
          }
        />

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard
            label="Totais"
            value={filteredCollaborators.length}
            icon={Users}
            tone="primary"
            hint="Colaboradores no dia"
          />
          <StatCard
            label="Presentes"
            value={statusCounts.presente}
            icon={CheckCircle2}
            tone="success"
            hint="Ativos hoje"
          />
          <StatCard
            label="Folgas"
            value={statusCounts.folga}
            icon={CalendarDays}
            tone="default"
            hint="Escala 6x2"
          />
          <StatCard
            label="Dimensionados"
            value={`${assignedCount} / ${statusCounts.presente}`}
            icon={Shuffle}
            tone="primary"
            hint="Presentes com tarefa"
          />
          <StatCard
            label="Absenteísmo"
            value={`${teamAbsenteeismRate}%`}
            icon={Activity}
            tone="danger"
            hint={`${statusCounts.ausente} ausente(s) no dia`}
          />
        </div>

        <div className="mt-5 pt-4 border-t border-[var(--line)]">
          <SectionHeader
            icon={<UsersIcon className="w-4 h-4" />}
            title="Afastamentos & Disponibilidade"
            right={<Badge tone="neutral">Período: {absenteeismPeriodDays} dias</Badge>}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {statusCards.map(({ key, label, value, icon: Icon, tone }) => (
              <StatCard key={key} label={label} value={value} icon={Icon} tone={tone} />
            ))}
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-[var(--line)] grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="min-w-0">
            <SectionHeader
              icon={<ClipboardList className="w-4 h-4" />}
              title="Quantidade por Tarefa"
              right={
                <span className="text-[11px] font-bold text-[var(--muted)]">
                  {taskStats.length} tarefa(s) • {totalAssigned} atribuição(ões)
                </span>
              }
            />
            {taskStats.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="Nenhuma tarefa cadastrada ainda"
                description="Cadastre tarefas na tela Equipe & Cadastros."
              />
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1.5">
                {taskStats.map((t) => {
                  const pct = t.total > 0 ? Math.round((t.present / t.total) * 100) : 0;
                  return (
                    <div key={t.id} className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-xs font-black ${
                            t.present > 0
                              ? 'bg-[var(--primary)] text-white'
                              : 'bg-[var(--surface-3)] text-[var(--muted)]'
                          }`}
                        >
                          {t.present}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-[var(--ink)] truncate">{t.name}</span>
                            <span className="text-[10px] font-bold text-[var(--muted)] shrink-0">
                              {t.present} • {t.total}
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[var(--primary)] rounded-full transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {showSubtasks && t.hasSubtasks && (
                        <div className="mt-1.5 ml-10 pl-2.5 border-l-2 border-[var(--primary-border)]/60 space-y-1">
                          {t.directTotal > 0 && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[9.5px] font-bold text-[var(--muted)] truncate">Geral / Apoio</span>
                              <span className="text-[9.5px] font-bold text-[var(--muted)] shrink-0">{t.directTotal}</span>
                            </div>
                          )}
                          {t.subtasks.map((s) => (
                            <div key={s.name} className="flex items-center justify-between gap-2">
                              <span className="text-[9.5px] font-bold text-[var(--ink)] truncate flex items-center gap-1">
                                <span className="text-[var(--primary)]">├</span>
                                {s.name}
                              </span>
                              <span className="text-[9.5px] font-bold text-[var(--primary)] shrink-0">
                                {s.present} • {s.total}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="min-w-0">
            <SectionHeader
              icon={<Gauge className="w-4 h-4" />}
              title="Absenteísmo por Colaborador"
              right={
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-[var(--muted)]">Média: {teamAbsenteeismRate}%</span>
                  <select
                    value={absenteeismPeriodDays}
                    onChange={(e) => setAbsenteeismPeriodDays(Number(e.target.value))}
                    title="Período de cálculo do absenteísmo"
                    className="px-2 py-1 bg-[var(--surface-2)] border border-[var(--line)] rounded-lg text-[10px] font-bold text-[var(--ink)] cursor-pointer focus:outline-none focus:border-rose-500"
                  >
                    {[7, 15, 30, 45, 60, 90].map((d) => (
                      <option key={d} value={d}>{d} dias</option>
                    ))}
                  </select>
                </div>
              }
            />
            {collabAbsenteeism.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Nenhum colaborador no filtro atual"
                description="Ajuste os filtros de turno ou time para visualizar o absenteísmo."
              />
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1.5">
                {collabAbsenteeism.map((c) => (
                  <div key={c.id} className="flex items-center gap-2.5 p-1 rounded-lg hover:bg-[var(--surface-2)] transition-colors">
                    <div
                      className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-[10px] font-black ${
                        c.rate > 0
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                      }`}
                    >
                      {c.rate}%
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[var(--ink)] truncate">
                          {c.name}
                          {c.absentNow && (
                            <span className="ml-1.5 px-1.5 py-0.5 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded text-[9px] font-black uppercase align-middle">
                              ausente hoje
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] font-bold text-[var(--muted)] shrink-0">{c.role}</span>
                      </div>
                      <div className="mt-1 h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            c.rate > 0 ? 'bg-rose-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, c.rate)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>
        </>
      )}
    </div>
  );
};