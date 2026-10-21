import React, { useState, useEffect } from 'react';
import {
  Calendar,
  CheckSquare,
  Database,
  RefreshCw,
  LogIn,
  LogOut,
  Plus,
  Check,
  ExternalLink,
  ShieldCheck,
  Activity,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { auth, googleSignIn, logout, getAccessToken, User } from '../lib/firebase';
import {
  fetchCalendarEvents,
  createCalendarEvent,
  fetchTaskLists,
  fetchTasks,
  createGoogleTask,
  updateGoogleTaskStatus,
  CalendarEventItem,
  GoogleTaskItem,
  GoogleTaskList,
} from '../lib/workspace';
import { useApp } from '../context/AppContext';

export const WorkspaceHubPanel: React.FC = () => {
  const { showNotice, state } = useApp();
  const { collaborators, attendance, selectedDate } = state;
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [activeService, setActiveService] = useState<'calendar' | 'tasks' | 'cloudsql'>('calendar');

  // Loading & error states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Google Calendar State
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventItem[]>([]);
  const [newCalSummary, setNewCalSummary] = useState<string>('');
  const [newCalStart, setNewCalStart] = useState<string>('');
  const [newCalEnd, setNewCalEnd] = useState<string>('');

  // Google Tasks State
  const [taskLists, setTaskLists] = useState<GoogleTaskList[]>([]);
  const [selectedTaskListId, setSelectedTaskListId] = useState<string>('@default');
  const [googleTasks, setGoogleTasks] = useState<GoogleTaskItem[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState<string>('');

  // Cloud SQL Database State
  const [cloudSqlStatus, setCloudSqlStatus] = useState<any | null>(null);
  const [dbUsers, setDbUsers] = useState<any[]>([]);

  // Mutating Action Confirmation Gate
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setCurrentUser(user);
      const token = await getAccessToken();
      setHasToken(!!token);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (currentUser && hasToken) {
      if (activeService === 'calendar') loadCalendar();
      else if (activeService === 'tasks') loadTasks();
    }
    if (activeService === 'cloudsql') {
      checkCloudSql();
    }
  }, [currentUser, hasToken, activeService]);

  const handleSignIn = async () => {
    setErrorMsg(null);
    try {
      setIsLoading(true);
      const res = await googleSignIn();
      if (res) {
        setCurrentUser(res.user);
        setHasToken(true);
        showNotice(`Conectado à conta Google como ${res.user.displayName || res.user.email}!`);
        // Sync user to Cloud SQL
        const idToken = await res.user.getIdToken();
        await fetch('/api/users/sync', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${idToken}`,
            'Content-Type': 'application/json',
          },
        }).catch((err) => console.warn('Could not auto-sync user to Cloud SQL:', err));
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha na autenticação');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setCurrentUser(null);
    setHasToken(false);
    setCalendarEvents([]);
    setGoogleTasks([]);
    showNotice('Conta Google desconectada.');
  };

  // -------------------------------------------------------------------------
  // Calendar Actions
  // -------------------------------------------------------------------------
  const loadCalendar = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const events = await fetchCalendarEvents();
      setCalendarEvents(events);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar calendário');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCalendarEvent = () => {
    if (!newCalSummary.trim()) {
      showNotice('Informe o título do evento.');
      return;
    }
    const start = newCalStart || new Date().toISOString();
    const end = newCalEnd || new Date(Date.now() + 3600000).toISOString();

    setConfirmDialog({
      isOpen: true,
      title: 'Criar Evento no Google Calendar',
      description: `Deseja agendar "${newCalSummary}" no seu Google Calendar principal?`,
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await createCalendarEvent({
            summary: newCalSummary,
            startDateTime: new Date(start).toISOString(),
            endDateTime: new Date(end).toISOString(),
            description: 'Criado via Dimensio Operations Hub',
          });
          setNewCalSummary('');
          setNewCalStart('');
          setNewCalEnd('');
          showNotice('Evento criado com sucesso no Google Calendar!');
          loadCalendar();
        } catch (err: any) {
          setErrorMsg(err.message);
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  // -------------------------------------------------------------------------
  // Tasks Actions
  // -------------------------------------------------------------------------
  const loadTasks = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const lists = await fetchTaskLists();
      setTaskLists(lists);
      const activeList = lists.length > 0 ? lists[0].id : '@default';
      setSelectedTaskListId(activeList);
      const items = await fetchTasks(activeList);
      setGoogleTasks(items);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar Google Tasks');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTask = () => {
    if (!newTaskTitle.trim()) {
      showNotice('Informe o título da tarefa.');
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Criar Tarefa no Google Tasks',
      description: `Deseja adicionar "${newTaskTitle}" à sua lista de tarefas do Google?`,
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await createGoogleTask(selectedTaskListId, {
            title: newTaskTitle,
            notes: 'Criado pelo Dimensio Operations Hub',
          });
          setNewTaskTitle('');
          showNotice('Tarefa criada no Google Tasks!');
          const items = await fetchTasks(selectedTaskListId);
          setGoogleTasks(items);
        } catch (err: any) {
          setErrorMsg(err.message);
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleToggleTask = async (task: GoogleTaskItem) => {
    const isCompleted = task.status === 'completed';
    try {
      await updateGoogleTaskStatus(selectedTaskListId, task.id, !isCompleted);
      setGoogleTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: isCompleted ? 'needsAction' : 'completed' } : t))
      );
      showNotice(`Tarefa marcada como ${isCompleted ? 'pendente' : 'concluída'}!`);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Cloud SQL Database Actions
  // -------------------------------------------------------------------------
  const checkCloudSql = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/cloudsql/status');
      const data = await res.json();
      setCloudSqlStatus(data);
      if (currentUser) {
        const idToken = await currentUser.getIdToken();
        const usersRes = await fetch('/api/users', {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (usersRes.ok) {
          const uData = await usersRes.json();
          setDbUsers(uData.users || []);
        }
      }
    } catch (err: any) {
      setCloudSqlStatus({ status: 'error', message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6" id="workspace-hub-panel">
      {/* Auth Banner */}
      <div className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--ink)]">
              Google Calendar, Tasks & Cloud SQL
            </h3>
            <p className="text-xs text-[var(--muted)]">
              {currentUser
                ? `Autenticado: ${currentUser.displayName || currentUser.email} (${currentUser.email})`
                : 'Conecte sua conta Google para sincronizar Calendar, Tasks e usuários com o Cloud SQL.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentUser ? (
            <button
              type="button"
              onClick={handleSignOut}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Desconectar</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSignIn}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              <span>Conectar conta Google</span>
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Services Nav */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setActiveService('calendar')}
          className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-2 ${
            activeService === 'calendar'
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
              : 'bg-[var(--paper)] text-[var(--ink)] border-[var(--line)] hover:border-blue-500'
          }`}
        >
          <Calendar className="w-5 h-5" />
          <span className="text-xs font-bold">Calendar</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveService('tasks')}
          className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-2 ${
            activeService === 'tasks'
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
              : 'bg-[var(--paper)] text-[var(--ink)] border-[var(--line)] hover:border-blue-500'
          }`}
        >
          <CheckSquare className="w-5 h-5" />
          <span className="text-xs font-bold">Tasks</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveService('cloudsql')}
          className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-2 ${
            activeService === 'cloudsql'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
              : 'bg-[var(--paper)] text-[var(--ink)] border-[var(--line)] hover:border-emerald-500'
          }`}
        >
          <Database className="w-5 h-5" />
          <span className="text-xs font-bold">Cloud SQL</span>
        </button>
      </div>

      {/* Main Service Content */}
      <div className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-6 shadow-xs">
        {/* CALENDAR */}
        {activeService === 'calendar' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  Google Calendar - Eventos & Escalas
                </h4>
                <p className="text-xs text-[var(--muted)]">
                  Sincronização de reuniões, escalas de turno e alinhamentos operacionais.
                </p>
              </div>
              <button
                type="button"
                onClick={loadCalendar}
                disabled={isLoading || !currentUser}
                className="px-3 py-1.5 bg-[var(--bg)] border border-[var(--line)] hover:border-blue-500 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>

            {/* Quick Event Creation */}
            <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-4 space-y-3">
              <h5 className="text-xs font-bold text-[var(--ink)]">Agendar Novo Evento / Turno no Calendar</h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Título (ex: Alinhamento Turno T2)"
                  value={newCalSummary}
                  onChange={(e) => setNewCalSummary(e.target.value)}
                  className="px-3 py-2 bg-[var(--paper)] border border-[var(--line)] rounded-lg text-xs text-[var(--ink)]"
                />
                <input
                  type="datetime-local"
                  value={newCalStart}
                  onChange={(e) => setNewCalStart(e.target.value)}
                  className="px-3 py-2 bg-[var(--paper)] border border-[var(--line)] rounded-lg text-xs text-[var(--ink)]"
                />
                <input
                  type="datetime-local"
                  value={newCalEnd}
                  onChange={(e) => setNewCalEnd(e.target.value)}
                  className="px-3 py-2 bg-[var(--paper)] border border-[var(--line)] rounded-lg text-xs text-[var(--ink)]"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleCreateCalendarEvent}
                  disabled={actionLoading || !currentUser}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  Agendar Evento
                </button>
              </div>
            </div>

            {/* Events List */}
            <div className="space-y-2">
              <h5 className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
                Eventos Próximos ({calendarEvents.length})
              </h5>
              {calendarEvents.length === 0 ? (
                <div className="text-center py-8 text-xs text-[var(--muted)]">
                  {currentUser ? 'Nenhum evento encontrado no período.' : 'Conecte sua conta Google para ver os eventos.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                  {calendarEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl flex flex-col justify-between gap-2"
                    >
                      <div>
                        <div className="font-bold text-xs text-[var(--ink)]">{evt.summary || '(Sem título)'}</div>
                        {evt.description && (
                          <div className="text-[11px] text-[var(--muted)] line-clamp-2 mt-0.5">
                            {evt.description}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-[var(--muted)] pt-2 border-t border-[var(--line)]">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-blue-500" />
                          {evt.start?.dateTime
                            ? new Date(evt.start.dateTime).toLocaleString('pt-BR')
                            : evt.start?.date || 'Dia inteiro'}
                        </span>
                        {evt.htmlLink && (
                          <a
                            href={evt.htmlLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline flex items-center gap-0.5"
                          >
                            Abrir <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TASKS */}
        {activeService === 'tasks' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-blue-500" />
                  Google Tasks - Tarefas & Checklist Operacional
                </h4>
                <p className="text-xs text-[var(--muted)]">
                  Integração direta com o gerenciador de tarefas do Google.
                </p>
              </div>
              <button
                type="button"
                onClick={loadTasks}
                disabled={isLoading || !currentUser}
                className="px-3 py-1.5 bg-[var(--bg)] border border-[var(--line)] hover:border-blue-500 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>

            {/* Create Task Bar */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nova tarefa ou rotina do turno..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateTask()}
                className="flex-1 px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--ink)]"
              />
              <button
                type="button"
                onClick={handleCreateTask}
                disabled={actionLoading || !currentUser}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Adicionar
              </button>
            </div>

            {/* Task Items */}
            <div className="space-y-2">
              <h5 className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
                Tarefas Registradas ({googleTasks.length})
              </h5>
              {googleTasks.length === 0 ? (
                <div className="text-center py-8 text-xs text-[var(--muted)]">
                  {currentUser ? 'Nenhuma tarefa na lista.' : 'Conecte sua conta Google para ver as tarefas.'}
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {googleTasks.map((t) => {
                    const isDone = t.status === 'completed';
                    return (
                      <div
                        key={t.id}
                        onClick={() => handleToggleTask(t)}
                        className={`p-3 bg-[var(--bg)] border rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-all ${
                          isDone
                            ? 'opacity-60 border-[var(--line)] line-through'
                            : 'border-[var(--line)] hover:border-blue-500'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                              isDone ? 'bg-blue-600 border-blue-600 text-white' : 'border-[var(--muted)]'
                            }`}
                          >
                            {isDone && <Check className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-[var(--ink)]">{t.title}</div>
                            {t.notes && <div className="text-[10px] text-[var(--muted)]">{t.notes}</div>}
                          </div>
                        </div>
                        {t.due && (
                          <span className="text-[10px] text-[var(--muted)]">
                            Venc: {new Date(t.due).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* CLOUD SQL */}
        {activeService === 'cloudsql' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-500" />
                  Cloud SQL (PostgreSQL) - Status & Banco de Dados
                </h4>
                <p className="text-xs text-[var(--muted)]">
                  Gerenciamento da infraestrutura relacional provisionada no Google Cloud.
                </p>
              </div>
              <button
                type="button"
                onClick={checkCloudSql}
                disabled={isLoading}
                className="px-3 py-1.5 bg-[var(--bg)] border border-[var(--line)] hover:border-emerald-500 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                Testar Conexão
              </button>
            </div>

            {/* Cloud SQL Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 bg-[var(--bg)] border border-[var(--line)] rounded-xl">
                <div className="text-[10px] uppercase font-bold text-[var(--muted)]">Conexão</div>
                <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  {cloudSqlStatus?.status === 'connected'
                    ? 'Ativo & Operacional'
                    : cloudSqlStatus?.status === 'error'
                      ? 'Erro de conexão'
                      : 'Verificando...'}
                </div>
              </div>

              <div className="p-4 bg-[var(--bg)] border border-[var(--line)] rounded-xl">
                <div className="text-[10px] uppercase font-bold text-[var(--muted)]">Instância / Engine</div>
                <div className="text-sm font-black text-[var(--ink)] mt-1">
                  PostgreSQL (Cloud SQL)
                </div>
              </div>

              <div className="p-4 bg-[var(--bg)] border border-[var(--line)] rounded-xl">
                <div className="text-[10px] uppercase font-bold text-[var(--muted)]">Usuários Registrados</div>
                <div className="text-sm font-black text-[var(--ink)] mt-1">
                  {cloudSqlStatus?.usersCount ?? 0} Usuários
                </div>
              </div>
            </div>

            {cloudSqlStatus?.status === 'error' && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                Cloud SQL indisponível ou não configurado. Verifique as variáveis SQL_HOST, SQL_USER,
                SQL_PASSWORD e SQL_DB_NAME no servidor.
              </div>
            )}

            {/* Users Table */}
            {dbUsers.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
                  Usuários Autenticados no Cloud SQL
                </h5>
                <div className="border border-[var(--line)] rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[var(--bg)] border-b border-[var(--line)]">
                      <tr>
                        <th className="p-2.5 font-bold text-[var(--ink)]">UID</th>
                        <th className="p-2.5 font-bold text-[var(--ink)]">Nome</th>
                        <th className="p-2.5 font-bold text-[var(--ink)]">Email</th>
                        <th className="p-2.5 font-bold text-[var(--ink)]">Perfil</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dbUsers.map((u) => (
                        <tr key={u.id} className="border-b border-[var(--line)]">
                          <td className="p-2.5 font-mono text-[11px] text-[var(--muted)]">{u.uid.slice(0, 10)}...</td>
                          <td className="p-2.5 font-bold text-[var(--ink)]">{u.name || '-'}</td>
                          <td className="p-2.5 text-[var(--muted)]">{u.email}</td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                              {u.role || 'user'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-[var(--paper)] border border-[var(--line)] rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
            <h4 className="text-base font-bold text-[var(--ink)]">{confirmDialog.title}</h4>
            <p className="text-xs text-[var(--muted)]">{confirmDialog.description}</p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] rounded-lg text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer shadow-xs"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
