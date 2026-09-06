import React, { useState, useEffect } from 'react';
import {
  Calendar,
  CheckSquare,
  Presentation,
  FileSpreadsheet,
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
  FileText,
  ListChecks,
} from 'lucide-react';
import { auth, googleSignIn, logout, getAccessToken, User } from '../lib/firebase';
import {
  fetchCalendarEvents,
  createCalendarEvent,
  fetchTaskLists,
  fetchTasks,
  createGoogleTask,
  updateGoogleTaskStatus,
  fetchSpreadsheet,
  fetchSheetValues,
  fetchUserGoogleForms,
  fetchGoogleForm,
  fetchGoogleFormResponses,
  createGoogleForm,
  CalendarEventItem,
  GoogleTaskItem,
  GoogleTaskList,
  GoogleForm,
  GoogleFormResponseItem,
} from '../lib/workspace';
import { useApp } from '../context/AppContext';

export const WorkspaceHubPanel: React.FC = () => {
  const { showNotice, state } = useApp();
  const { collaborators, attendance, selectedDate } = state;
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [activeService, setActiveService] = useState<
    'calendar' | 'tasks' | 'slides' | 'sheets' | 'forms' | 'cloudsql'
  >('calendar');

  // Loading & error states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Google Forms State
  const [userForms, setUserForms] = useState<Array<{ id: string; name: string; modifiedTime?: string; webViewLink?: string }>>([]);
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [selectedFormData, setSelectedFormData] = useState<GoogleForm | null>(null);
  const [formResponses, setFormResponses] = useState<GoogleFormResponseItem[]>([]);
  const [showCreateFormModal, setShowCreateFormModal] = useState<boolean>(false);
  const [newFormTitle, setNewFormTitle] = useState<string>('');
  const [newFormDesc, setNewFormDesc] = useState<string>('');
  const [formTemplate, setFormTemplate] = useState<'custom' | 'handover' | 'checklist' | 'feedback'>('handover');

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

  // Google Slides State
  const [slideDeckId, setSlideDeckId] = useState<string>('');
  const [slideDeckTitle, setSlideDeckTitle] = useState<string>('Dimensio - Apresentação Operacional');

  // Google Sheets State
  const [sheetIdInput, setSheetIdInput] = useState<string>('');
  const [sheetData, setSheetData] = useState<any[][]>([]);

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
      else if (activeService === 'forms') loadUserFormsList();
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
        showNotice(`Conectado ao Google Workspace como ${res.user.displayName || res.user.email}!`);
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
    showNotice('Desconectado do Google Workspace.');
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

  // -------------------------------------------------------------------------
  // Google Forms Actions
  // -------------------------------------------------------------------------
  const loadUserFormsList = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const forms = await fetchUserGoogleForms();
      setUserForms(forms);
      if (forms.length > 0 && !selectedFormId) {
        handleSelectForm(forms[0].id);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar formulários do Google Drive/Forms');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectForm = async (formId: string) => {
    setSelectedFormId(formId);
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [formData, responses] = await Promise.all([
        fetchGoogleForm(formId),
        fetchGoogleFormResponses(formId).catch((err) => {
          console.warn('Could not fetch form responses:', err);
          return [] as GoogleFormResponseItem[];
        }),
      ]);
      setSelectedFormData(formData);
      setFormResponses(responses);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar detalhes do formulário');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshFormResponses = async () => {
    if (!selectedFormId) return;
    setActionLoading(true);
    try {
      const responses = await fetchGoogleFormResponses(selectedFormId);
      setFormResponses(responses);
      showNotice(`Respostas atualizadas: ${responses.length} envio(s) registrado(s)!`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao atualizar respostas');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateGoogleFormAction = () => {
    if (!newFormTitle.trim()) {
      showNotice('Informe o título do formulário.');
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Criar Formulário no Google Forms',
      description: `Deseja criar o formulário "${newFormTitle}" no Google Forms com o modelo selecionado?`,
      onConfirm: async () => {
        setActionLoading(true);
        try {
          let questions: Array<{
            title: string;
            type: 'RADIO' | 'CHECKBOX' | 'TEXT' | 'PARAGRAPH';
            options?: string[];
            required?: boolean;
          }> = [];

          if (formTemplate === 'handover') {
            questions = [
              {
                title: 'Setor / Posto de Trabalho',
                type: 'RADIO',
                options: ['Almoxarifado', 'Portaria Principal', 'Central de Monitoramento', 'Operações de Pátio', 'Expedição'],
                required: true,
              },
              {
                title: 'Colaborador Responsável pela Passagem',
                type: 'TEXT',
                required: true,
              },
              {
                title: 'Status dos Equipamentos e Rádios Comunicadores',
                type: 'RADIO',
                options: ['100% Operacional e Conferido', 'Pequenas pendências relatadas', 'Equipamento em manutenção / com defeito'],
                required: true,
              },
              {
                title: 'Ocorrências e Pendências Relevantes do Turno',
                type: 'PARAGRAPH',
                required: true,
              },
              {
                title: 'Orientações Especiais para o Próximo Turno',
                type: 'PARAGRAPH',
                required: false,
              },
            ];
          } else if (formTemplate === 'checklist') {
            questions = [
              {
                title: 'Identificação do Posto / Setor',
                type: 'TEXT',
                required: true,
              },
              {
                title: 'Itens Inspecionados no Início do Turno',
                type: 'CHECKBOX',
                options: ['EPIs Completos', 'Caderno / Livro de Registro', 'Rádios HT Carregados', 'Câmeras de Segurança Ativas', 'Extintores e Saídas Livres'],
                required: true,
              },
              {
                title: 'Condições de Limpeza e Organização do Posto',
                type: 'RADIO',
                options: ['Excelente', 'Adequado', 'Necessita Atenção'],
                required: true,
              },
              {
                title: 'Observações do Inspetor / Responsável',
                type: 'PARAGRAPH',
                required: false,
              },
            ];
          } else if (formTemplate === 'feedback') {
            questions = [
              {
                title: 'Como você avalia a comunicação e escala do turno hoje?',
                type: 'RADIO',
                options: ['Muito Satisfeito', 'Satisfeito', 'Regular', 'Insatisfeito'],
                required: true,
              },
              {
                title: 'Suporte dos Líderes e Apoio Operacional',
                type: 'RADIO',
                options: ['Ágil e Eficaz', 'Adequado', 'Lento / Necessita Melhoria'],
                required: true,
              },
              {
                title: 'Sugestões de melhoria para o time e operações',
                type: 'PARAGRAPH',
                required: false,
              },
            ];
          } else {
            questions = [
              {
                title: 'Pergunta Inicial / Identificação',
                type: 'TEXT',
                required: true,
              },
              {
                title: 'Opção de Escolha',
                type: 'RADIO',
                options: ['Opção A', 'Opção B', 'Opção C'],
                required: false,
              },
            ];
          }

          const created = await createGoogleForm(newFormTitle, newFormDesc, questions);
          showNotice(`Formulário "${created.info.title}" criado com sucesso no Google Forms!`);
          setShowCreateFormModal(false);
          setNewFormTitle('');
          setNewFormDesc('');
          // Refresh list and select new form
          await loadUserFormsList();
          await handleSelectForm(created.formId);
        } catch (err: any) {
          setErrorMsg(err.message || 'Erro ao criar Google Form');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  // -------------------------------------------------------------------------
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
              Google Workspace & Cloud SQL Hub
            </h3>
            <p className="text-xs text-[var(--muted)]">
              {currentUser
                ? `Autenticado: ${currentUser.displayName || currentUser.email} (${currentUser.email})`
                : 'Conecte sua conta Google para sincronizar Calendar, Tasks, Slides, Sheets e Chat com Cloud SQL.'}
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
              <span>Conectar Google Workspace</span>
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
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
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
          onClick={() => setActiveService('slides')}
          className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-2 ${
            activeService === 'slides'
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
              : 'bg-[var(--paper)] text-[var(--ink)] border-[var(--line)] hover:border-blue-500'
          }`}
        >
          <Presentation className="w-5 h-5" />
          <span className="text-xs font-bold">Slides</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveService('sheets')}
          className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-2 ${
            activeService === 'sheets'
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
              : 'bg-[var(--paper)] text-[var(--ink)] border-[var(--line)] hover:border-blue-500'
          }`}
        >
          <FileSpreadsheet className="w-5 h-5" />
          <span className="text-xs font-bold">Sheets</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveService('forms')}
          className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-2 ${
            activeService === 'forms'
              ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
              : 'bg-[var(--paper)] text-[var(--ink)] border-[var(--line)] hover:border-purple-500'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span className="text-xs font-bold">Forms</span>
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

        {/* SLIDES */}
        {activeService === 'slides' && (
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                <Presentation className="w-4 h-4 text-blue-500" />
                Google Slides - Apresentações & Briefing Operacional
              </h4>
              <p className="text-xs text-[var(--muted)]">
                Conecte slides de briefing, alinhamento diário e relatórios operacionais formatados.
              </p>
            </div>

            <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-4 space-y-3">
              <h5 className="text-xs font-bold text-[var(--ink)]">Vincular ID da Apresentação</h5>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="ID da Apresentação Google Slides (ex: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms)"
                  value={slideDeckId}
                  onChange={(e) => setSlideDeckId(e.target.value)}
                  className="flex-1 px-3 py-2 bg-[var(--paper)] border border-[var(--line)] rounded-lg text-xs text-[var(--ink)] font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!slideDeckId.trim()) showNotice('Insira o ID da apresentação.');
                    else showNotice('ID da apresentação configurado com sucesso!');
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </div>

            {slideDeckId && (
              <div className="border border-[var(--line)] rounded-xl overflow-hidden aspect-video bg-black/5 flex items-center justify-center">
                <iframe
                  src={`https://docs.google.com/presentation/d/${slideDeckId}/embed?start=false&loop=false&delayms=3000`}
                  title="Google Slides Preview"
                  width="100%"
                  height="100%"
                  className="w-full h-full border-0"
                  allowFullScreen
                />
              </div>
            )}
          </div>
        )}

        {/* SHEETS */}
        {activeService === 'sheets' && (
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                Google Sheets - Sincronizador de Dados
              </h4>
              <p className="text-xs text-[var(--muted)]">
                Consulta e envio de dados bidirecionais entre a lista de presença do Dimensio e sua planilha Google.
              </p>
            </div>

            <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-4 space-y-3">
              <h5 className="text-xs font-bold text-[var(--ink)]">Importar Células da Planilha</h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="ID da Planilha Google"
                  value={sheetIdInput}
                  onChange={(e) => setSheetIdInput(e.target.value)}
                  className="col-span-2 px-3 py-2 bg-[var(--paper)] border border-[var(--line)] rounded-lg text-xs text-[var(--ink)] font-mono"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!sheetIdInput.trim()) return showNotice('Informe o ID da planilha.');
                    setIsLoading(true);
                    try {
                      const vals = await fetchSheetValues(sheetIdInput, 'A1:Z50');
                      setSheetData(vals);
                      showNotice(`${vals.length} linhas carregadas com sucesso!`);
                    } catch (err: any) {
                      setErrorMsg(err.message);
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  disabled={isLoading || !currentUser}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  Ler Planilha
                </button>
              </div>
            </div>

            {sheetData.length > 0 && (
              <div className="overflow-x-auto border border-[var(--line)] rounded-xl max-h-80">
                <table className="w-full text-left text-xs border-collapse">
                  <tbody>
                    {sheetData.map((row, rIdx) => (
                      <tr key={rIdx} className={rIdx === 0 ? 'bg-[var(--bg)] font-bold' : 'border-t border-[var(--line)]'}>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="p-2 border-r border-[var(--line)] text-[var(--ink)] whitespace-nowrap">
                            {String(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* GOOGLE FORMS */}
        {activeService === 'forms' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  Google Forms - Pesquisas, Checklists & Respostas
                </h4>
                <p className="text-xs text-[var(--muted)]">
                  Crie e inspecione formulários operacionais, checklists de passagem de turno e analise respostas em tempo real.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadUserFormsList}
                  disabled={isLoading || !currentUser}
                  className="px-3 py-1.5 bg-[var(--bg)] border border-[var(--line)] hover:border-purple-500 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateFormModal(true)}
                  disabled={!currentUser}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Novo Formulário
                </button>
              </div>
            </div>

            {/* Forms Selector Carousel / List */}
            {userForms.length > 0 ? (
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider">
                  Formulários Disponíveis no Google Drive ({userForms.length})
                </label>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                  {userForms.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => handleSelectForm(f.id)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border flex items-center gap-2 ${
                        selectedFormId === f.id
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-[var(--bg)] text-[var(--ink)] border-[var(--line)] hover:border-purple-400'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate max-w-[200px]">{f.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-xs text-[var(--muted)] flex items-center justify-between">
                <span>
                  {currentUser
                    ? 'Nenhum Google Form encontrado no seu Google Drive. Crie um novo formulário operacional acima.'
                    : 'Conecte sua conta Google para listar seus formulários.'}
                </span>
                {currentUser && (
                  <button
                    type="button"
                    onClick={() => setShowCreateFormModal(true)}
                    className="px-3 py-1 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 cursor-pointer"
                  >
                    Criar Agora
                  </button>
                )}
              </div>
            )}

            {/* Selected Form Details & Responses */}
            {selectedFormData && (
              <div className="space-y-6 pt-2">
                {/* Form Header Card */}
                <div className="p-5 bg-[var(--bg)] border border-[var(--line)] rounded-xl space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                          Google Forms API
                        </span>
                        <span className="text-[10px] text-[var(--muted)] font-mono">ID: {selectedFormData.formId}</span>
                      </div>
                      <h3 className="text-base font-bold text-[var(--ink)] mt-1">
                        {selectedFormData.info.title || 'Formulário Sem Título'}
                      </h3>
                      {selectedFormData.info.description && (
                        <p className="text-xs text-[var(--muted)] mt-0.5">
                          {selectedFormData.info.description}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleRefreshFormResponses}
                        disabled={actionLoading}
                        className="px-3 py-1.5 bg-[var(--paper)] border border-[var(--line)] hover:border-purple-500 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
                        Atualizar Respostas ({formResponses.length})
                      </button>

                      {selectedFormData.responderUri ? (
                        <a
                          href={selectedFormData.responderUri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Responder / Preencher
                        </a>
                      ) : (
                        <a
                          href={`https://docs.google.com/forms/d/${selectedFormData.formId}/edit`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Abrir no Google Forms
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Summary Metric Pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-[var(--line)]">
                    <div className="p-2.5 bg-[var(--paper)] border border-[var(--line)] rounded-lg">
                      <div className="text-[10px] text-[var(--muted)] font-bold uppercase">Questões / Campos</div>
                      <div className="text-sm font-black text-[var(--ink)]">
                        {selectedFormData.items?.length || 0} Itens
                      </div>
                    </div>
                    <div className="p-2.5 bg-[var(--paper)] border border-[var(--line)] rounded-lg">
                      <div className="text-[10px] text-[var(--muted)] font-bold uppercase">Respostas Recebidas</div>
                      <div className="text-sm font-black text-purple-600 dark:text-purple-400">
                        {formResponses.length} Submissões
                      </div>
                    </div>
                    <div className="p-2.5 bg-[var(--paper)] border border-[var(--line)] rounded-lg col-span-2 sm:col-span-1">
                      <div className="text-[10px] text-[var(--muted)] font-bold uppercase">Status do Form</div>
                      <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        Ativo & Coletando
                      </div>
                    </div>
                  </div>
                </div>

                {/* Form Questions & Submissions Tabs/Columns */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* Questions Outline */}
                  <div className="lg:col-span-5 space-y-3">
                    <h5 className="text-xs font-bold text-[var(--ink)] flex items-center gap-1.5 uppercase tracking-wider">
                      <ListChecks className="w-4 h-4 text-purple-600" />
                      Estrutura do Formulário ({selectedFormData.items?.length || 0})
                    </h5>
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {(selectedFormData.items || []).map((item, idx) => {
                        const question = item.questionItem?.question;
                        const choiceQuestion = question?.choiceQuestion;
                        const isText = question?.textQuestion !== undefined;

                        return (
                          <div key={item.itemId || idx} className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono text-[var(--muted)] font-bold">#{idx + 1}</span>
                              {question?.required && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                  Obrigatório
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-bold text-[var(--ink)]">
                              {item.title || 'Campo sem título'}
                            </div>
                            {item.description && (
                              <div className="text-[11px] text-[var(--muted)]">{item.description}</div>
                            )}
                            {choiceQuestion && choiceQuestion.options && (
                              <div className="pt-1 flex flex-wrap gap-1">
                                {choiceQuestion.options.map((opt, oIdx) => (
                                  <span
                                    key={oIdx}
                                    className="px-2 py-0.5 rounded-md text-[10px] bg-[var(--paper)] border border-[var(--line)] text-[var(--ink)]"
                                  >
                                    • {opt.value}
                                  </span>
                                ))}
                              </div>
                            )}
                            {isText && (
                              <div className="text-[10px] italic text-[var(--muted)]">
                                {question?.textQuestion?.paragraph ? '[Texto longo / Parágrafo]' : '[Resposta curta]'}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Form Responses Feed */}
                  <div className="lg:col-span-7 space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold text-[var(--ink)] flex items-center gap-1.5 uppercase tracking-wider">
                        <CheckSquare className="w-4 h-4 text-emerald-500" />
                        Envios & Respostas dos Colaboradores ({formResponses.length})
                      </h5>
                    </div>

                    {formResponses.length === 0 ? (
                      <div className="p-8 text-center bg-[var(--bg)] border border-[var(--line)] rounded-xl space-y-2">
                        <div className="text-xs text-[var(--muted)]">
                          Nenhum envio recebido ainda neste formulário.
                        </div>
                        {selectedFormData.responderUri && (
                          <a
                            href={selectedFormData.responderUri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 cursor-pointer shadow-xs"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Abrir Link de Preenchimento
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                        {formResponses.map((resp, rIdx) => (
                          <div key={resp.responseId || rIdx} className="p-4 bg-[var(--bg)] border border-[var(--line)] rounded-xl space-y-2.5">
                            <div className="flex items-center justify-between text-[11px] pb-2 border-b border-[var(--line)]">
                              <span className="font-bold text-[var(--ink)]">
                                {resp.respondentEmail || `Envio #${rIdx + 1}`}
                              </span>
                              <span className="text-[10px] text-[var(--muted)] flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {resp.lastSubmittedTime ? new Date(resp.lastSubmittedTime).toLocaleString('pt-BR') : '-'}
                              </span>
                            </div>

                            {/* Answers Breakdown */}
                            <div className="space-y-1.5">
                              {resp.answers &&
                                Object.entries(resp.answers).map(([qId, ans]) => {
                                  // Look up question title from items
                                  const matchedItem = (selectedFormData.items || []).find(
                                    (it) => it.questionItem?.question?.questionId === qId
                                  );
                                  const label = matchedItem?.title || `Questão (${qId.slice(0, 6)}...)`;
                                  const textVals = ans.textAnswers?.answers?.map((a) => a.value).join(', ') || '-';

                                  return (
                                    <div key={qId} className="text-xs">
                                      <span className="text-[var(--muted)] font-semibold">{label}: </span>
                                      <span className="font-bold text-[var(--ink)]">{textVals}</span>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
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
                  {cloudSqlStatus?.status === 'connected' ? 'Ativo & Operacional' : 'Verificando...'}
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

      {/* Create Google Form Modal */}
      {showCreateFormModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-[var(--paper)] border border-[var(--line)] rounded-2xl p-6 max-w-lg w-full shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold text-[var(--ink)] flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-600" />
                Criar Novo Google Form
              </h4>
              <button
                type="button"
                onClick={() => setShowCreateFormModal(false)}
                className="text-xs text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[var(--ink)]">Modelo Pré-Configurado</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setFormTemplate('handover');
                      setNewFormTitle('Passagem de Turno Operacional');
                      setNewFormDesc('Registro oficial de troca de turno, status de postos e equipamentos.');
                    }}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      formTemplate === 'handover'
                        ? 'border-purple-600 bg-purple-500/10 text-purple-700 dark:text-purple-300 font-bold'
                        : 'border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]'
                    }`}
                  >
                    🔄 Passagem de Turno
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormTemplate('checklist');
                      setNewFormTitle('Checklist de Posto & Equipamentos');
                      setNewFormDesc('Inspeção de conformidade, EPIs, rádios e instalações.');
                    }}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      formTemplate === 'checklist'
                        ? 'border-purple-600 bg-purple-500/10 text-purple-700 dark:text-purple-300 font-bold'
                        : 'border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]'
                    }`}
                  >
                    📋 Checklist de Posto
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormTemplate('feedback');
                      setNewFormTitle('Pesquisa de Clima & Satisfação');
                      setNewFormDesc('Avaliação diária da operação, liderança e sugestões.');
                    }}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      formTemplate === 'feedback'
                        ? 'border-purple-600 bg-purple-500/10 text-purple-700 dark:text-purple-300 font-bold'
                        : 'border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]'
                    }`}
                  >
                    💬 Clima & Satisfação
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormTemplate('custom');
                      setNewFormTitle('Formulário Operacional Personalizado');
                      setNewFormDesc('Coleta de dados da equipe.');
                    }}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      formTemplate === 'custom'
                        ? 'border-purple-600 bg-purple-500/10 text-purple-700 dark:text-purple-300 font-bold'
                        : 'border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]'
                    }`}
                  >
                    ⚙️ Personalizado
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--ink)]">Título do Formulário</label>
                <input
                  type="text"
                  placeholder="Ex: Passagem de Turno Operacional"
                  value={newFormTitle}
                  onChange={(e) => setNewFormTitle(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--ink)]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--ink)]">Descrição / Instruções</label>
                <textarea
                  rows={2}
                  placeholder="Instruções para quem for preencher o formulário..."
                  value={newFormDesc}
                  onChange={(e) => setNewFormDesc(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--ink)]"
                />
              </div>

              <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-[11px] text-[var(--muted)] space-y-1">
                <span className="font-bold text-[var(--ink)]">ℹ️ O que acontecerá:</span>
                <p>
                  O formulário será provisionado diretamente na sua conta Google via Google Forms API, com link de resposta público ou corporativo e salvamento automático das submissões.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setShowCreateFormModal(false)}
                className="px-4 py-2 bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] rounded-lg text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateGoogleFormAction}
                disabled={actionLoading || !newFormTitle.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Criar no Google Forms
              </button>
            </div>
          </div>
        </div>
      )}

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
