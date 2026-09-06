import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useCommunication } from '../context/CommunicationContext';
import { UserIdentifyModal } from '../components/UserIdentifyModal';
import { SupportCodeDispatcher } from '../components/SupportCodeDispatcher';
import {
  getCollaboratorStatus,
  formatDateLongBR,
  formatDateBR,
} from '../utils/helpers';
import { APP_VERSION, BUILD_TS, GIT_COMMIT, GIT_BRANCH } from '../version';
import {
  UserCheck,
  User,
  CalendarDays,
  Clock,
  Briefcase,
  Tag,
  Users,
  Shuffle,
  Radio,
  ShieldAlert,
  FileText,
  ExternalLink,
  AlertTriangle,
  ListTodo,
  CheckSquare,
  Square,
  CheckCircle2,
  Repeat,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Button,
  Badge,
  StatCard,
  EmptyState,
} from '../components/ui';
import { isTaskDueOnDate, formatRecurrenceLabel, getTaskProgress } from '../utils/routineHelpers';
import { ScheduledTask } from '../types';

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  presente: { label: 'Presente', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30' },
  folga: { label: 'Folga (escala)', cls: 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30' },
  ferias: { label: 'Férias', cls: 'bg-violet-500/15 text-violet-600 dark:text-violet-300 border-violet-500/30' },
  licenca: { label: 'Licença', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30' },
  treinamento: { label: 'Treinamento', cls: 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30' },
  ausente: { label: 'Ausente', cls: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30' },
  atestado: { label: 'Atestado', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30' },
  banco_horas: { label: 'Banco de Horas', cls: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30' },
  falta_injustificada: { label: 'Falta Injustificada', cls: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30' },
};

const STATUS_TONE: Record<string, 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple'> = {
  presente: 'success',
  folga: 'info',
  ferias: 'purple',
  licenca: 'warning',
  treinamento: 'purple',
  ausente: 'danger',
  atestado: 'warning',
  banco_horas: 'neutral',
  falta_injustificada: 'danger',
};

const STATUS_DESC: Record<string, string> = {
  presente: 'Você está dimensionado(a) no dia de hoje.',
  folga: 'Você está em folga de escala hoje.',
  ferias: 'Você está em férias.',
  licenca: 'Você está em licença.',
  treinamento: 'Você está em treinamento.',
  ausente: 'Você não está presente hoje.',
  atestado: 'Registrado atestado para hoje.',
  banco_horas: 'Registro de banco de horas ativo.',
  falta_injustificada: 'Falta não justificada.',
};

export const EmployeePanelView: React.FC = () => {
  const {
    state,
    identifiedUser,
    toggleScheduledTaskComplete,
    toggleScheduledSubtaskComplete,
  } = useApp();
  const { channels, joinTaskChannel, setActiveChannel, enabled } = useCommunication();
  const [isIdentifyOpen, setIsIdentifyOpen] = useState(false);
  const [taskTab, setTaskTab] = useState<'today' | 'upcoming' | 'all'>('today');

  const urlParams = useMemo(() => {
    if (typeof window === 'undefined') return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, []);

  const urlShift = urlParams.get('shift');
  const activeDate = state.selectedDate;

  const collab = identifiedUser?.collaboratorId
    ? state.collaborators.find((c) => c.id === identifiedUser.collaboratorId)
    : identifiedUser
    ? state.collaborators.find((c) => c.id === identifiedUser.id)
    : undefined;

  const statusInfo = collab ? getCollaboratorStatus(collab, activeDate, state) : null;
  const statusKey = statusInfo?.status || 'ausente';
  const statusMeta = STATUS_LABEL[statusKey] || STATUS_LABEL.ausente;

  const myTasks = collab ? state.tasks.filter((t) => t.members.includes(collab.id)) : [];

  const myScheduledTasks = useMemo(() => {
    if (!collab) return [];
    const all = state.scheduledTasks || [];
    return all.filter(
      (t) =>
        (t.assignedTo || []).includes(collab.id) ||
        (t.assignedTo || []).includes('all') ||
        (collab.role && t.assignedRole === collab.role)
    );
  }, [state.scheduledTasks, collab]);

  const todayScheduledTasks = useMemo(() => {
    return myScheduledTasks.filter((t) => isTaskDueOnDate(t, activeDate, state.calendar));
  }, [myScheduledTasks, activeDate, state.calendar]);

  const upcomingScheduledTasks = useMemo(() => {
    return myScheduledTasks.filter((t) => {
      if (t.status === 'concluida') return false;
      if (!t.dueDate) return true;
      return t.dueDate >= activeDate;
    });
  }, [myScheduledTasks, activeDate]);

  const displayedScheduledTasks = useMemo(() => {
    if (taskTab === 'today') return todayScheduledTasks;
    if (taskTab === 'upcoming') return upcomingScheduledTasks;
    return myScheduledTasks;
  }, [taskTab, todayScheduledTasks, upcomingScheduledTasks, myScheduledTasks]);

  const dayIntervals = state.intervals[activeDate] || {};
  const myBreak = collab
    ? state.breaks.find((b) => (dayIntervals[b.id] || []).includes(collab.id))
    : undefined;

  const formatStatusKey = (s: string) => (STATUS_LABEL[s] ? STATUS_LABEL[s].label : s);

  const versionBadge = (
    <Badge
      tone="neutral"
      className="font-mono"
      title={`Dimensio v${APP_VERSION}${GIT_COMMIT ? ` (${GIT_COMMIT})` : ''}${BUILD_TS ? ` — Build: ${BUILD_TS}` : ''}${GIT_BRANCH ? ` [Git: ${GIT_BRANCH}]` : ''}`}
    >
      v{APP_VERSION}{GIT_COMMIT ? ` (${GIT_COMMIT})` : ''}
    </Badge>
  );

  return (
    <div className="space-y-5">
      <UserIdentifyModal isOpen={isIdentifyOpen} onClose={() => setIsIdentifyOpen(false)} />

      <PageHeader
        icon={UserCheck}
        title={identifiedUser ? `Meu Painel — ${identifiedUser.name}` : 'Painel do Colaborador'}
        subtitle={
          identifiedUser
            ? `${identifiedUser.role} • ${formatDateLongBR(activeDate)}`
            : 'Identifique-se para ver suas informações do dia.'
        }
        meta={versionBadge}
        actions={
          <>
            {!identifiedUser && (
              <Button icon={UserCheck} onClick={() => setIsIdentifyOpen(true)}>
                Identificar-se
              </Button>
            )}

            {identifiedUser && collab && (
              <>
                {urlShift && <Badge tone="primary">Turno {urlShift}</Badge>}
                <Badge tone={STATUS_TONE[statusKey] ?? 'neutral'} dot>
                  {statusMeta.label}
                </Badge>
                <Badge tone="neutral">
                  {collab.registration ? `RE ${collab.registration}` : 'Sem matrícula'}
                </Badge>
              </>
            )}

            {!identifiedUser && urlShift && <Badge tone="primary">Link do Turno {urlShift}</Badge>}
          </>
        }
      />

      {!identifiedUser || !collab ? (
        <EmptyState
          icon={User}
          title={identifiedUser ? 'Seu cadastro não foi encontrado na equipe.' : 'Nenhum colaborador identificado.'}
          description={
            <>
              Identifique-se para acessar seu painel individual com a escala do dia, tarefas alocadas, horário de intervalo e acesso aos canais operacionais.
            </>
          }
          actionLabel={!identifiedUser ? 'Identificar-se agora' : undefined}
          onAction={!identifiedUser ? () => setIsIdentifyOpen(true) : undefined}
        />
      ) : (
        <>
          <Card>
            <CardHeader
              icon={<CalendarDays className="w-4.5 h-4.5" />}
              title="Situação do Dia"
              subtitle={formatDateBR(activeDate)}
              actions={
                <Badge tone={STATUS_TONE[statusKey] ?? 'neutral'} dot>
                  {statusMeta.label}
                </Badge>
              }
            />
            <CardBody className="mt-3.5 space-y-3.5">
              <p className="text-xs text-[var(--muted)] font-medium">
                {STATUS_DESC[statusKey] || 'Situação não informada.'}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <StatCard label="Turno" value={collab.shift || state.teamShift || '—'} icon={Clock} />
                <StatCard label="Escala" value={collab.scale || '—'} icon={CalendarDays} />
                <StatCard
                  label="Time / TL"
                  value={collab.teamLeader || state.defaultTeamLeader || '—'}
                  icon={Users}
                  hint={collab.teamLeader || state.defaultTeamLeader || '—'}
                />
                <StatCard label="Intervalo" value={myBreak?.time || 'Não definido'} icon={Briefcase} />
              </div>
            </CardBody>
          </Card>

          {/* Minhas Rotinas e Tarefas Agendadas (Módulo Notion/Google Tasks Style) */}
          <Card flush>
            <div className="px-4 py-3.5 border-b border-[var(--line)] flex flex-wrap items-center justify-between gap-2.5">
              <CardHeader
                icon={<ListTodo className="w-4.5 h-4.5 text-[var(--primary)]" />}
                title="Minhas Rotinas & Programação de Tarefas"
                subtitle="Acompanhe suas rotinas diárias/semanais, prazos e subtarefas"
                actions={
                  <div className="flex items-center gap-1 bg-[var(--surface-2)] p-1 rounded-lg border border-[var(--line)]">
                    <button
                      onClick={() => setTaskTab('today')}
                      className={`px-2.5 py-1 rounded text-xs font-black transition-all cursor-pointer ${
                        taskTab === 'today'
                          ? 'bg-[var(--primary)] text-white shadow-xs'
                          : 'text-[var(--muted)] hover:text-[var(--ink)]'
                      }`}
                    >
                      Hoje ({todayScheduledTasks.length})
                    </button>
                    <button
                      onClick={() => setTaskTab('upcoming')}
                      className={`px-2.5 py-1 rounded text-xs font-black transition-all cursor-pointer ${
                        taskTab === 'upcoming'
                          ? 'bg-[var(--primary)] text-white shadow-xs'
                          : 'text-[var(--muted)] hover:text-[var(--ink)]'
                      }`}
                    >
                      Próximas ({upcomingScheduledTasks.length})
                    </button>
                    <button
                      onClick={() => setTaskTab('all')}
                      className={`px-2.5 py-1 rounded text-xs font-black transition-all cursor-pointer ${
                        taskTab === 'all'
                          ? 'bg-[var(--primary)] text-white shadow-xs'
                          : 'text-[var(--muted)] hover:text-[var(--ink)]'
                      }`}
                    >
                      Todas ({myScheduledTasks.length})
                    </button>
                  </div>
                }
              />
            </div>

            {displayedScheduledTasks.length === 0 ? (
              <div className="p-6 text-center">
                <EmptyState
                  icon={ListTodo}
                  title="Nenhuma tarefa ou rotina para exibir nesta aba."
                  description="Quando tarefas ou rotinas forem programadas ou atribuídas para você, elas aparecerão aqui com checklist e horários."
                />
              </div>
            ) : (
              <div className="divide-y divide-[var(--line)]">
                {displayedScheduledTasks.map((t) => {
                  const isDone = t.status === 'concluida';
                  const progress = getTaskProgress(t);
                  const list = state.scheduledTaskLists?.find((l) => l.id === t.listId);

                  return (
                    <div
                      key={t.id}
                      className={`p-4 transition-colors ${
                        isDone ? 'bg-[var(--surface-2)]/40 opacity-75' : 'hover:bg-[var(--surface-2)]/20'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleScheduledTaskComplete(t.id)}
                          className="mt-0.5 text-[var(--muted)] hover:text-[var(--primary)] transition-colors cursor-pointer"
                          title={isDone ? 'Marcar como pendente' : 'Marcar como concluída'}
                        >
                          {isDone ? (
                            <CheckSquare className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>

                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`font-black text-sm ${
                                isDone ? 'line-through text-[var(--muted)]' : 'text-[var(--ink)]'
                              }`}
                            >
                              {t.title}
                            </span>

                            {list && (
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded-md font-extrabold border"
                                style={{
                                  backgroundColor: `${list.color}15`,
                                  borderColor: `${list.color}40`,
                                  color: list.color,
                                }}
                              >
                                {list.name}
                              </span>
                            )}

                            {t.priority === 'urgente' && (
                              <Badge tone="danger" className="text-[10px] py-0.5">Urgente</Badge>
                            )}
                            {t.priority === 'alta' && (
                              <Badge tone="warning" className="text-[10px] py-0.5">Alta</Badge>
                            )}

                            {t.recurrence && t.recurrence.type !== 'none' && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary-border)]/40">
                                <Repeat className="w-3 h-3" />
                                {formatRecurrenceLabel(t.recurrence)}
                              </span>
                            )}

                            {t.dueTime && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--muted)]">
                                <Clock className="w-3 h-3" />
                                {t.dueTime}
                              </span>
                            )}
                          </div>

                          {t.description && (
                            <p className="text-xs text-[var(--muted)] leading-relaxed whitespace-pre-line">
                              {t.description}
                            </p>
                          )}

                          {/* Subtasks Progress Bar & Checklist */}
                          {t.subtasks && t.subtasks.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-[var(--line)] space-y-2">
                              <div className="flex items-center justify-between text-[11px] font-bold text-[var(--muted)]">
                                <span className="flex items-center gap-1">
                                  <Layers className="w-3.5 h-3.5" />
                                  Subtarefas ({t.subtasks.filter((st) => st.completed).length}/{t.subtasks.length})
                                </span>
                                <span>{progress.percent}%</span>
                              </div>

                              <div className="h-1.5 w-full bg-[var(--surface-3)] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                                  style={{ width: `${progress.percent}%` }}
                                />
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                                {t.subtasks.map((subtask) => (
                                  <label
                                    key={subtask.id}
                                    className="flex items-center gap-2 p-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-xs cursor-pointer hover:border-[var(--primary-border)] transition-colors"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={subtask.completed}
                                      onChange={() => toggleScheduledSubtaskComplete(t.id, subtask.id)}
                                      className="rounded accent-[var(--primary)] cursor-pointer"
                                    />
                                    <span
                                      className={`text-xs ${
                                        subtask.completed
                                          ? 'line-through text-[var(--muted)]'
                                          : 'font-medium text-[var(--ink)]'
                                      }`}
                                    >
                                      {subtask.title}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card flush>
              <div className="px-4 py-3 border-b border-[var(--line)]">
                <CardHeader
                  icon={<Shuffle className="w-4.5 h-4.5" />}
                  title="Minhas Tarefas"
                  actions={<Badge tone="primary">{myTasks.length}</Badge>}
                />
              </div>
              {myTasks.length === 0 ? (
                <EmptyState icon={Shuffle} title="Nenhuma tarefa alocada para você hoje." />
              ) : (
                <div className="divide-y divide-[var(--line)]">
                  {myTasks.map((t) => (
                    <div key={t.id} className="px-4 py-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-black text-xs text-[var(--ink)] leading-snug">{t.name}</span>
                        <Badge tone="primary" className="shrink-0">
                          {t.members.length} alocados
                        </Badge>
                      </div>
                      {t.externalUrl && (
                        <a
                          href={t.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--primary)] hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" /> Abrir sistema da tarefa
                        </a>
                      )}
                      <Button
                        variant="outline"
                        size="xs"
                        icon={Radio}
                        title="Entrar no canal de voz desta tarefa"
                        onClick={() => {
                          joinTaskChannel(t.id);
                          if (!enabled) return;
                        }}
                      >
                        Canal de voz desta tarefa
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <CardHeader icon={<Briefcase className="w-4.5 h-4.5" />} title="Meu Perfil" />
              <CardBody className="mt-3.5 space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 shrink-0 rounded-lg bg-[var(--surface-3)] text-[var(--muted)] flex items-center justify-center">
                    <Tag className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-black uppercase text-[var(--muted)]">Cargo</div>
                    <div className="text-xs font-bold text-[var(--ink)]">{collab.role || 'Operador'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 shrink-0 rounded-lg bg-[var(--surface-3)] text-[var(--muted)] flex items-center justify-center">
                    <ShieldAlert className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-black uppercase text-[var(--muted)]">Categoria</div>
                    <div className="text-xs font-bold text-[var(--ink)]">{collab.category || 'Geral'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 shrink-0 rounded-lg bg-[var(--surface-3)] text-[var(--muted)] flex items-center justify-center">
                    <Users className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-black uppercase text-[var(--muted)]">Líder (TL)</div>
                    <div className="text-xs font-bold text-[var(--ink)]">
                      {collab.teamLeader || state.defaultTeamLeader || '—'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 shrink-0 rounded-lg bg-[var(--surface-3)] text-[var(--muted)] flex items-center justify-center">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-black uppercase text-[var(--muted)]">Intervalo do dia</div>
                    <div className="text-xs font-bold text-[var(--ink)]">{myBreak?.time || 'Não definido'}</div>
                  </div>
                </div>
                {collab.skills && Object.keys(collab.skills).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {Object.entries(collab.skills).map(([sk, lv]) => (
                      <Badge key={sk} tone="neutral">
                        {sk} {Number(lv) > 0 ? `(nível ${lv})` : ''}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          {state.showRadioModule !== false && (
            <Card>
              <CardHeader
                icon={<Radio className="w-4.5 h-4.5" />}
                title="Dimensio Talk"
                subtitle={
                  enabled
                    ? 'Canal de voz ativo. Use o botão de rádio flutuante para entrar no canal geral ou em canais por tarefa.'
                    : 'Conecte a planilha compartilhada para ativar o rádio por canais (Geral + por tarefa).'
                }
                actions={
                  enabled ? (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={FileText}
                      onClick={() => {
                        const myTaskId = myTasks[0]?.id;
                        if (myTaskId) {
                          joinTaskChannel(myTaskId);
                        } else {
                          setActiveChannel('geral');
                        }
                      }}
                    >
                      Abrir canal da minha tarefa
                    </Button>
                  ) : undefined
                }
              />
            </Card>
          )}

          {statusInfo?.absenceReason && (
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 p-3 rounded-xl text-[11px] font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Justificativa de ausência registrada: {statusInfo.absenceReason}</span>
            </div>
          )}

          <div className="pt-2">
            <SupportCodeDispatcher />
          </div>
        </>
      )}
    </div>
  );
};
