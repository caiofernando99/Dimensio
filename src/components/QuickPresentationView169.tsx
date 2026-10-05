import React, { useState, useRef, useMemo, useEffect } from 'react';
import { toPng } from 'html-to-image';
import { useApp } from '../context/AppContext';
import { MultiSelectFilter } from './MultiSelectFilter';
import { SearchInput } from './SearchInput';
import {
  Download,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Printer,
  SlidersHorizontal,
  Clock,
  Users,
  Briefcase,
  Tag,
  ShieldCheck,
  LayoutGrid,
  Sparkles,
  Tv,
  Layers,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  CheckCircle2,
  GitFork,
  GripVertical,
  ArrowLeft,
  ArrowRight,
  Plus,
  Minus,
  Type,
  ZoomIn,
  ZoomOut,
  Columns,
  Palette,
  Sparkle,
} from 'lucide-react';
import {
  formatDateBR,
  formatDateLongBR,
  abbreviateNameFlexible,
  isScaleOff,
  getCollaboratorStatus,
} from '../utils/helpers';
import { filterPresentCollaborators } from '../utils/presenceFilters';
import { Collaborator } from '../types';
import { MarkdownContent } from './MarkdownContent';
import { getConsolidatedTaskGroups, ConsolidatedTaskGroup } from '../utils/taskTreeHelpers';

export type PresentationTheme =
  | 'system'
  | 'tv_dark'
  | 'corporate_light'
  | 'royal_dimensio'
  | 'emerald_ops'
  | 'amber_ops'
  | 'slate_modern'
  | 'midnight_blue'
  | 'high_contrast';

export type DensityMode = 'auto' | 'compact' | 'normal' | 'comfortable' | 'spacious';
export type FontSizePreset = 'auto' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export type FontFamilyPreset = 'sans' | 'display' | 'mono' | 'condensed';
export type BreakDisplayMode = 'grouped' | 'badge' | 'none';
export type TaskCardHeaderStyle = 'banner' | 'subtle' | 'minimal';

export interface CardCustomLayout {
  colSpan?: number; // 1 to 4
  internalCols?: number; // 1 to 4
  highlight?: boolean;
}

export interface QuickPresentationConfig {
  theme: PresentationTheme;
  density: DensityMode;
  fontSize: FontSizePreset;
  fontScale: number; // 0.75 to 1.75
  fontFamily: FontFamilyPreset;
  stretchItems: boolean;
  headerStyle: TaskCardHeaderStyle;
  breakDisplay: BreakDisplayMode;
  showRoles: boolean;
  showHeadcounts: boolean;
  groupSubtasks: boolean;
  abbreviateNames: boolean;
  hideEmptyTasks: boolean;
  showMetricsBar: boolean;
  showHeaderDetails: boolean;
  footerNote: string;
  totalColumns: number | 'auto';
  cardOrder?: string[];
  cardLayouts?: Record<string, CardCustomLayout>;
}

export const DEFAULT_CONFIG: QuickPresentationConfig = {
  theme: 'system', // Default is the app theme!
  density: 'auto',
  fontSize: 'auto',
  fontScale: 1.0,
  fontFamily: 'sans',
  stretchItems: true,
  headerStyle: 'banner',
  breakDisplay: 'grouped',
  showRoles: true,
  showHeadcounts: true,
  groupSubtasks: true,
  abbreviateNames: false,
  hideEmptyTasks: true,
  showMetricsBar: true,
  showHeaderDetails: true,
  footerNote: '',
  totalColumns: 'auto',
  cardOrder: [],
  cardLayouts: {},
};

export interface PresentationThemeStyle {
  name: string;
  bg: string;
  cardBg: string;
  cardBorder: string;
  itemBg: string;
  itemBorder: string;
  text: string;
  textMuted: string;
  accent: string;
  accentBg: string;
  accentBorder: string;
  headerBg: string;
  headerBorder: string;
  badgeBg: string;
  badgeText: string;
  breakBg: string;
  breakText: string;
  breakBorder: string;
  footerBg: string;
}

// Fixed theme definitions with high-contrast color palettes
export const presentationThemeStyles: Record<PresentationTheme, PresentationThemeStyle> = {
  system: {
    name: 'Tema Padrão (Acompanha o App)',
    bg: 'var(--bg)',
    cardBg: 'var(--paper)',
    cardBorder: 'var(--line)',
    itemBg: 'var(--bg)',
    itemBorder: 'var(--line)',
    text: 'var(--ink)',
    textMuted: 'var(--muted)',
    accent: 'var(--primary)',
    accentBg: 'var(--primary-soft)',
    accentBorder: 'var(--primary-border)',
    headerBg: 'var(--paper)',
    headerBorder: 'var(--line)',
    badgeBg: 'var(--primary-soft)',
    badgeText: 'var(--primary)',
    breakBg: 'var(--bg)',
    breakText: 'var(--ink)',
    breakBorder: 'var(--line)',
    footerBg: 'var(--paper)',
  },
  tv_dark: {
    name: 'Escuro TV / OLED (Preto Puro & Alto Contraste)',
    bg: '#090d16',
    cardBg: '#111827',
    cardBorder: '#1f293d',
    itemBg: '#162032',
    itemBorder: '#23304d',
    text: '#f8fafc',
    textMuted: '#94a3b8',
    accent: '#0284c7',
    accentBg: 'rgba(2, 132, 199, 0.2)',
    accentBorder: '#0284c7',
    headerBg: '#0f172a',
    headerBorder: '#1e293b',
    badgeBg: '#1e293b',
    badgeText: '#38bdf8',
    breakBg: '#1c1917',
    breakText: '#fdba74',
    breakBorder: '#7c2d12',
    footerBg: '#0f172a',
  },
  corporate_light: {
    name: 'Claro Corporativo (Clean)',
    bg: '#f1f5f9',
    cardBg: '#ffffff',
    cardBorder: '#cbd5e1',
    itemBg: '#f8fafc',
    itemBorder: '#e2e8f0',
    text: '#0f172a',
    textMuted: '#475569',
    accent: '#2563eb',
    accentBg: '#eff6ff',
    accentBorder: '#bfdbfe',
    headerBg: '#ffffff',
    headerBorder: '#e2e8f0',
    badgeBg: '#eff6ff',
    badgeText: '#1d4ed8',
    breakBg: '#fff7ed',
    breakText: '#c2410c',
    breakBorder: '#fed7aa',
    footerBg: '#f8fafc',
  },
  royal_dimensio: {
    name: 'Dimensio Royal (Índigo Profundo)',
    bg: '#09091f',
    cardBg: '#121235',
    cardBorder: '#282860',
    itemBg: '#181844',
    itemBorder: '#2e2e6c',
    text: '#f1f5f9',
    textMuted: '#a5b4fc',
    accent: '#6366f1',
    accentBg: 'rgba(99, 102, 241, 0.2)',
    accentBorder: '#6366f1',
    headerBg: '#101030',
    headerBorder: '#25255e',
    badgeBg: '#312e81',
    badgeText: '#c7d2fe',
    breakBg: '#2e1065',
    breakText: '#f472b6',
    breakBorder: '#701a75',
    footerBg: '#101030',
  },
  emerald_ops: {
    name: 'Esmeralda Operacional (Verde Floresta)',
    bg: '#04130d',
    cardBg: '#092117',
    cardBorder: '#124231',
    itemBg: '#0d2b1f',
    itemBorder: '#194d3a',
    text: '#f0fdf4',
    textMuted: '#86efac',
    accent: '#059669',
    accentBg: 'rgba(5, 150, 105, 0.2)',
    accentBorder: '#059669',
    headerBg: '#061c13',
    headerBorder: '#114a36',
    badgeBg: '#064e3b',
    badgeText: '#a7f3d0',
    breakBg: '#14280f',
    breakText: '#fde047',
    breakBorder: '#4d7c0f',
    footerBg: '#061c13',
  },
  amber_ops: {
    name: 'Âmbar Industrial (Grafite & Ouro)',
    bg: '#141414',
    cardBg: '#1c1b18',
    cardBorder: '#383329',
    itemBg: '#26241e',
    itemBorder: '#474032',
    text: '#fefce8',
    textMuted: '#d4d4d8',
    accent: '#d97706',
    accentBg: 'rgba(217, 119, 6, 0.2)',
    accentBorder: '#d97706',
    headerBg: '#1f1e1a',
    headerBorder: '#3d382c',
    badgeBg: '#451a03',
    badgeText: '#fde68a',
    breakBg: '#291b00',
    breakText: '#fbbf24',
    breakBorder: '#78350f',
    footerBg: '#1c1b18',
  },
  slate_modern: {
    name: 'Slate Modern (Cinza Noturno & Ciano)',
    bg: '#0f172a',
    cardBg: '#1e293b',
    cardBorder: '#334155',
    itemBg: '#243247',
    itemBorder: '#3b4c66',
    text: '#f8fafc',
    textMuted: '#94a3b8',
    accent: '#06b6d4',
    accentBg: 'rgba(6, 182, 212, 0.2)',
    accentBorder: '#06b6d4',
    headerBg: '#182234',
    headerBorder: '#2d3b4e',
    badgeBg: '#164e63',
    badgeText: '#67e8f9',
    breakBg: '#1e1b4b',
    breakText: '#a5b4fc',
    breakBorder: '#3730a3',
    footerBg: '#182234',
  },
  midnight_blue: {
    name: 'Azul Meia-Noite (Marinho Corporativo)',
    bg: '#080d1a',
    cardBg: '#0f172a',
    cardBorder: '#1e2d4a',
    itemBg: '#17233d',
    itemBorder: '#23385d',
    text: '#ffffff',
    textMuted: '#93c5fd',
    accent: '#3b82f6',
    accentBg: 'rgba(59, 130, 246, 0.2)',
    accentBorder: '#3b82f6',
    headerBg: '#0b1324',
    headerBorder: '#1b2a47',
    badgeBg: '#1e3a8a',
    badgeText: '#bfdbfe',
    breakBg: '#172554',
    breakText: '#93c5fd',
    breakBorder: '#1d4ed8',
    footerBg: '#0b1324',
  },
  high_contrast: {
    name: 'Alto Contraste P&B (TV / Painel Industrial)',
    bg: '#000000',
    cardBg: '#0a0a0a',
    cardBorder: '#ffffff',
    itemBg: '#171717',
    itemBorder: '#525252',
    text: '#ffffff',
    textMuted: '#d4d4d4',
    accent: '#facc15',
    accentBg: '#ca8a04',
    accentBorder: '#facc15',
    headerBg: '#000000',
    headerBorder: '#ffffff',
    badgeBg: '#ffffff',
    badgeText: '#000000',
    breakBg: '#262626',
    breakText: '#facc15',
    breakBorder: '#a3a3a3',
    footerBg: '#000000',
  },
};

// Safe runtime theme resolver that dynamically extracts computed CSS variables when 'system' is active
export function resolvePresentationTheme(themeKey: PresentationTheme): PresentationThemeStyle {
  if (themeKey === 'system' && typeof window !== 'undefined') {
    const styles = getComputedStyle(document.documentElement);
    const bg = styles.getPropertyValue('--bg').trim() || '#f3f4fa';
    const paper = styles.getPropertyValue('--paper').trim() || '#ffffff';
    const ink = styles.getPropertyValue('--ink').trim() || '#161633';
    const muted = styles.getPropertyValue('--muted').trim() || '#414368';
    const line = styles.getPropertyValue('--line').trim() || '#d1d6eb';
    const primary = styles.getPropertyValue('--primary').trim() || '#4f46e5';
    const primarySoft = styles.getPropertyValue('--primary-soft').trim() || '#eef2ff';
    const primaryBorder = styles.getPropertyValue('--primary-border').trim() || '#93a5f7';
    const isDark = document.documentElement.classList.contains('dark');

    return {
      name: 'Tema Padrão (Acompanha o App)',
      bg: bg,
      cardBg: paper,
      cardBorder: line,
      itemBg: isDark ? 'rgba(255, 255, 255, 0.05)' : bg,
      itemBorder: line,
      text: ink,
      textMuted: muted,
      accent: primary,
      accentBg: primarySoft,
      accentBorder: primaryBorder,
      headerBg: paper,
      headerBorder: line,
      badgeBg: primarySoft,
      badgeText: primary,
      breakBg: isDark ? 'rgba(0, 0, 0, 0.3)' : primarySoft,
      breakText: ink,
      breakBorder: line,
      footerBg: paper,
    };
  }
  return presentationThemeStyles[themeKey] || presentationThemeStyles.system;
}

export interface QuickPresentationView169Props {
  config?: QuickPresentationConfig;
  onConfigChange?: (config: QuickPresentationConfig) => void;
  selectedShift?: string;
  selectedShifts?: string[];
  selectedTLs?: string[];
  selectedRoles?: string[];
  selectedCategories?: string[];
  selectedTaskIds?: string[];
  searchTerm?: string;
  isFullscreen?: boolean;
  onFullscreenChange?: (fs: boolean) => void;
  slideRef?: React.RefObject<HTMLDivElement>;
  hideControls?: boolean;
}

export const QuickPresentationView169: React.FC<QuickPresentationView169Props> = ({
  config: externalConfig,
  onConfigChange,
  selectedShift: externalShift,
  selectedShifts: externalShifts,
  selectedTLs: externalTLs,
  selectedRoles: externalRoles,
  selectedCategories: externalCategories,
  selectedTaskIds: externalTaskIds,
  searchTerm: externalSearchTerm,
  isFullscreen: externalIsFullscreen,
  onFullscreenChange,
  slideRef: externalSlideRef,
  hideControls = false,
}) => {
  const { state, showNotice } = useApp();
  const internalSlideRef = useRef<HTMLDivElement>(null);
  const slideRef = externalSlideRef || internalSlideRef;

  // Load custom configuration from localStorage if not provided via props
  const [internalConfig, setInternalConfig] = useState<QuickPresentationConfig>(() => {
    try {
      const saved = localStorage.getItem('dimensio_quick_16_9_config');
      if (saved) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      }
    } catch {}
    return DEFAULT_CONFIG;
  });

  const config = externalConfig || internalConfig;
  const setConfig = (newConfig: QuickPresentationConfig) => {
    if (onConfigChange) {
      onConfigChange(newConfig);
    } else {
      setInternalConfig(newConfig);
      try {
        localStorage.setItem('dimensio_quick_16_9_config', JSON.stringify(newConfig));
      } catch {}
    }
  };

  // Fullscreen state
  const [internalIsFullscreen, setInternalIsFullscreen] = useState(false);
  const isFullscreen = externalIsFullscreen !== undefined ? externalIsFullscreen : internalIsFullscreen;
  const setIsFullscreen = (fs: boolean) => {
    if (onFullscreenChange) {
      onFullscreenChange(fs);
    } else {
      setInternalIsFullscreen(fs);
    }
  };

  // Interactive Layout Mode State
  const [isInteractiveMode, setIsInteractiveMode] = useState<boolean>(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);

  // Local Filter States
  const [selectedShift, setSelectedShift] = useState<string>(externalShift || 'ALL');
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>(externalTaskIds || []);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(externalRoles || []);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(externalCategories || []);
  const [selectedTLs, setSelectedTLs] = useState<string[]>(externalTLs || []);
  const [searchTerm, setSearchTerm] = useState<string>(externalSearchTerm || '');

  // Keep internal filter state in sync if external props change
  useEffect(() => {
    if (externalShift !== undefined) setSelectedShift(externalShift);
    if (externalTaskIds !== undefined) setSelectedTaskIds(externalTaskIds);
    if (externalRoles !== undefined) setSelectedRoles(externalRoles);
    if (externalCategories !== undefined) setSelectedCategories(externalCategories);
    if (externalTLs !== undefined) setSelectedTLs(externalTLs);
    if (externalSearchTerm !== undefined) setSearchTerm(externalSearchTerm);
  }, [
    externalShift,
    externalTaskIds,
    externalRoles,
    externalCategories,
    externalTLs,
    externalSearchTerm,
  ]);

  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);

  // Active Date & Breaks Info
  const activeDate = state.selectedDate;
  const dayIntervals = state.intervals[activeDate] || {};

  // Escape key handler for fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Unique options for filters
  const availableShifts = useMemo(() => {
    const customShifts = state.shifts || [];
    const collabShifts = Array.from(
      new Set(state.collaborators.map((c) => c.shift).filter(Boolean))
    ) as string[];
    const combined = Array.from(new Set([...customShifts, ...collabShifts])).filter(Boolean);
    return combined.length > 0 ? combined : ['T1', 'T2', 'T3', 'ADM'];
  }, [state.shifts, state.collaborators]);

  const availableRoles = useMemo(
    () => Array.from(new Set(state.collaborators.map((c) => c.role || 'Operador'))).filter(Boolean),
    [state.collaborators]
  );
  const availableCategories = useMemo(
    () => Array.from(new Set(state.collaborators.map((c) => c.category || 'Geral'))).filter(Boolean),
    [state.collaborators]
  );
  const availableTLs = useMemo(
    () =>
      Array.from(
        new Set(
          state.collaborators.map(
            (c) => c.teamLeader || state.defaultTeamLeader || 'Sem Líder'
          )
        )
      ).filter(Boolean),
    [state.collaborators, state.defaultTeamLeader]
  );

  // Filter Present Collaborators
  const presentCollaborators = useMemo(() => {
    const activeShiftVal =
      selectedShift !== 'ALL' ? selectedShift : state.selectedShiftFilter || state.teamShift || 'ALL';

    // Fonte única em presenceFilters: sentinelas 'Todos' não filtram;
    // status via getCollaboratorStatus (folga, atestado em objeto, extra).
    return filterPresentCollaborators(state.collaborators, activeDate, state, {
      shifts: externalShifts,
      categories: selectedCategories,
      roles: selectedRoles,
      tls: selectedTLs,
      search: searchTerm,
      activeShift: activeShiftVal,
      defaultTL: state.defaultTeamLeader || 'Sem Líder',
    });
  }, [
    state.collaborators,
    state.calendar,
    state.attendance,
    state.dailyReports,
    activeDate,
    selectedShift,
    externalShifts,
    state.selectedShiftFilter,
    state.teamShift,
    selectedRoles,
    selectedCategories,
    selectedTLs,
    searchTerm,
    state.defaultTeamLeader,
  ]);

  // Overall Shift Metrics for Top Slide Header
  const metrics = useMemo(() => {
    const shiftCollabs = state.collaborators.filter((c) => {
      if (selectedShift !== 'ALL') return c.shift === selectedShift;
      return true;
    });

    let presentes = 0;
    let folgas = 0;
    let atrasos = 0;
    let ausentes = 0;

    shiftCollabs.forEach((c) => {
      const isPresent = presentCollaborators.some((p) => p.id === c.id);
      if (isPresent) {
        presentes++;
        const statusInfo = getCollaboratorStatus(c, activeDate, state);
        if (statusInfo.status === 'atraso') atrasos++;
      } else {
        const off = isScaleOff(state.calendar, activeDate, c.scale);
        if (off) folgas++;
        else ausentes++;
      }
    });

    return { total: shiftCollabs.length, presentes, folgas, atrasos, ausentes };
  }, [state.collaborators, selectedShift, presentCollaborators, activeDate, state]);

  // Break Slot Lookup
  const getBreakTime = (personId: string) => {
    const slot = (state.breaks || []).find((b) => (dayIntervals[b.id] || []).includes(personId));
    return slot ? slot.time : 'Sem Intervalo';
  };

  // Group Members by Break Slot
  const groupTaskMembersByBreak = (taskMembers: Collaborator[]) => {
    const map = new Map<string, Collaborator[]>();

    taskMembers.forEach((person) => {
      const time = getBreakTime(person.id);
      if (!map.has(time)) {
        map.set(time, []);
      }
      map.get(time)!.push(person);
    });

    const result: Array<{ timeLabel: string; members: Collaborator[] }> = [];
    map.forEach((members, timeLabel) => {
      result.push({ timeLabel, members });
    });

    result.sort((a, b) => {
      if (a.timeLabel === 'Sem Intervalo') return 1;
      if (b.timeLabel === 'Sem Intervalo') return -1;
      return a.timeLabel.localeCompare(b.timeLabel);
    });

    return result;
  };

  // Compute Task Groups with Custom Card Ordering & Filtering
  const displayedTaskGroups = useMemo(() => {
    const rawGroups = getConsolidatedTaskGroups(state.tasks, true);

    const filtered = rawGroups
      .filter((group) => {
        if (selectedTaskIds.length > 0 && !selectedTaskIds.includes(group.rootTask.id)) return false;
        return true;
      })
      .map((group) => {
        const directMembers = (group.rootTask.members || [])
          .map((id) => state.collaborators.find((c) => c.id === id))
          .filter(
            (c): c is Collaborator =>
              Boolean(c) && presentCollaborators.some((p) => p.id === c.id)
          );

        const filteredSubtasks = group.subtasks
          .map((sub) => {
            const members = (sub.members || [])
              .map((id) => state.collaborators.find((c) => c.id === id))
              .filter(
                (c): c is Collaborator =>
                  Boolean(c) && presentCollaborators.some((p) => p.id === c.id)
              );
            return {
              ...sub,
              filteredMembers: members,
            };
          })
          .filter((sub) => !config.hideEmptyTasks || sub.filteredMembers.length > 0);

        const allMembers = [
          ...directMembers,
          ...filteredSubtasks.flatMap((s) => s.filteredMembers),
        ];

        const uniqueAllMembers = Array.from(new Map(allMembers.map((m) => [m.id, m])).values());

        return {
          ...group,
          directMembers,
          filteredSubtasks,
          allFilteredMembers: uniqueAllMembers,
          totalPresentCount: uniqueAllMembers.length,
        };
      })
      .filter((g) => !config.hideEmptyTasks || g.totalPresentCount > 0);

    // Apply custom order if saved in config
    if (config.cardOrder && config.cardOrder.length > 0) {
      const orderMap = new Map<string, number>();
      config.cardOrder.forEach((id, idx) => orderMap.set(id, idx));

      return [...filtered].sort((a, b) => {
        const orderA = orderMap.has(a.rootTask.id) ? orderMap.get(a.rootTask.id)! : 9999;
        const orderB = orderMap.has(b.rootTask.id) ? orderMap.get(b.rootTask.id)! : 9999;
        return orderA - orderB;
      });
    }

    return filtered;
  }, [
    state.tasks,
    state.collaborators,
    presentCollaborators,
    selectedTaskIds,
    config.hideEmptyTasks,
    config.cardOrder,
  ]);

  // CARD REORDERING & RESIZING HANDLERS
  const moveCard = (taskId: string, direction: 'left' | 'right' | 'start' | 'end') => {
    const currentOrder = displayedTaskGroups.map((g) => g.rootTask.id);
    const index = currentOrder.indexOf(taskId);
    if (index === -1) return;

    const newOrder = [...currentOrder];
    if (direction === 'left' && index > 0) {
      const temp = newOrder[index - 1];
      newOrder[index - 1] = newOrder[index];
      newOrder[index] = temp;
    } else if (direction === 'right' && index < newOrder.length - 1) {
      const temp = newOrder[index + 1];
      newOrder[index + 1] = newOrder[index];
      newOrder[index] = temp;
    } else if (direction === 'start') {
      const item = newOrder.splice(index, 1)[0];
      newOrder.unshift(item);
    } else if (direction === 'end') {
      const item = newOrder.splice(index, 1)[0];
      newOrder.push(item);
    }

    setConfig({ ...config, cardOrder: newOrder });
  };

  const setCardSpan = (taskId: string, span: number) => {
    const clampedSpan = Math.max(1, Math.min(4, span));
    const currentLayouts = config.cardLayouts || {};
    const updated = {
      ...currentLayouts,
      [taskId]: {
        ...(currentLayouts[taskId] || {}),
        colSpan: clampedSpan,
      },
    };
    setConfig({ ...config, cardLayouts: updated });
  };

  const setCardInternalCols = (taskId: string, internalCols: number) => {
    const clamped = Math.max(1, Math.min(4, internalCols));
    const currentLayouts = config.cardLayouts || {};
    const updated = {
      ...currentLayouts,
      [taskId]: {
        ...(currentLayouts[taskId] || {}),
        internalCols: clamped,
      },
    };
    setConfig({ ...config, cardLayouts: updated });
  };

  const toggleCardHighlight = (taskId: string) => {
    const currentLayouts = config.cardLayouts || {};
    const isHighlighted = currentLayouts[taskId]?.highlight;
    const updated = {
      ...currentLayouts,
      [taskId]: {
        ...(currentLayouts[taskId] || {}),
        highlight: !isHighlighted,
      },
    };
    setConfig({ ...config, cardLayouts: updated });
  };

  const handleResetCardLayouts = () => {
    setConfig({
      ...config,
      totalColumns: 'auto',
      cardOrder: [],
      cardLayouts: {},
    });
    showNotice('Posições e tamanhos dos cards restaurados para o padrão automático.');
  };

  // Drag & Drop handlers for cards
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDragOver = (e: React.DragEvent, taskId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverTaskId !== taskId) {
      setDragOverTaskId(taskId);
    }
  };

  const handleDrop = (e: React.DragEvent, targetTaskId: string) => {
    e.preventDefault();
    if (!draggedTaskId || draggedTaskId === targetTaskId) {
      setDraggedTaskId(null);
      setDragOverTaskId(null);
      return;
    }

    const currentOrder = displayedTaskGroups.map((g) => g.rootTask.id);
    const fromIndex = currentOrder.indexOf(draggedTaskId);
    const toIndex = currentOrder.indexOf(targetTaskId);

    if (fromIndex !== -1 && toIndex !== -1) {
      const newOrder = [...currentOrder];
      const [removed] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, removed);
      setConfig({ ...config, cardOrder: newOrder });
      showNotice('Ordem dos cards atualizada!');
    }

    setDraggedTaskId(null);
    setDragOverTaskId(null);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverTaskId(null);
  };

  // DYNAMIC 16:9 GRID & TYPOGRAPHY CALCULATIONS
  const layoutCalculations = useMemo(() => {
    const taskCount = displayedTaskGroups.length;
    const totalMembers = displayedTaskGroups.reduce((acc, t) => acc + t.totalPresentCount, 0);
    const maxMembersPerTask = Math.max(1, ...displayedTaskGroups.map((t) => t.totalPresentCount));

    // Density factor
    const densityFactor =
      config.density === 'compact'
        ? 0.8
        : config.density === 'comfortable'
        ? 1.2
        : config.density === 'spacious'
        ? 1.35
        : 1.0;

    // Font Scale multiplier
    const fontScaleFactor = (config.fontScale || 1.0) * densityFactor;

    // Font preset adjustment
    const fontPresetMultipliers: Record<FontSizePreset, number> = {
      'xs': 0.8,
      'sm': 0.9,
      'md': 1.0,
      'lg': 1.15,
      'xl': 1.3,
      '2xl': 1.5,
      'auto': 1.0,
    };
    const presetFactor = fontPresetMultipliers[config.fontSize || 'auto'] || 1.0;

    // Determine grid columns
    let totalCols = 3;
    if (typeof config.totalColumns === 'number' && config.totalColumns >= 1 && config.totalColumns <= 6) {
      totalCols = config.totalColumns;
    } else {
      // Auto calculation
      if (taskCount <= 1) totalCols = 1;
      else if (taskCount === 2) totalCols = 2;
      else if (taskCount <= 4) totalCols = config.density === 'compact' ? 4 : 2;
      else if (taskCount <= 6) totalCols = 3;
      else if (taskCount <= 8) totalCols = 4;
      else if (taskCount <= 10) totalCols = 5;
      else totalCols = 6;
    }

    // Grid CSS template
    const gridColsClassMap: Record<number, string> = {
      1: 'grid-cols-1',
      2: 'grid-cols-2',
      3: 'grid-cols-3',
      4: 'grid-cols-4',
      5: 'grid-cols-5',
      6: 'grid-cols-6',
    };
    const gridColsClass = gridColsClassMap[totalCols] || 'grid-cols-3';

    // Base typography sizes
    let baseNameSize = 28;
    if (config.density === 'compact') baseNameSize = 20;
    if (config.density === 'comfortable') baseNameSize = 34;
    if (config.density === 'spacious') baseNameSize = 40;

    // Adapt font size by column count & total members
    const colMultiplier = totalCols === 1 ? 1.8 : totalCols === 2 ? 1.4 : totalCols === 3 ? 1.1 : totalCols === 4 ? 0.95 : 0.85;
    const avgMembers = totalMembers / Math.max(1, taskCount);
    const peopleMultiplier = Math.max(0.65, Math.min(1.1, 4.2 / (avgMembers + 1.5)));

    let nameFontSize = Math.round(baseNameSize * colMultiplier * peopleMultiplier * fontScaleFactor * presetFactor);
    nameFontSize = Math.max(12, Math.min(54, nameFontSize));

    const headerFontSize = Math.round(nameFontSize * 1.15);
    const subHeaderFontSize = Math.max(9, Math.round(nameFontSize * 0.72));
    const badgeFontSize = Math.max(9, Math.round(nameFontSize * 0.6));

    const cardPadding = totalCols <= 2 ? 'p-4 sm:p-5' : totalCols <= 4 ? 'p-3 sm:p-3.5' : 'p-2.5';
    const itemPadding = totalCols <= 2 ? 'px-3 py-2 sm:px-4 sm:py-2.5' : 'px-2.5 py-1.5';

    // Max characters before abbreviation
    const nameMaxChars = Math.max(8, Math.round(nameFontSize * 0.55));

    // Font Family class
    const fontFamilyMap: Record<FontFamilyPreset, string> = {
      sans: 'Inter, system-ui, -apple-system, sans-serif',
      display: 'Montserrat, Poppins, sans-serif',
      mono: 'Space Grotesk, monospace',
      condensed: 'Roboto, Arial Narrow, sans-serif',
    };
    const activeFontFamily = fontFamilyMap[config.fontFamily || 'sans'] || fontFamilyMap.sans;

    return {
      totalCols,
      gridColsClass,
      nameFontSize,
      headerFontSize,
      subHeaderFontSize,
      badgeFontSize,
      cardPadding,
      itemPadding,
      nameMaxChars,
      activeFontFamily,
    };
  }, [
    displayedTaskGroups,
    config.density,
    config.fontScale,
    config.fontSize,
    config.totalColumns,
    config.fontFamily,
  ]);

  const activeTheme = useMemo(() => resolvePresentationTheme(config.theme), [config.theme, state.theme]);

  // Name abbreviation helper
  const renderDisplayName = (name: string) =>
    config.abbreviateNames
      ? abbreviateNameFlexible(name, 'auto', layoutCalculations.nameMaxChars, true)
      : name;

  // Capture High-Res 16:9 PNG
  const handleDownloadImage169 = async () => {
    if (!slideRef.current) return;
    setIsGeneratingImage(true);
    try {
      showNotice('Renderizando imagem 16:9 em alta resolução...');
      await document.fonts.ready;

      const dataUrl = await toPng(slideRef.current, {
        pixelRatio: 3,
        backgroundColor: activeTheme.bg,
        cacheBust: true,
      });

      const link = document.createElement('a');
      const sanitizedTeam = (state.teamName || 'Equipe').replace(/\s+/g, '_');
      link.download = `Apresentacao_16x9_${sanitizedTeam}_${activeDate}.png`;
      link.href = dataUrl;
      link.click();
      showNotice('Imagem 16:9 baixada com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar a imagem 16:9. Tente novamente.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Copy 16:9 Image to Clipboard
  const handleCopyImage169 = async () => {
    if (!slideRef.current) return;
    setIsGeneratingImage(true);
    try {
      showNotice('Renderizando imagem 16:9 para a área de transferência...');
      await document.fonts.ready;

      const dataUrl = await toPng(slideRef.current, {
        pixelRatio: 3,
        backgroundColor: activeTheme.bg,
        cacheBust: true,
      });

      const blob = await (await fetch(dataUrl)).blob();
      if (!blob) {
        alert('Erro ao processar imagem.');
        setIsGeneratingImage(false);
        return;
      }

      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopiedImage(true);
        showNotice('Imagem 16:9 copiada! Você já pode colar no Teams ou WhatsApp.');
        setTimeout(() => setCopiedImage(false), 2500);
      } catch {
        handleDownloadImage169();
      } finally {
        setIsGeneratingImage(false);
      }
    } catch (err) {
      console.error(err);
      setIsGeneratingImage(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleResetConfig = () => {
    setConfig(DEFAULT_CONFIG);
    setSelectedShift('ALL');
    setSelectedTaskIds([]);
    setSelectedRoles([]);
    setSelectedCategories([]);
    setSelectedTLs([]);
    setSearchTerm('');
    localStorage.removeItem('dimensio_quick_16_9_config');
    showNotice('Configurações da visualização 16:9 restauradas.');
  };

  // Direct 1-click restore to app theme
  const handleRestoreAppTheme = () => {
    setConfig({ ...config, theme: 'system' });
    showNotice('Tema restaurado para o padrão do aplicativo!');
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {!hideControls && (
        <>
          {/* TOP ACTION & TOOLBAR */}
          <div className="no-print bg-[var(--paper)] p-3.5 sm:p-4 rounded-2xl border border-[var(--line)] shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center font-black shadow-sm shrink-0">
                  <Tv className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-black text-[var(--ink)]">
                      Visualização Rápida • Apresentação 16:9
                    </h2>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200 border border-sky-300 dark:border-sky-800 rounded-md">
                      TV & Telão
                    </span>
                    {config.theme === 'system' && (
                      <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 dark:bg-indigo-950/80 dark:text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                        Tema do App Ativo
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--muted)] font-medium">
                    Proporção 16:9 sem rolagem. Campos flexíveis, temas de alto contraste e personalização interativa de cards.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* INTERACTIVE MODE TOGGLE BUTTON */}
              <button
                type="button"
                onClick={() => setIsInteractiveMode(!isInteractiveMode)}
                className={`px-3.5 py-2 rounded-xl text-xs font-black border transition-all flex items-center gap-2 cursor-pointer shadow-sm ${
                  isInteractiveMode
                    ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-400 ring-2 ring-amber-300/50'
                    : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-indigo-400'
                }`}
                title="Ativar ferramenta para redimensionar e mover cards com adaptação automática"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isInteractiveMode ? 'Modo Interativo Ativo' : 'Personalizar Layout (Mover/Expandir)'}</span>
              </button>

              {/* FONT ZOOM QUICK BUTTONS */}
              <div className="flex items-center gap-0.5 bg-[var(--bg)] border border-[var(--line)] p-1 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() =>
                    setConfig({
                      ...config,
                      fontScale: Math.max(0.75, Number(((config.fontScale || 1.0) - 0.08).toFixed(2))),
                    })
                  }
                  className="p-1 text-[var(--muted)] hover:text-[var(--ink)] rounded-lg hover:bg-[var(--paper)] cursor-pointer"
                  title="Diminuir tamanho da fonte (A-)"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-black px-1 text-[var(--ink)] min-w-[36px] text-center">
                  {Math.round((config.fontScale || 1.0) * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setConfig({
                      ...config,
                      fontScale: Math.min(1.75, Number(((config.fontScale || 1.0) + 0.08).toFixed(2))),
                    })
                  }
                  className="p-1 text-[var(--muted)] hover:text-[var(--ink)] rounded-lg hover:bg-[var(--paper)] cursor-pointer"
                  title="Aumentar tamanho da fonte (A+)"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* EXPORT BUTTONS */}
              <button
                type="button"
                onClick={handleDownloadImage169}
                disabled={isGeneratingImage}
                className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                title="Baixar imagem PNG 16:9 em alta resolução"
              >
                <Download className="w-4 h-4" />
                <span>{isGeneratingImage ? 'Gerando...' : 'Baixar Imagem'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyImage169}
                disabled={isGeneratingImage}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                title="Copiar imagem 16:9 para colar no WhatsApp ou Teams"
              >
                {copiedImage ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                <span>{copiedImage ? 'Copiada!' : 'Copiar'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsFullscreen(true)}
                className="px-3 py-2 bg-[var(--paper)] hover:bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] font-black text-xs rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                title="Abrir em Tela Cheia para transmissão na TV"
              >
                <Maximize2 className="w-4 h-4 text-[var(--primary)]" />
                <span className="hidden sm:inline">Modo TV</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="p-2 border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--bg)] rounded-xl text-xs font-bold cursor-pointer transition-colors"
                title="Imprimir slide 16:9"
              >
                <Printer className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setShowConfigPanel(!showConfigPanel)}
                className={`px-3 py-2 rounded-xl text-xs font-black border transition-colors flex items-center gap-1.5 cursor-pointer ${
                  showConfigPanel
                    ? 'bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--primary-border)]'
                    : 'bg-[var(--paper)] text-[var(--muted)] border-[var(--line)] hover:text-[var(--ink)]'
                }`}
                title="Abrir/fechar opções, densidade, fontes e filtros"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Filtros & Opções</span>
                {showConfigPanel ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* INTERACTIVE MODE NOTIFICATION BANNER */}
          {isInteractiveMode && (
            <div className="no-print bg-amber-500/10 border-2 border-amber-500/40 p-3.5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center font-black shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-extrabold text-[var(--ink)] text-xs block">
                    Modo de Ajuste Interativo Ativo
                  </span>
                  <span className="text-[11px] text-[var(--muted)]">
                    Use os botões <strong className="text-amber-600 dark:text-amber-400">[-] e [+]</strong> nos cards para aumentar/reduzir largura (1x, 2x, 3x) e as setas <strong className="text-indigo-600 dark:text-indigo-400">[←] e [→]</strong> ou arraste para reposicionar. Os outros cards se adaptam automaticamente!
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {/* Total Columns Quick Selector */}
                <div className="flex items-center gap-1 bg-[var(--paper)] border border-[var(--line)] px-2 py-1 rounded-xl">
                  <Columns className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                  <span className="font-bold text-[10px] text-[var(--muted)]">Colunas:</span>
                  <select
                    value={config.totalColumns || 'auto'}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        totalColumns: e.target.value === 'auto' ? 'auto' : Number(e.target.value),
                      })
                    }
                    className="bg-transparent font-black text-xs text-[var(--ink)] focus:outline-none cursor-pointer"
                  >
                    <option value="auto">Automático ({layoutCalculations.totalCols})</option>
                    <option value="1">1 Coluna</option>
                    <option value="2">2 Colunas</option>
                    <option value="3">3 Colunas</option>
                    <option value="4">4 Colunas</option>
                    <option value="5">5 Colunas</option>
                    <option value="6">6 Colunas</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleResetCardLayouts}
                  className="px-2.5 py-1 bg-[var(--paper)] hover:bg-[var(--bg)] border border-[var(--line)] text-xs font-bold text-[var(--muted)] hover:text-rose-600 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Redefinir Layout</span>
                </button>
              </div>
            </div>
          )}

          {/* EXPANDABLE CONFIGURATION & FILTERS PANEL */}
          {showConfigPanel && (
            <div className="no-print bg-[var(--paper)] border border-[var(--line)] p-4 rounded-2xl shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <SlidersHorizontal className="w-4 h-4 text-[var(--primary)]" />
                  <h3 className="text-xs font-black text-[var(--ink)] uppercase tracking-wider">
                    Personalização Completa: Temas, Fontes, Densidade & Filtros
                  </h3>
                  <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 dark:bg-emerald-950/80 dark:text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-800">
                    Sincronizado
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRestoreAppTheme}
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1 transition-colors"
                    title="Usar as cores padrão do sistema/app"
                  >
                    <Palette className="w-3.5 h-3.5" />
                    <span>Tema Padrão do App</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetConfig}
                    className="text-[11px] font-bold text-[var(--muted)] hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer flex items-center gap-1 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Restaurar Tudo</span>
                  </button>
                </div>
              </div>

              {/* 1. THEMES & DENSITY ROW */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {/* Theme Selector */}
                <div className="bg-[var(--bg)] border border-[var(--line)] p-3 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-extrabold text-[var(--ink)] text-[11px] flex items-center gap-1.5">
                      <Tv className="w-3.5 h-3.5 text-[var(--primary)]" />
                      <span>Tema Visual 16:9</span>
                    </label>
                    {config.theme !== 'system' && (
                      <button
                        type="button"
                        onClick={handleRestoreAppTheme}
                        className="text-[9.5px] font-bold text-[var(--primary)] hover:underline"
                      >
                        Padrão App
                      </button>
                    )}
                  </div>
                  <select
                    value={config.theme}
                    onChange={(e) => setConfig({ ...config, theme: e.target.value as PresentationTheme })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--paper)] text-xs font-bold text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] cursor-pointer"
                  >
                    {Object.entries(presentationThemeStyles).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Density Mode */}
                <div className="bg-[var(--bg)] border border-[var(--line)] p-3 rounded-xl space-y-2">
                  <label className="font-extrabold text-[var(--ink)] text-[11px] flex items-center gap-1.5">
                    <LayoutGrid className="w-3.5 h-3.5 text-[var(--primary)]" />
                    <span>Densidade & Espaçamento</span>
                  </label>
                  <select
                    value={config.density}
                    onChange={(e) => setConfig({ ...config, density: e.target.value as DensityMode })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--paper)] text-xs font-bold text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] cursor-pointer"
                  >
                    <option value="auto">Automático Inteligente</option>
                    <option value="compact">Compacto (Mais Nomes e Postos)</option>
                    <option value="normal">Normal (Equilibrado)</option>
                    <option value="comfortable">Confortável (Mais Espaçamento)</option>
                    <option value="spacious">Amplo / TV Grande (Preenchimento Máximo)</option>
                  </select>
                </div>

                {/* Font Size & Scale */}
                <div className="bg-[var(--bg)] border border-[var(--line)] p-3 rounded-xl space-y-2">
                  <label className="font-extrabold text-[var(--ink)] text-[11px] flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-[var(--primary)]" />
                    <span>Tamanho e Escala de Fonte</span>
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <select
                      value={config.fontSize || 'auto'}
                      onChange={(e) =>
                        setConfig({ ...config, fontSize: e.target.value as FontSizePreset })
                      }
                      className="w-full px-2 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--paper)] text-xs font-bold text-[var(--ink)] focus:outline-none cursor-pointer"
                    >
                      <option value="auto">Auto</option>
                      <option value="xs">Pequena (80%)</option>
                      <option value="sm">Média (90%)</option>
                      <option value="md">Padrão (100%)</option>
                      <option value="lg">Grande (115%)</option>
                      <option value="xl">Extra (130%)</option>
                      <option value="2xl">TV Gigante (150%)</option>
                    </select>

                    <select
                      value={config.fontFamily || 'sans'}
                      onChange={(e) =>
                        setConfig({ ...config, fontFamily: e.target.value as FontFamilyPreset })
                      }
                      className="w-full px-2 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--paper)] text-xs font-bold text-[var(--ink)] focus:outline-none cursor-pointer"
                    >
                      <option value="sans">Sans Clean</option>
                      <option value="condensed">Condensada</option>
                      <option value="display">Display</option>
                      <option value="mono">Mono Técnica</option>
                    </select>
                  </div>
                </div>

                {/* Header Style */}
                <div className="bg-[var(--bg)] border border-[var(--line)] p-3 rounded-xl space-y-2">
                  <label className="font-extrabold text-[var(--ink)] text-[11px] flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--primary)]" />
                    <span>Estilo dos Cards</span>
                  </label>
                  <select
                    value={config.headerStyle}
                    onChange={(e) =>
                      setConfig({ ...config, headerStyle: e.target.value as TaskCardHeaderStyle })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--paper)] text-xs font-bold text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] cursor-pointer"
                  >
                    <option value="banner">Banner em Destaque</option>
                    <option value="subtle">Suave com Fundo Translúcido</option>
                    <option value="minimal">Minimalista com Linha</option>
                  </select>
                </div>
              </div>

              {/* 2. FILTERS & DISPLAY OPTIONS */}
              <div className="space-y-2 pt-1 border-t border-[var(--line)]">
                <span className="text-[10.5px] font-black uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[var(--primary)]" />
                  <span>Filtros de Exibição</span>
                </span>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Shift Filter */}
                  <div className="flex items-center gap-1 bg-[var(--bg)] border border-[var(--line)] px-2.5 py-1 rounded-xl text-xs">
                    <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="font-bold text-[var(--muted)] text-[11px]">Turno:</span>
                    <select
                      value={selectedShift}
                      onChange={(e) => setSelectedShift(e.target.value)}
                      className="bg-transparent font-black text-[var(--ink)] text-xs focus:outline-none cursor-pointer"
                    >
                      <option value="ALL">Todos os Turnos</option>
                      {availableShifts.map((s) => (
                        <option key={s} value={s}>
                          Turno {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <MultiSelectFilter
                    label="Tarefas"
                    options={state.tasks.map((t) => ({ label: t.name, value: t.id }))}
                    selectedValues={selectedTaskIds}
                    onChange={setSelectedTaskIds}
                    placeholder="Todas as tarefas"
                    allLabel="Todas as Tarefas"
                    icon={<LayoutGrid className="w-3 h-3 text-indigo-500" />}
                  />

                  <MultiSelectFilter
                    label="Cargo"
                    options={availableRoles.map((role) => ({ label: role, value: role }))}
                    selectedValues={selectedRoles}
                    onChange={setSelectedRoles}
                    placeholder="Todos os cargos"
                    allLabel="Todos os Cargos"
                    icon={<Briefcase className="w-3 h-3 text-emerald-500" />}
                  />

                  <MultiSelectFilter
                    label="Categoria"
                    options={availableCategories.map((cat) => ({ label: cat, value: cat }))}
                    selectedValues={selectedCategories}
                    onChange={setSelectedCategories}
                    placeholder="Todas as categorias"
                    allLabel="Todas as Categorias"
                    icon={<Tag className="w-3 h-3 text-sky-500" />}
                  />

                  <MultiSelectFilter
                    label="Líder (TL)"
                    options={availableTLs.map((tl) => ({ label: tl, value: tl }))}
                    selectedValues={selectedTLs}
                    onChange={setSelectedTLs}
                    placeholder="Todos os líderes"
                    allLabel="Todos os Líderes"
                    icon={<Users className="w-3 h-3 text-purple-500" />}
                  />

                  <SearchInput
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder="Filtrar por nome..."
                    className="w-44"
                  />
                </div>
              </div>

              {/* 3. VISIBILITY TOGGLES & OPTIONS */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs pt-1 border-t border-[var(--line)]">
                {/* Break Display */}
                <div className="bg-[var(--bg)] border border-[var(--line)] p-3 rounded-xl space-y-2">
                  <label className="font-extrabold text-[var(--ink)] text-[11px] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[var(--primary)]" />
                    <span>Exibição dos Intervalos</span>
                  </label>
                  <select
                    value={config.breakDisplay}
                    onChange={(e) =>
                      setConfig({ ...config, breakDisplay: e.target.value as BreakDisplayMode })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--paper)] text-xs font-bold text-[var(--ink)] focus:outline-none cursor-pointer"
                  >
                    <option value="grouped">Agrupar por Horário (Divisória Central)</option>
                    <option value="badge">Badge junto ao Nome</option>
                    <option value="none">Ocultar Intervalos no Slide</option>
                  </select>
                </div>

                {/* Toggles */}
                <div className="bg-[var(--bg)] border border-[var(--line)] p-3 rounded-xl space-y-1.5 lg:col-span-2">
                  <span className="block font-extrabold text-[var(--ink)] text-[11px]">
                    Elementos e Comportamento
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.stretchItems}
                        onChange={(e) => setConfig({ ...config, stretchItems: e.target.checked })}
                        className="w-3.5 h-3.5 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                      />
                      <span className="text-[11px] font-bold text-[var(--ink)]">
                        Preencher altura dos cards
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.showRoles}
                        onChange={(e) => setConfig({ ...config, showRoles: e.target.checked })}
                        className="w-3.5 h-3.5 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                      />
                      <span className="text-[11px] font-bold text-[var(--ink)]">Exibir cargos</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.showHeadcounts}
                        onChange={(e) => setConfig({ ...config, showHeadcounts: e.target.checked })}
                        className="w-3.5 h-3.5 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                      />
                      <span className="text-[11px] font-bold text-[var(--ink)]">
                        Contador de pessoas
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.groupSubtasks}
                        onChange={(e) => setConfig({ ...config, groupSubtasks: e.target.checked })}
                        className="w-3.5 h-3.5 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                      />
                      <span className="text-[11px] font-bold text-[var(--ink)]">
                        Agrupar subtarefas
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.hideEmptyTasks}
                        onChange={(e) => setConfig({ ...config, hideEmptyTasks: e.target.checked })}
                        className="w-3.5 h-3.5 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                      />
                      <span className="text-[11px] font-bold text-[var(--ink)]">
                        Ocultar tarefas vazias
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.abbreviateNames}
                        onChange={(e) =>
                          setConfig({ ...config, abbreviateNames: e.target.checked })
                        }
                        className="w-3.5 h-3.5 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                      />
                      <span className="text-[11px] font-bold text-[var(--ink)]">Abreviar nomes</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* 4. FOOTER NOTE */}
              <div className="bg-[var(--bg)] border border-[var(--line)] p-3 rounded-xl flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex items-center gap-1.5 text-[var(--primary)] font-black text-xs shrink-0">
                  <span>Aviso / Foco do Turno:</span>
                </div>
                <textarea
                  rows={2}
                  value={config.footerNote}
                  onChange={(e) => setConfig({ ...config, footerNote: e.target.value })}
                  placeholder="Ex: Atenção ao uso de EPIs e conferência de códigos | Foco em Segurança... (Suporta **negrito**, listas e quebras de linha)"
                  className="flex-1 w-full px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--paper)] text-xs font-bold text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-y"
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* 16:9 FIXED PRESENTATION CONTAINER (STAGE) */}
      <div
        className={`flex justify-center transition-all ${
          isFullscreen
            ? 'fixed inset-0 z-50 bg-black/95 p-4 sm:p-8 flex-col items-center justify-center overflow-hidden'
            : 'bg-slate-950/20 p-2 sm:p-5 rounded-3xl border border-[var(--line)] shadow-inner'
        }`}
      >
        {/* Fullscreen Floating Controls */}
        {isFullscreen && (
          <div className="absolute top-4 right-4 z-50 flex items-center gap-2 bg-slate-900/90 border border-slate-700 p-1.5 rounded-2xl backdrop-blur-md shadow-2xl">
            <button
              type="button"
              onClick={handleDownloadImage169}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar Imagem</span>
            </button>
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Sair da Tela Cheia (ESC)</span>
            </button>
          </div>
        )}

        {/* 16:9 SLIDE BOARD - Strict 16:9 aspect ratio with ZERO internal scroll */}
        <div
          ref={slideRef}
          id="presentation-slide-16-9"
          className="w-full aspect-[16/9] rounded-2xl sm:rounded-3xl border shadow-2xl flex flex-col justify-between overflow-hidden relative select-none transition-colors duration-200"
          style={{
            backgroundColor: activeTheme.bg,
            borderColor: activeTheme.cardBorder,
            color: activeTheme.text,
            fontFamily: layoutCalculations.activeFontFamily,
            boxSizing: 'border-box',
            width: isFullscreen ? 'min(100%, calc((100vh - 4rem) * 16 / 9))' : 'min(100%, 1600px)',
          }}
        >
          {/* 1. SLIDE HEADER (TOP BAR) */}
          <div
            className="px-4 sm:px-6 py-2.5 sm:py-3.5 border-b flex items-center justify-between shrink-0 gap-3"
            style={{
              backgroundColor: activeTheme.headerBg,
              borderColor: activeTheme.headerBorder,
            }}
          >
            <div className="min-w-0">
              <h1
                className="font-black text-sm sm:text-base lg:text-lg uppercase tracking-wide truncate"
                style={{ color: activeTheme.text }}
              >
                {state.teamName || 'ESCALA OPERACIONAL DE TRABALHO'}
              </h1>
              <div
                className="flex items-center gap-2 text-[10px] sm:text-xs font-bold truncate"
                style={{ color: activeTheme.textMuted }}
              >
                <span>{formatDateLongBR(activeDate)}</span>
                <span>•</span>
                <span>Turno {selectedShift === 'ALL' ? state.teamShift || 'T2' : selectedShift}</span>
                <span>•</span>
                <span>{state.sector || 'Operacional'}</span>
                {config.showHeaderDetails && (
                  <>
                    <span>•</span>
                    <span>TL: {state.defaultTeamLeader || 'Supervisão'}</span>
                  </>
                )}
              </div>
            </div>

            {/* Quick Metrics Badges in Header */}
            {config.showMetricsBar && (
              <div
                className="hidden md:flex items-center gap-2 px-3 py-1 rounded-xl text-xs font-bold border shrink-0"
                style={{
                  backgroundColor: activeTheme.badgeBg,
                  borderColor: activeTheme.cardBorder,
                  color: activeTheme.text,
                }}
              >
                <span className="flex items-center gap-1 font-black text-emerald-500 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                  <span>{metrics.presentes} Presentes</span>
                </span>
                {metrics.atrasos > 0 && (
                  <span className="flex items-center gap-1 font-black text-amber-500 dark:text-amber-400">
                    <Clock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                    <span>{metrics.atrasos} Atraso</span>
                  </span>
                )}
                {metrics.folgas > 0 && (
                  <span className="text-[10.5px] opacity-75">
                    {metrics.folgas} Folgas
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 2. MAIN BODY: DYNAMIC MULTI-COLUMN NO-SCROLL GRID WITH INTERACTIVE CARD RESIZE & REORDER */}
          <div className="p-3 sm:p-4 md:p-5 flex-1 flex flex-col justify-stretch min-h-0 overflow-hidden">
            {displayedTaskGroups.length > 0 ? (
              <div
                className={`grid ${layoutCalculations.gridColsClass} gap-2.5 sm:gap-3.5 h-full w-full items-stretch content-stretch overflow-hidden`}
              >
                {displayedTaskGroups.map((group, groupIndex) => {
                  const root = group.rootTask;
                  const hasSubtasks = group.subtasks.length > 0;
                  const membersToDisplay = config.groupSubtasks
                    ? group.allFilteredMembers
                    : group.directMembers;

                  // Custom Card Layout Settings
                  const cardLayout = config.cardLayouts?.[root.id] || {};
                  const colSpan = Math.min(layoutCalculations.totalCols, cardLayout.colSpan || 1);
                  const internalCols =
                    cardLayout.internalCols ||
                    (colSpan > 1 && membersToDisplay.length >= 4
                      ? Math.min(colSpan, 3)
                      : membersToDisplay.length >= 8 && layoutCalculations.totalCols <= 3
                      ? 2
                      : 1);
                  const isHighlighted = Boolean(cardLayout.highlight);

                  // Check for pending intervals
                  const pendingBreaksCount = group.allFilteredMembers.filter(
                    (m) => !state.breaks.some((b) => (dayIntervals[b.id] || []).includes(m.id))
                  ).length;
                  const hasPendingBreaks = pendingBreaksCount > 0;

                  // Card font scaling based on card column span
                  const cardNameFontSize =
                    colSpan > 1
                      ? Math.round(layoutCalculations.nameFontSize * 1.08)
                      : layoutCalculations.nameFontSize;
                  const cardHeaderFontSize =
                    colSpan > 1
                      ? Math.round(layoutCalculations.headerFontSize * 1.08)
                      : layoutCalculations.headerFontSize;

                  return (
                    <div
                      key={root.id}
                      draggable={isInteractiveMode}
                      onDragStart={(e) => handleDragStart(e, root.id)}
                      onDragOver={(e) => handleDragOver(e, root.id)}
                      onDrop={(e) => handleDrop(e, root.id)}
                      onDragEnd={handleDragEnd}
                      className={`rounded-xl sm:rounded-2xl border shadow-sm flex flex-col justify-between overflow-hidden transition-all duration-150 relative ${
                        dragOverTaskId === root.id ? 'ring-2 ring-indigo-500 scale-[1.01]' : ''
                      } ${isInteractiveMode ? 'cursor-grab active:cursor-grabbing hover:border-amber-400' : ''}`}
                      style={{
                        gridColumn: `span ${colSpan} / span ${colSpan}`,
                        backgroundColor: activeTheme.cardBg,
                        borderColor: isHighlighted
                          ? activeTheme.accent
                          : hasPendingBreaks
                          ? '#f59e0b'
                          : activeTheme.cardBorder,
                        borderWidth: isHighlighted ? '2px' : '1px',
                        boxShadow: isHighlighted ? `0 0 12px ${activeTheme.accent}44` : undefined,
                      }}
                    >
                      {/* INTERACTIVE CONTROLS BAR (Appears on top of card when in Interactive Mode) */}
                      {isInteractiveMode && (
                        <div
                          className="no-print flex items-center justify-between px-2 py-1 bg-black/80 text-white text-[10px] font-black border-b border-white/10 z-10"
                        >
                          <div className="flex items-center gap-1">
                            <GripVertical className="w-3 h-3 text-amber-400 cursor-grab" />
                            <span className="text-amber-400 uppercase tracking-wide">
                              Largura: {colSpan}x ({colSpan} col{colSpan > 1 ? 's' : ''})
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            {/* Resize Buttons */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCardSpan(root.id, colSpan - 1);
                              }}
                              disabled={colSpan <= 1}
                              className="p-1 rounded bg-white/10 hover:bg-white/25 disabled:opacity-30 cursor-pointer"
                              title="Reduzir largura do card (-1 coluna)"
                            >
                              <Minus className="w-2.5 h-2.5" />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCardSpan(root.id, colSpan + 1);
                              }}
                              disabled={colSpan >= layoutCalculations.totalCols}
                              className="p-1 rounded bg-white/10 hover:bg-white/25 disabled:opacity-30 cursor-pointer"
                              title="Aumentar largura do card (+1 coluna)"
                            >
                              <Plus className="w-2.5 h-2.5" />
                            </button>

                            {/* Internal sub-columns toggle for wide cards */}
                            {colSpan > 1 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCardInternalCols(root.id, internalCols >= 3 ? 1 : internalCols + 1);
                                }}
                                className="px-1.5 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-[9px] cursor-pointer"
                                title="Alternar colunas internas de colaboradores dentro deste card"
                              >
                                {internalCols} cols nomes
                              </button>
                            )}

                            {/* Move Card Buttons */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveCard(root.id, 'left');
                              }}
                              disabled={groupIndex === 0}
                              className="p-1 rounded bg-white/10 hover:bg-white/25 disabled:opacity-30 cursor-pointer"
                              title="Mover para esquerda"
                            >
                              <ArrowLeft className="w-2.5 h-2.5" />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveCard(root.id, 'right');
                              }}
                              disabled={groupIndex === displayedTaskGroups.length - 1}
                              className="p-1 rounded bg-white/10 hover:bg-white/25 disabled:opacity-30 cursor-pointer"
                              title="Mover para direita"
                            >
                              <ArrowRight className="w-2.5 h-2.5" />
                            </button>

                            {/* Highlight toggle */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCardHighlight(root.id);
                              }}
                              className={`p-1 rounded cursor-pointer ${
                                isHighlighted ? 'bg-amber-500 text-white' : 'bg-white/10 hover:bg-white/25 text-white/70'
                              }`}
                              title="Destacar card com borda luminosa"
                            >
                              <Sparkle className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Task Header according to Header Style */}
                      {config.headerStyle === 'banner' ? (
                        /* Banner Em Destaque */
                        <div
                          className="flex items-center justify-between px-3 py-2 shrink-0 border-b shadow-2xs gap-2"
                          style={{
                            backgroundColor: activeTheme.accent,
                            borderColor: 'rgba(255, 255, 255, 0.18)',
                          }}
                        >
                          <h2
                            className="font-black uppercase tracking-wide truncate min-w-0 text-white"
                            style={{
                              fontSize: cardHeaderFontSize,
                            }}
                            title={root.name}
                          >
                            {root.name}
                          </h2>

                          {config.showHeadcounts && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              {hasPendingBreaks && (
                                <span
                                  className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500 text-white border border-amber-300/40 flex items-center gap-1 shadow-2xs"
                                  title={`${pendingBreaksCount} com intervalo a definir`}
                                >
                                  <Clock className="w-2.5 h-2.5" />
                                  <span>{pendingBreaksCount}</span>
                                </span>
                              )}
                              <span
                                className="px-2 py-0.5 rounded-full font-black text-white bg-white/20 backdrop-blur-xs border border-white/25 shadow-2xs"
                                style={{
                                  fontSize: layoutCalculations.badgeFontSize,
                                }}
                              >
                                {group.totalPresentCount}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : config.headerStyle === 'subtle' ? (
                        /* Cabeçalho Suave */
                        <div
                          className="flex items-center justify-between px-3 py-1.5 shrink-0 border-b gap-2"
                          style={{
                            backgroundColor: activeTheme.accentBg,
                            borderColor: activeTheme.accentBorder,
                          }}
                        >
                          <h2
                            className="font-black uppercase tracking-wide truncate min-w-0"
                            style={{
                              color: activeTheme.accent,
                              fontSize: cardHeaderFontSize,
                            }}
                            title={root.name}
                          >
                            {root.name}
                          </h2>

                          {config.showHeadcounts && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              {hasPendingBreaks && (
                                <span
                                  className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center gap-1"
                                  title={`${pendingBreaksCount} com intervalo a definir`}
                                >
                                  <Clock className="w-2.5 h-2.5" />
                                  <span>{pendingBreaksCount}</span>
                                </span>
                              )}
                              <span
                                className="px-2 py-0.5 rounded-full font-black text-white"
                                style={{
                                  backgroundColor: activeTheme.accent,
                                  fontSize: layoutCalculations.badgeFontSize,
                                }}
                              >
                                {group.totalPresentCount}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Minimalista */
                        <div
                          className="flex items-center justify-between px-3 py-1.5 shrink-0 border-b gap-2"
                          style={{
                            borderColor: activeTheme.cardBorder,
                          }}
                        >
                          <h2
                            className="font-black uppercase tracking-wide truncate min-w-0"
                            style={{
                              color: activeTheme.text,
                              fontSize: cardHeaderFontSize,
                            }}
                            title={root.name}
                          >
                            {root.name}
                          </h2>

                          {config.showHeadcounts && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              {hasPendingBreaks && (
                                <span
                                  className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center gap-1"
                                  title={`${pendingBreaksCount} com intervalo a definir`}
                                >
                                  <Clock className="w-2.5 h-2.5" />
                                  <span>{pendingBreaksCount}</span>
                                </span>
                              )}
                              <span
                                className="px-2 py-0.5 rounded-full font-black border"
                                style={{
                                  backgroundColor: activeTheme.badgeBg,
                                  color: activeTheme.badgeText,
                                  borderColor: activeTheme.cardBorder,
                                  fontSize: layoutCalculations.badgeFontSize,
                                }}
                              >
                                {group.totalPresentCount}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Task Members Content - Dynamically filling available card height */}
                      <div className="p-2 sm:p-2.5 flex-1 flex flex-col justify-between min-h-0 overflow-hidden">
                        {config.groupSubtasks || !hasSubtasks ? (
                          membersToDisplay.length > 0 ? (
                            config.breakDisplay === 'grouped' ? (
                              <div
                                className={`overflow-hidden flex flex-col h-full ${
                                  config.stretchItems ? 'justify-between' : 'justify-start'
                                } space-y-1`}
                              >
                                {groupTaskMembersByBreak(membersToDisplay).map((breakGroup) => (
                                  <div
                                    key={breakGroup.timeLabel}
                                    className={`space-y-1 min-w-0 ${
                                      config.stretchItems ? 'flex-1 flex flex-col justify-center' : ''
                                    }`}
                                  >
                                    {/* Interval Section Divider */}
                                    <div className="flex items-center gap-1.5 my-0.5 shrink-0">
                                      <div
                                        className="h-px flex-1 opacity-50"
                                        style={{ backgroundColor: activeTheme.cardBorder }}
                                      />
                                      <span
                                        className="px-2 py-0.5 rounded-full text-[9px] font-black flex items-center gap-1 shrink-0 shadow-2xs border"
                                        style={{
                                          backgroundColor: activeTheme.breakBg,
                                          color: activeTheme.breakText,
                                          borderColor: activeTheme.breakBorder,
                                        }}
                                      >
                                        <Clock className="w-2.5 h-2.5 shrink-0" />
                                        <span>
                                          {breakGroup.timeLabel} ({breakGroup.members.length})
                                        </span>
                                      </span>
                                      <div
                                        className="h-px flex-1 opacity-50"
                                        style={{ backgroundColor: activeTheme.cardBorder }}
                                      />
                                    </div>

                                    <div
                                      className={`grid ${
                                        internalCols >= 3
                                          ? 'grid-cols-3'
                                          : internalCols === 2
                                          ? 'grid-cols-2'
                                          : 'grid-cols-1'
                                      } gap-1 ${
                                        config.stretchItems
                                          ? 'flex-1 items-stretch content-stretch'
                                          : ''
                                      }`}
                                    >
                                      {breakGroup.members.map((member) => {
                                        const displayName = renderDisplayName(member.name);
                                        const statusInfo = getCollaboratorStatus(member, activeDate, state);
                                        const isLate = statusInfo.status === 'atraso';

                                        return (
                                          <div
                                            key={member.id}
                                            className={`rounded-lg border flex items-center justify-between min-w-0 transition-all shadow-2xs ${
                                              layoutCalculations.itemPadding
                                            } ${
                                              config.stretchItems
                                                ? 'flex-1 min-h-[30px] max-h-[72px]'
                                                : ''
                                            }`}
                                            style={{
                                              backgroundColor: activeTheme.itemBg,
                                              borderColor: isLate ? '#f59e0b' : activeTheme.itemBorder,
                                            }}
                                          >
                                            <div className="min-w-0 flex-1 pr-1 text-left">
                                              <span
                                                className="font-black truncate block leading-snug"
                                                style={{
                                                  color: activeTheme.text,
                                                  fontSize: cardNameFontSize,
                                                }}
                                              >
                                                {displayName}
                                              </span>
                                              {config.showRoles && (
                                                <span
                                                  className="font-semibold truncate block leading-none opacity-80 mt-0.5"
                                                  style={{
                                                    color: activeTheme.textMuted,
                                                    fontSize: layoutCalculations.subHeaderFontSize,
                                                  }}
                                                >
                                                  {member.role || 'Operador'}
                                                </span>
                                              )}
                                            </div>

                                            {isLate && (
                                              <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40 shrink-0 ml-1">
                                                Atraso
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div
                                className={`grid ${
                                  internalCols >= 3
                                    ? 'grid-cols-3'
                                    : internalCols === 2
                                    ? 'grid-cols-2'
                                    : 'grid-cols-1'
                                } gap-1 overflow-hidden h-full ${
                                  config.stretchItems
                                    ? 'flex-1 items-stretch content-stretch'
                                    : 'content-start'
                                }`}
                              >
                                {membersToDisplay.map((member) => {
                                  const displayName = renderDisplayName(member.name);
                                  const statusInfo = getCollaboratorStatus(member, activeDate, state);
                                  const isLate = statusInfo.status === 'atraso';
                                  const breakTime = getBreakTime(member.id);

                                  return (
                                    <div
                                      key={member.id}
                                      className={`rounded-lg border flex items-center justify-between min-w-0 transition-all shadow-2xs ${
                                        layoutCalculations.itemPadding
                                      } ${
                                        config.stretchItems ? 'flex-1 min-h-[30px] max-h-[72px]' : ''
                                      }`}
                                      style={{
                                        backgroundColor: activeTheme.itemBg,
                                        borderColor: isLate ? '#f59e0b' : activeTheme.itemBorder,
                                      }}
                                    >
                                      <div className="min-w-0 flex-1 pr-1 text-left">
                                        <span
                                          className="font-black truncate block leading-snug"
                                          style={{
                                            color: activeTheme.text,
                                            fontSize: cardNameFontSize,
                                          }}
                                        >
                                          {displayName}
                                        </span>
                                        {config.showRoles && (
                                          <span
                                            className="font-semibold truncate block leading-none opacity-80 mt-0.5"
                                            style={{
                                              color: activeTheme.textMuted,
                                              fontSize: layoutCalculations.subHeaderFontSize,
                                            }}
                                          >
                                            {member.role || 'Operador'}
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-1 shrink-0 ml-1">
                                        {isLate && (
                                          <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40 shrink-0">
                                            Atraso
                                          </span>
                                        )}
                                        {config.breakDisplay === 'badge' &&
                                          breakTime !== 'Sem Intervalo' && (
                                            <span
                                              className="font-black px-1.5 py-0.5 rounded border flex items-center gap-0.5 shrink-0"
                                              style={{
                                                backgroundColor: activeTheme.breakBg,
                                                color: activeTheme.breakText,
                                                borderColor: activeTheme.breakBorder,
                                                fontSize: Math.max(
                                                  8,
                                                  layoutCalculations.subHeaderFontSize * 0.85
                                                ),
                                              }}
                                            >
                                              <Clock className="w-2 h-2 shrink-0" />
                                              <span>{breakTime}</span>
                                            </span>
                                          )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )
                          ) : (
                            <p
                              className="text-[10px] italic text-center py-2 my-auto"
                              style={{ color: activeTheme.textMuted }}
                            >
                              Sem colaboradores alocados
                            </p>
                          )
                        ) : (
                          /* Detailed Subtasks Hierarchical Mode */
                          <div
                            className={`space-y-1.5 overflow-hidden flex flex-col h-full ${
                              config.stretchItems ? 'justify-between' : 'justify-start'
                            }`}
                          >
                            {group.directMembers.length > 0 && (
                              <div className="space-y-0.5">
                                <span
                                  className="text-[9px] font-black uppercase tracking-wider opacity-75 block px-1"
                                  style={{ color: activeTheme.textMuted }}
                                >
                                  Posto Principal ({group.directMembers.length})
                                </span>
                                <div
                                  className={`grid ${
                                    internalCols >= 2 ? 'grid-cols-2' : 'grid-cols-1'
                                  } gap-1`}
                                >
                                  {group.directMembers.map((m) => {
                                    const displayName = renderDisplayName(m.name);
                                    const statusInfo = getCollaboratorStatus(m, activeDate, state);
                                    const isLate = statusInfo.status === 'atraso';
                                    const breakTime = getBreakTime(m.id);

                                    return (
                                      <div
                                        key={m.id}
                                        className={`rounded-lg border flex items-center justify-between min-w-0 ${layoutCalculations.itemPadding}`}
                                        style={{
                                          backgroundColor: activeTheme.itemBg,
                                          borderColor: isLate ? '#f59e0b' : activeTheme.itemBorder,
                                        }}
                                      >
                                        <div className="min-w-0 flex-1 pr-1 text-left">
                                          <span
                                            className="font-black truncate block leading-snug"
                                            style={{
                                              color: activeTheme.text,
                                              fontSize: cardNameFontSize,
                                            }}
                                          >
                                            {displayName}
                                          </span>
                                          {config.showRoles && (
                                            <span
                                              className="font-semibold truncate block leading-none opacity-80 mt-0.5"
                                              style={{
                                                color: activeTheme.textMuted,
                                                fontSize: layoutCalculations.subHeaderFontSize,
                                              }}
                                            >
                                              {m.role || 'Operador'}
                                            </span>
                                          )}
                                        </div>
                                        {config.breakDisplay === 'badge' &&
                                          breakTime !== 'Sem Intervalo' && (
                                            <span
                                              className="font-black px-1.5 py-0.5 rounded border text-[8.5px] shrink-0 ml-1"
                                              style={{
                                                backgroundColor: activeTheme.breakBg,
                                                color: activeTheme.breakText,
                                                borderColor: activeTheme.breakBorder,
                                              }}
                                            >
                                              {breakTime}
                                            </span>
                                          )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {group.filteredSubtasks.map((sub) => (
                              <div
                                key={sub.id}
                                className="rounded-xl border p-1.5 space-y-1 shadow-2xs"
                                style={{
                                  backgroundColor: `${activeTheme.itemBg}cc`,
                                  borderColor: activeTheme.itemBorder,
                                }}
                              >
                                <div
                                  className="flex items-center justify-between border-b pb-0.5 px-1"
                                  style={{ borderColor: activeTheme.itemBorder }}
                                >
                                  <div
                                    className="flex items-center gap-1 font-black uppercase tracking-wide text-[10px]"
                                    style={{ color: activeTheme.accent }}
                                  >
                                    <GitFork className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{sub.name}</span>
                                  </div>
                                  <span
                                    className="px-1.5 py-0.2 rounded-full font-black text-[9px] border"
                                    style={{
                                      backgroundColor: activeTheme.badgeBg,
                                      color: activeTheme.badgeText,
                                      borderColor: activeTheme.cardBorder,
                                    }}
                                  >
                                    {sub.filteredMembers.length}
                                  </span>
                                </div>

                                <div
                                  className={`grid ${
                                    internalCols >= 2 ? 'grid-cols-2' : 'grid-cols-1'
                                  } gap-1`}
                                >
                                  {sub.filteredMembers.map((m) => {
                                    const displayName = renderDisplayName(m.name);
                                    const statusInfo = getCollaboratorStatus(m, activeDate, state);
                                    const isLate = statusInfo.status === 'atraso';
                                    const breakTime = getBreakTime(m.id);

                                    return (
                                      <div
                                        key={m.id}
                                        className={`rounded-lg border flex items-center justify-between min-w-0 ${layoutCalculations.itemPadding}`}
                                        style={{
                                          backgroundColor: activeTheme.cardBg,
                                          borderColor: isLate ? '#f59e0b' : activeTheme.itemBorder,
                                        }}
                                      >
                                        <div className="min-w-0 flex-1 pr-1 text-left">
                                          <span
                                            className="font-black truncate block leading-snug"
                                            style={{
                                              color: activeTheme.text,
                                              fontSize: Math.max(11, cardNameFontSize * 0.95),
                                            }}
                                          >
                                            {displayName}
                                          </span>
                                          {config.showRoles && (
                                            <span
                                              className="font-semibold truncate block leading-none opacity-80 mt-0.5"
                                              style={{
                                                color: activeTheme.textMuted,
                                                fontSize: layoutCalculations.subHeaderFontSize,
                                              }}
                                            >
                                              {m.role || 'Operador'}
                                            </span>
                                          )}
                                        </div>
                                        {config.breakDisplay === 'badge' &&
                                          breakTime !== 'Sem Intervalo' && (
                                            <span
                                              className="font-black px-1.5 py-0.5 rounded border text-[8.5px] shrink-0 ml-1"
                                              style={{
                                                backgroundColor: activeTheme.breakBg,
                                                color: activeTheme.breakText,
                                                borderColor: activeTheme.breakBorder,
                                              }}
                                            >
                                              {breakTime}
                                            </span>
                                          )}
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
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                <Users className="w-12 h-12 opacity-40" style={{ color: activeTheme.textMuted }} />
                <p className="text-sm font-bold" style={{ color: activeTheme.textMuted }}>
                  Nenhum colaborador ou tarefa atende aos filtros atuais para este turno.
                </p>
              </div>
            )}
          </div>

          {/* 3. SLIDE FOOTER (BOTTOM BAR) */}
          {config.footerNote.trim() ? (
            <div
              className="px-4 sm:px-6 py-2 sm:py-2.5 border-t flex items-center justify-between shrink-0 text-[10px] sm:text-xs font-bold"
              style={{
                backgroundColor: activeTheme.footerBg,
                borderColor: activeTheme.headerBorder,
              }}
            >
              <div className="flex items-center min-w-0 flex-1 pr-2">
                <div
                  className="font-black px-2.5 py-0.5 rounded-lg border min-w-0"
                  style={{
                    backgroundColor: activeTheme.accentBg,
                    color: activeTheme.accent,
                    borderColor: activeTheme.accentBorder,
                  }}
                >
                  <div className="min-w-0">
                    <MarkdownContent
                      content={config.footerNote}
                      onColored
                      sizeClass="text-[10px] sm:text-xs"
                    />
                  </div>
                </div>
              </div>

              <div
                className="flex items-center gap-2 shrink-0 text-[9.5px] sm:text-[11px] font-semibold"
                style={{ color: activeTheme.textMuted }}
              >
                <span>{formatDateBR(activeDate)}</span>
                <span>•</span>
                <span className="font-extrabold uppercase" style={{ color: activeTheme.accent }}>
                  Dimensio Ops
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
