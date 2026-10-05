import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { MarkdownContent } from '../components/MarkdownContent';
import {
  FileText,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  Plus,
  Search,
  User,
  Trash2,
  Layers,
  UserCheck,
  Link as LinkIcon,
  Play,
  RotateCcw,
  XCircle,
  Image as ImageIcon,
  Copy,
  Check,
  Volume2,
  VolumeX,
  Maximize2,
  Pencil,
  SlidersHorizontal,
  Filter,
  Headphones,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  CardHeader,
  Button,
  Badge,
  StatCard,
  Tabs,
  Toolbar,
  EmptyState,
  Field,
  Input,
  Select,
  Textarea,
  Modal,
} from '../components/ui';
import { ServiceRequest, SupportMessage, ActionLinkVar } from '../types';
import { escapeSearchTerm, formatDateBR } from '../utils/helpers';
import { collabMenuOnContext } from '../utils/collabContextMenu';
import { resolveSupportActionLink, formatSupportFieldsForClipboard } from '../utils/supportActionLink';
import { consumePendingServiceRequestId, onFocusServiceRequest } from '../utils/navigation';
import { dispatchHighlightToExtension, dispatchOpenSystemToExtension, isExtensionInstalled } from '../utils/extensionInstaller';
import { useI18n } from '../i18n';

// Live Stopwatch for tickets currently in progress
const LiveDurationTimer: React.FC<{ startedAt: string }> = ({ startedAt }) => {
  const [elapsed, setElapsed] = useState<number>(() => {
    const start = new Date(startedAt).getTime();
    return isNaN(start) ? 0 : Math.max(0, Math.floor((Date.now() - start) / 1000));
  });

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    if (isNaN(start)) return;

    const interval = setInterval(() => {
      const ms = Date.now() - start;
      setElapsed(Math.max(0, Math.floor(ms / 1000)));
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <span className="font-mono font-black text-xs text-blue-600 dark:text-blue-400 inline-flex items-center gap-1">
      <Clock className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '3s' }} />
      <span>
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </span>
    </span>
  );
};

export const ServiceRequestsView: React.FC = () => {
  const { t } = useI18n();
  const {
    state,
    identifiedUser,
    createServiceRequest,
    updateServiceRequest,
    markRequestAsRead,
    markRequestAsCompleted,
    deleteServiceRequest,
    updateTaskExternalUrl,
    showNotice,
    acceptSupportMessage,
    resolveSupportMessage,
    returnSupportMessageToQueue,
    cancelSupportMessage,
    deleteSupportMessage,
    addSupportMessage,
    updateHelpdeskConfig,
  } = useApp();

  // Top View Navigation Mode: 'helpdesk' | 'systemic'
  const [activeTab, setActiveTab] = useState<'helpdesk' | 'systemic'>('helpdesk');

  // ================= HELPDESK QUEUE STATE =================
  const [helpdeskDateFilter, setHelpdeskDateFilter] = useState<'hoje' | '7dias' | 'todos'>('hoje');
  const [helpdeskShiftFilter, setHelpdeskShiftFilter] = useState<string>('todos');
  const [helpdeskSectorFilter, setHelpdeskSectorFilter] = useState<string>('todos');
  const [helpdeskStatusFilter, setHelpdeskStatusFilter] = useState<string>('todos');
  const [helpdeskCategoryFilter, setHelpdeskCategoryFilter] = useState<string>('todas');
  const [helpdeskTypeFilter, setHelpdeskTypeFilter] = useState<string>('todos');
  const [helpdeskSearch, setHelpdeskSearch] = useState<string>('');

  // Resolution Notes State (in-ticket during atendimento)
  const [ticketNotes, setTicketNotes] = useState<Record<string, string>>({});

  // Cancel Modal State
  const [cancellingTicketId, setCancellingTicketId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');

  // Image Preview Modal
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Copied state indicator map
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [copiedFieldId, setCopiedFieldId] = useState<string | null>(null);
  const [copiedAllId, setCopiedAllId] = useState<string | null>(null);

  // ================= SYSTEMIC REQUESTS STATE =================
  const [activeFilter, setActiveFilter] = useState<'todos' | 'pendentes' | 'realizados' | 'meus'>('pendentes');
  const [shiftFilter, setShiftFilter] = useState<string>('meu_turno'); // 'meu_turno' | 'todos' | 'T1' | 'T2' | 'T3' | 'ADM'
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingRequest, setEditingRequest] = useState<ServiceRequest | null>(null);

  // Form State for Systemic Requests
  const [reqType, setReqType] = useState<'aviso' | 'acao_sistemica'>('acao_sistemica');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [selectedCollabIds, setSelectedCollabIds] = useState<string[]>([]);
  const [collabSearchTerm, setCollabSearchTerm] = useState('');
  const [priority, setPriority] = useState<'baixa' | 'media' | 'alta' | 'urgente'>('media');
  const [requestShift, setRequestShift] = useState<string>(identifiedUser?.shift || state.teamShift || 'T2');
  const [targetAudience, setTargetAudience] = useState<'atual' | 'proximo' | 'proximos' | 'todos'>('atual');
  const [visibleUntilShift, setVisibleUntilShift] = useState<string>('Todos');
  const [externalUrlInput, setExternalUrlInput] = useState('');

  const [deletingReqId, setDeletingReqId] = useState<string | null>(null);
  const [focusedRequestId, setFocusedRequestId] = useState<string | null>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve o colaborador cadastrado a partir do remetente de um chamado.
  const collabBySender = useMemo(() => {
    return (senderId?: string, senderName?: string) => {
      if (senderId) {
        const byId = state.collaborators.find(
          (c) => c.id === senderId || c.login === senderId || c.registration === senderId
        );
        if (byId) return byId;
      }
      if (senderName && senderName.trim()) {
        const normalized = senderName.trim().toLowerCase();
        return state.collaborators.find((c) => c.name.trim().toLowerCase() === normalized);
      }
      return undefined;
    };
  }, [state.collaborators]);

  const applyFocus = (id: string) => {
    const isSupport = (state.supportMessages || []).some((m) => m.id === id);
    const isSystemic = (state.serviceRequests || []).some((r) => r.id === id);
    if (isSupport) {
      setActiveTab('helpdesk');
    } else if (isSystemic) {
      setActiveTab('systemic');
    }
    setActiveFilter('todos');
    setShiftFilter('todos');
    setSearchTerm('');
    setFocusedRequestId(id);
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    focusTimerRef.current = setTimeout(() => setFocusedRequestId(null), 3500);
  };

  useEffect(() => {
    const pendingId = consumePendingServiceRequestId();
    if (pendingId) applyFocus(pendingId);
    const off = onFocusServiceRequest((id) => applyFocus(id));
    return () => {
      off();
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!focusedRequestId) return;
    const el = document.getElementById(`request-${focusedRequestId}`);
    if (el) {
      const t = setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
      return () => clearTimeout(t);
    }
  }, [focusedRequestId]);

  const activeTask = state.tasks.find((t) => t.id === selectedTaskId);
  const taskMembers = activeTask
    ? state.collaborators.filter((c) => activeTask.members.includes(c.id))
    : [];

  const handleTaskChange = (taskId: string) => {
    setSelectedTaskId(taskId);
    const taskObj = state.tasks.find((t) => t.id === taskId);
    if (taskObj) {
      if (taskObj.externalUrl) {
        setExternalUrlInput(taskObj.externalUrl);
      } else {
        setExternalUrlInput('');
      }
    }
  };

  const handleSaveExternalUrl = () => {
    if (!selectedTaskId) {
      showNotice('Selecione uma tarefa primeiro para vincular o link externo.');
      return;
    }
    updateTaskExternalUrl(selectedTaskId, externalUrlInput);
    showNotice('Link do sistema salvo na tarefa com sucesso!');
  };

  const toggleCollaborator = (collabId: string) => {
    if (selectedCollabIds.includes(collabId)) {
      setSelectedCollabIds(selectedCollabIds.filter((id) => id !== collabId));
    } else {
      setSelectedCollabIds([...selectedCollabIds, collabId]);
    }
  };

  const selectAllTaskCollaborators = () => {
    const taskCollabIds = taskMembers.map((c) => c.id);
    setSelectedCollabIds((prev) => Array.from(new Set([...prev, ...taskCollabIds])));
  };

  const deselectAllTaskCollaborators = () => {
    const taskCollabIds = new Set(taskMembers.map((c) => c.id));
    setSelectedCollabIds((prev) => prev.filter((id) => !taskCollabIds.has(id)));
  };

  const handleOpenEditRequest = (req: ServiceRequest) => {
    setEditingRequest(req);
    setReqType(req.type || 'acao_sistemica');
    setTitle(req.title || '');
    setDescription(req.description || '');
    setPriority((req.priority as any) || 'media');
    setRequestShift(req.shift || identifiedUser?.shift || state.teamShift || 'T2');
    setTargetAudience((req.targetShiftAudience as any) || 'atual');
    setVisibleUntilShift(req.visibleUntilShift || 'Todos');
    setSelectedTaskId(req.taskId || '');
    setExternalUrlInput(req.taskExternalUrl || '');

    if (req.selectedCollaborators && req.selectedCollaborators.length > 0) {
      const ids = req.selectedCollaborators
        .map((name) => state.collaborators.find((c) => c.name.toLowerCase() === name.toLowerCase())?.id)
        .filter(Boolean) as string[];
      setSelectedCollabIds(ids);
    } else if (req.collaboratorId) {
      setSelectedCollabIds([req.collaboratorId]);
    } else if (req.collaboratorName) {
      const found = state.collaborators.find((c) => c.name.toLowerCase() === req.collaboratorName?.toLowerCase());
      setSelectedCollabIds(found ? [found.id] : []);
    } else {
      setSelectedCollabIds([]);
    }

    setIsCreating(true);
  };

  const handleCloseModal = () => {
    setTitle('');
    setDescription('');
    setSelectedTaskId('');
    setSelectedCollabIds([]);
    setCollabSearchTerm('');
    setExternalUrlInput('');
    setEditingRequest(null);
    setIsCreating(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showNotice('Por favor, preencha o título do pedido.');
      return;
    }

    const selectedCollaboratorsNames = state.collaborators
      .filter((c) => selectedCollabIds.includes(c.id))
      .map((c) => c.name);

    if (editingRequest) {
      updateServiceRequest(editingRequest.id, {
        title: title.trim(),
        description: description.trim(),
        taskId: selectedTaskId || undefined,
        collaboratorName: selectedCollaboratorsNames.length === 1 ? selectedCollaboratorsNames[0] : undefined,
        selectedCollaborators: selectedCollaboratorsNames,
        priority,
        shift: requestShift,
        targetShiftAudience: targetAudience,
        visibleUntilShift: targetAudience === 'proximos' ? visibleUntilShift : undefined,
        taskExternalUrl: externalUrlInput.trim() || undefined,
        type: reqType,
      });
      handleCloseModal();
      return;
    }

    createServiceRequest({
      title: title.trim(),
      description: description.trim(),
      taskId: selectedTaskId || undefined,
      collaboratorName: selectedCollaboratorsNames.length === 1 ? selectedCollaboratorsNames[0] : undefined,
      selectedCollaborators: selectedCollaboratorsNames,
      priority,
      shift: requestShift,
      targetShiftAudience: targetAudience,
      visibleUntilShift: targetAudience === 'proximos' ? visibleUntilShift : undefined,
      taskExternalUrl: externalUrlInput.trim() || undefined,
      type: reqType,
    });

    handleCloseModal();
    showNotice('Pedido de serviço cadastrado com sucesso!');
  };

  const handleOpenTaskSystemWithCollabCopy = async (
    taskName?: string,
    externalUrl?: string,
    collabName?: string
  ) => {
    if (collabName) {
      try {
        await navigator.clipboard.writeText(collabName);
      } catch {
        // ignore
      }
    }

    if (externalUrl) {
      if (collabName) {
        dispatchHighlightToExtension([collabName], taskName || 'Tarefa');
      }
      dispatchOpenSystemToExtension(externalUrl);
      window.open(externalUrl, '_blank', 'noopener,noreferrer');
      showNotice(
        `📋 "${collabName || 'Colaborador'}" copiado para a área de transferência e abrindo o sistema (${taskName || 'Tarefa'})!`
      );
    } else {
      showNotice(`📋 "${collabName || 'Colaborador'}" copiado para a área de transferência!`);
    }
  };

  const handleOpenSystemWithCopy = async (
    externalUrl?: string,
    collaboratorNames?: string[],
    requestTitle?: string
  ) => {
    if (collaboratorNames && collaboratorNames.length > 0) {
      const textToCopy = collaboratorNames.join('\n');
      try {
        await navigator.clipboard.writeText(textToCopy);
        showNotice(`📋 ${collaboratorNames.length} colaborador(es) copiado(s) para a área de transferência!`);
      } catch (err) {
        showNotice('Não foi possível copiar automaticamente para a área de transferência.');
      }
    }

    if (externalUrl) {
      if (collaboratorNames && collaboratorNames.length > 0) {
        dispatchHighlightToExtension(collaboratorNames, requestTitle);
      }
      dispatchOpenSystemToExtension(externalUrl);
      window.open(externalUrl, '_blank', 'noopener,noreferrer');
    } else {
      showNotice('Nenhum link de sistema configurado para este pedido/tarefa.');
    }
  };

  // Filtered Systemic Requests
  const filteredRequests = (state.serviceRequests || []).filter((req) => {
    if (activeFilter === 'pendentes' && req.status !== 'pendente') return false;
    if (activeFilter === 'realizados' && req.status !== 'realizado') return false;
    if (activeFilter === 'meus') {
      const isMine =
        req.requesterId === identifiedUser?.id ||
        (identifiedUser?.name && req.requesterName?.toLowerCase().includes(identifiedUser.name.toLowerCase()));
      if (!isMine) return false;
    }

    if (shiftFilter === 'meu_turno') {
      const myShift = identifiedUser?.shift || state.teamShift;
      if (myShift) {
        if (req.shift && req.shift !== myShift && req.targetShiftAudience !== 'todos') return false;
      }
    } else if (shiftFilter !== 'todos') {
      if (req.shift !== shiftFilter) return false;
    }

    if (searchTerm.trim()) {
      const term = escapeSearchTerm(searchTerm.trim().toLowerCase());
      const matchTitle = req.title.toLowerCase().includes(term);
      const matchDesc = req.description?.toLowerCase().includes(term);
      const matchRequester = req.requesterName.toLowerCase().includes(term);
      const matchCollab = req.selectedCollaborators?.some((c) => c.toLowerCase().includes(term));
      if (!matchTitle && !matchDesc && !matchRequester && !matchCollab) return false;
    }

    return true;
  });

  // Support messages filtering & queue calculation
  const allSupportMessages = state.supportMessages || [];

  const todayStr = new Date().toISOString().slice(0, 10);
  const sevenDaysAgoStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const filteredSupportMessages = useMemo(() => {
    return allSupportMessages.filter((msg) => {
      // Date Filter
      const msgDate = msg.createdAt ? msg.createdAt.slice(0, 10) : '';
      if (helpdeskDateFilter === 'hoje' && msgDate !== todayStr) return false;
      if (helpdeskDateFilter === '7dias' && msgDate < sevenDaysAgoStr) return false;

      // Shift Filter
      if (helpdeskShiftFilter !== 'todos') {
        if (msg.senderShift !== helpdeskShiftFilter) return false;
      }

      // Sector Filter (Multisetorial)
      if (helpdeskSectorFilter !== 'todos') {
        const msgSector = (msg as any).senderSector || (msg as any).targetSector;
        if (msgSector && msgSector !== helpdeskSectorFilter) return false;
      }

      // Status Filter
      if (helpdeskStatusFilter !== 'todos') {
        if (msg.status !== helpdeskStatusFilter) return false;
      }

      // Category Filter
      if (helpdeskCategoryFilter !== 'todas') {
        if (msg.senderCategory !== helpdeskCategoryFilter) return false;
      }

      // Type Filter
      if (helpdeskTypeFilter !== 'todos') {
        if (msg.supportType !== helpdeskTypeFilter) return false;
      }

      // Search query
      if (helpdeskSearch.trim()) {
        const term = escapeSearchTerm(helpdeskSearch.trim().toLowerCase());
        const matchSender = msg.senderName.toLowerCase().includes(term);
        const matchCode = msg.codeText?.toLowerCase().includes(term);
        const matchFields = (msg.fields || []).some((f) => String(f.value || '').toLowerCase().includes(term));
        const matchType = msg.supportType?.toLowerCase().includes(term);
        const matchNotes = msg.resolutionNotes?.toLowerCase().includes(term);
        if (!matchSender && !matchCode && !matchFields && !matchType && !matchNotes) return false;
      }

      return true;
    });
  }, [
    allSupportMessages,
    helpdeskDateFilter,
    helpdeskShiftFilter,
    helpdeskSectorFilter,
    helpdeskStatusFilter,
    helpdeskCategoryFilter,
    helpdeskTypeFilter,
    helpdeskSearch,
    todayStr,
    sevenDaysAgoStr,
  ]);

  // KPI Calculations
  const waitingCount = allSupportMessages.filter((m) => m.status === 'enviado').length;
  const inProgressCount = allSupportMessages.filter((m) => m.status === 'em_atendimento').length;
  const resolvedTodayCount = allSupportMessages.filter((m) => {
    const date = (m.resolvedAt || m.createdAt || '').slice(0, 10);
    return m.status === 'resolvido' && date === todayStr;
  }).length;

  const resolvedWithDuration = allSupportMessages.filter(
    (m) => m.status === 'resolvido' && typeof m.durationSeconds === 'number' && m.durationSeconds > 0
  );
  const avgDurationSeconds =
    resolvedWithDuration.length > 0
      ? Math.round(
          resolvedWithDuration.reduce((sum, m) => sum + (m.durationSeconds || 0), 0) /
            resolvedWithDuration.length
        )
      : 0;

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'urgente':
        return <Badge tone="danger">Urgente</Badge>;
      case 'alta':
        return <Badge tone="warning">Alta</Badge>;
      case 'media':
        return <Badge tone="info">Média</Badge>;
      default:
        return <Badge tone="neutral">Baixa</Badge>;
    }
  };

  const handleCopyCode = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCodeId(id);
      setTimeout(() => setCopiedCodeId(null), 2500);
      showNotice('Código copiado para a área de transferência!');
    } catch {
      showNotice('Erro ao copiar código.');
    }
  };

  const handleCopyField = async (key: string, value: string, id: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedFieldId(id);
      setTimeout(() => setCopiedFieldId(null), 2500);
      showNotice('Valor copiado para a área de transferência!');
    } catch {
      showNotice('Erro ao copiar valor.');
    }
  };

  const handleCopyAllFields = async (id: string, fields?: Array<{ id: string; label: string; value: string; key?: string }>) => {
    const text = formatSupportFieldsForClipboard(fields);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAllId(id);
      setTimeout(() => setCopiedAllId(null), 2500);
      showNotice('Todos os campos copiados para a área de transferência!');
    } catch {
      showNotice('Erro ao copiar os campos.');
    }
  };

  const handleOpenSupportActionLink = (msg: { supportType?: string; fields?: Array<{ id: string; label: string; value: string; key?: string }>; senderName?: string; senderShift?: string; senderCategory?: string; codeText?: string }) => {
    const preset = (state.helpdeskConfig?.supportTypes || []).find((p) => p.name === msg.supportType);
    const template = preset?.actionLink;
    const linkVars: ActionLinkVar[] | undefined = preset?.actionLinkVars;
    const textToCopy = formatSupportFieldsForClipboard(msg.fields);
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy).catch(() => undefined);
    }
    if (template) {
      const url = resolveSupportActionLink(template, linkVars, {
        fields: msg.fields,
        senderName: msg.senderName,
        senderShift: msg.senderShift,
        senderCategory: msg.senderCategory,
        supportType: msg.supportType,
        codeText: msg.codeText,
      });
      window.open(url, '_blank', 'noopener,noreferrer');
      showNotice('📋 Dados copiados e link aberto no sistema!');
    } else {
      showNotice('Nenhum link de sistema configurado para este tipo de pedido.');
    }
  };

  const handleNoteChange = (msgId: string, value: string) => {
    setTicketNotes((prev) => ({
      ...prev,
      [msgId]: value,
    }));
  };

  const handleDirectResolve = (msg: SupportMessage) => {
    const currentNote = ticketNotes[msg.id] !== undefined ? ticketNotes[msg.id] : (msg.resolutionNotes || '');
    resolveSupportMessage(msg.id, currentNote.trim() || undefined);
    showNotice('Chamado concluído com sucesso!');
  };

  const handleConfirmCancel = () => {
    if (!cancellingTicketId) return;
    cancelSupportMessage(cancellingTicketId, cancelReason.trim() || undefined);
    setCancellingTicketId(null);
    setCancelReason('');
    showNotice('Chamado cancelado.');
  };

  return (
    <div className="space-y-5 animate-fadeIn max-w-7xl mx-auto">
      <PageHeader
        icon={activeTab === 'helpdesk' ? Headphones : FileText}
        title={t('requests.title')}
        subtitle={t('requests.subtitle')}
        actions={
          activeTab === 'systemic' ? (
            <Button icon={Plus} onClick={() => setIsCreating(true)}>
              {t('requests.newRequest')}
            </Button>
          ) : undefined
        }
      />

      <Tabs
        items={[
          {
            value: 'helpdesk',
            label: t('requests.title'),
            icon: Headphones,
            badge:
              waitingCount > 0 ? (
                <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[9px] font-black rounded-full animate-pulse">
                  {waitingCount}
                </span>
              ) : undefined,
          },
          {
            value: 'systemic',
            label: t('requests.subtitle'),
            icon: FileText,
            badge:
              filteredRequests.filter((r) => r.status === 'pendente').length > 0 ? (
                <span className="px-1.5 py-0.5 bg-[var(--surface-3)] text-[var(--muted)] text-[9px] font-black rounded-full">
                  {filteredRequests.filter((r) => r.status === 'pendente').length}
                </span>
              ) : undefined,
          },
        ]}
        value={activeTab}
        onChange={(v) => setActiveTab(v as 'helpdesk' | 'systemic')}
      />

      {/* ========================================================================= */}
      {/* TAB 1: HELPDESK & SUPPORT QUEUE                                          */}
      {/* ========================================================================= */}
      {activeTab === 'helpdesk' && (
        <div className="space-y-5">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Na Fila (Aguardando)" value={waitingCount} icon={Clock} tone="warning" />
            <StatCard label="Em Atendimento" value={inProgressCount} icon={Play} tone="info" />
            <StatCard label="Resolvidos Hoje" value={resolvedTodayCount} icon={CheckCircle2} tone="success" />
            <StatCard
              label="TMA (Tempo Médio)"
              value={avgDurationSeconds > 0 ? formatDuration(avgDurationSeconds) : '—'}
              icon={Clock}
              tone="default"
            />
          </div>

          {/* Filter Bar */}
          <Card>
            <CardHeader
              title="Filtros da Fila"
              subtitle="Refine por data, turno, status, tipo e busca."
              icon={<SlidersHorizontal className="w-4.5 h-4.5" />}
              actions={
                <Button
                  variant="outline"
                  size="sm"
                  icon={state.helpdeskConfig?.notifySound !== false ? Volume2 : VolumeX}
                  title="Ativar/Desativar som de novos chamados"
                  onClick={() =>
                    updateHelpdeskConfig({
                      notifySound: !(state.helpdeskConfig?.notifySound ?? true),
                    })
                  }
                >
                  {state.helpdeskConfig?.notifySound !== false ? 'Som Ativo' : 'Som Mudo'}
                </Button>
              }
            />
            <div className="mt-3.5 space-y-3">
              <Toolbar>
                <span className="text-[11px] font-bold text-[var(--muted)]">Data:</span>
                {(['hoje', '7dias', 'todos'] as const).map((mode) => (
                  <Button
                    key={mode}
                    size="xs"
                    variant={helpdeskDateFilter === mode ? 'primary' : 'outline'}
                    onClick={() => setHelpdeskDateFilter(mode)}
                  >
                    {mode === 'hoje' ? 'Hoje' : mode === '7dias' ? 'Últimos 7 dias' : 'Todos'}
                  </Button>
                ))}
              </Toolbar>

              {/* Shift, Sector, Status, Type & Search row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
                <Field label="Turno do Solicitante">
                  <Select
                    value={helpdeskShiftFilter}
                    onChange={(e) => setHelpdeskShiftFilter(e.target.value)}
                  >
                    <option value="todos">Todos os Turnos</option>
                    {(state.shifts || ['T1', 'T2', 'T3', 'T4', 'T5']).map((s) => (
                      <option key={s} value={s}>
                        Turno {s}
                      </option>
                    ))}
                  </Select>
                </Field>

                {state.registeredSectors && state.registeredSectors.length > 1 && (
                  <Field label="Setor">
                    <Select
                      value={helpdeskSectorFilter}
                      onChange={(e) => setHelpdeskSectorFilter(e.target.value)}
                    >
                      <option value="todos">Todos os Setores</option>
                      {state.registeredSectors.map((sec) => (
                        <option key={sec} value={sec}>
                          {sec}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}

                <Field label="Status do Chamado">
                  <Select
                    value={helpdeskStatusFilter}
                    onChange={(e) => setHelpdeskStatusFilter(e.target.value)}
                  >
                    <option value="todos">Todos os Status</option>
                    <option value="enviado">🟡 Na Fila (Aguardando)</option>
                    <option value="em_atendimento">🔵 Em Atendimento</option>
                    <option value="resolvido">🟢 Resolvidos</option>
                    <option value="cancelado">⚪ Cancelados</option>
                  </Select>
                </Field>

                <Field label="Tipo de Pedido">
                  <Select
                    value={helpdeskTypeFilter}
                    onChange={(e) => setHelpdeskTypeFilter(e.target.value)}
                  >
                    <option value="todos">Todos os Tipos</option>
                    {(state.helpdeskConfig?.supportTypes || []).map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Buscar Chamado">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                    <Input
                      type="text"
                      value={helpdeskSearch}
                      onChange={(e) => setHelpdeskSearch(e.target.value)}
                      placeholder="Nome, código, recado..."
                      className="pl-8"
                    />
                  </div>
                </Field>
              </div>
            </div>
          </Card>

          {/* Ticket Cards Grid */}
          {filteredSupportMessages.length === 0 ? (
            <EmptyState
              icon={Headphones}
              title="Nenhum chamado encontrado na fila."
              description={
                allSupportMessages.length === 0
                  ? 'Os pedidos enviados pelo Portal da Base ou Meu Painel aparecerão aqui em tempo real.'
                  : 'Nenhum chamado corresponde aos filtros aplicados.'
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredSupportMessages.map((msg) => {
                const isWaiting = msg.status === 'enviado';
                const isInProgress = msg.status === 'em_atendimento';
                const isResolved = msg.status === 'resolvido';
                const isCancelled = msg.status === 'cancelado';
                const senderCollab = collabBySender(msg.senderId, msg.senderName);
                const activeTaskForCollab = msg.taskId
                  ? state.tasks.find((t) => t.id === msg.taskId)
                  : senderCollab
                  ? state.tasks.find((t) => t.members.includes(senderCollab.id))
                  : undefined;
                const taskExternalUrl = (msg as any).taskExternalUrl || activeTaskForCollab?.externalUrl;
                const effectiveTaskName = activeTaskForCollab?.name || msg.taskName;

                return (
                  <Card
                    key={msg.id}
                    id={`request-${msg.id}`}
                    className={`space-y-3 ${
                      isInProgress
                        ? '!border-blue-500 !bg-blue-500/5 ring-1 ring-blue-500/20'
                        : isWaiting
                        ? '!border-amber-500/40'
                        : isResolved
                        ? '!border-emerald-500/30 !bg-emerald-500/5'
                        : 'opacity-70'
                    }`}
                  >
                    {/* Header: Requester, Shift, Type, Priority */}
                    <div className="flex items-start justify-between gap-2 border-b border-[var(--line)] pb-2.5">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className="font-black text-sm text-[var(--ink)] truncate cursor-context-menu"
                            onContextMenu={senderCollab ? collabMenuOnContext(senderCollab.id) : undefined}
                            title={senderCollab ? 'Clique com o botão direito para opções do colaborador' : undefined}
                          >
                            {msg.senderName}
                          </span>
                          {msg.senderRole && <Badge tone="neutral">{msg.senderRole}</Badge>}
                          {msg.senderShift && <Badge tone="purple">Turno {msg.senderShift}</Badge>}
                          {msg.senderCategory && <Badge tone="neutral">{msg.senderCategory}</Badge>}
                          {effectiveTaskName && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenTaskSystemWithCollabCopy(
                                  effectiveTaskName,
                                  taskExternalUrl,
                                  msg.senderName || senderCollab?.name
                                );
                              }}
                              title={
                                taskExternalUrl
                                  ? `Abrir sistema da tarefa "${effectiveTaskName}" com o nome de "${msg.senderName || senderCollab?.name}" na área de transferência`
                                  : `Copiar "${msg.senderName || senderCollab?.name}" para a área de transferência`
                              }
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20 border border-indigo-500/30 cursor-pointer transition-all hover:scale-[1.02] shadow-xs"
                            >
                              <Layers className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                              <span className="truncate max-w-[150px]">{effectiveTaskName}</span>
                              {taskExternalUrl ? (
                                <ExternalLink className="w-2.5 h-2.5 ml-0.5 opacity-80" />
                              ) : (
                                <Copy className="w-2.5 h-2.5 ml-0.5 opacity-80" />
                              )}
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-[var(--muted)] font-medium">
                          {msg.supportType && (
                            <span className="font-extrabold text-[var(--primary)]">
                              {msg.supportType}
                            </span>
                          )}
                          <span>•</span>
                          <span>
                            {msg.createdAt
                              ? new Date(msg.createdAt).toLocaleTimeString('pt-BR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '—'}
                          </span>
                          {msg.createdAt && (
                            <span className="text-[10px]">
                              ({formatDateBR(msg.createdAt.slice(0, 10))})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status and Priority Badges */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {isWaiting && (
                          <Badge tone="warning">
                            <Clock className="w-3 h-3" />
                            Na Fila
                          </Badge>
                        )}
                        {isInProgress && (
                          <Badge tone="info">
                            <Play className="w-3 h-3" />
                            Em Atendimento
                          </Badge>
                        )}
                        {isResolved && (
                          <Badge tone="success">
                            <CheckCircle2 className="w-3 h-3" />
                            Resolvido
                          </Badge>
                        )}
                        {isCancelled && (
                          <Badge tone="neutral">
                            <XCircle className="w-3 h-3" />
                            Cancelado
                          </Badge>
                        )}

                        {msg.priority && getPriorityBadge(msg.priority)}
                      </div>
                    </div>

                    {/* Content Section: Code, Note, Photo */}
                    <div className="space-y-2 text-xs">
                      {/* Custom configured fields (e.g. printer code, product code) */}
                      {(msg.fields || []).length > 0 && (
                        <div className="space-y-1.5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {(msg.fields || []).map((f) => (
                              <div
                                key={f.id}
                                className="p-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg"
                              >
                                <div className="flex items-center justify-between gap-1 mb-0.5">
                                  <div className="text-[9.5px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                                    {f.label}
                                  </div>
                                  <Button
                                    type="button"
                                    size="xs"
                                    variant="ghost"
                                    title="Copiar valor deste campo"
                                    className={copiedFieldId === `${msg.id}_${f.id}` ? '!text-emerald-500' : ''}
                                    onClick={() => handleCopyField(f.id, f.value, `${msg.id}_${f.id}`)}
                                    icon={copiedFieldId === `${msg.id}_${f.id}` ? Check : Copy}
                                  />
                                </div>
                                <div className="font-mono text-[11px] font-bold text-[var(--ink)] break-all select-all">
                                  {f.value}
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              title="Copiar todos os campos"
                              icon={copiedAllId === msg.id ? Check : Copy}
                              onClick={() => handleCopyAllFields(msg.id, msg.fields)}
                            >
                              {copiedAllId === msg.id ? 'Copiado!' : 'Copiar todos'}
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Action Link (Copiar & Abrir) — independente dos campos personalizados */}
                      {(state.helpdeskConfig?.supportTypes || []).some(
                        (p) => p.name === msg.supportType && p.actionLink
                      ) && (
                        <Button
                          type="button"
                          size="sm"
                          fullWidth
                          icon={ExternalLink}
                          title="Copiar dados e abrir link de ação no sistema"
                          onClick={() => handleOpenSupportActionLink(msg)}
                        >
                          Copiar & Abrir
                        </Button>
                      )}

                      {/* Short Note / Description */}
                      {msg.codeText && (
                        <p className="text-xs text-[var(--ink)] leading-relaxed bg-[var(--bg)] p-2.5 rounded-lg border border-[var(--line)] font-medium">
                          {msg.codeText}
                        </p>
                      )}

                      {/* Code Pill with Copy */}
                      {msg.codeText && (
                        <div className="flex items-center justify-between gap-2 p-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg font-mono text-xs">
                          <div className="truncate font-black text-[var(--ink)]">
                            {msg.codeText}
                          </div>
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            icon={copiedCodeId === msg.id ? Check : Copy}
                            onClick={() => handleCopyCode(msg.id, msg.codeText!)}
                          >
                            {copiedCodeId === msg.id ? 'Copiado!' : 'Copiar'}
                          </Button>
                        </div>
                      )}

                      {/* Photo Thumbnail */}
                      {msg.imageUrl && (
                        <div className="pt-1">
                          <div className="flex items-center justify-between mb-1 text-[10px] font-extrabold uppercase text-[var(--muted)]">
                            <span className="flex items-center gap-1">
                              <ImageIcon className="w-3 h-3 text-[var(--primary)]" />
                              Foto da Câmera / Coletor
                            </span>
                            <button
                              type="button"
                              onClick={() => setPreviewImageUrl(msg.imageUrl!)}
                              className="text-[var(--primary)] hover:underline cursor-pointer font-bold inline-flex items-center gap-0.5"
                            >
                              <Maximize2 className="w-3 h-3" /> Ampliar
                            </button>
                          </div>
                          <img
                            src={msg.imageUrl}
                            alt="Foto do chamado"
                            onClick={() => setPreviewImageUrl(msg.imageUrl!)}
                            className="w-full max-h-48 object-cover rounded-lg border border-[var(--line)] cursor-pointer hover:opacity-90 transition-opacity"
                          />
                        </div>
                      )}
                    </div>

                    {/* Active In-Progress Timer & Inline Observation Field (Visible during atendimento) */}
                    {isInProgress && (
                      <div className="space-y-2">
                        {msg.startedAt && (
                          <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-between text-xs">
                            <div className="text-[11px] font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                              <UserCheck className="w-4 h-4 text-blue-600 shrink-0" />
                              <span>
                                Atendente: <strong>{msg.assignedToName || 'Suporte'}</strong>
                              </span>
                            </div>
                            <LiveDurationTimer startedAt={msg.startedAt} />
                          </div>
                        )}

                        {/* Campo de Observação durante o atendimento (Opcional) */}
                        <Field label="Observação do Atendimento (Opcional):">
                          <Textarea
                            value={ticketNotes[msg.id] !== undefined ? ticketNotes[msg.id] : (msg.resolutionNotes || '')}
                            onChange={(e) => handleNoteChange(msg.id, e.target.value)}
                            placeholder="Ex: Coletor substituído pela unidade #14, solicitação atendida..."
                            rows={2}
                          />
                        </Field>
                      </div>
                    )}

                    {/* Resolved Summary */}
                    {isResolved && (
                      <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                          <span>
                            Resolvido por: <strong>{msg.assignedToName || 'Suporte'}</strong>
                          </span>
                          {typeof msg.durationSeconds === 'number' && msg.durationSeconds > 0 && (
                            <span className="font-mono text-[10px] bg-emerald-500/20 px-1.5 py-0.5 rounded">
                              Duração: {formatDuration(msg.durationSeconds)}
                            </span>
                          )}
                        </div>
                        {msg.resolutionNotes && (
                          <div className="text-[11px] text-[var(--ink)] italic bg-[var(--paper)] p-2 rounded-lg border border-emerald-500/20">
                            "{msg.resolutionNotes}"
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions Bar */}
                    <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between gap-2 flex-wrap text-xs">
                      <div className="flex items-center gap-1">
                        {/* Delete / Cancel option */}
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          icon={Trash2}
                          title="Excluir chamado"
                          className="hover:!text-rose-600 hover:!bg-rose-500/10"
                          onClick={() => deleteSupportMessage(msg.id)}
                        />
                        {!isCancelled && !isResolved && (
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            className="hover:!text-slate-800 hover:!bg-slate-500/10"
                            onClick={() => setCancellingTicketId(msg.id)}
                          >
                            Cancelar
                          </Button>
                        )}
                      </div>

                      {/* Main State Action Buttons */}
                      <div className="flex items-center gap-1.5">
                        {isWaiting && (
                          <Button
                            type="button"
                            size="sm"
                            icon={Play}
                            onClick={() => acceptSupportMessage(msg.id)}
                          >
                            Atender Chamado
                          </Button>
                        )}

                        {isInProgress && (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              icon={RotateCcw}
                              title="Liberar chamado de volta para a fila geral"
                              onClick={() => returnSupportMessageToQueue(msg.id)}
                            >
                              Devolver à Fila
                            </Button>

                            <Button
                              type="button"
                              size="sm"
                              icon={CheckCircle2}
                              className="!bg-emerald-600 hover:!bg-emerald-700"
                              title="Concluir este chamado imediatamente"
                              onClick={() => handleDirectResolve(msg)}
                            >
                              Concluir
                            </Button>
                          </>
                        )}

                        {isResolved && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => returnSupportMessageToQueue(msg.id)}
                          >
                            Reabrir Chamado
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SYSTEMIC SERVICE REQUESTS                                         */}
      {/* ========================================================================= */}
      {activeTab === 'systemic' && (
        <div className="space-y-5">
          {/* Filters Bar */}
          <Card>
            <CardHeader
              title="Filtros dos Pedidos"
              subtitle="Filtre por status, turno e busque pedidos ou pessoas."
              icon={<Filter className="w-4.5 h-4.5" />}
            />
            <div className="mt-3.5 space-y-3">
              <Toolbar>
                {(['pendentes', 'realizados', 'meus', 'todos'] as const).map((filter) => (
                  <Button
                    key={filter}
                    size="xs"
                    variant={activeFilter === filter ? 'primary' : 'outline'}
                    onClick={() => setActiveFilter(filter)}
                  >
                    {filter === 'pendentes'
                      ? 'Pendentes'
                      : filter === 'realizados'
                      ? 'Realizados'
                      : filter === 'meus'
                      ? 'Criados por Mim'
                      : 'Todos'}
                  </Button>
                ))}
              </Toolbar>

              <Toolbar>
                <span className="text-[11px] font-bold text-[var(--muted)]">Filtrar Turno:</span>
                <Button
                  size="xs"
                  variant={shiftFilter === 'meu_turno' ? 'primary' : 'outline'}
                  onClick={() => setShiftFilter('meu_turno')}
                >
                  Meu Turno ({identifiedUser?.shift || state.teamShift || 'T2'})
                </Button>
                <Button
                  size="xs"
                  variant={shiftFilter === 'todos' ? 'primary' : 'outline'}
                  onClick={() => setShiftFilter('todos')}
                >
                  Todos os Turnos
                </Button>
                {(state.shifts || ['T1', 'T2', 'T3', 'T4', 'T5']).map((s) => (
                  <Button
                    key={s}
                    size="xs"
                    variant={shiftFilter === s ? 'primary' : 'outline'}
                    onClick={() => setShiftFilter(s)}
                  >
                    Turno {s}
                  </Button>
                ))}
              </Toolbar>

              {/* Search Bar */}
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                <Input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar pedidos ou pessoas..."
                  className="pl-8"
                />
              </div>
            </div>
          </Card>

          {/* Requests List */}
          {filteredRequests.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Nenhum pedido de serviço encontrado."
              description={'Clique em "Novo Pedido Sistêmico" para registrar uma solicitação.'}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredRequests.map((req) => {
                const reqTask = req.taskId ? state.tasks.find((t) => t.id === req.taskId) : null;
                const reqMembers = reqTask ? state.collaborators.filter((c) => reqTask.members.includes(c.id)) : [];
                const requesterCollab = collabBySender(req.requesterId, req.requesterName);

                return (
                  <Card
                    key={req.id}
                    id={`request-${req.id}`}
                    onClick={() => {
                      if (req.status === 'pendente') markRequestAsRead(req.id);
                    }}
                    className={`space-y-2.5 cursor-pointer ${
                      focusedRequestId === req.id
                        ? '!ring-2 !ring-emerald-400 !border-emerald-400 !bg-[var(--primary-soft)]'
                        : req.status === 'realizado'
                        ? '!border-emerald-500/30 !bg-emerald-500/5'
                        : 'hover:border-[var(--primary-border)]'
                    }`}
                  >
                    {/* Header line */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm text-[var(--ink)] tracking-tight">
                            {req.title}
                          </span>
                          {getPriorityBadge(req.priority)}
                        </div>
                        <div className="text-[11px] text-[var(--muted)] font-medium flex items-center gap-1.5 flex-wrap">
                          <span
                            className="flex items-center gap-1 font-bold text-[var(--ink)] cursor-context-menu"
                            onContextMenu={requesterCollab ? collabMenuOnContext(requesterCollab.id) : undefined}
                            title={requesterCollab ? 'Clique com o botão direito para opções do colaborador' : undefined}
                          >
                            <User className="w-3 h-3 text-[var(--primary)]" />
                            {req.requesterName}
                          </span>
                          <span>•</span>
                          <span className="font-bold text-[var(--primary)]">
                            Turno {req.shift || 'T2'}
                          </span>
                          {req.targetShiftAudience && (
                            <>
                              <span>•</span>
                              <Badge tone="neutral">
                                {req.targetShiftAudience === 'atual'
                                  ? 'Turno Atual'
                                  : req.targetShiftAudience === 'todos'
                                  ? 'Todos os Turnos'
                                  : 'Próximos Turnos'}
                              </Badge>
                            </>
                          )}
                          <span>•</span>
                          <span>{new Date(req.createdAt).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div>
                        {req.status === 'realizado' ? (
                          <Badge tone="success" className="uppercase shrink-0">
                            <CheckCircle2 className="w-3 h-3" />
                            Realizado
                          </Badge>
                        ) : (
                          <Badge tone="warning" className="uppercase shrink-0">
                            <Clock className="w-3 h-3" />
                            Pendente
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    {req.description && (
                      <div className="text-xs text-[var(--ink)] leading-relaxed bg-[var(--bg)] p-2 rounded-lg border border-[var(--line)] font-medium">
                        <MarkdownContent content={req.description} sizeClass="text-xs leading-relaxed" />
                      </div>
                    )}

                    {/* Task / Action System Box */}
                    {(reqTask || req.taskExternalUrl || req.collaboratorName) && (
                      <div className="pt-2 border-t border-[var(--line)] space-y-2 text-xs">
                        {reqTask && (
                          <div className="font-bold text-[var(--ink)] flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-[var(--primary)]" />
                            <span>Tarefa: {reqTask.name}</span>
                          </div>
                        )}

                        {/* Selected Collaborators */}
                        {req.selectedCollaborators && req.selectedCollaborators.length > 0 ? (
                          <div className="flex flex-wrap gap-1 items-center">
                            <span className="text-[10.5px] font-semibold text-[var(--muted)]">Pessoas:</span>
                            {req.selectedCollaborators.map((name) => (
                              <Badge key={name} tone="neutral">
                                {name}
                              </Badge>
                            ))}
                          </div>
                        ) : req.collaboratorName ? (
                          <div className="text-[11px] font-medium text-[var(--ink)]">
                            Colaborador: <span className="font-bold text-[var(--primary)]">{req.collaboratorName}</span>
                          </div>
                        ) : null}

                        {/* Open System & Copy Names Button */}
                        <Button
                          type="button"
                          fullWidth
                          icon={ExternalLink}
                          disabled={!identifiedUser?.isAdmin && !identifiedUser?.isSuperAdmin && !identifiedUser?.isEditor}
                          title={
                            identifiedUser?.isAdmin || identifiedUser?.isSuperAdmin || identifiedUser?.isEditor
                              ? 'Abrir no sistema com os nomes já destacados'
                              : 'Somente cargos administrativos (Admin/Editor) podem abrir o sistema'
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            const namesToCopy =
                              req.selectedCollaborators && req.selectedCollaborators.length > 0
                                ? req.selectedCollaborators
                                : req.collaboratorName
                                ? [req.collaboratorName]
                                : reqMembers.map((c) => c.name);
                            handleOpenSystemWithCopy(req.taskExternalUrl || reqTask?.externalUrl, namesToCopy, req.title);
                          }}
                        >
                          Abrir no Sistema (Copiar Nomes & Destacar)
                        </Button>
                      </div>
                    )}

                    {/* Footer Action buttons */}
                    <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between text-xs">
                      {req.completedBy ? (
                        <span className="text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400">
                          Concluído por {req.completedBy}
                        </span>
                      ) : (
                        <span className="text-[10.5px] text-[var(--muted)]">Aguardando atendimento</span>
                      )}

                      <div className="flex items-center gap-1.5">
                        {/* Edit Button */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          icon={Pencil}
                          title="Editar este aviso/pedido"
                          className="!text-[var(--primary)]"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditRequest(req);
                          }}
                        >
                          Editar
                        </Button>

                        {deletingReqId === req.id ? (
                          <div className="flex items-center gap-1 animate-fadeIn">
                            <Button
                              type="button"
                              variant="danger"
                              size="sm"
                              icon={Trash2}
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteServiceRequest(req.id);
                                setDeletingReqId(null);
                              }}
                            >
                              Confirmar Exclusão
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingReqId(null);
                              }}
                            >
                              Cancelar
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            icon={Trash2}
                            title="Excluir este pedido"
                            className="text-rose-600 dark:text-rose-400"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingReqId(req.id);
                            }}
                          >
                            Excluir
                          </Button>
                        )}

                        {req.status !== 'realizado' && (identifiedUser?.isEditor || identifiedUser?.isAdmin || identifiedUser?.id === 'admin') && (
                          <Button
                            type="button"
                            size="sm"
                            icon={CheckCircle2}
                            className="!bg-emerald-600 hover:!bg-emerald-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              markRequestAsCompleted(req.id);
                            }}
                          >
                            Concluir
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* CANCEL MODAL                                                              */}
      {/* ========================================================================= */}
      <Modal
        isOpen={!!cancellingTicketId}
        onClose={() => setCancellingTicketId(null)}
        title="Cancelar Chamado"
        subtitle="Informe o motivo para cancelar este chamado."
        icon={<XCircle className="w-4.5 h-4.5 text-rose-500" />}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setCancellingTicketId(null)}>
              Voltar
            </Button>
            <Button variant="danger" icon={XCircle} onClick={handleConfirmCancel}>
              Confirmar Cancelamento
            </Button>
          </>
        }
      >
        <Field label="Motivo do Cancelamento (Opcional):">
          <Textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Ex: Chamado duplicado ou resolvido pelo próprio operador."
            rows={2}
          />
        </Field>
      </Modal>

      {/* ========================================================================= */}
      {/* FULL-SIZE IMAGE PREVIEW MODAL                                             */}
      {/* ========================================================================= */}
      <Modal
        isOpen={!!previewImageUrl}
        onClose={() => setPreviewImageUrl(null)}
        title="Foto Anexada ao Chamado"
        size="xl"
      >
        <div className="flex items-center justify-center overflow-auto">
          <img
            src={previewImageUrl}
            alt="Foto em alta resolução"
            className="max-w-full max-h-[75vh] object-contain rounded-lg"
          />
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* SYSTEMIC REQUEST CREATION MODAL                                           */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isCreating}
        onClose={handleCloseModal}
        title={editingRequest ? 'Editar Pedido de Serviço / Aviso' : 'Novo Pedido de Serviço'}
        icon={editingRequest ? <Pencil className="w-4.5 h-4.5" /> : <Send className="w-4.5 h-4.5" />}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {!identifiedUser && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 rounded-lg font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Por favor, identifique-se no topo antes de enviar.</span>
            </div>
          )}

          {/* Title & Priority */}
          <div className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <Field label="Título *">
                  <Input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Alocar colaborador na tarefa XYZ"
                    required
                  />
                </Field>
              </div>

              <Field label="Prioridade">
                <Select value={priority} onChange={(e) => setPriority(e.target.value as any)}>
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </Select>
              </Field>
            </div>

            {/* Quick Title Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10.5px] font-medium text-[var(--muted)]">Atalhos:</span>
              {['Alocar', 'Derrubar', 'Ajustar Fila', 'Liberar Permissão', 'Remanejar'].map((sug) => (
                <Button
                  key={sug}
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    if (!title.trim()) {
                      setTitle(`${sug}: `);
                    } else if (!title.toLowerCase().startsWith(sug.toLowerCase())) {
                      setTitle(`${sug} - ${title}`);
                    }
                  }}
                >
                  + {sug}
                </Button>
              ))}
            </div>
          </div>

          {/* Shift & Audience Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Origem (Turno):">
              <Select value={requestShift} onChange={(e) => setRequestShift(e.target.value)}>
                {state.shifts.map((s) => (
                  <option key={s} value={s}>
                    Turno {s}
                  </option>
                ))}
                <option value="ADM">ADM / Geral</option>
              </Select>
            </Field>

            <Field label="Público-Alvo:">
              <Select value={targetAudience} onChange={(e) => setTargetAudience(e.target.value as any)}>
                <option value="atual">Apenas Turno Atual ({requestShift})</option>
                <option value="todos">Todos os Turnos (Visível Geral)</option>
                <option value="proximo">Próximo Turno</option>
                <option value="proximos">Próximos Turnos</option>
              </Select>
            </Field>
          </div>

          {/* Task Link & Collaborator Picker */}
          <div className="space-y-3 pt-1 border-t border-[var(--line)]">
            <Field label="Tarefa Envolvida (Opcional):">
              <Select value={selectedTaskId} onChange={(e) => handleTaskChange(e.target.value)}>
                <option value="">Nenhuma tarefa vinculada</option>
                {state.tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.members.length} membros)
                  </option>
                ))}
              </Select>
            </Field>

            {/* Task Members Selector */}
            {activeTask && taskMembers.length > 0 && (
              <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px] text-[var(--ink)] flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-[var(--primary)]" />
                    Membros de "{activeTask.name}":
                  </span>
                  <div className="flex items-center gap-2 text-[10px]">
                    <button
                      type="button"
                      onClick={selectAllTaskCollaborators}
                      className="font-bold text-[var(--primary)] hover:underline cursor-pointer"
                    >
                      Selecionar Todos
                    </button>
                    <span className="text-[var(--muted)]">•</span>
                    <button
                      type="button"
                      onClick={deselectAllTaskCollaborators}
                      className="font-bold text-[var(--muted)] hover:underline cursor-pointer"
                    >
                      Limpar Seleção
                    </button>
                  </div>
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                  {taskMembers.map((c) => {
                    const isChecked = selectedCollabIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className={`flex items-center justify-between p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-[var(--primary-soft)] border-[var(--primary)] text-[var(--ink)] font-bold'
                            : 'bg-[var(--paper)] border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleCollaborator(c.id)}
                            className="w-3.5 h-3.5 text-[var(--primary)] rounded cursor-pointer"
                          />
                          <span>{c.name}</span>
                        </div>
                        <span className="text-[10px] text-[var(--muted)] font-mono">
                          {c.role || 'Operador'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* External Task URL Input */}
            <Field label="Link Externo do Sistema da Tarefa (Opcional):">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <LinkIcon className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                  <Input
                    type="url"
                    value={externalUrlInput}
                    onChange={(e) => setExternalUrlInput(e.target.value)}
                    placeholder="https://sistema-interno.empresa.com/tarefa/..."
                    className="pl-8"
                  />
                </div>
                {selectedTaskId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSaveExternalUrl}
                    title="Salvar este link permanentemente nesta tarefa"
                    className="shrink-0"
                  >
                    Salvar na Tarefa
                  </Button>
                )}
              </div>
            </Field>
          </div>

          {/* Description */}
          <Field label="Observações / Recado:">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes adicionais sobre a solicitação..."
              rows={3}
            />
          </Field>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--line)]">
            <Button type="button" variant="outline" onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button type="submit" icon={editingRequest ? Check : Send}>
              {editingRequest ? 'Salvar Alterações' : 'Cadastrar Pedido'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};