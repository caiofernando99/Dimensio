import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  ListTodo,
  Clock,
  Radio,
  ShieldCheck,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  Coffee,
  BellRing,
  Smartphone,
  Search,
  Check,
  User,
  Users,
  Wifi,
  ChevronRight,
  Filter,
  X,
  SlidersHorizontal,
  Settings,
  Link2,
  ExternalLink,
  Copy,
  Globe,
  UserCheck,
  Info,
  Sparkles,
  MapPinned,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardBody,
  SectionHeader,
  Button,
  Badge,
  Tabs,
  EmptyState,
  Field,
  Input,
  Select,
  Toggle,
  Modal,
} from '../components/ui';
import { CommunicationPanel } from '../components/CommunicationPanel';
import { useCommunication } from '../context/CommunicationContext';
import { SupportCodeDispatcher } from '../components/SupportCodeDispatcher';
import { UserNotificationsModal } from '../components/UserNotificationsModal';
import { DimensioMonogram } from '../components/DimensioLogo';
import { getTodayISO, formatDateBR, abbreviateName, escapeSearchTerm, matchesCollaboratorSearch } from '../utils/helpers';
import { playNotificationSound, triggerDeviceVibration, unlockAudioContext } from '../utils/audioAlert';
import { showNativeOSNotification } from '../utils/notifications';
import { APP_VERSION, BUILD_TS, GIT_COMMIT, GIT_BRANCH } from '../version';
import { InfoHubLink } from '../types';

interface PortalViewProps {
  onSwitchToManagement?: () => void;
  standalone?: boolean;
}

const LOCAL_STORAGE_OPERATOR_KEY = 'dimensio_portal_operator_id';

export const OperatorPortalView: React.FC<PortalViewProps> = ({
  onSwitchToManagement,
  standalone = false,
}) => {
  const {
    state,
    identifiedUser,
    identifyUser,
    logoutUser,
    showNotice,
    isNotificationForCurrentUser,
    getTaskAreaCounts,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'tarefas' | 'intervalos' | 'comunicacao' | 'links'>('tarefas');
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Rádio: enquanto estiver ligado, o modo segundo plano permanece sempre ativo
  // (coletor Honeywell) para não suspender a transmissão de voz.
  const { enabled: radioEnabled } = useCommunication();

  // Read URL query parameters for default filters
  const urlParams = useMemo(() => {
    if (typeof window === 'undefined') return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, []);

  // Preset multiselect filters parsed from URL
  const presetRoles = useMemo(() => {
    const rolesStr = urlParams.get('roles') || urlParams.get('role');
    if (!rolesStr || rolesStr === 'all') return [];
    return rolesStr.split(',').map((r) => r.trim()).filter(Boolean);
  }, [urlParams]);

  const presetCategories = useMemo(() => {
    const catsStr = urlParams.get('categories') || urlParams.get('category');
    if (!catsStr || catsStr === 'all') return [];
    return catsStr.split(',').map((c) => c.trim()).filter(Boolean);
  }, [urlParams]);

  // Abreviar nomes dos colaboradores no Portal (via link ?abbrev=true ou configuração global)
  const [abbreviateNames, setAbbreviateNames] = useState<boolean>(() => {
    return urlParams.get('abbrev') === 'true' || state.abbreviatePortalNames === true;
  });

  // Filter States initialized from URL params if present
  const [filterShift, setFilterShift] = useState<string>(() => urlParams.get('shift') || 'all');
  const [filterScale, setFilterScale] = useState<string>(() => urlParams.get('scale') || 'all');
  const [filterCategory, setFilterCategory] = useState<string>(() => urlParams.get('category') || 'all');
  const [filterRole, setFilterRole] = useState<string>(() => urlParams.get('role') || 'all');
  const [viewScope, setViewScope] = useState<'my_tasks' | 'all_tasks'>(() => {
    if (urlParams.get('onlyMine') === 'true' || urlParams.get('mine') === 'true') {
      return 'my_tasks';
    }
    return 'all_tasks';
  });
  const [searchTaskQuery, setSearchTaskQuery] = useState<string>(() => urlParams.get('q') || '');

  // Links Tab States
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [linkCategoryFilter, setLinkCategoryFilter] = useState('todos');
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  // Operator selection modal state with 6-hour auto-logout for shared devices
  const OPERATOR_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours

  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState<string>(() => {
    try {
      if (identifiedUser?.collaboratorId) return String(identifiedUser.collaboratorId);
      const saved = localStorage.getItem(LOCAL_STORAGE_OPERATOR_KEY);
      if (saved) {
        if (saved.startsWith('{')) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.id) {
            const timestamp = parsed.timestamp || 0;
            if (timestamp && Date.now() - timestamp > OPERATOR_MAX_AGE_MS) {
              localStorage.removeItem(LOCAL_STORAGE_OPERATOR_KEY);
              return '';
            }
            return String(parsed.id);
          }
        }
        return saved; // Legacy string ID
      }
    } catch {
      // Fallback
    }
    return '';
  });

  const [searchOperatorQuery, setSearchOperatorQuery] = useState('');
  const [isSelectingOperator, setIsSelectingOperator] = useState(false);

  // Check if user is truly identified with an existing collaborator profile
  const isIdentified = useMemo(() => {
    if (identifiedUser && identifiedUser.id !== 'unauthenticated') {
      return true;
    }
    if (selectedCollaboratorId && state.collaborators.some((c) => c.id === selectedCollaboratorId || c.login === selectedCollaboratorId || c.registration === selectedCollaboratorId)) {
      return true;
    }
    return false;
  }, [identifiedUser, selectedCollaboratorId, state.collaborators]);

  // Prompt for identification if user opens the portal unauthenticated
  useEffect(() => {
    if (!isIdentified) {
      setIsSelectingOperator(true);
    }
  }, []);

  // Synchronize when identifiedUser changes in AppContext
  useEffect(() => {
    if (identifiedUser?.collaboratorId) {
      setSelectedCollaboratorId(String(identifiedUser.collaboratorId));
    }
  }, [identifiedUser]);

  // Background Radio & Wake Lock state for Honeywell Collectors (Always on by default)
  const [isBackgroundRadioActive, setIsBackgroundRadioActive] = useState(true);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const audioKeepaliveCtxRef = useRef<AudioContext | null>(null);

  // Rádio ligado ⇒ segundo plano sempre ativo (usuário não consegue deixá-lo
  // desativado enquanto transmite, evitando áudio suspenso ao trocar de app).
  useEffect(() => {
    if (radioEnabled) {
      setIsBackgroundRadioActive(true);
    }
  }, [radioEnabled]);

  // Real-time task redirection alert state
  const [taskRedirectionAlert, setTaskRedirectionAlert] = useState<{
    taskName: string;
    timestamp: string;
  } | null>(null);

  const prevAssignedTaskIdsRef = useRef<string[]>([]);

  const todayStr = getTodayISO();

  // Active collaborator profile
  const currentCollaborator = useMemo(() => {
    const found = state.collaborators.find(
      (c) =>
        c.id === selectedCollaboratorId ||
        c.login === selectedCollaboratorId ||
        c.registration === selectedCollaboratorId ||
        c.id === identifiedUser?.collaboratorId ||
        c.login === identifiedUser?.login
    );

    if (found) return found;

    if (identifiedUser && identifiedUser.id !== 'unauthenticated') {
      return {
        id: identifiedUser.collaboratorId || identifiedUser.id,
        name: identifiedUser.name,
        shift: identifiedUser.shift || state.teamShift || 'T1',
        scale: 'A',
        role: identifiedUser.role || 'REP',
        category: 'Operação',
        login: identifiedUser.login || '',
        registration: identifiedUser.registration || '',
      };
    }

    return {
      id: '',
      name: 'Operador Não Identificado',
      shift: state.teamShift || 'T1',
      scale: 'A',
      role: 'REP',
      category: 'Geral',
      login: '',
      registration: '',
    };
  }, [state.collaborators, selectedCollaboratorId, identifiedUser, state.teamShift]);

  // Unread notifications for current operator
  const myNotifications = useMemo(() => {
    return (state.notifications || []).filter((n) => isNotificationForCurrentUser(n, true, currentCollaborator.id));
  }, [state.notifications, isNotificationForCurrentUser, currentCollaborator.id]);

  const unreadNotifCount = useMemo(() => {
    return myNotifications.filter((n) => !n.read).length;
  }, [myNotifications]);

  // Tarefas por área (contagem de Pendentes/Em processamento dos postos) — planejamento de rotas
  const isSupervisor = useMemo(() => {
    const role = (currentCollaborator.role || '').toLowerCase();
    return (
      identifiedUser?.isAdmin === true ||
      identifiedUser?.isEditor === true ||
      role === 'tl' ||
      role === 'admin' ||
      role === 'super' ||
      role === 'supervisor' ||
      role === 'gestor' ||
      role === 'gerente' ||
      role === 'lider' ||
      role === 'líder'
    );
  }, [identifiedUser, currentCollaborator.role]);

  const areaCounts = useMemo(() => getTaskAreaCounts(), [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    state.metricDefinitions,
    state.metricReadings,
    state.tasks,
  ]);

  const areaGrandTotal = useMemo(() => {
    let p = 0;
    let pr = 0;
    areaCounts.forEach((a) => {
      p += a.pending;
      pr += a.processing;
    });
    return { pending: p, processing: pr, total: p + pr };
  }, [areaCounts]);

  // Save selected operator id locally with timestamp and identify in AppContext
  const handleSelectOperator = async (collabId: string) => {
    setSelectedCollaboratorId(collabId);
    try {
      localStorage.setItem(
        LOCAL_STORAGE_OPERATOR_KEY,
        JSON.stringify({ id: collabId, timestamp: Date.now() })
      );
    } catch {
      // Fallback
    }
    identifyUser(collabId);
    setIsSelectingOperator(false);
    showNotice('Identificação realizada com sucesso!');
  };

  const handleLogoutOperator = () => {
    setSelectedCollaboratorId('');
    try {
      localStorage.removeItem(LOCAL_STORAGE_OPERATOR_KEY);
    } catch {}
    logoutUser();
    setIsSelectingOperator(true);
    showNotice('Sessão encerrada. Por favor, identifique-se.');
  };

  // Direct tasks where collaborator is an active assigned member
  const myDirectTasks = useMemo(() => {
    if (!currentCollaborator.id || !isIdentified) return [];
    return state.tasks.filter((t) => t.active !== false && t.members.includes(currentCollaborator.id));
  }, [state.tasks, currentCollaborator.id, isIdentified]);

  // Find all eligible/assigned tasks for current operator
  const myTasks = useMemo(() => {
    if (!currentCollaborator.id || !isIdentified) return [];
    return state.tasks.filter((t) => {
      return (
        t.active !== false &&
        (t.members.includes(currentCollaborator.id) ||
          (t.allowedRoles && t.allowedRoles.includes(currentCollaborator.role)) ||
          (t.allowedCategories && t.allowedCategories.includes(currentCollaborator.category)))
      );
    });
  }, [state.tasks, currentCollaborator, isIdentified]);

  // Track task reassignment in real-time
  useEffect(() => {
    const currentTaskIds = myDirectTasks.map((t) => t.id);
    const prevIds = prevAssignedTaskIdsRef.current;

    if (prevIds.length > 0) {
      const newlyAssigned = myDirectTasks.find((t) => !prevIds.includes(t.id));
      if (newlyAssigned) {
        const portalCfg = state.portalNotificationConfig || {};
        if (portalCfg.soundAlerts !== false) {
          playNotificationSound();
          if (portalCfg.vibrationAlerts) {
            triggerDeviceVibration([300, 100, 300]);
          }
        }
        if (portalCfg.taskRedirectionAlert !== false) {
          showNativeOSNotification('Redirecionamento de Tarefa — Dimensio Portal', {
            body: `Atenção: Você foi direcionado para a tarefa "${newlyAssigned.name}".`,
            tag: 'dimensio-task-redirect',
          });
          setTaskRedirectionAlert({
            taskName: newlyAssigned.name,
            timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          });
        }
      }
    }

    prevAssignedTaskIdsRef.current = currentTaskIds;
  }, [myDirectTasks, state.portalNotificationConfig]);

  // Handle Background Radio WakeLock for Honeywell Collectors
  useEffect(() => {
    let wakeSentinel: WakeLockSentinel | null = null;

    const enableBackgroundMode = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeSentinel = await navigator.wakeLock.request('screen');
          wakeLockRef.current = wakeSentinel;
        }
      } catch {
        // Silent catch
      }
    };

    if (isBackgroundRadioActive) {
      enableBackgroundMode();
    }

    return () => {
      if (wakeSentinel) wakeSentinel.release().catch(() => {});
    };
  }, [isBackgroundRadioActive]);

  // Break schedule for current date
  const todayIntervals = state.intervals?.[todayStr] || {};
  const shiftBreaks = state.breaks.filter((b) => !b.shift || b.shift === currentCollaborator.shift || b.shift === 'Todos');

  const myAssignedBreaks = shiftBreaks.filter((b) => {
    const list = todayIntervals[b.id] || [];
    return list.includes(currentCollaborator.id);
  });

  // Filter Tasks list based on active filters and sort current collaborator's task to the TOP
  const displayedTasks = useMemo(() => {
    let baseTasks = state.tasks;

    if (viewScope === 'my_tasks') {
      baseTasks = myTasks;
    }

    const filtered = baseTasks.filter((task) => {
      // Hidden (inactive) tasks should never appear in the portal
      if (task.active === false) return false;

      // Category filter
      if (filterCategory !== 'all') {
        const matchesCat =
          task.allowedCategories?.includes(filterCategory) ||
          task.name.toLowerCase().includes(filterCategory.toLowerCase());
        if (!matchesCat) return false;
      }

      // Role filter
      if (filterRole !== 'all' && task.allowedRoles && task.allowedRoles.length > 0) {
        if (!task.allowedRoles.includes(filterRole)) return false;
      }

      // Search query
      if (searchTaskQuery.trim()) {
        const q = escapeSearchTerm(searchTaskQuery);
        const matchesName = escapeSearchTerm(task.name).includes(q);
        const matchesMember = state.collaborators.some(
          (c) => task.members.includes(c.id) && escapeSearchTerm(c.name).includes(q)
        );
        if (!matchesName && !matchesMember) return false;
      }

      return true;
    });

    // Sort: Tasks assigned to the identified operator ALWAYS APPEAR FIRST
    return filtered.sort((a, b) => {
      const aIsMyDirect = isIdentified && currentCollaborator.id ? a.members.includes(currentCollaborator.id) : false;
      const bIsMyDirect = isIdentified && currentCollaborator.id ? b.members.includes(currentCollaborator.id) : false;
      if (aIsMyDirect && !bIsMyDirect) return -1;
      if (!aIsMyDirect && bIsMyDirect) return 1;
      return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
    });
  }, [state.tasks, state.collaborators, viewScope, myTasks, filterCategory, filterRole, searchTaskQuery, isIdentified, currentCollaborator]);

  // Map collaborator breaks for display on task cards
  const collabBreakMap = useMemo(() => {
    const map: Record<string, string> = {};
    Object.entries(todayIntervals).forEach(([breakId, memberIds]) => {
      const breakObj = state.breaks.find((b) => b.id === breakId);
      if (breakObj && Array.isArray(memberIds)) {
        memberIds.forEach((mId) => {
          map[mId] = breakObj.time;
        });
      }
    });
    return map;
  }, [todayIntervals, state.breaks]);

  // Check if search or task scope filter is active
  const hasActiveFilters = searchTaskQuery.trim() !== '' || viewScope === 'my_tasks';

  const resetFilters = () => {
    setViewScope('all_tasks');
    setSearchTaskQuery('');
  };

  // Filter collaborators list for identification selector modal based on active filters (Sorted Alphabetically A-Z)
  const filteredCollaborators = useMemo(() => {
    const query = searchOperatorQuery.trim();

    const matchesFilter = (c: typeof state.collaborators[0]) => {
      if (filterShift !== 'all' && c.shift && c.shift !== filterShift) {
        return false;
      }
      if (presetRoles.length > 0) {
        if (!presetRoles.includes(c.role)) return false;
      } else if (filterRole !== 'all' && c.role !== filterRole) {
        return false;
      }
      if (presetCategories.length > 0) {
        if (!presetCategories.includes(c.category)) return false;
      } else if (filterCategory !== 'all' && c.category !== filterCategory) {
        return false;
      }
      return true;
    };

    if (!query) {
      return state.collaborators
        .filter(matchesFilter)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
    }

    // When query is typed, search across all collaborators
    const searchMatches = state.collaborators.filter((c) =>
      matchesCollaboratorSearch(c, query, { defaultTeamLeader: state.defaultTeamLeader })
    );

    const inFilterMatches = searchMatches
      .filter(matchesFilter)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
    const outOfFilterMatches = searchMatches
      .filter((c) => !matchesFilter(c))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));

    return [...inFilterMatches, ...outOfFilterMatches];
  }, [
    state.collaborators,
    filterShift,
    presetRoles,
    filterRole,
    presetCategories,
    filterCategory,
    searchOperatorQuery,
    state.defaultTeamLeader,
  ]);

  // Operational links list (only links with showInPortal enabled in InfoHub)
  const allOperationalLinks = useMemo<InfoHubLink[]>(() => {
    const rawLinks = state.infoHubLinks || [];
    return rawLinks
      .filter((link) => link.showInPortal === true)
      .sort((a, b) =>
        (a.title || '').localeCompare(b.title || '', 'pt-BR', { sensitivity: 'base' })
      );
  }, [state.infoHubLinks]);

  // Categories available in links
  const availableLinkCategories = useMemo(() => {
    const set = new Set<string>();
    allOperationalLinks.forEach((l) => {
      if (l.category && l.category.trim()) set.add(l.category.trim());
    });
    return Array.from(set);
  }, [allOperationalLinks]);

  // Filtered operational links
  const filteredOperationalLinks = useMemo(() => {
    const q = linkSearchQuery.toLowerCase().trim();
    return allOperationalLinks.filter((l) => {
      if (linkCategoryFilter !== 'todos' && l.category !== linkCategoryFilter) {
        return false;
      }
      if (
        currentCollaborator.shift &&
        l.shift &&
        l.shift !== 'todos' &&
        l.shift !== currentCollaborator.shift
      ) {
        return false;
      }
      if (q) {
        const matchTitle = (l.title || '').toLowerCase().includes(q);
        const matchDesc = (l.description || '').toLowerCase().includes(q);
        const matchCat = (l.category || '').toLowerCase().includes(q);
        const matchUrl = (l.url || '').toLowerCase().includes(q);
        return matchTitle || matchDesc || matchCat || matchUrl;
      }
      return true;
    });
  }, [allOperationalLinks, linkCategoryFilter, linkSearchQuery, currentCollaborator.shift]);

  const handleCopyLink = (url: string, id: string) => {
    if (!url) return;
    try {
      navigator.clipboard.writeText(url);
      setCopiedLinkId(id);
      showNotice('Link copiado com sucesso para a área de transferência!');
      setTimeout(() => setCopiedLinkId(null), 2500);
    } catch {
      showNotice('Não foi possível copiar o link.');
    }
  };

  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--ink)] flex flex-col font-sans select-none pb-12">
      {/* Task Redirection Alert Floating Banner */}
      {taskRedirectionAlert && (
        <div className="bg-amber-500 text-slate-950 font-black px-4 py-3 shadow-[var(--shadow-pop)] flex items-center justify-between gap-3 sticky top-0 z-50 animate-bounce">
          <div className="flex items-center gap-2.5 min-w-0">
            <BellRing className="w-5 h-5 shrink-0 text-slate-900 animate-spin" />
            <div className="truncate text-xs sm:text-sm">
              <span>Atenção: Você foi direcionado para uma nova tarefa! </span>
              <span className="underline decoration-2 font-extrabold">{taskRedirectionAlert.taskName}</span>
              <span className="text-[10px] opacity-80 ml-2 font-mono">({taskRedirectionAlert.timestamp})</span>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setTaskRedirectionAlert(null);
              setActiveTab('tarefas');
            }}
            className="bg-slate-900 text-white hover:bg-slate-800 shrink-0"
          >
            Ver Minha Tarefa
          </Button>
        </div>
      )}

      {/* HEADER BAR WITH DIMENSIO LOGO AND SECTOR NAME */}
      <header className="bg-[var(--paper)] border-b border-[var(--line)] sticky top-0 z-40 px-3 sm:px-5 py-3 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Dimensio Logo + PORTAL — SETOR */}
          <div className="flex items-center gap-3">
            {/* Dimensio Brand Monogram */}
            <div className="flex items-center bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-1.5 rounded-2xl shadow-md">
              <DimensioMonogram size="sm" />
            </div>

            {/* Separator */}
            <div className="h-6 w-px bg-[var(--line)] hidden sm:block" />

            {/* Title: PORTAL — SETOR */}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-black uppercase tracking-wide text-[var(--ink)]">
                  PORTAL — <span className="text-[var(--primary)]">{state.sector || 'BASE OPERACIONAL'}</span>
                </h1>
              </div>
              <p className="text-[10.5px] text-[var(--muted)] font-medium truncate max-w-[220px] sm:max-w-none flex items-center gap-1.5">
                {state.location || 'Unidade Operacional'} • {formatDateBR(todayStr)}
                <Badge
                  tone="neutral"
                  className="font-mono"
                  title={`Dimensio v${APP_VERSION}${GIT_COMMIT ? ` (${GIT_COMMIT})` : ''}${BUILD_TS ? ` — Build: ${BUILD_TS}` : ''}${GIT_BRANCH ? ` [Git: ${GIT_BRANCH}]` : ''}`}
                >
                  v{APP_VERSION}{GIT_COMMIT ? ` (${GIT_COMMIT})` : ''}
                </Badge>
              </p>
            </div>
          </div>

          {/* Operator Profile Selector, Settings & Actions */}
          <div className="flex items-center gap-2">
            {/* Portal Settings Button */}
            <Button
              variant="outline"
              size="sm"
              icon={Settings}
              onClick={() => setIsSettingsModalOpen(true)}
              title="Configurações do Portal (Rádio em segundo plano, atalhos, nomes)"
              className="bg-[var(--bg)]"
            />

            {/* Notification Bell Button for Operator */}
            <Button
              variant="outline"
              size="sm"
              icon={BellRing}
              className={`relative bg-[var(--bg)] ${
                unreadNotifCount > 0 ? '[&_svg]:text-amber-500 [&_svg]:animate-bounce' : ''
              }`}
              onClick={() => {
                unlockAudioContext();
                setIsNotificationsModalOpen(true);
              }}
              title="Central de Notificações do Colaborador"
            >
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-rose-600 text-white shadow-sm animate-pulse">
                  {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                </span>
              )}
            </Button>

            {/* Operator Identifier Button */}
            <Button
              variant={isIdentified ? "outline" : "primary"}
              size="sm"
              iconRight={ChevronRight}
              onClick={() => setIsSelectingOperator(true)}
              title={isIdentified ? "Clique para trocar o operador selecionado" : "Clique para identificar-se"}
              className={`h-10 px-2.5 gap-2.5 ${
                !isIdentified
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-black ring-2 ring-amber-500/40 animate-pulse'
                  : 'bg-[var(--bg)]'
              }`}
            >
              <span
                className={`w-7 h-7 rounded-lg text-xs font-black flex items-center justify-center uppercase shrink-0 ${
                  !isIdentified ? 'bg-slate-900 text-white' : 'bg-[var(--primary)] text-white'
                }`}
              >
                {isIdentified ? currentCollaborator.name.charAt(0) : '?'}
              </span>
              <span className="flex flex-col items-start text-left">
                <span className="text-xs font-black text-[var(--ink)] truncate max-w-[120px] sm:max-w-[170px]">
                  {isIdentified
                    ? (abbreviateNames ? abbreviateName(currentCollaborator.name, false) : currentCollaborator.name)
                    : 'Identificar-se'}
                </span>
                <span className="text-[9.5px] font-mono text-[var(--muted)] truncate block">
                  {isIdentified
                    ? `Turno ${currentCollaborator.shift} | ${currentCollaborator.role}`
                    : 'Toque para escolher'}
                </span>
              </span>
            </Button>

            {/* Management mode switch (if authorized) */}
            {!standalone && onSwitchToManagement && (
              <Button
                variant="secondary"
                size="sm"
                icon={ShieldCheck}
                onClick={onSwitchToManagement}
                title="Voltar ao Painel de Gestão"
              >
                <span className="hidden md:inline">Gestão</span>
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              icon={LogOut}
              onClick={handleLogoutOperator}
              title="Trocar Operador / Sair"
              className="text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 hover:text-rose-600"
            />
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 space-y-4">
        {/* TAB SWITCHER */}
        <Tabs
          items={[
            {
              value: 'tarefas',
              label: 'Tarefas',
              icon: ListTodo,
              badge: myDirectTasks.length > 0 ? myDirectTasks.length : (myTasks.length > 0 ? myTasks.length : undefined),
            },
            { value: 'intervalos', label: 'Intervalos', icon: Clock },
            { value: 'comunicacao', label: 'Comunicação', icon: Radio },
            {
              value: 'links',
              label: 'Links & Atalhos',
              icon: Link2,
            },
          ]}
          value={activeTab}
          onChange={(v) => setActiveTab(v as 'tarefas' | 'intervalos' | 'comunicacao' | 'links')}
          className="w-full [&>button]:flex-1"
        />

        {/* TAB 1: TAREFAS DO DIA */}
        {activeTab === 'tarefas' && (
          <div className="space-y-4">
            {/* Identification Prompt Banner if not identified */}
            {!isIdentified && (
              <div className="p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-500/60 shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-lg shrink-0">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[var(--ink)]">
                      Identificação do Operador Necessária
                    </h3>
                    <p className="text-xs text-[var(--muted)] font-medium">
                      Identifique-se para ver sua tarefa atual destacada em primeiro lugar e receber avisos do seu turno.
                    </p>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  icon={UserCheck}
                  onClick={() => setIsSelectingOperator(true)}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black"
                >
                  Identificar-me Agora
                </Button>
              </div>
            )}

            {/* Hero Card: SUA TAREFA ATUAL (Top of Tasks list) */}
            {isIdentified && myDirectTasks.length > 0 && (
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent border-2 border-emerald-500 shadow-md">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black text-xl shadow-sm shrink-0">
                      🎯
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-emerald-600 text-white shadow-2xs">
                          Sua Tarefa Atual
                        </span>
                        <span className="text-[11px] font-mono font-bold text-[var(--muted)]">
                          {currentCollaborator.name} (Turno {currentCollaborator.shift} | {currentCollaborator.role})
                        </span>
                      </div>
                      <h2 className="text-base sm:text-lg font-black text-[var(--ink)] uppercase tracking-wide truncate mt-1">
                        {myDirectTasks.map((t) => t.name).join(' • ')}
                      </h2>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge tone="success" dot className="font-extrabold text-xs py-1 px-3 uppercase">
                      Alocado Hoje
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            {isIdentified && myDirectTasks.length === 0 && (
              <div className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-[var(--muted)]">
                  <Info className="w-4 h-4 text-[var(--primary)] shrink-0" />
                  <span>Você ainda não foi alocado em uma tarefa no turno de hoje.</span>
                </div>
                <Badge tone="neutral" className="font-mono">Turno {currentCollaborator.shift}</Badge>
              </div>
            )}

            {/* TAREFAS POR ÁREA (supervisão/roteamento) */}
            {isIdentified && isSupervisor && (
              <div className="p-4 rounded-2xl bg-sky-50/60 dark:bg-sky-950/20 border border-sky-500/20 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <MapPinned className="w-4 h-4 text-sky-600" />
                    <span className="text-[11px] font-black uppercase tracking-wider text-[var(--ink)]">
                      Tarefas por área (planejamento de rotas)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge tone="success" dot>Total: {areaGrandTotal.total}</Badge>
                    <Badge tone="warning">Pendentes: {areaGrandTotal.pending}</Badge>
                    <Badge tone="info">Processando: {areaGrandTotal.processing}</Badge>
                  </div>
                </div>
                {areaCounts.length === 0 ? (
                  <p className="text-[11px] text-[var(--muted)] font-medium leading-relaxed">
                    Sem contagens coletadas. O gestor cadastra as métricas "Pendentes" e "Em processamento" por posto no
                    painel de métricas (com fluxo de filtros + áreas a contar, estilo CTRL+F) — o resumo por área
                    aparece aqui para orientar o roteiro.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {areaCounts.map((a) => (
                      <div
                        key={a.area}
                        className="p-2.5 bg-[var(--paper)] border border-[var(--line)] rounded-xl flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-[11px] font-extrabold text-[var(--ink)] truncate">{a.area}</div>
                          <div className="text-[10px] text-[var(--muted)] font-semibold">
                            {a.tasks} posto(s)
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="px-1.5 py-0.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-black">
                            {a.pending} pend.
                          </span>
                          <span className="px-1.5 py-0.5 rounded-lg bg-sky-500/15 text-sky-700 dark:text-sky-300 text-[10px] font-black">
                            {a.processing} proc.
                          </span>
                          <span className="px-1.5 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-black">
                            {a.total} total
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SEARCH BAR & TASK SCOPE SELECTOR */}
            <Card>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                  <Input
                    type="text"
                    value={searchTaskQuery}
                    onChange={(e) => setSearchTaskQuery(e.target.value)}
                    placeholder="Buscar tarefa ou operador por nome..."
                    className="pl-9"
                  />
                  {searchTaskQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchTaskQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 bg-[var(--surface-2)] border border-[var(--line)] p-1 rounded-xl shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewScope('all_tasks')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      viewScope === 'all_tasks'
                        ? 'bg-[var(--primary)] text-white shadow-xs'
                        : 'text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    Todas do Setor
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewScope('my_tasks')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      viewScope === 'my_tasks'
                        ? 'bg-[var(--primary)] text-white shadow-xs'
                        : 'text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    Minhas Tarefas ({myTasks.length})
                  </button>
                </div>
              </div>

              {/* Active Search Filter Reset Indicator */}
              {hasActiveFilters && (
                <div className="pt-2.5 mt-2.5 border-t border-[var(--line)] flex items-center justify-between gap-2 text-xs">
                  <span className="text-[11px] font-bold text-[var(--muted)] truncate">
                    {searchTaskQuery ? (
                      <>
                        Buscando por: <strong className="text-[var(--ink)]">"{searchTaskQuery}"</strong>
                      </>
                    ) : (
                      <>Exibindo apenas as suas tarefas alocadas</>
                    )}
                  </span>
                  <Button
                    variant="ghost"
                    size="xs"
                    icon={X}
                    onClick={resetFilters}
                    className="text-rose-500 hover:text-rose-600 shrink-0"
                  >
                    Limpar Filtro
                  </Button>
                </div>
              )}
            </Card>

            {/* TASKS LISTING — SHAREVIEW STYLE */}
            {displayedTasks.length === 0 ? (
              <Card flush>
                <EmptyState
                  icon={CheckCircle2}
                  title="Nenhuma tarefa encontrada"
                  description="Não há tarefas correspondentes aos filtros selecionados para este turno ou setor."
                  actionLabel={hasActiveFilters ? 'Ver Todas as Tarefas do Setor' : undefined}
                  onAction={hasActiveFilters ? resetFilters : undefined}
                />
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-5">
                {displayedTasks.map((task) => {
                  // Get assigned collaborators matching current active shift/scale filters (Sorted Alphabetically)
                  const assignedCollaborators = state.collaborators
                    .filter((c) => {
                      if (!task.members.includes(c.id)) return false;
                      if (filterShift !== 'all' && c.shift !== filterShift) return false;
                      if (filterScale !== 'all' && c.scale !== filterScale) return false;
                      if (filterRole !== 'all' && c.role !== filterRole) return false;
                      return true;
                    })
                    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));

                  const isMyTask = task.members.includes(currentCollaborator.id);

                  return (
                    <Card
                      key={task.id}
                      flush
                      className={isMyTask ? 'border-emerald-500 ring-2 ring-emerald-500/20' : ''}
                    >
                      {/* CARD HEADER (SHAREVIEW STYLE) */}
                      <div className="px-4 sm:px-5 py-3.5 bg-[var(--surface-2)] border-b border-[var(--line)] flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                          <div className="min-w-0">
                            <h3 className="text-sm sm:text-base font-black text-[var(--ink)] uppercase tracking-wide truncate">
                              {task.name}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {task.allowedCategories?.map((cat) => (
                                <Badge key={cat} tone="primary">
                                  {cat}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Count Badge & User Indicator */}
                        <div className="flex items-center gap-2">
                          {isMyTask && (
                            <Badge tone="success" dot className="uppercase">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Sua Tarefa
                            </Badge>
                          )}

                          <Badge tone="neutral" className="font-mono">
                            {assignedCollaborators.length} Alocados
                          </Badge>
                        </div>
                      </div>

                      {/* ASSIGNED TEAM MEMBERS GRID (SHAREVIEW STYLE) */}
                      <CardBody className="p-4 sm:p-5">
                        {assignedCollaborators.length === 0 ? (
                          <div className="p-4 rounded-lg bg-[var(--surface-2)] text-center text-xs text-[var(--muted)] italic">
                            Nenhum operador com os filtros selecionados nesta tarefa.
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                            {assignedCollaborators.map((m) => {
                              const isCurrentOp = m.id === currentCollaborator.id;
                              const breakTime = collabBreakMap[m.id];

                              return (
                                <div
                                  key={m.id}
                                  className={`p-3 rounded-xl border transition-all flex flex-col justify-between space-y-2 ${
                                    isCurrentOp
                                      ? 'bg-emerald-500/10 border-emerald-500 font-extrabold shadow-[var(--shadow-card)]'
                                      : 'bg-[var(--surface-2)] border-[var(--line)]'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-1.5">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1">
                                        <span className="font-black text-xs text-[var(--ink)] truncate">
                                          {abbreviateNames ? abbreviateName(m.name, false) : m.name}
                                        </span>
                                      </div>
                                      <div className="text-[10px] font-mono text-[var(--muted)] truncate">
                                        Turno {m.shift || 'T1'} • Escala {m.scale || 'A'}
                                      </div>
                                    </div>

                                    {isCurrentOp && (
                                      <span className="px-1.5 py-0.5 bg-emerald-600 text-white rounded-md text-[9px] font-black uppercase shrink-0">
                                        VOCÊ
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center justify-between pt-1.5 border-t border-[var(--line)]/60 text-[10px] flex-wrap gap-1">
                                    <Badge tone="primary">{m.role || 'REP'}</Badge>

                                    {breakTime ? (
                                      <Badge tone="warning" className="font-mono">
                                        <Coffee className="w-3 h-3" />
                                        {breakTime}
                                      </Badge>
                                    ) : (
                                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                        Ativo
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: HORÁRIOS DE INTERVALO */}
        {activeTab === 'intervalos' && (
          <div className="space-y-4">
            <SectionHeader
              title="Horário de Intervalo"
              subtitle={`Cronograma de pausas no Turno ${currentCollaborator.shift} (${formatDateBR(todayStr)})`}
              icon={<Clock className="w-4 h-4" />}
            />

            {/* User interval highlight banner */}
            {myAssignedBreaks.length > 0 && (
              <Card className="bg-emerald-500/10 border-emerald-500/30">
                <div className="flex items-center gap-3 text-emerald-800 dark:text-emerald-200">
                  <div className="w-10 h-10 shrink-0 rounded-lg bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                    <Coffee className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider">Seu Horário de Intervalo Agendado</h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      {myAssignedBreaks.map((b) => (
                        <Badge key={b.id} tone="success" className="font-mono text-sm px-3 py-1">
                          {b.time}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Shift Breakdown Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {shiftBreaks.map((b) => {
                const assignedCollabIds = todayIntervals[b.id] || [];
                const assignedCollabs = state.collaborators
                  .filter((c) => assignedCollabIds.includes(c.id))
                  .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
                const isMySlot = assignedCollabIds.includes(currentCollaborator.id);

                return (
                  <Card
                    key={b.id}
                    className={isMySlot ? 'border-emerald-500 ring-2 ring-emerald-500/20' : ''}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-mono font-black text-sm text-[var(--ink)]">
                        <Clock className="w-4 h-4 text-[var(--primary)]" />
                        <span>{b.time}</span>
                      </div>
                      <Badge tone="neutral">{assignedCollabs.length} pessoas</Badge>
                    </div>

                    <div className="pt-3 mt-3 border-t border-[var(--line)] space-y-1.5">
                      <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">Operadores:</p>
                      {assignedCollabs.length === 0 ? (
                        <p className="text-[11px] text-[var(--muted)] italic">Nenhum operador alocado</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {assignedCollabs.map((c) => (
                            <Badge
                              key={c.id}
                              tone={c.id === currentCollaborator.id ? 'success' : 'neutral'}
                              className={c.id === currentCollaborator.id ? 'bg-emerald-600 text-white border-emerald-600' : ''}
                            >
                              {abbreviateNames ? abbreviateName(c.name, false) : c.name.split(' ')[0]}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: COMUNICAÇÃO & SUPORTE (RADIO AS FIRST OPTION) */}
        {activeTab === 'comunicacao' && (
          <div className="space-y-5">
            {/* Embedded Dimensio Talk WebRTC Voice Radio Panel FIRST */}
            {state.showRadioModule !== false && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 px-1">
                  <div className="flex items-center gap-2">
                    <Radio className="w-5 h-5 text-emerald-500" />
                    <h2 className="text-sm sm:text-base font-black text-[var(--ink)] uppercase tracking-wide">
                      Rádio Walkie-Talkie (Voz em Tempo Real)
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSettingsModalOpen(true)}
                    className="text-xs text-[var(--primary)] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Configurações</span>
                  </button>
                </div>

                <CommunicationPanel isFloating={false} />
              </div>
            )}

            {/* Support Code & Camera Photo Dispatcher Component */}
            <div className="space-y-3 pt-2">
              <SupportCodeDispatcher
                senderOverride={{
                  id: currentCollaborator.id,
                  name: currentCollaborator.name,
                  role: currentCollaborator.role,
                  shift: currentCollaborator.shift,
                  category: currentCollaborator.category,
                }}
                isPortalView={true}
              />
            </div>
          </div>
        )}

        {/* TAB 4: LINKS & ATALHOS */}
        {activeTab === 'links' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionHeader
                title="Links & Atalhos do Portal"
                subtitle="Acesso rápido aos sistemas internos, planilhas e plataformas habilitadas pela gestão no Hub de Informações."
                icon={<Link2 className="w-4 h-4 text-[var(--primary)]" />}
              />
            </div>

            {/* Search & Category Filter */}
            {allOperationalLinks.length > 0 && (
              <Card>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                    <Input
                      type="text"
                      value={linkSearchQuery}
                      onChange={(e) => setLinkSearchQuery(e.target.value)}
                      placeholder="Buscar atalho por nome, categoria ou descrição..."
                      className="pl-9"
                    />
                    {linkSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setLinkSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {availableLinkCategories.length > 0 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                      <button
                        type="button"
                        onClick={() => setLinkCategoryFilter('todos')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-colors cursor-pointer shrink-0 ${
                          linkCategoryFilter === 'todos'
                            ? 'bg-[var(--primary)] text-white shadow-xs'
                            : 'bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--ink)]'
                        }`}
                      >
                        Todos
                      </button>
                      {availableLinkCategories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setLinkCategoryFilter(cat)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black transition-colors cursor-pointer shrink-0 ${
                            linkCategoryFilter === cat
                              ? 'bg-[var(--primary)] text-white shadow-xs'
                              : 'bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--ink)]'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Links Grid */}
            {filteredOperationalLinks.length === 0 ? (
              <Card flush>
                <EmptyState
                  icon={Link2}
                  title="Nenhum atalho disponível no Portal"
                  description={
                    allOperationalLinks.length === 0
                      ? 'Nenhum atalho foi habilitado para exibição no Portal do Operador. Os atalhos são gerenciados e habilitados individualmente pela liderança no Hub de Informações.'
                      : 'Nenhum atalho corresponde aos filtros de busca atuais.'
                  }
                  actionLabel={allOperationalLinks.length > 0 ? 'Limpar Busca' : undefined}
                  onAction={
                    allOperationalLinks.length > 0
                      ? () => {
                          setLinkSearchQuery('');
                          setLinkCategoryFilter('todos');
                        }
                      : undefined
                  }
                />
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredOperationalLinks.map((link) => {
                  const isCopied = copiedLinkId === link.id;

                  return (
                    <Card
                      key={link.id}
                      className="flex flex-col justify-between hover:border-[var(--primary)] transition-all group shadow-xs"
                    >
                      <div>
                        {/* Header with Category Badge and Actions */}
                        <div className="flex items-start justify-between gap-2 mb-2.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge tone="primary" className="text-[10px]">
                              {link.category || 'Atalho'}
                            </Badge>
                            {link.shift && link.shift !== 'Todos' && (
                              <Badge tone="neutral" className="text-[10px] font-mono">
                                Turno {link.shift}
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleCopyLink(link.url, link.id)}
                              className="p-1.5 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] transition-colors cursor-pointer"
                              title="Copiar URL do link"
                            >
                              {isCopied ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Title and Description */}
                        <h4 className="font-black text-sm text-[var(--ink)] group-hover:text-[var(--primary)] transition-colors flex items-center gap-1.5">
                          <Globe className="w-4 h-4 text-[var(--primary)] shrink-0" />
                          <span className="truncate">{link.title}</span>
                        </h4>

                        {link.description && (
                          <p className="text-xs text-[var(--muted)] mt-1.5 line-clamp-2 leading-relaxed">
                            {link.description}
                          </p>
                        )}

                        <div className="mt-2 text-[11px] font-mono text-[var(--muted)] truncate opacity-70">
                          {link.url}
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="pt-3 mt-3 border-t border-[var(--line)]/60 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-[var(--muted)] font-medium">
                          Acesso direto
                        </span>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-1.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-black flex items-center gap-1.5 shadow-xs transition-transform active:scale-95"
                        >
                          <span>Acessar</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* PORTAL SETTINGS MODAL */}
      <Modal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        title="Configurações do Portal"
        subtitle="Preferências de rádio e exibição do operador"
        icon={<Settings className="w-4 h-4" />}
        size="md"
        footer={
          <Button variant="primary" onClick={() => setIsSettingsModalOpen(false)}>
            Salvar e Fechar
          </Button>
        }
      >
        <div className="space-y-4">
          {/* Background Radio Option (Honeywell Collectors) */}
          <div className="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--line)] space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-5 h-5 text-emerald-500 shrink-0" />
                <div>
                  <div className="font-black text-xs sm:text-sm text-[var(--ink)] uppercase">
                    Rádio em Segundo Plano (Coletores Honeywell / Android)
                  </div>
                  <div className="text-[11px] text-[var(--muted)] leading-tight">
                    Mantém a transmissão e recepção de voz ativas em segundo plano sem pausar ao trocar de app ou minimizar.
                  </div>
                </div>
              </div>
              <Toggle
                checked={isBackgroundRadioActive}
                onChange={(val) => {
                  setIsBackgroundRadioActive(val);
                  showNotice(
                    val
                      ? 'Rádio em segundo plano ativado para coletores'
                      : 'Rádio em segundo plano desativado'
                  );
                }}
                className="shrink-0"
              />
            </div>
            {isBackgroundRadioActive ? (
              <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-2 rounded-lg flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 animate-pulse shrink-0" />
                <span>Modo ativo por padrão. Somente desative se for estritamente necessário.</span>
              </div>
            ) : (
              <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2 rounded-lg flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Atenção: O áudio poderá ser suspenso ao mudar de aba.</span>
              </div>
            )}
          </div>

          {/* Operador atual & opção de abreviar nomes é controlada pelo link/QR do portal */}
          <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between gap-3">
            <div className="text-xs text-[var(--muted)]">
              Operador atual: <strong className="text-[var(--ink)]">{currentCollaborator.name}</strong>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={Users}
              onClick={() => {
                setIsSettingsModalOpen(false);
                setIsSelectingOperator(true);
              }}
            >
              Trocar Operador
            </Button>
          </div>
        </div>
      </Modal>

      {/* OPERATOR PROFILE SELECTOR MODAL (SORTED ALPHABETICALLY A-Z) */}
      <Modal
        isOpen={isSelectingOperator}
        onClose={() => setIsSelectingOperator(false)}
        title="Selecionar Perfil do Operador"
        subtitle="Escolha o seu cadastro para ver suas tarefas e horários (Ordem Alfabética A-Z)"
        icon={<Users className="w-4 h-4" />}
        size="sm"
        footer={
          <Button variant="outline" onClick={() => setIsSelectingOperator(false)}>
            Concluir
          </Button>
        }
      >
        {/* Search Input */}
        <div className="relative mb-3">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <Input
            type="text"
            value={searchOperatorQuery}
            onChange={(e) => setSearchOperatorQuery(e.target.value)}
            placeholder="Buscar por nome, LDAP ou matrícula..."
            className="pl-9"
          />
        </div>

        {/* Active Preset Filter Badge */}
        {(presetRoles.length > 0 || presetCategories.length > 0 || filterShift !== 'all') && (
          <div className="mb-3 bg-[var(--primary-soft)] border border-[var(--primary-border)]/60 p-2.5 rounded-xl text-[11px] text-[var(--ink)] flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Filter className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
              <span className="truncate font-bold">
                Filtro Ativo: {[
                  filterShift !== 'all' ? `Turno ${filterShift}` : null,
                  presetRoles.length > 0 ? `Cargos (${presetRoles.join(', ')})` : null,
                  presetCategories.length > 0 ? `Categorias (${presetCategories.join(', ')})` : null,
                ].filter(Boolean).join(' • ')}
              </span>
            </div>
          </div>
        )}

        {/* Collaborators List (Sorted Alphabetically) */}
        <div className="space-y-2 pr-1 max-h-72 overflow-y-auto">
          {filteredCollaborators.length === 0 ? (
            <EmptyState
              icon={User}
              title="Nenhum colaborador encontrado"
              description={`Nenhum colaborador encontrado com "${searchOperatorQuery}".`}
              className="py-8"
            />
          ) : (
            filteredCollaborators.map((c) => {
              const isSelected = c.id === currentCollaborator.id;

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectOperator(c.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-[var(--shadow-card)]'
                      : 'bg-[var(--surface-2)] border-[var(--line)] hover:border-[var(--primary)] text-[var(--ink)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs uppercase shrink-0 ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-[var(--primary-soft)] text-[var(--primary)]'
                      }`}
                    >
                      {c.name.charAt(0)}
                    </div>
                    <div className="min-w-0 truncate">
                      <div className="text-xs font-black truncate">{c.name}</div>
                      <div
                        className={`text-[10px] font-mono truncate ${
                          isSelected ? 'text-white/80' : 'text-[var(--muted)]'
                        }`}
                      >
                        Turno {c.shift} | {c.role} ({c.category})
                      </div>
                    </div>
                  </div>

                  {isSelected && <Check className="w-4 h-4 shrink-0 text-white" />}
                </button>
              );
            })
          )}
        </div>
      </Modal>

      {/* Operator User Notifications Modal */}
      <UserNotificationsModal
        isOpen={isNotificationsModalOpen}
        onClose={() => setIsNotificationsModalOpen(false)}
        isPortalMode={true}
        targetShift={currentCollaborator?.shift}
        collaboratorId={currentCollaborator?.id}
        collaboratorName={currentCollaborator?.name}
      />
    </div>
  );
};

export const PortalView = OperatorPortalView;