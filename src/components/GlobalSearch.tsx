import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import {
  Search,
  X,
  Users,
  ClipboardList,
  Sparkles,
  UsersRound,
  Clock,
  FilterX,
  ChevronRight,
  Check,
  FileText,
  Send,
  Megaphone,
  UserCheck,
  Layers,
  Eye,
  RefreshCw,
  Sun,
  Globe,
  Link,
  BookOpen,
  HelpCircle,
  Copy,
  ExternalLink,
  FileCode,
} from 'lucide-react';
import {
  getCollaboratorStatus,
  matchesSearch,
  matchesCollaboratorSearch,
  sortBySearchScore,
  scoreCollaboratorSearch,
  compareStringsBR,
  sortCollaboratorsAlphabetical,
  parseSearchIntent,
  type StatusType,
  type ContextualSearchIntent,
} from '../utils/helpers';
import type { BreakSlot, Collaborator, Task } from '../types';
import { CollabDetailsModal } from './CollabDetailsModal';
import { MarkdownContent } from './MarkdownContent';
import { getAllTaskIdsInFamily, getRootTask, getDirectSubtasks } from '../utils/taskTreeHelpers';
import { parseSmartSearchAction, type ParsedSmartAction } from '../utils/smartSearchEngine';

const STATUS_META: Record<StatusType, { label: string; text: string; bg: string; dot: string }> = {
  presente: {
    label: 'Presente',
    text: 'text-emerald-800 dark:text-emerald-200',
    bg: 'bg-emerald-100 dark:bg-emerald-950/70 border-emerald-300 dark:border-emerald-800',
    dot: 'bg-emerald-600',
  },
  atraso: {
    label: 'Atraso',
    text: 'text-amber-800 dark:text-amber-200',
    bg: 'bg-amber-100 dark:bg-amber-950/70 border-amber-300 dark:border-amber-800',
    dot: 'bg-amber-600',
  },
  folga: {
    label: 'Folga',
    text: 'text-slate-700 dark:text-slate-300',
    bg: 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700',
    dot: 'bg-slate-500',
  },
  ferias: {
    label: 'Férias',
    text: 'text-purple-800 dark:text-purple-200',
    bg: 'bg-purple-100 dark:bg-purple-950/70 border-purple-300 dark:border-purple-800',
    dot: 'bg-purple-600',
  },
  licenca: {
    label: 'Licença',
    text: 'text-amber-800 dark:text-amber-200',
    bg: 'bg-amber-100 dark:bg-amber-950/70 border-amber-300 dark:border-amber-800',
    dot: 'bg-amber-600',
  },
  atestado: {
    label: 'Atestado',
    text: 'text-blue-800 dark:text-blue-200',
    bg: 'bg-blue-100 dark:bg-blue-950/70 border-blue-300 dark:border-blue-800',
    dot: 'bg-blue-600',
  },
  banco_horas: {
    label: 'Banco de Horas',
    text: 'text-teal-800 dark:text-teal-200',
    bg: 'bg-teal-100 dark:bg-teal-950/70 border-teal-300 dark:border-teal-800',
    dot: 'bg-teal-600',
  },
  falta_injustificada: {
    label: 'Falta Injustificada',
    text: 'text-rose-800 dark:text-rose-200',
    bg: 'bg-rose-100 dark:bg-rose-950/70 border-rose-300 dark:border-rose-800',
    dot: 'bg-rose-600',
  },
  treinamento: {
    label: 'Treinamento',
    text: 'text-cyan-800 dark:text-cyan-200',
    bg: 'bg-cyan-100 dark:bg-cyan-950/70 border-cyan-300 dark:border-cyan-800',
    dot: 'bg-cyan-600',
  },
  ausente: {
    label: 'Ausente',
    text: 'text-red-800 dark:text-red-200',
    bg: 'bg-red-100 dark:bg-red-950/70 border-red-300 dark:border-red-800',
    dot: 'bg-red-600',
  },
};

const STATUS_ORDER: StatusType[] = [
  'presente',
  'atraso',
  'folga',
  'ferias',
  'licenca',
  'atestado',
  'treinamento',
  'banco_horas',
  'falta_injustificada',
  'ausente',
];

const ABSENCE_TERMS: { term: string; status: StatusType; label: string }[] = [
  { term: 'presente', status: 'presente', label: 'Presente' },
  { term: 'atraso', status: 'atraso', label: 'Atraso' },
  { term: 'folga', status: 'folga', label: 'Folga' },
  { term: 'ferias', status: 'ferias', label: 'Férias' },
  { term: 'férias', status: 'ferias', label: 'Férias' },
  { term: 'licenca', status: 'licenca', label: 'Licença' },
  { term: 'licença', status: 'licenca', label: 'Licença' },
  { term: 'atestado', status: 'atestado', label: 'Atestado' },
  { term: 'treinamento', status: 'treinamento', label: 'Treinamento' },
  { term: 'banco de horas', status: 'banco_horas', label: 'Banco de Horas' },
  { term: 'banco_horas', status: 'banco_horas', label: 'Banco de Horas' },
  { term: 'falta injustificada', status: 'falta_injustificada', label: 'Falta Injustificada' },
  { term: 'falta_injustificada', status: 'falta_injustificada', label: 'Falta Injustificada' },
  { term: 'falta', status: 'falta_injustificada', label: 'Falta Injustificada' },
  { term: 'ausente', status: 'ausente', label: 'Ausente' },
];

interface CollabResult {
  collab: Collaborator;
  status: StatusType;
  tasksToday: Task[];
  breakSlot?: BreakSlot;
  isOffScale: boolean;
  isExtraPresence: boolean;
}

interface TaskResult {
  task: Task;
  members: Array<{
    collab: Collaborator;
    status: StatusType;
    breakSlot?: BreakSlot;
    viaSubtask?: boolean;
    subtaskName?: string;
  }>;
  rootTaskName?: string;
  isSubtask: boolean;
  hasSubtasks: boolean;
  subtaskCount: number;
}

interface SkillCollabResult {
  collab: Collaborator;
  status: StatusType;
  skills: Array<{ name: string; level: number }>;
}

export const GlobalSearch: React.FC = () => {
  const appContext = useApp();
  const {
    state,
    setStatusReason,
    addInterval,
    showNotice,
    createServiceRequest,
    updateCollaborator,
    assignTask,
    unassignTask,
    identifiedUser,
    identifyUser,
  } = appContext;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusType | 'all'>('all');
  const [levelFilter, setLevelFilter] = useState<number | 'all'>('all');
  const [breakFilter, setBreakFilter] = useState<'all' | 'with' | 'without'>('all');
  const [selectedCollab, setSelectedCollab] = useState<Collaborator | null>(null);

  // Intelligent Contextual Smart Action
  const smartAction: ParsedSmartAction | null = useMemo(() => {
    if (!query.trim() || query.trim().length < 3) return null;
    return parseSmartSearchAction(query, { state, identifiedUser });
  }, [query, state, identifiedUser]);

  // Command palette state
  const [cmdSelectedCollabIds, setCmdSelectedCollabIds] = useState<string[]>([]);
  const [cmdSelectedTaskId, setCmdSelectedTaskId] = useState<string>('');
  const [cmdCollabSearchText, setCmdCollabSearchText] = useState<string>('');
  const [cmdBreakTime, setCmdBreakTime] = useState<string>('');
  const [cmdShiftInput, setCmdShiftInput] = useState<string>('T2');
  const [cmdStatusInput, setCmdStatusInput] = useState<StatusType>('presente');
  const [cmdStatusReason, setCmdStatusReason] = useState<string>('Comando Global');
  const [cmdReqTitle, setCmdReqTitle] = useState<string>('');
  const [cmdReqDesc, setCmdReqDesc] = useState<string>('');
  const [cmdReqType, setCmdReqType] = useState<'aviso' | 'acao_sistemica'>('acao_sistemica');
  const [cmdReqPriority, setCmdReqPriority] = useState<'baixa' | 'media' | 'alta' | 'urgente'>('media');
  const [cmdReqAudience, setCmdReqAudience] = useState<'atual' | 'proximo' | 'proximos' | 'todos'>('atual');

  // Autocomplete state
  const [autocompleteIndex, setAutocompleteIndex] = useState<number>(0);

  // Multi-selection & Batch Action State
  const [selectedMultiIds, setSelectedMultiIds] = useState<string[]>([]);
  const [lastSelectedCollabId, setLastSelectedCollabId] = useState<string | null>(null);
  const [batchStatusInput, setBatchStatusInput] = useState<StatusType | ''>('');
  const [batchBreakTimeInput, setBatchBreakTimeInput] = useState<string>('');
  const [batchTaskId, setBatchTaskId] = useState<string>('');

  // Batch Request Modal State
  const [isBatchRequestOpen, setIsBatchRequestOpen] = useState(false);
  const [batchReqTitle, setBatchReqTitle] = useState('');
  const [batchReqDescription, setBatchReqDescription] = useState('');
  const [batchReqType, setBatchReqType] = useState<'aviso' | 'acao_sistemica'>('acao_sistemica');
  const [batchReqPriority, setBatchReqPriority] = useState<'baixa' | 'media' | 'alta' | 'urgente'>('media');
  const [batchReqAudience, setBatchReqAudience] = useState<'atual' | 'proximo' | 'proximos' | 'todos'>('atual');

  // Commands Meta
  const COMMAND_ITEMS = useMemo(() => [
    {
      cmd: '/tarefa',
      label: '/tarefa',
      badge: 'Rotina & Feedback',
      desc: 'Criar tarefa ou agendamento (Ex: /tarefa: adicionar "Lucas" na lista de feedback 16/09)',
      icon: ClipboardList,
      color: 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/30',
    },
    {
      cmd: '/alocar',
      label: '/alocar',
      badge: 'Alocar em Posto',
      desc: 'Mover colaborador para tarefa (Ex: /alocar Carlos em Recebimento)',
      icon: Layers,
      color: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/30',
    },
    {
      cmd: '/intervalo',
      label: '/intervalo',
      badge: 'Definir Pausa',
      desc: 'Definir horário de intervalo (Ex: /intervalo Mariana para 14:15)',
      icon: Clock,
      color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    },
    {
      cmd: '/rotacionar',
      label: '/rotacionar',
      badge: 'Rodízio Justo',
      desc: 'Executar rotação diária de intervalos (+1 slot)',
      icon: RefreshCw,
      color: 'text-teal-600 dark:text-teal-400 bg-teal-500/10 border-teal-500/30',
    },
    {
      cmd: '/ausencia',
      label: '/ausencia',
      badge: 'Atestado / Folga',
      desc: 'Registrar ausência ou afastamento (Ex: /ausencia Carlos atestado 18/09 consulta)',
      icon: UserCheck,
      color: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30',
    },
    {
      cmd: '/pedido',
      label: '/pedido',
      badge: 'Novo Pedido',
      desc: 'Registrar chamado de serviço (Ex: /pedido Troca de fita impressora 02)',
      icon: Send,
      color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30',
    },
    {
      cmd: '/aviso',
      label: '/aviso',
      badge: 'Mural de Avisos',
      desc: 'Publicar aviso no Hub de Informações (Ex: /aviso Reunião geral às 15:30)',
      icon: Megaphone,
      color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
    },
  ], []);

  // Live Autocomplete Suggestions Generator
  const autocompleteSuggestions = useMemo(() => {
    if (!query.startsWith('/')) return [];

    const lowerQuery = query.toLowerCase().trim();
    const spaceIndex = query.indexOf(' ');

    // 1. Slash command name completion (e.g. typing "/dim" or "/pe")
    if (spaceIndex === -1) {
      return COMMAND_ITEMS.filter((item) => item.cmd.startsWith(lowerQuery)).map((item) => ({
        type: 'command' as const,
        value: `${item.cmd} `,
        displayText: item.cmd,
        subText: item.desc,
        badge: item.badge,
        color: item.color,
      }));
    }

    // 2. Element autocompletion inside a command
    const cmdName = query.slice(0, spaceIndex).toLowerCase();
    const argsStr = query.slice(spaceIndex + 1);
    const terms = argsStr.split(',');
    const activeTerm = terms[terms.length - 1].trim().toLowerCase();

    if (!activeTerm) return [];

    const suggestions: Array<{
      type: 'collab' | 'task' | 'break' | 'status' | 'command';
      value: string;
      displayText: string;
      subText?: string;
      badge?: string;
      color?: string;
    }> = [];

    // Collabs matching active term (relevância: nome próprio primeiro)
    const matchedCollabs = sortBySearchScore(
      state.collaborators.filter(
        (c) => matchesSearch(c.name, activeTerm) || matchesSearch(c.login, activeTerm)
      ),
      activeTerm,
      { defaultTeamLeader: state.defaultTeamLeader }
    );
    matchedCollabs.slice(0, 5).forEach((c) => {
      suggestions.push({
        type: 'collab',
        value: c.name,
        displayText: c.name,
        subText: `${c.role || 'Colaborador'}${c.login ? ` (${c.login})` : ''}`,
        badge: 'Colaborador',
        color: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
      });
    });

    // Tasks matching active term (for /dimensionamento or /pedido)
    if (cmdName === '/dimensionamento' || cmdName === '/pedido') {
      const matchedTasks = state.tasks
        .filter((t) => t.active !== false && matchesSearch(t.name, activeTerm));
      matchedTasks.slice(0, 4).forEach((t) => {
        suggestions.push({
          type: 'task',
          value: t.name,
          displayText: t.name,
          subText: `Tarefa com ${t.members.length} membro(s)`,
          badge: 'Tarefa',
          color: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
        });
      });
    }

    // Breaks matching active term (for /intervalo)
    if (cmdName === '/intervalo') {
      const defaultTimes = ['11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'];
      const slotTimes = Array.from(new Set([...(state.breaks || []).map((b) => b.time), ...defaultTimes]));
      const matchedTimes = slotTimes.filter((t) => t.toLowerCase().includes(activeTerm));
      matchedTimes.slice(0, 5).forEach((t) => {
        suggestions.push({
          type: 'break',
          value: t,
          displayText: t,
          subText: 'Horário de Intervalo',
          badge: 'Intervalo',
          color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
        });
      });
    }

    // Status matching active term (for /status)
    if (cmdName === '/status') {
      const statusOptions: Array<{ term: string; status: StatusType; label: string }> = [
        { term: 'presente', status: 'presente', label: 'Presente' },
        { term: 'atraso', status: 'atraso', label: 'Atraso' },
        { term: 'folga', status: 'folga', label: 'Folga' },
        { term: 'ferias', status: 'ferias', label: 'Férias' },
        { term: 'licenca', status: 'licenca', label: 'Licença' },
        { term: 'atestado', status: 'atestado', label: 'Atestado' },
        { term: 'treinamento', status: 'treinamento', label: 'Treinamento' },
        { term: 'banco de horas', status: 'banco_horas', label: 'Banco de Horas' },
        { term: 'falta injustificada', status: 'falta_injustificada', label: 'Falta Injustificada' },
        { term: 'ausente', status: 'ausente', label: 'Ausente' },
      ];

      const matchedStatuses = statusOptions.filter(
        (s) => matchesSearch(s.term, activeTerm) || matchesSearch(s.label, activeTerm)
      );
      matchedStatuses.forEach((st) => {
        suggestions.push({
          type: 'status',
          value: st.term,
          displayText: st.label,
          subText: `Status de Presença (${st.term})`,
          badge: 'Status',
          color: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30',
        });
      });
    }

    return suggestions;
  }, [query, state.collaborators, state.tasks, state.breaks, COMMAND_ITEMS]);

  const applyAutocomplete = (suggestion: typeof autocompleteSuggestions[0]) => {
    if (!suggestion) return;

    if (suggestion.type === 'command') {
      setQuery(suggestion.value);
    } else {
      const spaceIndex = query.indexOf(' ');
      if (spaceIndex === -1) {
        setQuery(suggestion.value);
      } else {
        const cmdName = query.slice(0, spaceIndex);
        const argsStr = query.slice(spaceIndex + 1);
        const terms = argsStr.split(',');
        const previousTerms = terms.slice(0, -1).map((t) => t.trim()).filter(Boolean);

        const newTerms = [...previousTerms, suggestion.value];
        setQuery(`${cmdName} ${newTerms.join(', ')}, `);
      }
    }
    setAutocompleteIndex(0);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
  };

  // Live Command Context Parser
  const commandContext = useMemo(() => {
    if (!query.startsWith('/')) return null;

    const parts = query.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const argsString = query.slice(parts[0].length).trim();
    const rawTerms = argsString
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    // Find collaborators matching any rawTerm (relevância primeiro)
    const autoMatchedCollabs = state.collaborators
      .filter((c) => {
        if (rawTerms.length === 0) return false;
        return rawTerms.some((term) => matchesCollaboratorSearch(c, term, { defaultTeamLeader: state.defaultTeamLeader }));
      })
      .sort((a, b) => {
        const term = rawTerms.join(' ');
        const scoreDiff =
          scoreCollaboratorSearch(b, term, { defaultTeamLeader: state.defaultTeamLeader }) -
          scoreCollaboratorSearch(a, term, { defaultTeamLeader: state.defaultTeamLeader });
        if (scoreDiff !== 0) return scoreDiff;
        return compareStringsBR(a.name, b.name);
      });

    // Find task matching any rawTerm
    const activeTasks = state.tasks.filter((t) => t.active !== false);
    let autoMatchedTask: Task | null = null;
    if (rawTerms.length > 0) {
      for (const term of rawTerms) {
        const found = activeTasks.find((t) => matchesSearch(t.name, term));
        if (found) {
          autoMatchedTask = found;
          break;
        }
      }
    }

    // Find interval slot matching any rawTerm
    let autoMatchedBreak: string = '';
    if (rawTerms.length > 0) {
      for (const term of rawTerms) {
        const found = (state.breaks || []).find((b) => matchesSearch(b.time, term));
        if (found) {
          autoMatchedBreak = found.time;
          break;
        }
      }
    }

    // Find status matching any rawTerm
    let autoMatchedStatus: StatusType | null = null;
    if (rawTerms.length > 0) {
      for (const term of rawTerms) {
        const foundMeta = ABSENCE_TERMS.find((st) => matchesSearch(st.term, term) || matchesSearch(st.label, term));
        if (foundMeta) {
          autoMatchedStatus = foundMeta.status;
          break;
        }
      }
    }

    return {
      cmd,
      argsString,
      rawTerms,
      autoMatchedCollabs,
      autoMatchedTask,
      autoMatchedBreak,
      autoMatchedStatus,
      activeTasks,
    };
  }, [query, state.collaborators, state.tasks, state.breaks]);

  const handleExecuteDimensionamento = () => {
    const collabIdsToMove = Array.from(
      new Set([
        ...cmdSelectedCollabIds,
        ...(commandContext?.autoMatchedCollabs.map((c) => c.id) || []),
      ])
    );
    const targetTaskId = cmdSelectedTaskId || commandContext?.autoMatchedTask?.id || '';

    if (collabIdsToMove.length === 0) {
      showNotice('Nenhum colaborador encontrado ou selecionado para mover.');
      return;
    }
    if (!targetTaskId) {
      showNotice('Selecione a tarefa de destino.');
      return;
    }

    const targetTaskObj = state.tasks.find((t) => t.id === targetTaskId);
    const targetTaskName = targetTaskObj ? targetTaskObj.name : 'tarefa';

    collabIdsToMove.forEach((collabId) => {
      assignTask(collabId, targetTaskId);
    });

    const collabNames = state.collaborators
      .filter((c) => collabIdsToMove.includes(c.id))
      .map((c) => c.name);

    showNotice(
      `✅ ${collabNames.length} colaborador(es) (${collabNames.join(', ')}) movido(s) para a tarefa '${targetTaskName}'!`
    );
    setCmdSelectedCollabIds([]);
    setCmdSelectedTaskId('');
    setQuery('');
    setOpen(false);
  };

  const handleExecutePedido = () => {
    // Ensure user identification exists for requests
    if (!identifiedUser) {
      identifyUser('admin');
    }

    const targetCollabs = state.collaborators.filter(
      (c) =>
        cmdSelectedCollabIds.includes(c.id) ||
        (commandContext?.autoMatchedCollabs || []).some((m) => m.id === c.id)
    );

    const rawText = commandContext?.argsString || '';
    let cleanTitle = cmdReqTitle.trim();

    if (!cleanTitle && rawText) {
      let text = rawText;
      if (targetCollabs.length > 0) {
        targetCollabs.forEach((collab) => {
          text = text.replace(new RegExp(collab.name, 'gi'), '').replace(new RegExp(collab.login, 'gi'), '');
        });
        text = text.replace(/^[\s,]+|[\s,]+$/g, '');
      }
      cleanTitle = text || rawText;
    }

    if (!cleanTitle) {
      cleanTitle = 'Solicitação de Ação Operacional';
    }

    if (targetCollabs.length === 0 && !cmdSelectedCollabIds.length) {
      const res = createServiceRequest({
        type: cmdReqType,
        title: cleanTitle,
        description: cmdReqDesc.trim() || 'Registrado via Comando Global',
        priority: cmdReqPriority,
        shift: state.teamShift || 'T2',
        targetShiftAudience: cmdReqAudience,
      });
      if (res?.message) showNotice(res.message);
    } else {
      const selectedNames = targetCollabs.map((c) => c.name);
      const tasksInfo = targetCollabs
        .map((c) => {
          const tObj = state.tasks.find((t) => t.members.includes(c.id));
          return tObj ? `${c.name} (${tObj.name})` : c.name;
        })
        .join(', ');

      createServiceRequest({
        type: cmdReqType,
        title: `${cleanTitle} - ${selectedNames.join(', ')}`,
        description: cmdReqDesc.trim() || `Pedido envolvendo: ${tasksInfo}`,
        priority: cmdReqPriority,
        shift: state.teamShift || 'T2',
        targetShiftAudience: cmdReqAudience,
        collaboratorId: targetCollabs[0]?.id,
        collaboratorName: selectedNames.join(', '),
        selectedCollaborators: selectedNames,
      });
      showNotice(`✅ Pedido registrado com sucesso para ${selectedNames.join(', ')}!`);
    }

    setCmdReqTitle('');
    setCmdReqDesc('');
    setCmdSelectedCollabIds([]);
    setQuery('');
    setOpen(false);
  };

  const handleExecuteIntervalo = () => {
    const targetCollabs = Array.from(
      new Set([
        ...cmdSelectedCollabIds,
        ...(commandContext?.autoMatchedCollabs.map((c) => c.id) || []),
      ])
    );
    const targetBreakTime = cmdBreakTime.trim() || commandContext?.autoMatchedBreak || '';

    if (targetCollabs.length === 0) {
      showNotice('Selecione ao menos um colaborador para o intervalo.');
      return;
    }
    if (!targetBreakTime) {
      showNotice('Informe ou selecione o horário do intervalo (ex: 12:00).');
      return;
    }

    targetCollabs.forEach((id) => {
      addInterval(id, targetBreakTime);
    });

    const names = state.collaborators
      .filter((c) => targetCollabs.includes(c.id))
      .map((c) => c.name);

    showNotice(`✅ Intervalo "${targetBreakTime}" aplicado para ${names.join(', ')}!`);
    setCmdSelectedCollabIds([]);
    setCmdBreakTime('');
    setQuery('');
    setOpen(false);
  };

  const handleExecuteStatus = () => {
    const targetCollabs = Array.from(
      new Set([
        ...cmdSelectedCollabIds,
        ...(commandContext?.autoMatchedCollabs.map((c) => c.id) || []),
      ])
    );
    const targetStatus = (commandContext?.autoMatchedStatus || cmdStatusInput || 'presente') as StatusType;

    if (targetCollabs.length === 0) {
      showNotice('Selecione ao menos um colaborador.');
      return;
    }

    const trocaFolgaCollabs = targetCollabs
      .map((id) => state.collaborators.find((c) => c.id === id))
      .filter((c): c is Collaborator => Boolean(c))
      .filter((c) => {
        const info = getCollaboratorStatus(c, activeDate, state);
        return info.isOffScale && info.status === 'folga';
      });

    targetCollabs.forEach((id) => {
      setStatusReason(id, targetStatus, cmdStatusReason || 'Comando Global');
    });

    const names = state.collaborators
      .filter((c) => targetCollabs.includes(c.id))
      .map((c) => c.name);

    const statusLabel = STATUS_META[targetStatus]?.label || targetStatus;
    const extra =
      targetStatus === 'presente' && trocaFolgaCollabs.length > 0
        ? ` • Troca de Folga registrada para ${trocaFolgaCollabs.map((c) => c.name).join(', ')}`
        : '';
    showNotice(`✅ Status "${statusLabel}" aplicado para ${names.join(', ')}!${extra}`);
    setCmdSelectedCollabIds([]);
    setQuery('');
    setOpen(false);
  };

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [panelPosition, setPanelPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  const measurePanelPosition = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const width = vw < 640 ? Math.max(rect.width, vw - 24) : vw < 768 ? 580 : vw < 1024 ? 760 : 860;
    const left = Math.min(Math.max(rect.left + rect.width / 2, width / 2 + 8), vw - width / 2 - 8);
    setPanelPosition({ top: rect.bottom + 8, left, width });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPanelPosition(null);
      return;
    }
    measurePanelPosition();
    window.addEventListener('resize', measurePanelPosition);
    window.addEventListener('scroll', measurePanelPosition, true);
    return () => {
      window.removeEventListener('resize', measurePanelPosition);
      window.removeEventListener('scroll', measurePanelPosition, true);
    };
  }, [open, measurePanelPosition]);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        (wrapperRef.current && wrapperRef.current.contains(target)) ||
        (panelRef.current && panelRef.current.contains(target))
      ) {
        return;
      }
      if (target instanceof HTMLElement && target.closest('.fixed, [role="dialog"]')) {
        return;
      }
      setOpen(false);
    };

    const handleFocusSearch = () => {
      inputRef.current?.focus();
      inputRef.current?.select();
      setOpen(true);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setSelectedCollab(null);
        return;
      }

      // Check if user is typing inside an editable field
      const activeEl = document.activeElement;
      const isEditable =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          (activeEl as HTMLElement).isContentEditable);

      if (isEditable) return;

      // Trigger global search shortcut with 's' or 'S' or '/' or Ctrl+K / Cmd+K
      if (
        e.key === 's' ||
        e.key === 'S' ||
        e.key === '/' ||
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')
      ) {
        e.preventDefault();
        handleFocusSearch();
      }
    };

    document.addEventListener('mousedown', onDocMouseDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('open-global-search', handleFocusSearch);

    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('open-global-search', handleFocusSearch);
    };
  }, []);

  const activeDate = state.selectedDate;
  const dayIntervals = state.intervals[activeDate] || {};
  const q = query.trim();
  const active = open && (q.length >= 1 || query.startsWith('/'));

  const colShifts = state.collaborators.map((c) => c.shift || 'Geral');
  const availableShifts = Array.from(new Set([...(state.shifts || []), ...colShifts]));

  const activeShiftFilter = state.selectedShiftFilter || state.teamShift || 'ALL';

  const identifiedCollaborator = useMemo(() => {
    if (!identifiedUser) return null;
    return state.collaborators.find((c) => c.id === identifiedUser.id) || null;
  }, [identifiedUser, state.collaborators]);

  const searchIntent: ContextualSearchIntent = useMemo(() => {
    return parseSearchIntent(q, identifiedCollaborator);
  }, [q, identifiedCollaborator]);

  const results = useMemo(() => {
    const collabResults: CollabResult[] = state.collaborators
      .filter((c) => {
        if (!q && activeShiftFilter !== 'ALL' && activeShiftFilter !== 'todos' && activeShiftFilter !== 'Geral') {
          if (c.shift && c.shift !== 'Geral' && c.shift !== 'Todos' && c.shift !== activeShiftFilter) {
            return false;
          }
        }
        // Match collaborator based on standard and contextual search
        return matchesCollaboratorSearch(c, q, {
          defaultTeamLeader: state.defaultTeamLeader,
        });
      })
      .map((c) => {
        const stInfo = getCollaboratorStatus(c, activeDate, state);
        const tasksToday = state.tasks.filter((t) => t.active !== false && t.members.includes(c.id));
        const breakSlot = state.breaks.find((b) => (dayIntervals[b.id] || []).includes(c.id));
        return {
          collab: c,
          status: stInfo.status,
          tasksToday,
          breakSlot,
          isOffScale: stInfo.isOffScale,
          isExtraPresence: stInfo.isExtraPresence,
        };
      })
      .sort((a, b) => {
        // If personal scope, prioritize identified user at top
        if (identifiedUser) {
          if (a.collab.id === identifiedUser.id) return -1;
          if (b.collab.id === identifiedUser.id) return 1;
        }
        // Relevância: nome próprio antes de time/líder (ex: "matheus"
        // mostra os Matheus antes dos liderados por um Matheus)
        if (q.trim()) {
          const scoreDiff =
            scoreCollaboratorSearch(b.collab, q, { defaultTeamLeader: state.defaultTeamLeader }) -
            scoreCollaboratorSearch(a.collab, q, { defaultTeamLeader: state.defaultTeamLeader });
          if (scoreDiff !== 0) return scoreDiff;
        }
        return compareStringsBR(a.collab.name, b.collab.name);
      });

    const taskResults: TaskResult[] = state.tasks
      .filter((t) => {
        if (t.active === false) return false;
        // Direct name search
        if (matchesSearch(t.name, q)) return true;
        // Contextual: if search matches a scale (e.g. "turma B"), include tasks that have Turma B members
        if (searchIntent.detectedScale) {
          const hasScaleMember = (t.members || []).some((mId) => {
            const m = state.collaborators.find((c) => c.id === mId);
            return m && m.scale?.toUpperCase() === searchIntent.detectedScale?.toUpperCase();
          });
          if (hasScaleMember) return true;
        }
        // Contextual: if search is personal, include tasks where identified user is member
        if (searchIntent.isPersonalScope && identifiedUser && (t.members || []).includes(identifiedUser.id)) {
          return true;
        }
        return false;
      })
      .map((t) => {
        // Hierarquia completa: tarefa pai agrupa os colaboradores de toda a família
        const root = getRootTask(state.tasks, t.id);
        const isSubtask = Boolean(root && root.id !== t.id);
        const rootTaskName = root && root.id !== t.id ? root.name : undefined;
        const directSubtasks = getDirectSubtasks(state.tasks, t.id);
        const hasSubtasks = directSubtasks.length > 0;

        // IDs de toda a família (raiz + descendentes)
        const familyIds = new Set(getAllTaskIdsInFamily(state.tasks, t.id));
        const familyTasks = state.tasks.filter((ft) => ft.active !== false && familyIds.has(ft.id));

        const membersMap = new Map<string, { collab: Collaborator; status: StatusType; breakSlot?: BreakSlot; viaSubtask?: boolean; subtaskName?: string }>();

        familyTasks.forEach((ft) => {
          const viaSubtask = ft.id !== t.id;
          (ft.members || []).forEach((id) => {
            const c = state.collaborators.find((col) => col.id === id);
            if (!c) return;
            membersMap.set(id, {
              collab: c,
              status: getCollaboratorStatus(c, activeDate, state).status,
              breakSlot: state.breaks.find((b) => (dayIntervals[b.id] || []).includes(c.id)),
              viaSubtask: viaSubtask || undefined,
              subtaskName: viaSubtask ? ft.name : undefined,
            });
          });
        });

        return {
          task: t,
          members: Array.from(membersMap.values()),
          rootTaskName,
          isSubtask,
          hasSubtasks,
          subtaskCount: directSubtasks.length,
        };
      });

    const skillSet = new Set<string>();
    state.skills.forEach((s) => {
      if (matchesSearch(s, q)) skillSet.add(s);
    });
    state.collaborators.forEach((c) => {
      Object.keys(c.skills || {}).forEach((s) => {
        if (matchesSearch(s, q)) skillSet.add(s);
      });
    });
    const matchedSkills = [...skillSet];

    const skillCollabs: SkillCollabResult[] = matchedSkills.length
      ? state.collaborators
          .filter((c) => matchedSkills.some((s) => (c.skills?.[s] || 0) > 0))
          .map((c) => ({
            collab: c,
            status: getCollaboratorStatus(c, activeDate, state).status,
            skills: matchedSkills
              .filter((s) => (c.skills?.[s] || 0) > 0)
              .map((s) => ({ name: s, level: c.skills![s] })),
          }))
      : [];

    const matchedRoles = state.roles.filter((r) => matchesSearch(r, q));
    const matchedCategories = state.categories.filter((c) => matchesSearch(c, q));
    const matchedTLs = state.teamLeaders.filter((tl) => matchesSearch(tl, q));
    const matchedShifts = availableShifts.filter((s) => matchesSearch(s, q));

    const groupCollabs = state.collaborators.filter((c) => {
      const tl = c.teamLeader || state.defaultTeamLeader || 'Sem Time';
      return (
        matchedRoles.includes(c.role) ||
        matchedCategories.includes(c.category) ||
        matchedTLs.includes(tl) ||
        matchedShifts.includes(c.shift || 'Geral')
      );
    });

    const matchedAbsenceTypes = ABSENCE_TERMS.filter((a) => matchesSearch(a.term, q));
    const absenceCollabs = matchedAbsenceTypes.length
      ? state.collaborators.filter((c) =>
          matchedAbsenceTypes.some((a) => getCollaboratorStatus(c, activeDate, state).status === a.status)
        )
      : [];

    // Central de Informações & Hub Search
    const matchedInfoHubLinks = (state.infoHubLinks || []).filter((l) => {
      if (activeShiftFilter !== 'ALL' && activeShiftFilter !== 'todos' && activeShiftFilter !== 'Geral') {
        const itemShift = l.shift || 'Todos';
        if (itemShift !== 'Todos' && itemShift !== 'Geral' && itemShift !== activeShiftFilter) return false;
      }
      return (
        matchesSearch(l.title, q) ||
        matchesSearch(l.category || '', q) ||
        matchesSearch(l.description || '', q) ||
        matchesSearch(l.url || '', q)
      );
    });

    const matchedInfoHubQuickFills = (state.infoHubQuickFills || []).filter((qf) => {
      if (activeShiftFilter !== 'ALL' && activeShiftFilter !== 'todos' && activeShiftFilter !== 'Geral') {
        const itemShift = qf.shift || 'Todos';
        if (itemShift !== 'Todos' && itemShift !== 'Geral' && itemShift !== activeShiftFilter) return false;
      }
      return (
        matchesSearch(qf.title, q) ||
        matchesSearch(qf.category || '', q) ||
        matchesSearch(qf.description || '', q) ||
        (qf.tags || []).some((t) => matchesSearch(t, q)) ||
        (qf.items || []).some(
          (sub) => matchesSearch(sub.label, q) || matchesSearch(sub.codeValue, q)
        )
      );
    });

    const matchedInfoHubReminders = (state.infoHubReminders || []).filter((r) => {
      if (activeShiftFilter !== 'ALL' && activeShiftFilter !== 'todos' && activeShiftFilter !== 'Geral') {
        const itemShift = r.shift || 'Todos';
        if (itemShift !== 'Todos' && itemShift !== 'Geral' && itemShift !== activeShiftFilter) return false;
      }
      return (
        matchesSearch(r.text, q) ||
        matchesSearch(r.shift || '', q) ||
        matchesSearch(r.authorName || '', q)
      );
    });

    const matchedProcessKnowledge = (state.processKnowledgeList || []).filter((p) => {
      if (activeShiftFilter !== 'ALL' && activeShiftFilter !== 'todos' && activeShiftFilter !== 'Geral') {
        const itemShift = p.shift || 'Todos';
        if (itemShift !== 'Todos' && itemShift !== 'Geral' && itemShift !== activeShiftFilter) return false;
      }
      return (
        matchesSearch(p.title, q) ||
        matchesSearch(p.category || '', q) ||
        matchesSearch(p.description || '', q) ||
        (p.keyTakeaways || []).some((kt) => matchesSearch(kt, q))
      );
    });

    const matchedServiceRequests = (state.serviceRequests || []).filter((sr) => {
      if (activeShiftFilter !== 'ALL' && activeShiftFilter !== 'todos' && activeShiftFilter !== 'Geral') {
        const itemShift = sr.shift || 'T2';
        if (
          itemShift !== activeShiftFilter &&
          itemShift !== 'Todos' &&
          itemShift !== 'Geral' &&
          sr.targetShiftAudience !== 'todos' &&
          sr.targetShiftAudience !== 'proximos' &&
          sr.targetShiftAudience !== 'proximo'
        ) {
          return false;
        }
      }
      return (
        matchesSearch(sr.title, q) ||
        matchesSearch(sr.description || '', q) ||
        matchesSearch(sr.requesterName || '', q) ||
        matchesSearch(sr.collaboratorName || '', q)
      );
    });

    return {
      collabResults,
      taskResults,
      matchedSkills,
      skillCollabs,
      matchedRoles,
      matchedCategories,
      matchedTLs,
      matchedShifts,
      groupCollabs,
      matchedAbsenceTypes,
      absenceCollabs,
      matchedInfoHubLinks,
      matchedInfoHubQuickFills,
      matchedInfoHubReminders,
      matchedProcessKnowledge,
      matchedServiceRequests,
    };
  }, [state, q, activeDate, dayIntervals, availableShifts.join(',')]);

  const filteredCollabResults = collabResultsFiltered(results.collabResults, statusFilter);
  const filteredGroupCollabs = collabResultsFiltered(
    results.groupCollabs.map((c) => {
      const stInfo = getCollaboratorStatus(c, activeDate, state);
      return {
        collab: c,
        status: stInfo.status,
        tasksToday: [],
        breakSlot: undefined,
        isOffScale: stInfo.isOffScale,
        isExtraPresence: stInfo.isExtraPresence,
      };
    }),
    statusFilter
  );
  const filteredSkillCollabs = results.skillCollabs.filter(
    (item) =>
      (statusFilter === 'all' || item.status === statusFilter) &&
      (levelFilter === 'all' || item.skills.some((s) => s.level === levelFilter))
  );
  const filteredAbsenceCollabs = collabResultsFiltered(
    results.absenceCollabs.map((c) => {
      const stInfo = getCollaboratorStatus(c, activeDate, state);
      return {
        collab: c,
        status: stInfo.status,
        tasksToday: [],
        breakSlot: undefined,
        isOffScale: stInfo.isOffScale,
        isExtraPresence: stInfo.isExtraPresence,
      };
    }),
    statusFilter
  );

  const filteredTasks = results.taskResults
    .map((tr) => ({
      ...tr,
      members: tr.members.filter((m) =>
        breakFilter === 'all' ? true : breakFilter === 'with' ? Boolean(m.breakSlot) : !m.breakSlot
      ),
    }))
    .filter((tr) => tr.members.length > 0);

  const hasCollabSections =
    filteredCollabResults.length > 0 || filteredGroupCollabs.length > 0 || filteredAbsenceCollabs.length > 0;

  const hasInfoHubResults =
    results.matchedInfoHubLinks.length > 0 ||
    results.matchedInfoHubQuickFills.length > 0 ||
    results.matchedInfoHubReminders.length > 0 ||
    results.matchedProcessKnowledge.length > 0 ||
    results.matchedServiceRequests.length > 0;

  const hasAnyResults =
    hasCollabSections || filteredSkillCollabs.length > 0 || filteredTasks.length > 0 || hasInfoHubResults;

  const anyFilterActive = statusFilter !== 'all' || levelFilter !== 'all' || breakFilter !== 'all';

  const groupChips: Array<{ label: string; cls: string }> = [
    ...results.matchedRoles.map((r) => ({ label: r, cls: 'bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--primary-border)]' })),
    ...results.matchedCategories.map((c) => ({ label: c, cls: 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800' })),
    ...results.matchedTLs.map((tl) => ({ label: tl, cls: 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800' })),
    ...results.matchedShifts.map((s) => ({ label: `Turno ${s}`, cls: 'bg-blue-100 dark:bg-blue-950/70 text-blue-900 dark:text-blue-200 border-blue-300 dark:border-blue-800' })),
  ];

  const clearFilters = () => {
    setStatusFilter('all');
    setLevelFilter('all');
    setBreakFilter('all');
  };

  const clearSearch = () => {
    setQuery('');
    setOpen(false);
    setStatusFilter('all');
    setLevelFilter('all');
    setBreakFilter('all');
    inputRef.current?.focus();
  };

  const renderStatusBadge = (status: StatusType, isExtraPresence = false) => {
    const meta = STATUS_META[status];
    return (
      <span className="inline-flex items-center gap-1.5 shrink-0">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${meta.bg} ${meta.text}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
        {isExtraPresence && status === 'presente' && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black border bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-800">
            <RefreshCw className="w-2.5 h-2.5" />
            Troca de Folga
          </span>
        )}
      </span>
    );
  };

  const toggleSelectMultiCollab = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedMultiIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllFilteredCollabs = (collabList: CollabResult[]) => {
    const allIds = collabList.map((r) => r.collab.id);
    const areAllSelected = allIds.every((id) => selectedMultiIds.includes(id));
    if (areAllSelected) {
      setSelectedMultiIds((prev) => prev.filter((id) => !allIds.includes(id)));
    } else {
      setSelectedMultiIds((prev) => Array.from(new Set([...prev, ...allIds])));
    }
  };

  const handleBatchApplyStatus = () => {
    if (!batchStatusInput) {
      showNotice('Selecione um status para aplicar em lote.');
      return;
    }
    if (selectedMultiIds.length === 0) {
      showNotice('Nenhum colaborador selecionado.');
      return;
    }

    const trocaFolgaCollabs = selectedMultiIds
      .map((id) => state.collaborators.find((c) => c.id === id))
      .filter((c): c is Collaborator => Boolean(c))
      .filter((c) => {
        const info = getCollaboratorStatus(c, activeDate, state);
        return info.isOffScale && info.status === 'folga';
      });

    selectedMultiIds.forEach((id) => {
      setStatusReason(id, batchStatusInput as StatusType, 'Ação em Lote (Busca Global)');
    });

    const extra =
      batchStatusInput === 'presente' && trocaFolgaCollabs.length > 0
        ? ` • Troca de Folga registrada para ${trocaFolgaCollabs.length} colaborador(es)`
        : '';
    showNotice(`✅ Status "${batchStatusInput.toUpperCase()}" aplicado a ${selectedMultiIds.length} colaborador(es)!${extra}`);
    setSelectedMultiIds([]);
    setBatchStatusInput('');
  };

  const handleBatchApplyBreak = () => {
    if (!batchBreakTimeInput.trim()) {
      showNotice('Informe o horário do intervalo (ex: 12:00) para aplicar em lote.');
      return;
    }
    if (selectedMultiIds.length === 0) {
      showNotice('Nenhum colaborador selecionado.');
      return;
    }

    selectedMultiIds.forEach((id) => {
      addInterval(id, batchBreakTimeInput.trim());
    });

    showNotice(`✅ Intervalo "${batchBreakTimeInput.trim()}" atribuído a ${selectedMultiIds.length} colaborador(es)!`);
    setSelectedMultiIds([]);
    setBatchBreakTimeInput('');
  };

  const handleBatchAssignTask = () => {
    if (selectedMultiIds.length === 0) {
      showNotice('Nenhum colaborador selecionado.');
      return;
    }
    if (!batchTaskId) {
      showNotice('Selecione uma tarefa para dimensionar em lote.');
      return;
    }
    const task = state.tasks.find((t) => t.id === batchTaskId);
    selectedMultiIds.forEach((id) => assignTask(id, batchTaskId));
    showNotice(`✅ ${selectedMultiIds.length} colaborador(es) dimensionado(s) para a tarefa "${task?.name || '...'}"!`);
    setSelectedMultiIds([]);
    setBatchTaskId('');
  };

  const handleBatchUnassignTask = () => {
    if (selectedMultiIds.length === 0) {
      showNotice('Nenhum colaborador selecionado.');
      return;
    }
    selectedMultiIds.forEach((id) => unassignTask(id));
    showNotice(`✅ ${selectedMultiIds.length} colaborador(es) desvinculado(s) das tarefas!`);
    setSelectedMultiIds([]);
  };

  const handleBatchCopyNames = () => {
    if (selectedMultiIds.length === 0) {
      showNotice('Nenhum colaborador selecionado para copiar.');
      return;
    }
    const names = state.collaborators
      .filter((c) => selectedMultiIds.includes(c.id))
      .map((c) => c.name)
      .join('\n');
    navigator.clipboard.writeText(names);
    showNotice(`✅ Copiado (${selectedMultiIds.length}) nome(s) para a área de transferência!`);
  };

  const handleCollabCardClick = (c: Collaborator, e: React.MouseEvent) => {
    // 1. Shift + Click: Select range between lastSelectedCollabId and current
    if (e.shiftKey && lastSelectedCollabId) {
      const allCollabIds = filteredCollabResults.map((r) => r.collab.id);
      const lastIndex = allCollabIds.indexOf(lastSelectedCollabId);
      const currentIndex = allCollabIds.indexOf(c.id);

      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const rangeIds = allCollabIds.slice(start, end + 1);

        setSelectedMultiIds((prev) => Array.from(new Set([...prev, ...rangeIds])));
        setLastSelectedCollabId(c.id);
        return;
      }
    }

    // 2. Ctrl + Click / Cmd + Click: Toggle individual selection
    if (e.ctrlKey || e.metaKey) {
      setSelectedMultiIds((prev) =>
        prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]
      );
      setLastSelectedCollabId(c.id);
      return;
    }

    // 3. Simple Click: Open the action/details menu. Selection is opt-in and
    //    requires Ctrl/Cmd (or Shift for range) — never a plain click.
    setSelectedCollab(c);
  };

  const handleBatchSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifiedUser) {
      showNotice('Identifique-se no topo da tela para criar pedidos.');
      return;
    }
    if (!batchReqTitle.trim()) {
      showNotice('Informe o título do pedido em lote.');
      return;
    }
    if (selectedMultiIds.length === 0) {
      showNotice('Nenhum colaborador selecionado.');
      return;
    }

    const selectedCollabObjs = state.collaborators.filter((c) => selectedMultiIds.includes(c.id));
    const selectedNames = selectedCollabObjs.map((c) => c.name);
    const userShift = identifiedUser.shift || state.teamShift || 'T2';

    const result = createServiceRequest({
      type: batchReqType,
      title: batchReqTitle.trim(),
      description: batchReqDescription.trim(),
      priority: batchReqPriority,
      shift: userShift,
      targetShiftAudience: batchReqAudience,
      targetId: 'admin',
      targetName: 'Administrador / Líder de Turno',
      collaboratorId: selectedCollabObjs[0]?.id,
      collaboratorName: `${selectedMultiIds.length} colaboradores selecionados (${selectedNames.slice(0, 3).join(', ')}${selectedNames.length > 3 ? '...' : ''})`,
      selectedCollaborators: selectedNames,
    });

    if (result.success) {
      showNotice(`✅ Pedido em lote enviado para ${selectedMultiIds.length} colaborador(es)!`);
      setIsBatchRequestOpen(false);
      setBatchReqTitle('');
      setBatchReqDescription('');
      setSelectedMultiIds([]);
    }
  };

  const renderCollabCard = (r: CollabResult) => {
    const c = r.collab;
    const isSelected = selectedMultiIds.includes(c.id);
    const activeSkills = Object.entries(c.skills || {}).filter(([_, lvl]) => Number(lvl) > 0);
    const tl = c.teamLeader || state.defaultTeamLeader || 'Sem Time';
    const initials = c.name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();

    return (
      <div
        key={c.id}
        onClick={(e) => handleCollabCardClick(c, e)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCollabCardClick(c, e as any);
          }
        }}
        role="button"
        tabIndex={0}
        className={`bg-[var(--bg)] border rounded-xl p-3.5 space-y-2.5 cursor-pointer hover:border-[var(--primary)] hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-[var(--primary)] group relative select-none ${
          isSelected
            ? 'border-[var(--primary)] bg-[var(--primary-soft)]/40 ring-2 ring-[var(--primary)]/30 shadow-xs'
            : 'border-[var(--line)]'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 shrink-0 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center text-xs font-black border border-[var(--primary-border)]">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-[var(--ink)] truncate leading-tight group-hover:text-[var(--primary)]">
                {c.name}
              </div>
              <div className="text-[10px] font-semibold text-[var(--muted)]">
                {c.login || 'Sem LDAP'}
                {c.registration ? ` • RE ${c.registration}` : ''}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {renderStatusBadge(r.status, r.isExtraPresence)}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedCollab(c);
              }}
              className="p-1.5 text-[var(--muted)] hover:text-[var(--primary)] hover:bg-[var(--line)] rounded-lg transition-colors cursor-pointer"
              title="Ver detalhes do colaborador"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1.5 text-[11px] font-semibold text-[var(--muted)]">
          <div>
            <div className="text-[9px] font-black uppercase text-[var(--muted)] opacity-80">Turno</div>
            <div className="font-extrabold text-[var(--ink)]">{c.shift || 'Geral'}</div>
          </div>
          <div>
            <div className="text-[9px] font-black uppercase text-[var(--muted)] opacity-80">Escala</div>
            <div className="font-extrabold text-[var(--ink)]">Turma {c.scale || '—'}</div>
          </div>
          <div className="col-span-2">
            <div className="text-[9px] font-black uppercase text-[var(--muted)] opacity-80">Time / TL</div>
            <div className="font-extrabold text-[var(--ink)] truncate">{tl}</div>
          </div>
          <div className="col-span-2">
            <div className="text-[9px] font-black uppercase text-[var(--muted)] opacity-80">Cargo</div>
            <div className="font-extrabold text-[var(--ink)] truncate">{c.role || '—'}</div>
          </div>
          <div className="col-span-2">
            <div className="text-[9px] font-black uppercase text-[var(--muted)] opacity-80">Categoria</div>
            <div className="font-extrabold text-[var(--ink)] truncate">{c.category || '—'}</div>
          </div>
        </div>

        {activeSkills.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {activeSkills.map(([sName, lvlVal]) => (
              <span
                key={sName}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-950/70 text-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-800 rounded-md text-[10px] font-extrabold"
              >
                <Sparkles className="w-2.5 h-2.5 opacity-80" />
                {sName}
                <span className="opacity-70">Nv {lvlVal}</span>
              </span>
            ))}
          </div>
        )}

        {r.tasksToday.length > 0 && (
          <div className="space-y-1 pt-2 border-t border-[var(--line)]">
            <div className="text-[9px] font-black uppercase text-[var(--muted)]">
              Tarefa(s) de hoje {r.breakSlot ? `• Intervalo ${r.breakSlot.time}` : '• Sem intervalo'}
            </div>
            {r.tasksToday.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 text-[11px] font-bold text-[var(--ink)]">
                <span className="truncate">{t.name}</span>
                <span className="shrink-0 flex items-center gap-1">
                  {r.breakSlot ? (
                    <span className="bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 px-1.5 py-0.5 rounded text-[10px] font-black inline-flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {r.breakSlot.time}
                    </span>
                  ) : (
                    <span className="text-[var(--muted)] text-[10px] italic">sem intervalo</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderCollabRow = (c: Collaborator, status: StatusType, extra?: React.ReactNode, isExtraPresence = false) => (
    <div
      key={c.id}
      onClick={() => setSelectedCollab(c)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setSelectedCollab(c);
        }
      }}
      role="button"
      tabIndex={0}
      className="flex items-center justify-between gap-2 px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg cursor-pointer hover:border-[var(--primary)] hover:ring-1 hover:ring-[var(--primary)]/30 transition-all group focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-7 h-7 shrink-0 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center text-[10px] font-black">
          {c.name
            .trim()
            .split(/\s+/)
            .map((w) => w[0])
            .filter(Boolean)
            .slice(0, 2)
            .join('')
            .toUpperCase()}
        </div>
        <span className="text-xs font-bold text-[var(--ink)] truncate group-hover:text-[var(--primary)]">{c.name}</span>
        {extra}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {renderStatusBadge(status, isExtraPresence)}
        <ChevronRight className="w-3.5 h-3.5 text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );

  const renderSection = (title: string, icon: React.ReactNode, count: number, children: React.ReactNode) => (
    <div className="bg-[var(--paper)] border border-[var(--line)] rounded-2xl shadow-2xs overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--line)]">
        <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-[var(--ink)]">
          {icon}
          <span>{title}</span>
        </h4>
        <span className="text-[10px] font-black bg-[var(--bg)] px-2 py-0.5 rounded-md text-[var(--muted)]">{count}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );

  return (
    <div ref={wrapperRef} className="relative w-full z-50">
      {/* Input Único e Nítido no Header */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)] pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false);
            } else if (e.key === 'Tab') {
              if (autocompleteSuggestions.length > 0) {
                e.preventDefault();
                const currentIdx = Math.min(autocompleteIndex, autocompleteSuggestions.length - 1);
                applyAutocomplete(autocompleteSuggestions[currentIdx]);
              }
            } else if (e.key === 'ArrowDown') {
              if (autocompleteSuggestions.length > 0) {
                e.preventDefault();
                setAutocompleteIndex((prev) => (prev + 1) % autocompleteSuggestions.length);
              }
            } else if (e.key === 'ArrowUp') {
              if (autocompleteSuggestions.length > 0) {
                e.preventDefault();
                setAutocompleteIndex((prev) => (prev - 1 + autocompleteSuggestions.length) % autocompleteSuggestions.length);
              }
            } else if (e.key === 'Enter') {
              if (smartAction) {
                e.preventDefault();
                const res = smartAction.execute(appContext);
                if (res?.message) {
                  showNotice(res.message);
                }
                setQuery('');
                setOpen(false);
                return;
              }

              if (autocompleteSuggestions.length > 0 && autocompleteIndex >= 0 && autocompleteSuggestions[autocompleteIndex]) {
                e.preventDefault();
                applyAutocomplete(autocompleteSuggestions[autocompleteIndex]);
              } else if (query.startsWith('/dimensionamento') || query.startsWith('/alocar')) {
                e.preventDefault();
                handleExecuteDimensionamento();
              } else if (query.startsWith('/pedido')) {
                e.preventDefault();
                handleExecutePedido();
              } else if (query.startsWith('/intervalo')) {
                e.preventDefault();
                handleExecuteIntervalo();
              } else if (query.startsWith('/status') || query.startsWith('/ausencia')) {
                e.preventDefault();
                handleExecuteStatus();
              }
            }
          }}
          placeholder="Busca global ou comandos: /tarefa: feedback dia 16/09, /alocar, /intervalo, /pedido..."
          className={`w-full pl-9 ${query ? 'pr-9' : 'pr-12'} py-2 bg-[var(--bg)] border-2 rounded-xl text-sm font-semibold text-[var(--ink)] transition-all placeholder:font-medium placeholder:text-[var(--muted)]/70 ${
            open
              ? 'border-[var(--primary)] ring-2 ring-[var(--primary)] shadow-sm'
              : 'border-[var(--line)] hover:border-[var(--primary-border)]'
          }`}
        />
        {query ? (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--line)] transition-colors cursor-pointer"
            title="Limpar busca"
            tabIndex={-1}
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-1">
            <kbd className="hidden sm:inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-black text-[var(--muted)] bg-[var(--paper)] border border-[var(--line)] rounded-md shadow-2xs">
              /
            </kbd>
          </div>
        )}
      </div>

      {/* Fundo escurecido suave SEM DESFOQUE (Mapeado em portal no document.body) */}
      {open && createPortal(
        <div
          className="fixed inset-0 bg-black/20 z-40 transition-opacity animate-in fade-in duration-150"
          onClick={() => setOpen(false)}
        />,
        document.body
      )}

      {/* Painel Flutuante do Menu de Busca (Renderizado via React Portal no document.body para sair da hierarquia do Header) */}
      {open && panelPosition && createPortal(
        <div
          style={{
            position: 'fixed',
            top: panelPosition.top,
            left: panelPosition.left,
            width: panelPosition.width,
            transform: 'translateX(-50%)',
            zIndex: 50,
          }}
        >
          <div
            ref={panelRef}
            className="bg-[var(--paper)] border-2 border-[var(--line)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh] text-xs animate-in fade-in-50 slide-in-from-top-2 duration-150 overflow-y-auto"
          >
          {/* Autocompletar Sugestões Em Tempo Real */}
            {autocompleteSuggestions.length > 0 && (
              <div className="p-3 bg-gradient-to-r from-[var(--primary-soft)] via-[var(--bg)] to-[var(--bg)] border-b border-[var(--line)] space-y-2">
                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-[var(--primary)]">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--primary)] animate-pulse" />
                    <span>Autocompletar Sugestões</span>
                  </span>
                  <span className="text-[10px] font-bold text-[var(--muted)]">
                    Pressione <kbd className="px-1 py-0.5 bg-[var(--paper)] border rounded text-[9px] font-black">TAB</kbd> ou <kbd className="px-1 py-0.5 bg-[var(--paper)] border rounded text-[9px] font-black">ENTER</kbd>
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {autocompleteSuggestions.map((s, idx) => {
                    const isHighlighted = idx === autocompleteIndex;
                    return (
                      <button
                        key={`${s.type}-${s.value}-${idx}`}
                        type="button"
                        onClick={() => applyAutocomplete(s)}
                        onMouseEnter={() => setAutocompleteIndex(idx)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                          isHighlighted
                            ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm scale-[1.02]'
                            : 'bg-[var(--paper)] text-[var(--ink)] border-[var(--line)] hover:border-[var(--primary-border)]'
                        }`}
                      >
                        <span className={`px-1.5 py-0.5 text-[9px] font-black rounded uppercase ${s.color || 'bg-slate-200 text-slate-800'}`}>
                          {s.badge || s.type}
                        </span>
                        <span className="font-extrabold">{s.displayText}</span>
                        {s.subText && (
                          <span className={`text-[10px] truncate max-w-[180px] ${isHighlighted ? 'text-white/80' : 'text-[var(--muted)]'}`}>
                            {s.subText}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Barra Superior de Atalhos de Comandos */}
            <div className="flex items-center gap-1.5 p-2.5 bg-[var(--bg)] border-b border-[var(--line)] overflow-x-auto scrollbar-none shrink-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)] px-1 shrink-0">
                Comandos Inteligentes:
              </span>

              {COMMAND_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = query.toLowerCase().startsWith(item.cmd);
                return (
                  <button
                    key={item.cmd}
                    type="button"
                    onClick={() => {
                      setQuery(`${item.cmd}: `);
                      inputRef.current?.focus();
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer flex items-center gap-1 shrink-0 border ${
                      isActive
                        ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-xs'
                        : 'bg-[var(--paper)] text-[var(--ink)] border-[var(--line)] hover:bg-[var(--bg)]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.cmd}</span>
                  </button>
                );
              })}
            </div>

            {/* CARD DE AÇÃO INTELIGENTE DETECTADA (NLP / SMART COMMANDS) */}
            {smartAction && (
              <div className="p-3.5 m-3 bg-gradient-to-br from-[var(--paper)] to-[var(--bg)] border-2 border-[var(--primary)] rounded-2xl shadow-lg space-y-2.5 animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-xl bg-[var(--primary)] text-white shadow-xs">
                      <Sparkles className="w-4 h-4" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary-border)]">
                          {smartAction.badgeLabel}
                        </span>
                        <span className="text-[10px] font-bold text-[var(--muted)]">Comando Inteligente</span>
                      </div>
                      <h4 className="text-sm font-black text-[var(--ink)] mt-0.5">{smartAction.title}</h4>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const res = smartAction.execute(appContext);
                      if (res?.message) showNotice(res.message);
                      setQuery('');
                      setOpen(false);
                    }}
                    className="px-4 py-2 bg-[var(--primary)] hover:opacity-90 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all shrink-0 ml-auto"
                  >
                    <Check className="w-4 h-4" />
                    <span>Executar Ação (Enter)</span>
                  </button>
                </div>

                <p className="text-xs text-[var(--muted)] font-medium leading-relaxed bg-[var(--paper)] p-2.5 rounded-xl border border-[var(--line)]">
                  {smartAction.description}
                </p>

                <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] font-bold text-[var(--muted)]">
                  {smartAction.params.collaboratorName && (
                    <span className="px-2 py-0.5 bg-[var(--paper)] border border-[var(--line)] rounded-lg text-[var(--ink)]">
                      👤 {smartAction.params.collaboratorName}
                    </span>
                  )}
                  {smartAction.params.formattedDate && (
                    <span className="px-2 py-0.5 bg-[var(--paper)] border border-[var(--line)] rounded-lg text-[var(--ink)]">
                      📅 {smartAction.params.formattedDate}
                    </span>
                  )}
                  {smartAction.params.listName && (
                    <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300 rounded-lg">
                      📋 {smartAction.params.listName}
                    </span>
                  )}
                  {smartAction.params.taskName && (
                    <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 rounded-lg">
                      📌 {smartAction.params.taskName}
                    </span>
                  )}
                  {smartAction.params.slotTime && (
                    <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-lg">
                      ⏰ {smartAction.params.slotTime}
                    </span>
                  )}
                  {smartAction.params.absenceType && (
                    <span className="px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 rounded-lg">
                      🏥 {smartAction.params.absenceType}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* MODO COMANDO DETECTADO */}
            {query.startsWith('/') ? (
              <div className="p-4 space-y-4">
                {/* 1. Mover para Tarefa (Dimensionamento) */}
                {query.toLowerCase().startsWith('/dimensionamento') && (() => {
                  const matchedCollabs = Array.from(
                    new Set([
                      ...cmdSelectedCollabIds,
                      ...(commandContext?.autoMatchedCollabs.map((c) => c.id) || []),
                    ])
                  )
                    .map((id) => state.collaborators.find((c) => c.id === id))
                    .filter((c): c is Collaborator => Boolean(c));

                  const matchedTaskId = cmdSelectedTaskId || commandContext?.autoMatchedTask?.id || '';
                  const targetTaskObj = state.tasks.find((t) => t.id === matchedTaskId);

                  return (
                    <div className="p-3.5 bg-blue-500/5 border border-blue-500/30 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between border-b border-blue-500/20 pb-2">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <h4 className="font-extrabold text-sm text-[var(--ink)]">
                            Dimensionamento: Mover Colaborador(es) para Tarefa
                          </h4>
                        </div>
                        <span className="text-[10px] font-black bg-blue-500/20 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full">
                          Pressione ENTER para executar
                        </span>
                      </div>

                      {/* Dica de Sintaxe */}
                      <div className="text-[11px] text-[var(--muted)] font-medium bg-[var(--bg)] p-2 rounded-xl border border-[var(--line)]">
                        💡 <strong>Sintaxe rápida:</strong> <code className="text-blue-600 font-mono font-bold">/dimensionamento Ana, gab, Chat</code>
                        <span className="block text-[10px] opacity-80 mt-0.5">O sistema detecta nomes de colaboradores e a tarefa digitados por vírgula.</span>
                      </div>

                      {/* 1. Colaboradores Identificados / Selecionados */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-black uppercase tracking-wider text-[var(--muted)]">
                            Colaboradores Encontrados ({matchedCollabs.length})
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const allIds = state.collaborators.map((c) => c.id);
                              setCmdSelectedCollabIds(
                                cmdSelectedCollabIds.length === allIds.length ? [] : allIds
                              );
                            }}
                            className="text-[10.5px] font-black text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                          >
                            {cmdSelectedCollabIds.length === state.collaborators.length
                              ? 'Desmarcar Todos'
                              : 'Marcar Todos'}
                          </button>
                        </div>

                        {matchedCollabs.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto p-1 scrollbar-thin">
                            {matchedCollabs.map((c) => {
                              const currentTask = state.tasks.find((t) => t.members.includes(c.id));
                              const isChecked = true;
                              return (
                                <label
                                  key={c.id}
                                  className="flex items-center gap-2 p-2 rounded-xl border text-xs font-extrabold cursor-pointer transition-all bg-blue-500/10 text-blue-900 dark:text-blue-200 border-blue-500/40"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      setCmdSelectedCollabIds((prev) =>
                                        prev.includes(c.id) ? prev.filter((i) => i !== c.id) : [...prev, c.id]
                                      );
                                    }}
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate font-black">{c.name}</div>
                                    <div className="text-[10px] text-[var(--muted)] font-bold truncate">
                                      {currentTask ? `Atual: ${currentTask.name}` : 'Sem tarefa atribuída'}
                                    </div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="p-2.5 text-center text-[11px] font-bold text-[var(--muted)] bg-[var(--bg)] border border-[var(--line)] rounded-xl">
                            Digite os nomes dos colaboradores na busca (ex: <i>/dimensionamento Ana, gab</i>) ou selecione abaixo.
                          </div>
                        )}

                        {/* Busca manual extra de colaboradores caso deseje adicionar mais */}
                        <details className="text-[11px]">
                          <summary className="font-bold text-blue-600 cursor-pointer hover:underline py-1">
                            + Buscar e selecionar mais colaboradores na lista
                          </summary>
                          <div className="space-y-1.5 pt-2">
                            <input
                              type="text"
                              placeholder="Filtrar colaboradores por nome ou login..."
                              value={cmdCollabSearchText}
                              onChange={(e) => setCmdCollabSearchText(e.target.value)}
                              className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-xl p-2 text-xs font-medium text-[var(--ink)]"
                            />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-1 scrollbar-thin">
                              {state.collaborators
                                .filter(
                                  (c) =>
                                    !cmdCollabSearchText.trim() ||
                                    matchesSearch(c.name, cmdCollabSearchText) ||
                                    matchesSearch(c.login, cmdCollabSearchText)
                                )
                                .map((c) => {
                                  const isChecked = cmdSelectedCollabIds.includes(c.id);
                                  return (
                                    <label
                                      key={c.id}
                                      className={`flex items-center gap-2 p-1.5 rounded-xl border text-xs font-extrabold cursor-pointer transition-all ${
                                        isChecked
                                          ? 'bg-blue-500/10 text-blue-900 dark:text-blue-200 border-blue-500/40'
                                          : 'bg-[var(--bg)] text-[var(--ink)] border-[var(--line)]'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          setCmdSelectedCollabIds((prev) =>
                                            prev.includes(c.id) ? prev.filter((i) => i !== c.id) : [...prev, c.id]
                                          );
                                        }}
                                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                      />
                                      <span className="truncate">{c.name}</span>
                                    </label>
                                  );
                                })}
                            </div>
                          </div>
                        </details>
                      </div>

                      {/* 2. Seleção Contextual de Tarefa de Destino */}
                      <div className="space-y-1.5 pt-2 border-t border-[var(--line)]">
                        <label className="block text-[11px] font-black uppercase tracking-wider text-[var(--muted)]">
                          Tarefa de Destino {targetTaskObj ? `(Selecionada: "${targetTaskObj.name}")` : ''}
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {state.tasks
                            .filter((t) => t.active !== false)
                            .map((t) => {
                              const isSelected = matchedTaskId === t.id;
                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => setCmdSelectedTaskId(t.id)}
                                  className={`px-3 py-1.5 rounded-xl font-extrabold text-xs cursor-pointer border transition-all flex items-center gap-1.5 ${
                                    isSelected
                                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-400'
                                      : 'bg-[var(--paper)] text-[var(--ink)] border-[var(--line)] hover:border-blue-500/50'
                                  }`}
                                >
                                  {isSelected && <Check className="w-3.5 h-3.5" />}
                                  <span>{t.name}</span>
                                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-[var(--bg)] text-[var(--muted)]'}`}>
                                    {t.members.length}
                                  </span>
                                </button>
                              );
                            })}
                        </div>
                      </div>

                      {/* Botão de Ação / Teclado */}
                      <div className="flex items-center justify-between pt-2 border-t border-[var(--line)]">
                        <span className="text-[10.5px] font-bold text-[var(--muted)]">
                          Pressione <kbd className="px-1.5 py-0.5 bg-[var(--bg)] border rounded font-mono text-[10px]">ENTER</kbd> para confirmar no teclado
                        </span>
                        <button
                          type="button"
                          onClick={handleExecuteDimensionamento}
                          disabled={matchedCollabs.length === 0 || !matchedTaskId}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer transition-all"
                        >
                          <Check className="w-4 h-4" />
                          <span>Mover {matchedCollabs.length} colaborador(es) {targetTaskObj ? `para "${targetTaskObj.name}"` : ''}</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* 2. Criar Pedido envolvendo Colaborador / Tarefa */}
                {query.toLowerCase().startsWith('/pedido') && (() => {
                  const targetCollabs = state.collaborators.filter(
                    (c) =>
                      cmdSelectedCollabIds.includes(c.id) ||
                      (commandContext?.autoMatchedCollabs || []).some((m) => m.id === c.id)
                  );

                  return (
                    <div className="p-3.5 bg-amber-500/5 border border-amber-500/30 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                        <div className="flex items-center gap-2">
                          <Send className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          <h4 className="font-extrabold text-sm text-[var(--ink)]">
                            Criar Pedido de Ação ou Comunicado
                          </h4>
                        </div>
                        <span className="text-[10px] font-black bg-amber-500/20 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded-full">
                          Pressione ENTER para enviar
                        </span>
                      </div>

                      {/* Dica de Sintaxe */}
                      <div className="text-[11px] text-[var(--muted)] font-medium bg-[var(--bg)] p-2 rounded-xl border border-[var(--line)]">
                        💡 <strong>Sintaxe rápida:</strong> <code className="text-amber-600 font-mono font-bold">/pedido Ana, Troca de turno</code>
                        <span className="block text-[10px] opacity-80 mt-0.5">Insere automaticamente o colaborador e sua tarefa operacional atual.</span>
                      </div>

                      {/* Exibição Contextual do Colaborador e sua Tarefa Atual */}
                      {targetCollabs.length > 0 && (
                        <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1">
                          <label className="text-[10.5px] font-black uppercase text-amber-900 dark:text-amber-200 block">
                            Colaborador(es) e Tarefa Atual
                          </label>
                          <div className="flex flex-wrap gap-2 text-xs font-bold text-[var(--ink)]">
                            {targetCollabs.map((c) => {
                              const currTask = state.tasks.find((t) => t.members.includes(c.id));
                              return (
                                <div key={c.id} className="bg-[var(--paper)] border border-amber-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                                  <span>{c.name}</span>
                                  <span className="text-[10px] text-[var(--muted)] font-bold">
                                    • {currTask ? currTask.name : 'Sem Tarefa'} • Turno {c.shift || 'Geral'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10.5px] font-black uppercase text-[var(--muted)] mb-1">
                            Título / Motivo do Pedido
                          </label>
                          <input
                            type="text"
                            placeholder="Ex: Troca de horário / Suporte na fila..."
                            value={cmdReqTitle}
                            onChange={(e) => setCmdReqTitle(e.target.value)}
                            className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-xl p-2 text-xs font-bold text-[var(--ink)]"
                          />
                        </div>

                        <div>
                          <label className="block text-[10.5px] font-black uppercase text-[var(--muted)] mb-1">
                            Prioridade
                          </label>
                          <select
                            value={cmdReqPriority}
                            onChange={(e) => setCmdReqPriority(e.target.value as any)}
                            className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-xl p-2 text-xs font-bold text-[var(--ink)]"
                          >
                            <option value="baixa">Baixa</option>
                            <option value="media">Média</option>
                            <option value="alta">Alta</option>
                            <option value="urgente">Urgente</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10.5px] font-black uppercase text-[var(--muted)] mb-1">
                          Instruções / Descrição Opcional
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Detalhes adicionais da solicitação..."
                          value={cmdReqDesc}
                          onChange={(e) => setCmdReqDesc(e.target.value)}
                          className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-xl p-2 text-xs font-medium text-[var(--ink)]"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[var(--line)]">
                        <span className="text-[10.5px] font-bold text-[var(--muted)]">
                          Pressione <kbd className="px-1.5 py-0.5 bg-[var(--bg)] border rounded font-mono text-[10px]">ENTER</kbd> para enviar
                        </span>
                        <button
                          type="button"
                          onClick={handleExecutePedido}
                          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer transition-all"
                        >
                          <Send className="w-4 h-4" />
                          <span>Enviar Pedido ao Sistema</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* 3. Definir Horário de Intervalo */}
                {query.toLowerCase().startsWith('/intervalo') && (() => {
                  const matchedCollabs = Array.from(
                    new Set([
                      ...cmdSelectedCollabIds,
                      ...(commandContext?.autoMatchedCollabs.map((c) => c.id) || []),
                    ])
                  )
                    .map((id) => state.collaborators.find((c) => c.id === id))
                    .filter((c): c is Collaborator => Boolean(c));

                  const matchedBreak = cmdBreakTime || commandContext?.autoMatchedBreak || '';

                  return (
                    <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/30 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <h4 className="font-extrabold text-sm text-[var(--ink)]">
                            Atribuir Horário de Intervalo
                          </h4>
                        </div>
                        <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded-full">
                          Pressione ENTER para aplicar
                        </span>
                      </div>

                      {/* Dica de Sintaxe */}
                      <div className="text-[11px] text-[var(--muted)] font-medium bg-[var(--bg)] p-2 rounded-xl border border-[var(--line)]">
                        💡 <strong>Sintaxe rápida:</strong> <code className="text-emerald-600 font-mono font-bold">/intervalo Ana, gab, 12:00</code>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-black uppercase tracking-wider text-[var(--muted)]">
                          1. Selecione o Horário do Intervalo
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {(state.breaks || []).map((b) => {
                            const isSelected = matchedBreak === b.time;
                            return (
                              <button
                                key={b.id}
                                type="button"
                                onClick={() => setCmdBreakTime(b.time)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-black cursor-pointer border transition-all ${
                                  isSelected
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                    : 'bg-[var(--paper)] text-[var(--ink)] border-[var(--line)] hover:border-emerald-500/50'
                                }`}
                              >
                                {b.time}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Colaboradores Identificados */}
                      <div className="space-y-1.5 pt-2 border-t border-[var(--line)]">
                        <label className="block text-[11px] font-black uppercase tracking-wider text-[var(--muted)]">
                          2. Colaboradores ({matchedCollabs.length})
                        </label>
                        {matchedCollabs.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-1 scrollbar-thin">
                            {matchedCollabs.map((c) => (
                              <div key={c.id} className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl font-bold text-xs text-emerald-900 dark:text-emerald-200 flex items-center justify-between">
                                <span className="truncate">{c.name}</span>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-2 text-center text-xs text-[var(--muted)] bg-[var(--bg)] border border-[var(--line)] rounded-xl">
                            Digite os nomes dos colaboradores na busca.
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[var(--line)]">
                        <span className="text-[10.5px] font-bold text-[var(--muted)]">
                          Pressione <kbd className="px-1.5 py-0.5 bg-[var(--bg)] border rounded font-mono text-[10px]">ENTER</kbd> para aplicar
                        </span>
                        <button
                          type="button"
                          onClick={handleExecuteIntervalo}
                          disabled={matchedCollabs.length === 0 || !matchedBreak}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer transition-all"
                        >
                          <Check className="w-4 h-4" />
                          <span>Aplicar Intervalo ({matchedCollabs.length})</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* 4. Alterar Status de Presença / Afastamento */}
                {query.toLowerCase().startsWith('/status') && (() => {
                  const matchedCollabs = Array.from(
                    new Set([
                      ...cmdSelectedCollabIds,
                      ...(commandContext?.autoMatchedCollabs.map((c) => c.id) || []),
                    ])
                  )
                    .map((id) => state.collaborators.find((c) => c.id === id))
                    .filter((c): c is Collaborator => Boolean(c));

                  const matchedStatus = (cmdStatusInput || commandContext?.autoMatchedStatus || 'presente') as StatusType;

                  const folgaCollabs = matchedCollabs.filter((c) => {
                    const info = getCollaboratorStatus(c, activeDate, state);
                    return info.isOffScale && info.status === 'folga';
                  });
                  const registeringTroca = matchedStatus === 'presente' && folgaCollabs.length > 0;

                  return (
                    <div className="p-3.5 bg-purple-500/5 border border-purple-500/30 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
                        <div className="flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          <h4 className="font-extrabold text-sm text-[var(--ink)]">
                            Alterar Status de Presença / Afastamento
                          </h4>
                        </div>
                        <span className="text-[10px] font-black bg-purple-500/20 text-purple-800 dark:text-purple-200 px-2 py-0.5 rounded-full">
                          Pressione ENTER para aplicar
                        </span>
                      </div>

                      {/* Dica de Sintaxe */}
                      <div className="text-[11px] text-[var(--muted)] font-medium bg-[var(--bg)] p-2 rounded-xl border border-[var(--line)]">
                        💡 <strong>Sintaxe rápida:</strong> <code className="text-purple-600 font-mono font-bold">/status Ana, atestado</code>
                      </div>

                      {/* Troca de Folga contextual */}
                      {registeringTroca && (
                        <div className="flex items-start gap-2 p-2.5 bg-purple-100 dark:bg-purple-950/70 border border-purple-300 dark:border-purple-800 rounded-xl text-[11px] font-semibold text-purple-900 dark:text-purple-200">
                          <RefreshCw className="w-3.5 h-3.5 mt-0.5 shrink-0 text-purple-600 dark:text-purple-400" />
                          <span>
                            <strong>{folgaCollabs.map((c) => c.name).join(', ')}</strong> está(ão) de{' '}
                            <strong>folga de escala</strong> hoje. Ao aplicar <strong>Presente</strong>, será registrada uma{' '}
                            <strong>Troca de Folga</strong> (presença extra).
                          </span>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label className="block text-[10.5px] font-black uppercase text-[var(--muted)]">
                          Selecione o Status
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {STATUS_ORDER.map((st) => {
                            const isSelected = matchedStatus === st;
                            return (
                              <button
                                key={st}
                                type="button"
                                onClick={() => setCmdStatusInput(st)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-black cursor-pointer border transition-all ${
                                  isSelected
                                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                                    : STATUS_META[st].bg + ' ' + STATUS_META[st].text
                                }`}
                              >
                                {STATUS_META[st].label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Colaboradores Identificados */}
                      <div className="space-y-1.5 pt-2 border-t border-[var(--line)]">
                        <label className="block text-[11px] font-black uppercase tracking-wider text-[var(--muted)]">
                          Colaboradores ({matchedCollabs.length})
                        </label>
                        {matchedCollabs.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-1 scrollbar-thin">
                            {matchedCollabs.map((c) => {
                              const onFolgaHoje = folgaCollabs.some((fc) => fc.id === c.id);
                              return (
                                <div key={c.id} className="p-2 bg-purple-500/10 border border-purple-500/30 rounded-xl font-bold text-xs text-purple-900 dark:text-purple-200 flex items-center justify-between gap-2">
                                  <span className="truncate">{c.name}</span>
                                  <span className="flex items-center gap-1.5 shrink-0">
                                    {onFolgaHoje && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black border bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-800">
                                        <Sun className="w-2.5 h-2.5" />
                                        Folga hoje
                                      </span>
                                    )}
                                    <Check className="w-3.5 h-3.5 text-purple-600" />
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="p-2 text-center text-xs text-[var(--muted)] bg-[var(--bg)] border border-[var(--line)] rounded-xl">
                            Digite os nomes dos colaboradores na busca.
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[var(--line)]">
                        <span className="text-[10.5px] font-bold text-[var(--muted)]">
                          Pressione <kbd className="px-1.5 py-0.5 bg-[var(--bg)] border rounded font-mono text-[10px]">ENTER</kbd> para aplicar
                        </span>
                        <button
                          type="button"
                          onClick={handleExecuteStatus}
                          disabled={matchedCollabs.length === 0}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer transition-all"
                        >
                          <Check className="w-4 h-4" />
                          <span>Aplicar Status ({matchedCollabs.length})</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
            /* RESULTADOS NORMAIS */
            hasAnyResults || groupChips.length > 0 ? (
            <div className="space-y-3 p-3">
              {/* Filtros contextuais (sticky para sempre acessíveis) */}
              <div className="sticky top-0 z-10 bg-[var(--paper)] border border-[var(--line)] rounded-xl p-2.5 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">Filtros</span>
                {hasCollabSections && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {STATUS_ORDER.map((st) => (
                      <button
                        key={st}
                        onClick={() => setStatusFilter(statusFilter === st ? 'all' : st)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black border transition-colors cursor-pointer ${
                          statusFilter === st
                            ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                            : STATUS_META[st].bg + ' ' + STATUS_META[st].text + ' border-transparent hover:opacity-80'
                        }`}
                      >
                        {STATUS_META[st].label}
                      </button>
                    ))}
                  </div>
                )}
                {filteredSkillCollabs.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {['all', 1, 2, 3].map((lvl) => (
                      <button
                        key={String(lvl)}
                        onClick={() => setLevelFilter(levelFilter === lvl ? 'all' : (lvl as number | 'all'))}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black border transition-colors cursor-pointer ${
                          levelFilter === lvl
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-purple-100 dark:bg-purple-950/70 text-purple-900 dark:text-purple-200 border-purple-300 dark:border-purple-800 hover:opacity-80'
                        }`}
                      >
                        {lvl === 'all' ? 'Todas Nv' : `Nv ${lvl}`}
                      </button>
                    ))}
                  </div>
                )}
                {filteredTasks.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => setBreakFilter(breakFilter === 'all' ? 'with' : 'all')}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black border transition-colors cursor-pointer ${
                        breakFilter === 'with'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800 hover:opacity-80'
                      }`}
                    >
                      Com intervalo
                    </button>
                    <button
                      onClick={() => setBreakFilter(breakFilter === 'all' ? 'without' : 'all')}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black border transition-colors cursor-pointer ${
                        breakFilter === 'without'
                          ? 'bg-slate-700 text-white border-slate-700'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:opacity-80'
                      }`}
                    >
                      Sem intervalo
                    </button>
                  </div>
                )}
                {anyFilterActive && (
                  <button
                    onClick={clearFilters}
                    className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-black text-[var(--muted)] hover:text-[var(--ink)] border border-[var(--line)] rounded-full bg-[var(--bg)] transition-colors cursor-pointer"
                  >
                    <FilterX className="w-3 h-3" />
                    Limpar filtros
                  </button>
                )}
              </div>

              {/* Card de Busca Contextual Inteligente */}
              {searchIntent.summaryLabel && (
                <div className="bg-[var(--primary-soft)]/30 border border-[var(--primary-border)] rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-[13px] text-[var(--ink)]">
                          {searchIntent.summaryLabel}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[var(--primary)] text-white">
                          Filtro Inteligente
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--muted)] font-medium mt-0.5">
                        {searchIntent.summaryDescription}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap sm:shrink-0">
                    {filteredCollabResults.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleSelectAllFilteredCollabs(filteredCollabResults)}
                        className="px-3 py-1.5 bg-[var(--paper)] border border-[var(--line)] hover:bg-[var(--line)] text-[var(--ink)] rounded-lg font-black text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                      >
                        <UserCheck className="w-3.5 h-3.5 text-[var(--primary)]" />
                        <span>
                          {filteredCollabResults.every((r) => selectedMultiIds.includes(r.collab.id))
                            ? 'Desmarcar Todos'
                            : `Selecionar Todos (${filteredCollabResults.length})`}
                        </span>
                      </button>
                    )}
                    {filteredCollabResults.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const text = filteredCollabResults
                            .map((r) => `${r.collab.name} (${r.status}${r.collab.shift ? ` - ${r.collab.shift}` : ''}${r.collab.scale ? ` - Turma ${r.collab.scale}` : ''})`)
                            .join('\n');
                          navigator.clipboard.writeText(text);
                          showNotice(`Lista com ${filteredCollabResults.length} colaboradores copiada!`);
                        }}
                        className="px-3 py-1.5 bg-[var(--paper)] border border-[var(--line)] hover:bg-[var(--line)] text-[var(--ink)] rounded-lg font-black text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                      >
                        <Copy className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copiar Lista</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {filteredCollabResults.length > 0 && (
                <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 border-b border-[var(--line)] bg-[var(--paper)]">
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-[var(--primary)]" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-[var(--ink)]">
                        Colaboradores ({filteredCollabResults.length})
                      </h4>
                      <button
                        type="button"
                        onClick={() => handleSelectAllFilteredCollabs(filteredCollabResults)}
                        className="text-[10.5px] font-bold text-[var(--primary)] hover:underline ml-2 cursor-pointer"
                      >
                        {filteredCollabResults.every((r) => selectedMultiIds.includes(r.collab.id))
                          ? 'Desmarcar Todos'
                          : 'Selecionar Todos'}
                      </button>
                    </div>

                    {selectedMultiIds.length > 0 && (
                      <span className="text-[10px] font-black bg-[var(--primary-soft)] text-[var(--primary)] px-2.5 py-1 rounded-full border border-[var(--primary-border)]">
                        {selectedMultiIds.length} selecionado(s)
                      </span>
                    )}
                  </div>

                  {/* Batch Actions Toolbar */}
                  {selectedMultiIds.length > 0 && (
                    <div className="p-2.5 bg-[var(--primary-soft)]/20 border-b border-[var(--line)] flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-[10.5px] font-black uppercase text-[var(--ink)] shrink-0">
                        Ações em Lote:
                      </span>

                      {/* Copy Names */}
                      <button
                        type="button"
                        onClick={handleBatchCopyNames}
                        className="px-2.5 py-1 bg-[var(--paper)] border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--line)] rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        Copiar Nomes ({selectedMultiIds.length})
                      </button>

                      {/* Batch Request Button */}
                      <button
                        type="button"
                        onClick={() => setIsBatchRequestOpen(true)}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-black text-[11px] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        title="Criar pedido ou aviso para todos os colaboradores selecionados"
                      >
                        <Megaphone className="w-3.5 h-3.5" />
                        <span>Criar Pedido ({selectedMultiIds.length})</span>
                      </button>

                      {/* Status Batch */}
                      <div className="flex items-center gap-1">
                        <select
                          value={batchStatusInput}
                          onChange={(e) => setBatchStatusInput(e.target.value as StatusType)}
                          className="bg-[var(--paper)] border border-[var(--line)] text-[11px] font-bold rounded-lg px-2 py-1 text-[var(--ink)]"
                        >
                          <option value="">Alterar Status...</option>
                          {STATUS_ORDER.map((st) => (
                            <option key={st} value={st}>
                              {STATUS_META[st].label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleBatchApplyStatus}
                          className="px-2.5 py-1 bg-[var(--primary)] text-white rounded-lg font-extrabold text-[11px] cursor-pointer hover:opacity-90 transition-opacity"
                        >
                          Aplicar
                        </button>
                      </div>

                      {/* Dimensionamento em Lote */}
                      <div className="flex items-center gap-1">
                        <select
                          value={batchTaskId}
                          onChange={(e) => setBatchTaskId(e.target.value)}
                          className="bg-[var(--paper)] border border-[var(--line)] text-[11px] font-bold rounded-lg px-2 py-1 text-[var(--ink)] max-w-[170px]"
                          title="Mover colaboradores selecionados para uma tarefa"
                        >
                          <option value="">Dimensionar p/ Tarefa...</option>
                          {state.tasks
                            .filter((t) => t.active !== false)
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleBatchAssignTask}
                          className="px-2.5 py-1 bg-blue-600 text-white rounded-lg font-extrabold text-[11px] cursor-pointer hover:opacity-90 transition-opacity"
                        >
                          Aplicar
                        </button>
                        <button
                          type="button"
                          onClick={handleBatchUnassignTask}
                          className="px-2 py-1 bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 rounded-lg font-extrabold text-[11px] cursor-pointer hover:opacity-80 transition-opacity"
                          title="Desvincular os selecionados de todas as tarefas"
                        >
                          Desvincular
                        </button>
                      </div>

                      {/* Break Batch */}
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          list="batch-break-slot-list"
                          placeholder="HH:MM (Intervalo)"
                          value={batchBreakTimeInput}
                          onChange={(e) => setBatchBreakTimeInput(e.target.value)}
                          className="w-32 bg-[var(--paper)] border border-[var(--line)] text-[11px] font-bold rounded-lg px-2 py-1 text-[var(--ink)]"
                        />
                        <datalist id="batch-break-slot-list">
                          {Array.from(
                            new Set([
                              ...(state.breaks || []).map((b) => b.time),
                              '11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30','22:00',
                            ])
                          ).map((t) => (
                            <option key={t} value={t} />
                          ))}
                        </datalist>
                        <button
                          type="button"
                          onClick={handleBatchApplyBreak}
                          className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-extrabold text-[11px] cursor-pointer hover:opacity-90 transition-opacity"
                        >
                          Definir
                        </button>
                      </div>

                      {/* Troca de Folga contextual (lote) */}
                      {(() => {
                        const folgaSelected = state.collaborators
                          .filter((c) => selectedMultiIds.includes(c.id))
                          .filter((c) => {
                            const info = getCollaboratorStatus(c, activeDate, state);
                            return info.isOffScale && info.status === 'folga';
                          });
                        if (batchStatusInput !== 'presente' || folgaSelected.length === 0) return null;
                        return (
                          <div className="w-full flex items-start gap-2 px-2.5 py-2 bg-purple-100 dark:bg-purple-950/70 border border-purple-300 dark:border-purple-800 rounded-lg text-[10.5px] font-semibold text-purple-900 dark:text-purple-200">
                            <RefreshCw className="w-3 h-3 mt-0.5 shrink-0 text-purple-600 dark:text-purple-400" />
                            <span>
                              <strong>{folgaSelected.length}</strong> colaborador(es) selecionado(s) está(ão) de{' '}
                              <strong>folga de escala</strong> hoje (
                              {folgaSelected.slice(0, 3).map((c) => c.name).join(', ')}
                              {folgaSelected.length > 3 ? '...' : ''}). Ao aplicar <strong>Presente</strong>, será registrada{' '}
                              <strong>Troca de Folga</strong> (presença extra).
                            </span>
                          </div>
                        );
                      })()}

                      <button
                        type="button"
                        onClick={() => setSelectedMultiIds([])}
                        className="ml-auto text-[10.5px] font-bold text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
                      >
                        Limpar Seleção
                      </button>
                    </div>
                  )}

                  <div className="p-3 grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                    {filteredCollabResults.map((r) => renderCollabCard(r))}
                  </div>
                </div>
              )}

              {filteredTasks.length > 0 && (
                <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--line)]">
                    <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-[var(--ink)]">
                      <ClipboardList className="w-3.5 h-3.5 text-[var(--primary)]" />
                      <span>Tarefas & Dimensionamento</span>
                    </h4>
                    <span className="text-[10px] font-black bg-[var(--paper)] px-2 py-0.5 rounded-md text-[var(--muted)]">
                      {filteredTasks.length}
                    </span>
                  </div>
                  <div className="p-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {filteredTasks.map((tr) => (
                      <div key={tr.task.id} className="bg-[var(--paper)] border border-[var(--line)] rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-[var(--line)]">
                          <div className="flex items-center gap-2 min-w-0">
                            <ClipboardList className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-extrabold text-[var(--ink)] truncate">{tr.task.name}</span>
                                {tr.isSubtask && tr.rootTaskName && (
                                  <span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary-border)] rounded shrink-0">
                                    Subtarefa de {tr.rootTaskName}
                                  </span>
                                )}
                                {tr.hasSubtasks && (
                                  <span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800/60 rounded shrink-0">
                                    {tr.subtaskCount} subdivisões
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-bold text-[var(--muted)] block truncate">
                                {tr.task.allowedRoles?.length ? tr.task.allowedRoles.join(', ') : ''}
                                {tr.task.allowedCategories?.length
                                  ? (tr.task.allowedRoles?.length ? ' • ' : '') + tr.task.allowedCategories.join(', ')
                                  : ''}
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] font-black text-[var(--muted)] shrink-0">
                            {tr.members.length} membro{tr.members.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="divide-y divide-[var(--line)]">
                          {tr.members.map((m) => (
                            <div
                              key={m.collab.id}
                              onClick={() => setSelectedCollab(m.collab)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setSelectedCollab(m.collab);
                                }
                              }}
                              role="button"
                              tabIndex={0}
                              className="flex items-center justify-between gap-2 px-3 py-2 cursor-pointer hover:bg-[var(--paper)] transition-colors group focus:outline-none"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_META[m.status].dot}`} />
                                <span className="text-xs font-bold text-[var(--ink)] truncate">{m.collab.name}</span>
                                <span className="text-[10px] font-semibold text-[var(--muted)] hidden sm:inline truncate">
                                  {m.collab.role || ''} {m.collab.category ? `• ${m.collab.category}` : ''}
                                </span>
                                {m.viaSubtask && m.subtaskName && (
                                  <span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-[var(--bg)] text-[var(--muted)] border border-[var(--line)] rounded shrink-0">
                                    {m.subtaskName}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {renderStatusBadge(m.status)}
                                {m.breakSlot ? (
                                  <span className="bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 px-1.5 py-0.5 rounded text-[10px] font-black inline-flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5" />
                                    {m.breakSlot.time}
                                  </span>
                                ) : (
                                  <span className="text-[var(--muted)] text-[10px] italic">sem intervalo</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filteredSkillCollabs.length > 0 && (
                <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--line)]">
                    <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-[var(--ink)]">
                      <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                      <span>Skills & Proficiências</span>
                    </h4>
                    <span className="text-[10px] font-black bg-[var(--paper)] px-2 py-0.5 rounded-md text-[var(--muted)]">
                      {filteredSkillCollabs.length}
                    </span>
                  </div>
                  <div className="p-3">
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {results.matchedSkills.map((s) => (
                        <span
                          key={s}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 dark:bg-purple-950/70 text-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-800 rounded-lg text-[11px] font-extrabold"
                        >
                          <Sparkles className="w-3 h-3 opacity-80" />
                          {s}
                        </span>
                      ))}
                    </div>
                    <div className="space-y-1.5">
                      {filteredSkillCollabs.map((item) => (
                        <div
                          key={item.collab.id}
                          onClick={() => setSelectedCollab(item.collab)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedCollab(item.collab);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          className="flex items-center justify-between gap-2 px-3 py-2 bg-[var(--paper)] border border-[var(--line)] rounded-lg cursor-pointer hover:border-[var(--primary)] hover:ring-1 hover:ring-[var(--primary)]/30 transition-all group focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-bold text-[var(--ink)] truncate">{item.collab.name}</span>
                            <span className="flex flex-wrap gap-1">
                              {item.skills.map((s) => (
                                <span
                                  key={s.name}
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black border ${
                                    s.level === 3
                                      ? 'bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-800'
                                      : s.level === 2
                                      ? 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-200 border-indigo-300 dark:border-indigo-800'
                                      : 'bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-800'
                                  }`}
                                >
                                  {s.name} Nv {s.level}
                                </span>
                              ))}
                            </span>
                          </div>
                          {renderStatusBadge(item.status)}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {(filteredGroupCollabs.length > 0 || filteredAbsenceCollabs.length > 0) && (
                <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--line)]">
                    <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-[var(--ink)]">
                      <UsersRound className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Grupos, Cargos & Afastamentos</span>
                    </h4>
                    <span className="text-[10px] font-black bg-[var(--paper)] px-2 py-0.5 rounded-md text-[var(--muted)]">
                      {filteredGroupCollabs.length + filteredAbsenceCollabs.length}
                    </span>
                  </div>
                  <div className="p-3 space-y-3">
                    {groupChips.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {groupChips.map((chip, i) => (
                          <span
                            key={`${chip.label}-${i}`}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 border rounded-lg text-[11px] font-extrabold ${chip.cls}`}
                          >
                            {chip.label}
                          </span>
                        ))}
                      </div>
                    )}
                    {filteredGroupCollabs.length > 0 && (
                      <div className="space-y-1.5">
                        {filteredGroupCollabs.map((r) =>
                          renderCollabRow(r.collab, r.status, (
                            <span className="hidden sm:flex flex-wrap gap-1">
                              {results.matchedRoles.includes(r.collab.role) && (
                                <span className="text-[9px] font-black bg-[var(--primary-soft)] text-[var(--primary)] px-1.5 py-0.5 rounded">
                                  {r.collab.role}
                                </span>
                              )}
                              {results.matchedCategories.includes(r.collab.category) && (
                                <span className="text-[9px] font-black bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded">
                                  {r.collab.category}
                                </span>
                              )}
                            </span>
                          ),
                          r.isExtraPresence
                        ))}
                      </div>
                    )}
                    {filteredAbsenceCollabs.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">
                          Colaboradores em {results.matchedAbsenceTypes.map((a) => a.label).join(' / ')} hoje
                        </div>
                        {filteredAbsenceCollabs.map((r) => renderCollabRow(r.collab, r.status, undefined, r.isExtraPresence))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Central & Hub - Links e Sistemas */}
              {results.matchedInfoHubLinks.length > 0 && (
                <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--line)]">
                    <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-[var(--ink)]">
                      <Globe className="w-3.5 h-3.5 text-blue-500" />
                      <span>Hub de Informações — Links & Sistemas</span>
                    </h4>
                    <span className="text-[10px] font-black bg-[var(--paper)] px-2 py-0.5 rounded-md text-[var(--muted)]">
                      {results.matchedInfoHubLinks.length}
                    </span>
                  </div>
                  <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {results.matchedInfoHubLinks.map((link) => (
                      <div
                        key={link.id}
                        className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-3 flex flex-col justify-between gap-2 hover:border-[var(--primary)] transition-all group"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-extrabold text-[var(--ink)] flex items-center gap-1.5">
                              <Globe className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              {link.title}
                            </span>
                            {link.category && (
                              <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 rounded text-[9px] font-black shrink-0">
                                {link.category}
                              </span>
                            )}
                          </div>
                          {link.description && (
                            <p className="text-[11px] text-[var(--muted)] font-medium line-clamp-2">
                              {link.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--line)] mt-1">
                          <span className="text-[10px] text-[var(--muted)] truncate opacity-80">{link.url}</span>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10.5px] font-black flex items-center gap-1 shrink-0 transition-colors shadow-2xs"
                          >
                            <span>Acessar</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Central & Hub - Preenchimento Rápido & Códigos */}
              {results.matchedInfoHubQuickFills.length > 0 && (
                <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--line)]">
                    <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-[var(--ink)]">
                      <FileCode className="w-3.5 h-3.5 text-amber-500" />
                      <span>Hub de Informações — Preenchimento Rápido & Códigos</span>
                    </h4>
                    <span className="text-[10px] font-black bg-[var(--paper)] px-2 py-0.5 rounded-md text-[var(--muted)]">
                      {results.matchedInfoHubQuickFills.length}
                    </span>
                  </div>
                  <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {results.matchedInfoHubQuickFills.map((qf) => (
                      <div
                        key={qf.id}
                        className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-[var(--ink)] flex items-center gap-1.5">
                            <FileCode className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            {qf.title}
                          </span>
                          {qf.category && (
                            <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 rounded text-[9px] font-black shrink-0">
                              {qf.category}
                            </span>
                          )}
                        </div>
                        {qf.description && (
                          <p className="text-[11px] text-[var(--muted)] font-medium">{qf.description}</p>
                        )}
                        {qf.items && qf.items.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            {qf.items.map((subItem) => (
                              <div
                                key={subItem.id}
                                className="flex items-center justify-between gap-2 p-1.5 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs"
                              >
                                <span className="font-bold text-[var(--ink)] truncate">{subItem.label}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(subItem.codeValue);
                                    showNotice(`Código "${subItem.label}" copiado!`);
                                  }}
                                  className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-white rounded font-mono text-[10px] font-black flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                                  title="Clique para copiar este código"
                                >
                                  <Copy className="w-2.5 h-2.5" />
                                  <span>{subItem.codeValue}</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Central de Conhecimento - Processos */}
              {results.matchedProcessKnowledge.length > 0 && (
                <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--line)]">
                    <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-[var(--ink)]">
                      <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Central de Conhecimento — Processos & Procedimentos</span>
                    </h4>
                    <span className="text-[10px] font-black bg-[var(--paper)] px-2 py-0.5 rounded-md text-[var(--muted)]">
                      {results.matchedProcessKnowledge.length}
                    </span>
                  </div>
                  <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {results.matchedProcessKnowledge.map((proc) => (
                      <div
                        key={proc.id}
                        className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-[var(--ink)] flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            {proc.title}
                          </span>
                          {proc.category && (
                            <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 rounded text-[9px] font-black shrink-0">
                              {proc.category}
                            </span>
                          )}
                        </div>
                        {proc.description && (
                          <p className="text-[11px] text-[var(--muted)] font-medium line-clamp-2">
                            {proc.description}
                          </p>
                        )}
                        {proc.keyTakeaways && proc.keyTakeaways.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {proc.keyTakeaways.map((kt, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 bg-[var(--bg)] border border-[var(--line)] rounded text-[9.5px] font-bold text-[var(--ink)]"
                              >
                                • {kt}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Central & Hub - Comunicados & Lembretes */}
              {results.matchedInfoHubReminders.length > 0 && (
                <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--line)]">
                    <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-[var(--ink)]">
                      <Megaphone className="w-3.5 h-3.5 text-purple-500" />
                      <span>Hub de Informações — Comunicados & Lembretes</span>
                    </h4>
                    <span className="text-[10px] font-black bg-[var(--paper)] px-2 py-0.5 rounded-md text-[var(--muted)]">
                      {results.matchedInfoHubReminders.length}
                    </span>
                  </div>
                  <div className="p-3 space-y-2">
                    {results.matchedInfoHubReminders.map((rem) => (
                      <div
                        key={rem.id}
                        className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="space-y-0.5">
                          <MarkdownContent content={rem.text} sizeClass="text-xs font-bold leading-relaxed" />
                          <div className="flex items-center gap-2 text-[10px] text-[var(--muted)] font-medium">
                            {rem.authorName && <span>Por: {rem.authorName}</span>}
                            {rem.shift && (
                              <span className="px-1.5 py-0.2 bg-purple-100 text-purple-900 rounded font-black">
                                Turno {rem.shift}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Central - Pedidos & Chamados */}
              {results.matchedServiceRequests.length > 0 && (
                <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--line)]">
                    <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-[var(--ink)]">
                      <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Central de Pedidos — Ações & Operacional</span>
                    </h4>
                    <span className="text-[10px] font-black bg-[var(--paper)] px-2 py-0.5 rounded-md text-[var(--muted)]">
                      {results.matchedServiceRequests.length}
                    </span>
                  </div>
                  <div className="p-3 space-y-2">
                    {results.matchedServiceRequests.map((sr) => (
                      <div
                        key={sr.id}
                        className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-[var(--ink)] truncate">{sr.title}</span>
                            <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-900 rounded text-[9px] font-black shrink-0 uppercase">
                              {sr.priority}
                            </span>
                          </div>
                          {sr.description && (
                            <p className="text-[11px] text-[var(--muted)] font-medium truncate">{sr.description}</p>
                          )}
                          <div className="text-[10px] text-[var(--muted)] font-bold">
                            Solicitante: {sr.requesterName} {sr.collaboratorName ? `• Alvo: ${sr.collaboratorName}` : ''}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] rounded text-[10px] font-black shrink-0 self-start sm:self-center">
                          Status: {sr.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[var(--bg)] border border-[var(--line)] mb-3">
                <Search className="w-5 h-5 text-[var(--muted)]" />
              </div>
              <p className="text-sm font-bold text-[var(--ink)]">Nenhum resultado para "{query}"</p>
              <p className="text-xs text-[var(--muted)] mt-1">
                Tente buscar por nome de colaborador, tarefa, skill, cargo, categoria, time, turno ou afastamento.
              </p>
            </div>
          )
        )}
          </div>
        </div>,
        document.body
      )}

      {/* Detalhes e ações rápidas do colaborador (via React Portal no document.body) */}
      {selectedCollab &&
        createPortal(
          <CollabDetailsModal collab={selectedCollab} onClose={() => setSelectedCollab(null)} />,
          document.body
        )}

      {/* Modal para Criar Pedido em Lote (via React Portal no document.body) */}
      {isBatchRequestOpen &&
        createPortal(
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
                onClick={() => setIsBatchRequestOpen(false)}
                className="p-1 text-[var(--muted)] hover:text-[var(--ink)] rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBatchSubmitRequest} className="p-4 space-y-3">
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-300 font-bold space-y-1">
                <div>Pedido com conteúdo composto por <strong>{selectedMultiIds.length} colaborador(es)</strong> selecionados.</div>
                <div className="text-[10.5px] opacity-90 truncate">
                  {state.collaborators
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
                  onClick={() => setIsBatchRequestOpen(false)}
                  className="px-3 py-1.5 bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] rounded-xl text-xs font-extrabold hover:bg-[var(--line)]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-sm flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar Pedido ({selectedMultiIds.length})</span>
                </button>
              </div>
            </form>
          </div>
          </div>,
          document.body
        )}
    </div>
  );
};

function collabResultsFiltered(
  list: CollabResult[],
  statusFilter: StatusType | 'all'
): CollabResult[] {
  return statusFilter === 'all' ? list : list.filter((r) => r.status === statusFilter);
}
