import React, { useState, useRef, useMemo } from 'react';
import { toPng } from 'html-to-image';
import { useApp } from '../context/AppContext';
import { MultiSelectFilter } from '../components/MultiSelectFilter';
import { SearchInput } from '../components/SearchInput';
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Button,
  Badge,
  SectionHeader,
  Tabs,
  Toolbar,
  EmptyState,
  Field,
  Select,
  Textarea,
  Toggle,
} from '../components/ui';
import {
  QuickPresentationView169,
  DEFAULT_CONFIG as DEFAULT_QUICK_CONFIG,
  QuickPresentationConfig,
  PresentationTheme,
  DensityMode,
  FontSizePreset,
  FontFamilyPreset,
  BreakDisplayMode,
  TaskCardHeaderStyle,
  presentationThemeStyles,
  resolvePresentationTheme,
} from '../components/QuickPresentationView169';
import {
  Printer,
  Copy,
  History,
  Download,
  Check,
  Clock,
  CheckCircle2,
  ShieldCheck,
  Filter,
  SlidersHorizontal,
  Layers,
  Users,
  Briefcase,
  Tag,
  LayoutGrid,
  Eye,
  Maximize2,
  Minimize2,
  Tv,
  Smartphone,
  GitFork,
  CornerDownRight,
  FolderTree,
} from 'lucide-react';
import {
  matchesSearch,
  isScaleOff,
  formatDateBR,
  formatDateLongBR,
  abbreviateName,
  getCollaboratorStatus,
} from '../utils/helpers';
import { getConsolidatedTaskGroups, ConsolidatedTaskGroup } from '../utils/taskTreeHelpers';
import { Collaborator } from '../types';
import { MarkdownContent } from '../components/MarkdownContent';

interface ShareViewProps {
  onNavigate?: (view: string) => void;
}

const captureCardPng = async (element: HTMLElement): Promise<string> => {
  const bgColor =
    getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#f5f6fb';

  // Wait for fonts to load before capturing
  await document.fonts.ready;

  return toPng(element, {
    pixelRatio: 3,
    backgroundColor: bgColor,
    cacheBust: false,
  });
};

const shareThemeColors: Record<string, { bg: string; text: string; mutedText: string; border: string; accent: string; headerBg: string; badgeBg: string; badgeText: string; breakBg: string; breakText: string; breakBorder: string; cardBg: string; itemBg: string; accentBg: string }> = {
  dimensio: {
    bg: '#f5f6fb', text: '#1b1b3a', mutedText: '#45466b', border: '#e2e4f3', accent: '#7c3aed',
    headerBg: '#eef2ff', badgeBg: '#eef2ff', badgeText: '#4f46e5',
    breakBg: '#f5f6fb', breakText: '#45466b', breakBorder: '#e2e4f3',
    cardBg: '#ffffff', itemBg: '#f5f6fb', accentBg: '#eef2ff',
  },
  aurora: {
    bg: '#f0fbf7', text: '#06281f', mutedText: '#3f5a52', border: '#cde9e0', accent: '#10b981',
    headerBg: '#ccfbf1', badgeBg: '#ccfbf1', badgeText: '#0d9488',
    breakBg: '#f0fbf7', breakText: '#3f5a52', breakBorder: '#cde9e0',
    cardBg: '#ffffff', itemBg: '#f0fbf7', accentBg: '#ccfbf1',
  },
  ocean: {
    bg: '#f2f7fd', text: '#0b1f33', mutedText: '#33506e', border: '#d3e3f5', accent: '#06b6d4',
    headerBg: '#eff6ff', badgeBg: '#eff6ff', badgeText: '#2563eb',
    breakBg: '#f2f7fd', breakText: '#33506e', breakBorder: '#d3e3f5',
    cardBg: '#ffffff', itemBg: '#f2f7fd', accentBg: '#eff6ff',
  },
  sunset: {
    bg: '#fffaf5', text: '#2a1a10', mutedText: '#6b5647', border: '#f3e2d3', accent: '#e11d48',
    headerBg: '#fff7ed', badgeBg: '#fff7ed', badgeText: '#ea580c',
    breakBg: '#fffaf5', breakText: '#6b5647', breakBorder: '#f3e2d3',
    cardBg: '#ffffff', itemBg: '#fffaf5', accentBg: '#fff7ed',
  },
  crimson: {
    bg: '#fdf2f4', text: '#2b0f15', mutedText: '#6b3d46', border: '#f2d3d9', accent: '#db2777',
    headerBg: '#ffe4e6', badgeBg: '#ffe4e6', badgeText: '#be123c',
    breakBg: '#fdf2f4', breakText: '#6b3d46', breakBorder: '#f2d3d9',
    cardBg: '#ffffff', itemBg: '#fdf2f4', accentBg: '#ffe4e6',
  },
  midnight: {
    bg: '#0b0f1f', text: '#e6e8f5', mutedText: '#a7abc4', border: '#252b47', accent: '#38bdf8',
    headerBg: '#1e2142', badgeBg: '#1e2142', badgeText: '#818cf8',
    breakBg: '#0b0f1f', breakText: '#a7abc4', breakBorder: '#252b47',
    cardBg: '#151a2e', itemBg: '#0b0f1f', accentBg: '#1e2142',
  },
  graphite: {
    bg: '#16171c', text: '#eceef3', mutedText: '#b9bdc9', border: '#33353f', accent: '#a3e635',
    headerBg: '#2a2512', badgeBg: '#2a2512', badgeText: '#f0b429',
    breakBg: '#16171c', breakText: '#b9bdc9', breakBorder: '#33353f',
    cardBg: '#1f2128', itemBg: '#16171c', accentBg: '#2a2512',
  },
  'material-emerald': {
    bg: '#f4fbf7', text: '#002114', mutedText: '#3f4943', border: '#dbe5de', accent: '#3b6555',
    headerBg: '#e6f7f0', badgeBg: '#e6f7f0', badgeText: '#006c4c',
    breakBg: '#f4fbf7', breakText: '#3f4943', breakBorder: '#dbe5de',
    cardBg: '#ffffff', itemBg: '#f4fbf7', accentBg: '#e6f7f0',
  },
  'material-blue': {
    bg: '#f8f9ff', text: '#001a41', mutedText: '#414755', border: '#dae2f9', accent: '#535f70',
    headerBg: '#edf2ff', badgeBg: '#edf2ff', badgeText: '#005ac1',
    breakBg: '#f8f9ff', breakText: '#414755', breakBorder: '#dae2f9',
    cardBg: '#ffffff', itemBg: '#f8f9ff', accentBg: '#edf2ff',
  },
  'material-purple': {
    bg: '#fdf7ff', text: '#250f4c', mutedText: '#4a4458', border: '#ebdcf9', accent: '#6d5676',
    headerBg: '#f5eeff', badgeBg: '#f5eeff', badgeText: '#6b4ea2',
    breakBg: '#fdf7ff', breakText: '#4a4458', breakBorder: '#ebdcf9',
    cardBg: '#ffffff', itemBg: '#fdf7ff', accentBg: '#f5eeff',
  },
  'material-terracotta': {
    bg: '#fff8f5', text: '#370e00', mutedText: '#53433e', border: '#f8ded7', accent: '#77574e',
    headerBg: '#ffebd8', badgeBg: '#ffebd8', badgeText: '#984715',
    breakBg: '#fff8f5', breakText: '#53433e', breakBorder: '#f8ded7',
    cardBg: '#ffffff', itemBg: '#fff8f5', accentBg: '#ffebd8',
  },
  'material-dark': {
    bg: '#101412', text: '#e1e3df', mutedText: '#c0c9c2', border: '#2d322f', accent: '#a3d3ff',
    headerBg: '#182e22', badgeBg: '#182e22', badgeText: '#81d5a2',
    breakBg: '#101412', breakText: '#c0c9c2', breakBorder: '#2d322f',
    cardBg: '#1a1e1b', itemBg: '#101412', accentBg: '#182e22',
  },
};

export const ShareView: React.FC<ShareViewProps> = () => {
  const {
    state,
    saveHistory,
    showNotice,
    updateShareCustomConfig,
    updateShareFilters,
  } = useApp();

  const activeTheme = shareThemeColors[state.theme] || shareThemeColors.dimensio;

  const [searchTerm, setSearchTerm] = useState<string>(() => state.shareFilters?.searchTerm || '');
  const [selectedShifts, setSelectedShifts] = useState<string[]>(() => {
    if (Array.isArray(state.shareFilters?.selectedShifts) && state.shareFilters.selectedShifts.length > 0) {
      return state.shareFilters.selectedShifts;
    }
    return state.selectedShiftFilter && state.selectedShiftFilter !== 'ALL' && state.selectedShiftFilter !== 'todos'
      ? [state.selectedShiftFilter]
      : [];
  });

  const [viewMode, setViewMode] = useState<'export' | 'quick'>('export');
  const [copiedImage, setCopiedImage] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // Mobile & Image Export Configuration Controls with persistent state
  const [cardHeaderStyle, setCardHeaderStyle] = useState<TaskCardHeaderStyle>(() => {
    return state.shareCustomConfig?.cardHeaderStyle || 'subtle';
  });

  const [breakDisplay, setBreakDisplay] = useState<BreakDisplayMode>(() => {
    return state.shareCustomConfig?.breakDisplay || 'grouped';
  });

  const [isSlideFullscreen, setIsSlideFullscreen] = useState<boolean>(false);
  const quickSlideRef = useRef<HTMLDivElement>(null);

  // Quick 16:9 TV Presentation Config with persistent state
  const [quickConfig, setQuickConfig] = useState<QuickPresentationConfig>(() => {
    try {
      const saved = localStorage.getItem('dimensio_quick_16_9_config');
      if (saved) {
        return { ...DEFAULT_QUICK_CONFIG, ...JSON.parse(saved) };
      }
    } catch {}
    return DEFAULT_QUICK_CONFIG;
  });

  // Save quickConfig changes
  React.useEffect(() => {
    try {
      localStorage.setItem('dimensio_quick_16_9_config', JSON.stringify(quickConfig));
    } catch {}
  }, [quickConfig]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSlideFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [abbreviateNamesToggle, setAbbreviateNamesToggle] = useState<boolean>(() => {
    if (typeof state.shareCustomConfig?.abbreviateNamesToggle === 'boolean') {
      return state.shareCustomConfig.abbreviateNamesToggle;
    }
    return true;
  });

  const [hideEmptyTasks, setHideEmptyTasks] = useState<boolean>(() => {
    if (typeof state.shareCustomConfig?.hideEmptyTasks === 'boolean') {
      return state.shareCustomConfig.hideEmptyTasks;
    }
    return true;
  });

  const [includeDailyReport, setIncludeDailyReport] = useState<boolean>(() => {
    if (typeof state.shareCustomConfig?.includeDailyReport === 'boolean') {
      return state.shareCustomConfig.includeDailyReport;
    }
    return true;
  });

  const [footerNote, setFooterNote] = useState<string>(() => {
    return state.shareCustomConfig?.footerNote || '';
  });

  const [showRoles, setShowRoles] = useState<boolean>(() => {
    if (typeof state.shareCustomConfig?.showRoles === 'boolean') {
      return state.shareCustomConfig.showRoles;
    }
    return true;
  });

  const [showHeadcounts, setShowHeadcounts] = useState<boolean>(() => {
    if (typeof state.shareCustomConfig?.showHeadcounts === 'boolean') {
      return state.shareCustomConfig.showHeadcounts;
    }
    return true;
  });

  const [groupSubtasks, setGroupSubtasks] = useState<boolean>(() => {
    if (typeof state.shareCustomConfig?.groupSubtasks === 'boolean') {
      return state.shareCustomConfig.groupSubtasks;
    }
    return true; // Default to grouping subtasks under parent task to keep image compact
  });

  const [headerAlignment, setHeaderAlignment] = useState<'left' | 'center' | 'right'>(() => {
    return state.shareCustomConfig?.headerAlignment || 'left';
  });

  // Filters (same logic as briefing slide) - now using MultiSelectFilter with arrays
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => state.shareFilters?.selectedCategories || []);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(() => state.shareFilters?.selectedRoles || []);
  const [selectedTLs, setSelectedTLs] = useState<string[]>(() => state.shareFilters?.selectedTLs || []);

  // Auto-save visual and density customization options to state and localStorage
  React.useEffect(() => {
    const config = {
      cardHeaderStyle,
      breakDisplay,
      abbreviateNamesToggle,
      hideEmptyTasks,
      includeDailyReport,
      footerNote,
      showRoles,
      showHeadcounts,
      groupSubtasks,
      headerAlignment,
    };
    updateShareCustomConfig(config);
    try {
      localStorage.setItem('dimensio_share_custom_config', JSON.stringify(config));
    } catch {}
  }, [
    cardHeaderStyle,
    breakDisplay,
    abbreviateNamesToggle,
    hideEmptyTasks,
    includeDailyReport,
    footerNote,
    showRoles,
    showHeadcounts,
    groupSubtasks,
    headerAlignment,
  ]);

  // Auto-save filter preferences to state
  React.useEffect(() => {
    updateShareFilters({
      selectedShifts,
      selectedCategories,
      selectedRoles,
      selectedTLs,
      searchTerm,
    });
  }, [selectedShifts, selectedCategories, selectedRoles, selectedTLs, searchTerm]);

  const handleResetShareConfig = () => {
    setCardHeaderStyle('subtle');
    setBreakDisplay('grouped');
    setAbbreviateNamesToggle(true);
    setHideEmptyTasks(true);
    setIncludeDailyReport(true);
    setFooterNote('');
    setShowRoles(true);
    setShowHeadcounts(true);
    setGroupSubtasks(true);
    setHeaderAlignment('left');
    setSelectedCategories([]);
    setSelectedRoles([]);
    setSelectedTLs([]);
    setSearchTerm('');
    updateShareCustomConfig({
      cardHeaderStyle: 'subtle',
      breakDisplay: 'grouped',
      abbreviateNamesToggle: true,
      hideEmptyTasks: true,
      includeDailyReport: true,
      footerNote: '',
      showRoles: true,
      showHeadcounts: true,
      groupSubtasks: true,
      headerAlignment: 'left',
    });
    updateShareFilters({
      selectedShifts: [],
      selectedCategories: [],
      selectedRoles: [],
      selectedTLs: [],
      searchTerm: '',
    });
    localStorage.removeItem('dimensio_share_custom_config');
    showNotice('Opções de visualização e filtros restaurados para o padrão.');
  };

  const handleResetQuickConfig = () => {
    setQuickConfig(DEFAULT_QUICK_CONFIG);
    localStorage.removeItem('dimensio_quick_16_9_config');
    showNotice('Configurações do slide 16:9 restauradas para o padrão.');
  };

  const cardImageRef = useRef<HTMLDivElement>(null);

  const activeDate = state.selectedDate;
  const dayIntervals = state.intervals[activeDate] || {};

  // Unique metadata lists for filters
  const availableCategories = Array.from(new Set(state.collaborators.map((c) => c.category || 'Geral'))).filter(Boolean);
  const availableRoles = Array.from(new Set(state.collaborators.map((c) => c.role || 'Operador'))).filter(Boolean);
  const availableTLs = Array.from(new Set(state.collaborators.map((c) => c.teamLeader || state.defaultTeamLeader || 'Sem Time'))).filter(Boolean);
  const availableShifts = useMemo(() => {
    const customShifts = state.shifts || [];
    const collabShifts = Array.from(new Set(state.collaborators.map((c) => c.shift).filter(Boolean))) as string[];
    const combined = Array.from(new Set([...customShifts, ...collabShifts])).filter(Boolean);
    return combined.length > 0 ? combined : ['T1', 'T2', 'T3', 'ADM'];
  }, [state.shifts, state.collaborators]);

  const activeShift = state.selectedShiftFilter || state.teamShift || 'ALL';

  // Filter present people
  const presentPeople = state.collaborators.filter((c) => {
    const colShift = c.shift || 'Geral';
    if (selectedShifts.length > 0 && !selectedShifts.includes(colShift)) return false;
    if (selectedShifts.length === 0 && activeShift !== 'ALL' && activeShift !== 'todos' && colShift !== activeShift) return false;

    const hasAbsence = (c.absences || []).some((a) => activeDate >= a.startDate && activeDate <= a.endDate);
    if (hasAbsence) return false;
    const off = isScaleOff(state.calendar, activeDate, c.scale);
    if (off) return false;
    const manual = state.attendance[activeDate]?.[c.id];
    if (manual === false) return false;

    // Apply filters (array-based multi-select)
    if (selectedCategories.length > 0 && !selectedCategories.includes(c.category || 'Geral')) return false;
    if (selectedRoles.length > 0 && !selectedRoles.includes(c.role || 'Operador')) return false;
    if (selectedTLs.length > 0 && !selectedTLs.includes(c.teamLeader || state.defaultTeamLeader || 'Sem Time')) return false;
    if (searchTerm && !matchesSearch(c.name, searchTerm)) return false;

    return true;
  });

  const getBreakTime = (personId: string) => {
    const slot = (state.breaks || []).find((b) => (dayIntervals[b.id] || []).includes(personId));
    return slot ? slot.time : 'Sem Horário Definido';
  };

  const includeBreaks = breakDisplay !== 'none';

  // Distribuição dinâmica de nomes: nomes longos (sem abreviação) → 2 por linha;
  // nomes curtos (abreviados) e com quantidade suficiente → até 3 por linha.
  const memberGridClass = (count: number): string => {
    if (abbreviateNamesToggle && count >= 3) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
    return 'grid-cols-1 sm:grid-cols-2';
  };

  // Helper to group task members by break time slot
  const groupTaskMembersByBreakTime = (taskMembers: typeof state.collaborators) => {
    const map = new Map<string, typeof state.collaborators>();

    taskMembers.forEach((person) => {
      const time = getBreakTime(person.id);
      if (!map.has(time)) {
        map.set(time, []);
      }
      map.get(time)!.push(person);
    });

    const result: Array<{ timeLabel: string; members: typeof state.collaborators }> = [];
    map.forEach((members, timeLabel) => {
      result.push({ timeLabel, members });
    });

    result.sort((a, b) => {
      if (a.timeLabel.includes('Sem Horário')) return 1;
      if (b.timeLabel.includes('Sem Horário')) return -1;
      return a.timeLabel.localeCompare(b.timeLabel);
    });

    return result;
  };

  // Compute hierarchical task groups & member filtering
  const displayedTaskGroups = useMemo(() => {
    const rawGroups = getConsolidatedTaskGroups(state.tasks, true);

    return rawGroups
      .map((group) => {
        // Direct root members
        const directMembers = (group.rootTask.members || [])
          .map((id) => state.collaborators.find((c) => c.id === id))
          .filter((c): c is Collaborator => Boolean(c) && presentPeople.some((p) => p.id === c.id));

        // Subtasks with filtered members
        const filteredSubtasks = group.subtasks
          .map((sub) => {
            const members = (sub.members || [])
              .map((id) => state.collaborators.find((c) => c.id === id))
              .filter((c): c is Collaborator => Boolean(c) && presentPeople.some((p) => p.id === c.id));
            return {
              ...sub,
              filteredMembers: members,
            };
          })
          .filter((sub) => !hideEmptyTasks || sub.filteredMembers.length > 0);

        // All members consolidated (root + all subtasks)
        const allMembers = [
          ...directMembers,
          ...filteredSubtasks.flatMap((s) => s.filteredMembers),
        ];

        // Remove duplicate member IDs if any
        const uniqueAllMembers = Array.from(new Map(allMembers.map((m) => [m.id, m])).values());

        return {
          ...group,
          directMembers,
          filteredSubtasks,
          allFilteredMembers: uniqueAllMembers,
          totalPresentCount: uniqueAllMembers.length,
        };
      })
      .filter((g) => !hideEmptyTasks || g.totalPresentCount > 0);
  }, [state.tasks, state.collaborators, presentPeople, hideEmptyTasks]);

  // Legacy compatibility for simple flat task counts
  const displayedTasksCount = displayedTaskGroups.length;

  // Generate Image Download
  const handleDownloadImage = async () => {
    if (!cardImageRef.current) return;
    setIsGeneratingImage(true);
    try {
      showNotice('Gerando imagem de alta resolução...');
      const dataUrl = await captureCardPng(cardImageRef.current);

      const link = document.createElement('a');
      link.download = `Escala_Resumo_${(state.teamName || 'Equipe').replace(/\s+/g, '_')}_${activeDate}.png`;
      link.href = dataUrl;
      link.click();
      showNotice('Imagem baixada com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar a imagem. Tente novamente.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Copy Image to Clipboard directly
  const handleCopyImageToClipboard = async () => {
    if (!cardImageRef.current) return;
    setIsGeneratingImage(true);
    try {
      showNotice('Renderizando imagem para a área de transferência...');
      const dataUrl = await captureCardPng(cardImageRef.current);
      const blob = await (await fetch(dataUrl)).blob();
      if (!blob) {
        alert('Erro ao criar arquivo de imagem.');
        setIsGeneratingImage(false);
        return;
      }
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        setCopiedImage(true);
        showNotice('Imagem copiada para a área de transferência!');
        setTimeout(() => setCopiedImage(false), 2500);
      } catch {
        // Fallback if clipboard item is unsupported
        handleDownloadImage();
      } finally {
        setIsGeneratingImage(false);
      }
    } catch (err) {
      console.error(err);
      setIsGeneratingImage(false);
    }
  };

  const handleDownloadImage169 = async () => {
    if (!quickSlideRef.current) return;
    setIsGeneratingImage(true);
    try {
      showNotice('Renderizando imagem 16:9 em alta resolução...');
      await document.fonts.ready;

      const activeQuickTheme = resolvePresentationTheme(quickConfig.theme);
      const dataUrl = await toPng(quickSlideRef.current, {
        pixelRatio: 3,
        backgroundColor: activeQuickTheme.bg,
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

  const handleCopyImage169 = async () => {
    if (!quickSlideRef.current) return;
    setIsGeneratingImage(true);
    try {
      showNotice('Renderizando imagem 16:9 para a área de transferência...');
      await document.fonts.ready;

      const activeQuickTheme = resolvePresentationTheme(quickConfig.theme);
      const dataUrl = await toPng(quickSlideRef.current, {
        pixelRatio: 3,
        backgroundColor: activeQuickTheme.bg,
        cacheBust: true,
      });

      const blob = await (await fetch(dataUrl)).blob();
      if (!blob) {
        alert('Erro ao processar imagem.');
        setIsGeneratingImage(false);
        return;
      }

      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        setCopiedImage(true);
        showNotice('Imagem 16:9 copiada! Você já pode colar no Teams ou WhatsApp.');
        setTimeout(() => setCopiedImage(false), 2500);
      } catch {
        // Fallback to download
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

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* TOP CONTROL PANEL */}
      <div className="no-print space-y-4">
        <PageHeader
          icon={viewMode === 'export' ? Smartphone : Tv}
          title="Resumo para Compartilhar & Escala"
          subtitle={
            viewMode === 'export'
              ? 'Resumo operacional para exportação mobile e impressão'
              : 'Apresentação operacional 16:9 para TV'
          }
          meta={<Badge tone="success" dot>{presentPeople.length} Presentes</Badge>}
          actions={
            <>
              <Tabs
                items={[
                  { value: 'export', label: 'Mobile', icon: Smartphone },
                  { value: 'quick', label: '16:9 TV', icon: Tv },
                ]}
                value={viewMode}
                onChange={(v) => setViewMode(v as 'export' | 'quick')}
              />
              <Button variant="outline" size="sm" icon={Printer} onClick={handlePrint}>
                Imprimir / PDF
              </Button>
              <Button variant="secondary" size="sm" icon={History} onClick={saveHistory}>
                Salvar Histórico
              </Button>
              {viewMode === 'export' ? (
                <>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Download}
                    disabled={isGeneratingImage}
                    onClick={handleDownloadImage}
                  >
                    {isGeneratingImage ? 'Gerando...' : 'Baixar PNG'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={copiedImage ? Check : Copy}
                    disabled={isGeneratingImage}
                    onClick={handleCopyImageToClipboard}
                    title="Copia a imagem para colar diretamente no Teams ou outros apps"
                  >
                    {copiedImage ? 'Imagem Copiada!' : 'Copiar Imagem'}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Maximize2}
                    onClick={() => setIsSlideFullscreen(true)}
                    title="Apresentar em tela cheia na TV"
                  >
                    Modo TV
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Download}
                    disabled={isGeneratingImage}
                    onClick={handleDownloadImage169}
                    title="Exportar slide 16:9 em alta definição"
                  >
                    {isGeneratingImage ? 'Gerando...' : 'Baixar Imagem 16:9'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={copiedImage ? Check : Copy}
                    disabled={isGeneratingImage}
                    onClick={handleCopyImage169}
                    title="Copiar slide 16:9 para a área de transferência"
                  >
                    {copiedImage ? 'Imagem Copiada!' : 'Copiar Imagem 16:9'}
                  </Button>
                </>
              )}
            </>
          }
        />

        {/* ROW 2: CONTROLS GRID (Customizations & Configs for Active Mode) */}
        <Card>
          <CardHeader
            icon={<SlidersHorizontal className="w-4.5 h-4.5" />}
            title={
              viewMode === 'export'
                ? 'Opções do Gerador de Imagem & Briefing Mobile'
                : 'Personalização da Apresentação 16:9 (TV)'
            }
            subtitle={<Badge tone="success" dot>Salvo e sincronizado</Badge>}
            actions={
              viewMode === 'export' ? (
                <Button variant="ghost" size="xs" onClick={handleResetShareConfig}>
                  Restaurar Padrão
                </Button>
              ) : (
                <Button variant="ghost" size="xs" onClick={handleResetQuickConfig}>
                  Restaurar Padrão
                </Button>
              )
            }
          />
          <CardBody className="mt-3.5">
            {viewMode === 'export' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* 1. Estilo & Layout dos Cards */}
                <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-3.5 space-y-3">
                  <SectionHeader
                    icon={<Clock className="w-3.5 h-3.5" />}
                    title="Estilo dos Cards & Intervalos"
                  />
                  <Field label="Estilo dos Cards (Cabeçalho)">
                    <Select
                      value={cardHeaderStyle}
                      onChange={(e) => setCardHeaderStyle(e.target.value as TaskCardHeaderStyle)}
                    >
                      <option value="banner">Banner em Destaque</option>
                      <option value="subtle">Suave com Fundo do Tema</option>
                      <option value="minimal">Minimalista com Linha Inferior</option>
                    </Select>
                  </Field>
                  <Field label="Exibição dos Intervalos">
                    <Select
                      value={breakDisplay}
                      onChange={(e) => setBreakDisplay(e.target.value as BreakDisplayMode)}
                    >
                      <option value="grouped">Agrupar por Horário de Intervalo</option>
                      <option value="badge">Badge junto ao Nome do Colaborador</option>
                      <option value="none">Ocultar Intervalos no Resumo</option>
                    </Select>
                  </Field>
                  <div>
                    <span className="block text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)] mb-1.5">
                      Alinhamento
                    </span>
                    <Tabs
                      items={[
                        { value: 'left', label: 'Esquerda' },
                        { value: 'center', label: 'Centro' },
                        { value: 'right', label: 'Direita' },
                      ]}
                      value={headerAlignment}
                      onChange={(v) => setHeaderAlignment(v as 'left' | 'center' | 'right')}
                    />
                  </div>
                </div>

                {/* 2. Elementos Visíveis (Consolidado) */}
                <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-3.5 space-y-3">
                  <SectionHeader icon={<Layers className="w-3.5 h-3.5" />} title="Elementos Visíveis" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5">
                    <Toggle checked={showRoles} onChange={setShowRoles} label="Exibir cargos" />
                    <Toggle checked={showHeadcounts} onChange={setShowHeadcounts} label="Contador de pessoas" />
                    <Toggle checked={groupSubtasks} onChange={setGroupSubtasks} label="Agrupar subtarefas" />
                    <Toggle checked={hideEmptyTasks} onChange={setHideEmptyTasks} label="Ocultar tarefas vazias" />
                    <Toggle checked={abbreviateNamesToggle} onChange={setAbbreviateNamesToggle} label="Abreviar nomes" />
                  </div>
                </div>

                {/* 3. Aviso no rodapé (opcional) */}
                <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-3.5 space-y-3">
                  <SectionHeader
                    icon={<ShieldCheck className="w-3.5 h-3.5" />}
                    title="Aviso no rodapé (opcional)"
                  />
                  <Field hint="Deixe em branco para ocultar o rodapé e encurtar a imagem. Suporta formatação Markdown e quebras de linha.">
                    <Textarea
                      value={footerNote}
                      onChange={(e) => setFooterNote(e.target.value)}
                      rows={2}
                      placeholder="Ex.: Obrigatório o uso de EPIs completos no turno... (Suporta **negrito**, listas e quebras de linha)"
                    />
                  </Field>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* 1. Tema & Apresentação */}
                <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-3.5 space-y-3">
                  <SectionHeader
                    icon={<LayoutGrid className="w-3.5 h-3.5" />}
                    title="Tema Visual 16:9"
                    right={
                      quickConfig.theme !== 'system' ? (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setQuickConfig((prev) => ({ ...prev, theme: 'system' }))}
                        >
                          Padrão App
                        </Button>
                      ) : undefined
                    }
                  />
                  <Field label="Tema">
                    <Select
                      value={quickConfig.theme}
                      onChange={(e) =>
                        setQuickConfig((prev) => ({ ...prev, theme: e.target.value as PresentationTheme }))
                      }
                    >
                      {Object.entries(presentationThemeStyles).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Densidade">
                      <Select
                        value={quickConfig.density}
                        onChange={(e) =>
                          setQuickConfig((prev) => ({ ...prev, density: e.target.value as DensityMode }))
                        }
                      >
                        <option value="auto">Auto Inteligente</option>
                        <option value="compact">Compacto</option>
                        <option value="normal">Normal</option>
                        <option value="comfortable">Confortável</option>
                        <option value="spacious">Amplo TV</option>
                      </Select>
                    </Field>
                    <Field label="Fonte / Escala">
                      <Select
                        value={quickConfig.fontSize || 'auto'}
                        onChange={(e) =>
                          setQuickConfig((prev) => ({ ...prev, fontSize: e.target.value as FontSizePreset }))
                        }
                      >
                        <option value="auto">Auto</option>
                        <option value="xs">Pequena (80%)</option>
                        <option value="sm">Média (90%)</option>
                        <option value="md">Padrão (100%)</option>
                        <option value="lg">Grande (115%)</option>
                        <option value="xl">Extra (130%)</option>
                        <option value="2xl">TV Gigante (150%)</option>
                      </Select>
                    </Field>
                  </div>
                </div>

                {/* 2. Elementos Visíveis (Consolidado) */}
                <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-3.5 space-y-3">
                  <SectionHeader icon={<Layers className="w-3.5 h-3.5" />} title="Elementos Visíveis" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5">
                    <Toggle
                      checked={quickConfig.showRoles}
                      onChange={(checked) => setQuickConfig((prev) => ({ ...prev, showRoles: checked }))}
                      label="Exibir cargos"
                    />
                    <Toggle
                      checked={quickConfig.showHeadcounts}
                      onChange={(checked) => setQuickConfig((prev) => ({ ...prev, showHeadcounts: checked }))}
                      label="Contador de pessoas"
                    />
                    <Toggle
                      checked={quickConfig.groupSubtasks}
                      onChange={(checked) => setQuickConfig((prev) => ({ ...prev, groupSubtasks: checked }))}
                      label="Agrupar subtarefas"
                    />
                    <Toggle
                      checked={quickConfig.hideEmptyTasks}
                      onChange={(checked) => setQuickConfig((prev) => ({ ...prev, hideEmptyTasks: checked }))}
                      label="Ocultar tarefas vazias"
                    />
                    <Toggle
                      checked={quickConfig.abbreviateNames}
                      onChange={(checked) => setQuickConfig((prev) => ({ ...prev, abbreviateNames: checked }))}
                      label="Abreviar nomes"
                    />
                    <Toggle
                      checked={quickConfig.showMetricsBar}
                      onChange={(checked) => setQuickConfig((prev) => ({ ...prev, showMetricsBar: checked }))}
                      label="Barra de presença"
                    />
                    <Toggle
                      checked={quickConfig.stretchItems ?? true}
                      onChange={(checked) => setQuickConfig((prev) => ({ ...prev, stretchItems: checked }))}
                      label="Expandir no espaço"
                    />
                  </div>
                </div>

                {/* 3. Intervalos e Aviso */}
                <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-3.5 space-y-3">
                  <SectionHeader
                    icon={<ShieldCheck className="w-3.5 h-3.5" />}
                    title="Intervalos & Mensagem de Foco"
                  />
                  <Field label="Exibição dos Intervalos">
                    <Select
                      value={quickConfig.breakDisplay}
                      onChange={(e) =>
                        setQuickConfig((prev) => ({
                          ...prev,
                          breakDisplay: e.target.value as BreakDisplayMode,
                        }))
                      }
                    >
                      <option value="grouped">Agrupar por Horário de Intervalo</option>
                      <option value="badge">Badge junto ao Nome do Colaborador</option>
                      <option value="none">Ocultar Intervalos no Slide</option>
                    </Select>
                  </Field>
                  <Field label="Aviso / Foco do Turno">
                    <Textarea
                      rows={2}
                      value={quickConfig.footerNote}
                      onChange={(e) => setQuickConfig((prev) => ({ ...prev, footerNote: e.target.value }))}
                      placeholder="Ex: Foco em Segurança e Agilidade no Turno... (Suporta **negrito** e quebra de linha)"
                    />
                  </Field>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        {/* ROW 3: STANDARDIZED MULTI-SELECT FILTERS BAR (FOR BOTH MODES) */}
        <Card>
          <Toolbar>
            <MultiSelectFilter
              label="Turno"
              options={availableShifts.map((sh) => ({ label: `Turno ${sh}`, value: sh }))}
              selectedValues={selectedShifts}
              onChange={setSelectedShifts}
              placeholder="Todos os turnos"
              allLabel="Todos os Turnos"
              className="flex-1 min-w-[170px]"
            />

            <MultiSelectFilter
              label="Time / TL"
              options={availableTLs.map((tl) => ({ label: tl, value: tl }))}
              selectedValues={selectedTLs}
              onChange={setSelectedTLs}
              placeholder="Todos os times"
              allLabel="Todos os Times"
              icon={<Users className="w-3 h-3 text-[var(--primary)]" />}
              className="flex-1 min-w-[170px]"
            />

            <MultiSelectFilter
              label="Cargo"
              options={availableRoles.map((role) => ({ label: role, value: role }))}
              selectedValues={selectedRoles}
              onChange={setSelectedRoles}
              placeholder="Todos os cargos"
              allLabel="Todos os Cargos"
              icon={<Briefcase className="w-3 h-3 text-[var(--primary)]" />}
              className="flex-1 min-w-[170px]"
            />

            <MultiSelectFilter
              label="Categoria"
              options={availableCategories.map((cat) => ({ label: cat, value: cat }))}
              selectedValues={selectedCategories}
              onChange={setSelectedCategories}
              placeholder="Todas as categorias"
              allLabel="Todas as Categorias"
              icon={<Tag className="w-3 h-3 text-[var(--primary)]" />}
              className="flex-1 min-w-[170px]"
            />

            <div className="flex-1 min-w-[200px] max-w-xs">
              <SearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Pesquisar colaborador..."
                className="w-full"
              />
            </div>
          </Toolbar>
        </Card>
      </div>

      {viewMode === 'export' && (
        <>

      {/* IMAGE PREVIEW & HIGH-RESOLUTION CANVAS STAGE */}
      <div className="bg-[var(--surface-2)] p-3 sm:p-6 rounded-2xl border border-[var(--line)] flex justify-center overflow-x-auto w-full min-w-0">
        <div
          ref={cardImageRef}
          id="share-card-export"
          className="p-6 rounded-2xl shadow-[var(--shadow-card)] space-y-5 transition-colors duration-200 w-full max-w-[1000px] min-w-0"
          style={{
            backgroundColor: 'var(--bg)',
            color: 'var(--ink)',
            border: '1.5px solid var(--line)',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            boxSizing: 'border-box',
          }}
        >
          {/* HEADER SECTION */}
          <div
            className={`rounded-xl border text-center ${footerNote.trim() ? 'p-3' : 'p-2.5'}`}
            style={{
              background: activeTheme.headerBg,
              borderColor: activeTheme.border,
              boxSizing: 'border-box',
            }}
          >
            <h2
              className="font-black tracking-tight"
              style={{ color: activeTheme.text, lineHeight: '1.2', fontSize: footerNote.trim() ? '1.5rem' : '1.25rem' }}
            >
              {state.teamName || 'ESCALA OPERACIONAL DE TRABALHO'}
            </h2>

            <div className="flex items-center justify-center gap-2 mt-1" style={{ color: activeTheme.mutedText }}>
              <span className="text-[11px] font-bold">{formatDateLongBR(activeDate)}</span>
              <span className="text-[10px] opacity-60">•</span>
              <span className="text-[11px] font-bold">Turno {state.teamShift || 'T2'}</span>
              <span className="text-[10px] opacity-60">•</span>
              <span className="text-[11px] font-bold">{state.sector || 'Operacional'}</span>
              <span
                className="px-2 py-0.5 rounded-md border font-black text-[10px]"
                style={{
                  backgroundColor: activeTheme.badgeBg,
                  color: activeTheme.badgeText,
                  borderColor: activeTheme.border,
                  lineHeight: '1.4',
                }}
              >
                {presentPeople.length} Presentes
              </span>
            </div>
          </div>

          {/* SECTION 1: TASKS ALLOCATION */}
          <div className="space-y-3" style={{ boxSizing: 'border-box' }}>
            <div
              className="text-xs font-black uppercase tracking-wider pb-1.5 border-b flex items-center justify-between"
              style={{
                color: activeTheme.accent,
                borderColor: activeTheme.border,
                lineHeight: '1.4',
              }}
            >
              <div className="flex items-center gap-1.5">
                <FolderTree className="w-3.5 h-3.5" />
                <span>Dimensionamento de Postos de Trabalho</span>
              </div>
              <span className="text-[10px]" style={{ color: activeTheme.mutedText }}>
                {displayedTaskGroups.length} {displayedTaskGroups.length === 1 ? 'Grupo Principal' : 'Grupos Principais'}
                {groupSubtasks && ' • Subtarefas Agrupadas'}
              </span>
            </div>

            <div className="columns-1 md:columns-2 gap-3">
              {displayedTaskGroups.map((group) => {
                const rootTask = group.rootTask;

                return (
                  <div
                    key={rootTask.id}
                    className="p-3 rounded-2xl border space-y-2.5 shadow-sm break-inside-avoid mb-3 overflow-hidden"
                    style={{
                      backgroundColor: activeTheme.cardBg,
                      borderColor: activeTheme.border,
                      boxSizing: 'border-box',
                    }}
                  >
                    {/* Task Header with Background Highlight */}
                    <div
                      className={`flex items-center px-3 py-2 ${
                        cardHeaderStyle === 'banner'
                          ? 'rounded-xl shadow-xs'
                          : cardHeaderStyle === 'subtle'
                          ? 'rounded-xl border'
                          : 'border-b pb-1.5'
                      } ${
                        headerAlignment === 'center'
                          ? 'justify-center text-center gap-2'
                          : headerAlignment === 'right'
                          ? 'justify-end text-right gap-2'
                          : 'justify-between text-left gap-2'
                      }`}
                      style={{
                        backgroundColor:
                          cardHeaderStyle === 'banner'
                            ? activeTheme.accent
                            : cardHeaderStyle === 'subtle'
                            ? activeTheme.headerBg
                            : 'transparent',
                        borderColor: activeTheme.border,
                      }}
                    >
                      <div className="min-w-0">
                        <h4
                          className="font-black text-xs uppercase tracking-wide pr-1"
                          style={{
                            color: cardHeaderStyle === 'banner' ? '#ffffff' : activeTheme.text,
                            lineHeight: '1.3',
                          }}
                        >
                          {rootTask.name}
                        </h4>
                        {!groupSubtasks && group.subtasks.length > 0 && (
                          <span
                            className="text-[9px] font-bold block"
                            style={{
                              color:
                                cardHeaderStyle === 'banner'
                                  ? 'rgba(255,255,255,0.8)'
                                  : activeTheme.mutedText,
                            }}
                          >
                            {group.subtasks.length} {group.subtasks.length === 1 ? 'subdivisão vinculada' : 'subdivisões vinculadas'}
                          </span>
                        )}
                      </div>
                      {showHeadcounts && (
                        <span
                          className="px-2.5 py-0.5 rounded-full text-xs font-black shrink-0 shadow-sm"
                          style={{
                            backgroundColor:
                              cardHeaderStyle === 'banner'
                                ? 'rgba(255,255,255,0.2)'
                                : activeTheme.badgeBg,
                            color: cardHeaderStyle === 'banner' ? '#ffffff' : activeTheme.badgeText,
                            border: `1px solid ${
                              cardHeaderStyle === 'banner'
                                ? 'rgba(255,255,255,0.3)'
                                : activeTheme.border
                            }`,
                            lineHeight: '1.3',
                          }}
                        >
                          {group.totalPresentCount}
                        </span>
                      )}
                    </div>

                    {/* Task Collaborators */}
                    <div className="space-y-2">
                      {groupSubtasks ? (
                        /* MODO AGRUPADO: Todos os colaboradores no card da tarefa pai */
                        group.allFilteredMembers.length > 0 ? (
                          breakDisplay === 'grouped' ? (
                            <div className="space-y-2.5">
                              {groupTaskMembersByBreakTime(group.allFilteredMembers).map((g) => (
                                <div key={g.timeLabel} className="space-y-1.5">
                                  <div
                                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                      headerAlignment === 'center'
                                        ? 'justify-center text-center'
                                        : headerAlignment === 'right'
                                        ? 'justify-end text-right'
                                        : 'justify-start text-left'
                                    }`}
                                    style={{
                                      backgroundColor: activeTheme.breakBg,
                                      color: activeTheme.breakText,
                                      border: `1px solid ${activeTheme.breakBorder}`,
                                      lineHeight: '1.3',
                                      boxSizing: 'border-box',
                                    }}
                                  >
                                    <Clock className="w-3 h-3 shrink-0 opacity-90" />
                                    <span className="font-extrabold tracking-wide">{g.timeLabel}</span>
                                    {showHeadcounts && (
                                      <span className="ml-auto font-black px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/10" style={{ color: activeTheme.breakText }}>
                                        {g.members.length}
                                      </span>
                                    )}
                                  </div>
                                  <div className={`grid ${memberGridClass(g.members.length)} gap-1.5`}>
                                    {g.members.map((m) => {
                                      const displayName = abbreviateNamesToggle
                                        ? abbreviateName(m.name, true)
                                        : m.name;

                                      return (
                                        <div
                                          key={m.id}
                                          className="p-2 rounded-xl border text-xs"
                                          style={{
                                            backgroundColor: activeTheme.itemBg,
                                            borderColor: activeTheme.border,
                                            boxSizing: 'border-box',
                                          }}
                                        >
                                          <div className="min-w-0">
                                            <span
                                              className={`font-black block truncate ${
                                                showRoles ? 'text-xs' : 'text-sm py-0.5'
                                              }`}
                                              style={{ color: activeTheme.text, lineHeight: '1.4' }}
                                            >
                                              {displayName}
                                            </span>
                                            {showRoles && (
                                              <span
                                                className="text-[10px] block font-medium truncate"
                                                style={{ color: activeTheme.mutedText, lineHeight: '1.3' }}
                                              >
                                                {m.role || 'Operador'}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className={`grid ${memberGridClass(group.allFilteredMembers.length)} gap-1.5`}>
                              {group.allFilteredMembers.map((m) => {
                                const displayName = abbreviateNamesToggle
                                  ? abbreviateName(m.name, true)
                                  : m.name;

                                return (
                                  <div
                                    key={m.id}
                                    className="p-2 rounded-xl border text-xs flex items-center justify-between gap-1.5"
                                    style={{
                                      backgroundColor: activeTheme.itemBg,
                                      borderColor: activeTheme.border,
                                      boxSizing: 'border-box',
                                    }}
                                  >
                                    <div className="min-w-0 flex-1">
                                      <span
                                        className={`font-black block truncate ${
                                          showRoles ? 'text-xs' : 'text-sm py-0.5'
                                        }`}
                                        style={{ color: activeTheme.text, lineHeight: '1.4' }}
                                      >
                                        {displayName}
                                      </span>
                                      {showRoles && (
                                        <span
                                          className="text-[10px] block font-medium truncate"
                                          style={{ color: activeTheme.mutedText, lineHeight: '1.3' }}
                                        >
                                          {m.role || 'Operador'}
                                        </span>
                                      )}
                                    </div>
                                    {(() => {
                                      const bTime = getBreakTime(m.id);
                                      if (breakDisplay !== 'badge' || bTime === 'Sem Horário Definido') return null;
                                      return (
                                        <span
                                          className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1"
                                          style={{
                                            backgroundColor: activeTheme.breakBg,
                                            color: activeTheme.breakText,
                                            border: `1px solid ${activeTheme.breakBorder}`,
                                          }}
                                        >
                                          <Clock className="w-2.5 h-2.5 opacity-80" />
                                          {bTime}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                );
                              })}
                            </div>
                          )
                        ) : (
                          <p className="text-[10px] italic p-1 text-center" style={{ color: activeTheme.mutedText }}>
                            Nenhum colaborador atribuído.
                          </p>
                        )
                      ) : (
                        /* MODO HIERÁRQUICO: Exibe Posto Principal e Subdivisões separadas */
                        <div className="space-y-3">
                          {/* Direct Members */}
                          {group.directMembers.length > 0 && (
                            <div className="space-y-1.5">
                              {group.filteredSubtasks.length > 0 && (
                                <span className="text-[10px] font-black uppercase tracking-wider block opacity-75" style={{ color: activeTheme.mutedText }}>
                                  Posto Principal
                                </span>
                              )}
                              {breakDisplay === 'grouped' ? (
                                <div className="space-y-2">
                                  {groupTaskMembersByBreakTime(group.directMembers).map((g) => (
                                    <div key={g.timeLabel} className="space-y-1">
                                      <div
                                        className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider"
                                        style={{
                                          backgroundColor: activeTheme.breakBg,
                                          color: activeTheme.breakText,
                                          border: `1px solid ${activeTheme.breakBorder}`,
                                        }}
                                      >
                                        <Clock className="w-2.5 h-2.5 shrink-0 opacity-90" />
                                        <span className="font-extrabold tracking-wide">{g.timeLabel}</span>
                                        <span className="ml-auto font-black px-1 py-0.2 rounded bg-black/5 dark:bg-white/10">{g.members.length}</span>
                                      </div>
                                      <div className={`grid ${memberGridClass(g.members.length)} gap-1.5`}>
                                        {g.members.map((m) => (
                                          <div
                                            key={m.id}
                                            className="p-1.5 rounded-lg border text-xs"
                                            style={{ backgroundColor: activeTheme.itemBg, borderColor: activeTheme.border }}
                                          >
                                            <span className="font-black block truncate" style={{ color: activeTheme.text }}>
                                              {abbreviateNamesToggle ? abbreviateName(m.name, true) : m.name}
                                            </span>
                                            {showRoles && (
                                              <span className="text-[9px] block truncate" style={{ color: activeTheme.mutedText }}>
                                                {m.role || 'Operador'}
                                              </span>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className={`grid ${memberGridClass(group.directMembers.length)} gap-1.5`}>
                                  {group.directMembers.map((m) => (
                                    <div
                                      key={m.id}
                                      className="p-1.5 rounded-lg border text-xs flex items-center justify-between gap-1"
                                      style={{ backgroundColor: activeTheme.itemBg, borderColor: activeTheme.border }}
                                    >
                                      <div className="min-w-0 flex-1">
                                        <span className="font-black block truncate" style={{ color: activeTheme.text }}>
                                          {abbreviateNamesToggle ? abbreviateName(m.name, true) : m.name}
                                        </span>
                                        {showRoles && (
                                          <span className="text-[9px] block truncate" style={{ color: activeTheme.mutedText }}>
                                            {m.role || 'Operador'}
                                          </span>
                                        )}
                                      </div>
                                      {(() => {
                                        const bTime = getBreakTime(m.id);
                                        if (breakDisplay !== 'badge' || bTime === 'Sem Horário Definido') return null;
                                        return (
                                          <span
                                            className="text-[8px] font-bold px-1 py-0.2 rounded shrink-0 flex items-center gap-0.5"
                                            style={{
                                              backgroundColor: activeTheme.breakBg,
                                              color: activeTheme.breakText,
                                              border: `1px solid ${activeTheme.breakBorder}`,
                                            }}
                                          >
                                            <Clock className="w-2 h-2 opacity-80" />
                                            {bTime}
                                          </span>
                                        );
                                      })()}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Subtasks */}
                          {group.filteredSubtasks.map((sub) => (
                            <div
                              key={sub.id}
                              className="pl-2 border-l-2 space-y-1.5 pt-1"
                              style={{ borderColor: activeTheme.accent }}
                            >
                              <div className="flex items-center justify-between gap-1 text-[10px] font-black uppercase">
                                <span className="flex items-center gap-1" style={{ color: activeTheme.text }}>
                                  <CornerDownRight className="w-3 h-3 text-indigo-500 shrink-0" />
                                  {sub.name}
                                </span>
                                {showHeadcounts && (
                                  <span className="px-1.5 py-0.2 rounded-full text-[9px]" style={{ backgroundColor: activeTheme.badgeBg, color: activeTheme.badgeText }}>
                                    {sub.filteredMembers.length}
                                  </span>
                                )}
                              </div>

                              {breakDisplay === 'grouped' ? (
                                <div className="space-y-1.5">
                                  {groupTaskMembersByBreakTime(sub.filteredMembers).map((g) => (
                                    <div key={g.timeLabel} className="space-y-1">
                                      <div
                                        className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider"
                                        style={{
                                          backgroundColor: activeTheme.breakBg,
                                          color: activeTheme.breakText,
                                          border: `1px solid ${activeTheme.breakBorder}`,
                                        }}
                                      >
                                        <Clock className="w-2.5 h-2.5 shrink-0 opacity-90" />
                                        <span className="font-extrabold tracking-wide">{g.timeLabel}</span>
                                        <span className="ml-auto font-black px-1 py-0.2 rounded bg-black/5 dark:bg-white/10">{g.members.length}</span>
                                      </div>
                                      <div className={`grid ${memberGridClass(g.members.length)} gap-1`}>
                                        {g.members.map((m) => (
                                          <div
                                            key={m.id}
                                            className="p-1.5 rounded-lg border text-xs"
                                            style={{ backgroundColor: activeTheme.itemBg, borderColor: activeTheme.border }}
                                          >
                                            <span className="font-black block truncate" style={{ color: activeTheme.text }}>
                                              {abbreviateNamesToggle ? abbreviateName(m.name, true) : m.name}
                                            </span>
                                            {showRoles && (
                                              <span className="text-[9px] block truncate" style={{ color: activeTheme.mutedText }}>
                                                {m.role || 'Operador'}
                                              </span>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className={`grid ${memberGridClass(sub.filteredMembers.length)} gap-1`}>
                                  {sub.filteredMembers.map((m) => (
                                    <div
                                      key={m.id}
                                      className="p-1.5 rounded-lg border text-xs flex items-center justify-between gap-1"
                                      style={{ backgroundColor: activeTheme.itemBg, borderColor: activeTheme.border }}
                                    >
                                      <div className="min-w-0 flex-1">
                                        <span className="font-black block truncate" style={{ color: activeTheme.text }}>
                                          {abbreviateNamesToggle ? abbreviateName(m.name, true) : m.name}
                                        </span>
                                        {showRoles && (
                                          <span className="text-[9px] block truncate" style={{ color: activeTheme.mutedText }}>
                                            {m.role || 'Operador'}
                                          </span>
                                        )}
                                      </div>
                                      {(() => {
                                        const bTime = getBreakTime(m.id);
                                        if (breakDisplay !== 'badge' || bTime === 'Sem Horário Definido') return null;
                                        return (
                                          <span
                                            className="text-[8px] font-bold px-1 py-0.2 rounded shrink-0 flex items-center gap-0.5"
                                            style={{
                                              backgroundColor: activeTheme.breakBg,
                                              color: activeTheme.breakText,
                                              border: `1px solid ${activeTheme.breakBorder}`,
                                            }}
                                          >
                                            <Clock className="w-2 h-2 opacity-80" />
                                            {bTime}
                                          </span>
                                        );
                                      })()}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}

                          {group.directMembers.length === 0 && group.filteredSubtasks.length === 0 && (
                            <p className="text-[10px] italic p-1 text-center" style={{ color: activeTheme.mutedText }}>
                              Nenhum colaborador atribuído.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>



          {/* FOOTER & OPTIONAL NOTICE */}
          {footerNote.trim() && (
            <div
              className="pt-3 border-t space-y-1 text-center text-[10px]"
              style={{ borderColor: activeTheme.border, boxSizing: 'border-box' }}
            >
              <div
                className="p-2.5 rounded-xl font-bold flex items-center justify-center text-center"
                style={{
                  backgroundColor: activeTheme.accentBg,
                  color: activeTheme.accent,
                  border: `1px solid ${activeTheme.border}`,
                  lineHeight: '1.4',
                }}
              >
                <div className="w-full text-center">
                  <MarkdownContent content={footerNote} sizeClass="text-xs font-bold leading-relaxed" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      </>
      )}

      {/* QUICK VIEW - SLIDE-LIKE 16:9 PRESENTATION */}
      {viewMode === 'quick' && (
        <QuickPresentationView169
          hideControls={true}
          config={quickConfig}
          onConfigChange={setQuickConfig}
          isFullscreen={isSlideFullscreen}
          onFullscreenChange={setIsSlideFullscreen}
          slideRef={quickSlideRef}
          selectedShifts={selectedShifts}
          selectedTLs={selectedTLs}
          selectedRoles={selectedRoles}
          selectedCategories={selectedCategories}
          searchTerm={searchTerm}
        />
      )}

      {/* SAVED HISTORY LIST */}
      <div className="no-print">
        <Card>
          <CardHeader
            icon={<History className="w-4.5 h-4.5" />}
            title={`Histórico de Resumos Salvos (${state.history.length})`}
          />
          <CardBody className="mt-3">
            {state.history.length > 0 ? (
              <ul className="divide-y divide-[var(--line)] text-xs">
                {state.history
                  .slice()
                  .reverse()
                  .map((h) => (
                    <li key={h.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-[var(--ink)]">{h.date}</span>
                        <span className="text-[var(--muted)] ml-2">
                          ({h.peoplePresent} presentes, {h.peopleVacation} férias,{' '}
                          {h.peopleLeave + h.peopleTraining} licença/trein.)
                        </span>
                      </div>
                      <span className="text-[10px] text-[var(--muted)] shrink-0">{h.timestamp}</span>
                    </li>
                  ))}
              </ul>
            ) : (
              <EmptyState
                icon={History}
                title="Nenhum resumo salvo"
                description={`Nenhum resumo salvo no histórico local ainda. Clique em "Salvar Histórico" para registrar o dia.`}
              />
            )}
          </CardBody>
        </Card>
      </div>

      {/* PRINT-ONLY CONTAINER FOR SHARE VIEW PDF GENERATION */}
      <div className="hidden print:block print-container p-4 space-y-6 text-slate-900 bg-white font-sans">
        {/* PAGE 1: SLIDE DE ESCALA & DIMENSIONAMENTO */}
        <div className="w-full border border-slate-300 rounded-2xl p-6 bg-white space-y-4 page-break-inside-avoid">
          <div className="flex items-center justify-between border-b border-slate-300 pb-3">
            <div>
              <h2 className="text-xl font-black uppercase text-slate-900 tracking-wide">
                {state.teamName || 'ESCALA OPERACIONAL DE TRABALHO'}
              </h2>
              <p className="text-xs font-bold text-slate-600">
                {formatDateLongBR(activeDate)} • Turno {state.teamShift || 'T2'} • {state.sector || 'Operacional'}
              </p>
            </div>
            <div className="text-right">
              <span className="px-3 py-1 bg-slate-100 border border-slate-300 rounded-lg text-xs font-black text-slate-800">
                {presentPeople.length} Presentes / {displayedTaskGroups.reduce((n, g) => n + g.totalPresentCount, 0)} Alocados
              </span>
            </div>
          </div>

          {/* TASKS GRID WITH BREAK TIMES */}
          <div className="grid grid-cols-2 gap-4">
            {displayedTaskGroups.map((group) => {
              const rootTask = group.rootTask;
              const membersToDisplay = groupSubtasks ? group.allFilteredMembers : group.directMembers;

              return (
                <div key={rootTask.id} className="border border-slate-300 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg">
                    <div>
                      <h4 className="font-black text-xs uppercase text-slate-900">{rootTask.name}</h4>
                      {!groupSubtasks && group.subtasks.length > 0 && (
                        <span className="text-[9px] font-bold text-slate-500 block">
                          {group.subtasks.length} {group.subtasks.length === 1 ? 'subdivisão' : 'subdivisões'}
                        </span>
                      )}
                    </div>
                    <span className="px-2 py-0.5 bg-white rounded-full text-[10px] font-black text-slate-800 border border-slate-300 shadow-sm">
                      {group.totalPresentCount}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {groupSubtasks ? (
                      group.allFilteredMembers.length > 0 ? (
                        includeBreaks ? (
                          <div className="space-y-2">
                            {groupTaskMembersByBreakTime(group.allFilteredMembers).map((g) => (
                              <div key={g.timeLabel} className="space-y-1">
                                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-900">
                                  <Clock className="w-2.5 h-2.5 shrink-0 opacity-90" />
                                  <span className="font-extrabold">{g.timeLabel}</span>
                                  <span className="ml-auto font-black px-1 py-0.2 rounded bg-white border border-slate-200">{g.members.length}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-1 text-xs">
                                  {g.members.map((m) => {
                                    const displayName = abbreviateNamesToggle ? abbreviateName(m.name, true) : m.name;
                                    return (
                                      <div key={m.id} className="p-1 bg-slate-50 border border-slate-200 rounded">
                                        <span className="font-bold text-slate-900">{displayName}</span>
                                        <span className="text-[10px] text-slate-500 block">{m.role || 'Operador'}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-1 text-xs">
                            {group.allFilteredMembers.map((m) => {
                              const displayName = abbreviateNamesToggle ? abbreviateName(m.name, true) : m.name;
                              return (
                                <div key={m.id} className="p-1 bg-slate-50 border border-slate-200 rounded">
                                  <span className="font-bold text-slate-900">{displayName}</span>
                                  <span className="text-[10px] text-slate-500 block">{m.role || 'Operador'}</span>
                                </div>
                              );
                            })}
                          </div>
                        )
                      ) : (
                        <p className="text-[10px] italic text-slate-400">Sem alocados</p>
                      )
                    ) : (
                      <div className="space-y-2">
                        {group.directMembers.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[9px] font-black text-slate-500 uppercase">Posto Principal</span>
                            <div className="grid grid-cols-2 gap-1 text-xs">
                              {group.directMembers.map((m) => (
                                <div key={m.id} className="p-1 bg-slate-50 border border-slate-200 rounded">
                                  <span className="font-bold text-slate-900">{abbreviateNamesToggle ? abbreviateName(m.name, true) : m.name}</span>
                                  <span className="text-[10px] text-slate-500 block">{m.role || 'Operador'}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {group.filteredSubtasks.map((sub) => (
                          <div key={sub.id} className="pl-2 border-l-2 border-indigo-400 space-y-1">
                            <span className="text-[9px] font-black text-indigo-700 uppercase">↳ {sub.name} ({sub.filteredMembers.length})</span>
                            <div className="grid grid-cols-2 gap-1 text-xs">
                              {sub.filteredMembers.map((m) => (
                                <div key={m.id} className="p-1 bg-slate-50 border border-slate-200 rounded">
                                  <span className="font-bold text-slate-900">{abbreviateNamesToggle ? abbreviateName(m.name, true) : m.name}</span>
                                  <span className="text-[10px] text-slate-500 block">{m.role || 'Operador'}</span>
                                </div>
                              ))}
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
        </div>

        {/* PAGE 2: DAILY REPORT DATA (IF ENABLED) */}
        {includeDailyReport && (
          <div className="w-full border border-slate-300 rounded-2xl p-6 bg-white space-y-4 page-break-before-always">
            <div className="flex items-center justify-between border-b border-slate-300 pb-3">
              <div>
                <h2 className="text-xl font-black uppercase text-slate-900 tracking-wide">
                  Relatório Operacional do Dia
                </h2>
                <p className="text-xs font-bold text-slate-600">
                  {state.teamName} • {formatDateBR(activeDate)} • Turno {state.teamShift || 'Geral'}
                </p>
              </div>
              <div className="text-right">
                <span className="px-3 py-1 bg-slate-100 border border-slate-300 rounded-lg text-xs font-black text-slate-800">
                  {presentPeople.length} Presentes / {state.collaborators.length} Total
                </span>
              </div>
            </div>

            {/* Table of Non-Present Collaborators */}
            {(() => {
              const absents = state.collaborators
                .filter((c) => {
                  const statusInfo = getCollaboratorStatus(c, activeDate, state);
                  return statusInfo.status !== 'presente';
                })
                .map((c) => {
                  const statusInfo = getCollaboratorStatus(c, activeDate, state);
                  const report = state.dailyReports?.[activeDate];
                  const reason = report?.absenceReasons?.[c.id] || statusInfo.absenceReason || statusInfo.status;
                  return {
                    id: c.id,
                    name: c.name,
                    role: c.role || 'Operador',
                    statusLabel: statusInfo.status,
                    reason,
                  };
                });

              if (absents.length === 0) {
                return (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 text-center">
                    Todos os colaboradores estão presentes no dia de hoje.
                  </div>
                );
              }

              return (
                <div className="space-y-2">
                  <h3 className="text-xs font-black uppercase text-slate-800 border-b border-slate-200 pb-1">
                    Colaboradores Ausentes & Justificativas ({absents.length})
                  </h3>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-300 text-slate-500 font-bold uppercase text-[10px]">
                        <th className="py-1">Colaborador</th>
                        <th className="py-1">Cargo</th>
                        <th className="py-1">Status</th>
                        <th className="py-1">Justificativa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {absents.map((c) => (
                        <tr key={c.id}>
                          <td className="py-1.5 font-bold text-slate-900">{c.name}</td>
                          <td className="py-1.5 text-slate-600">{c.role}</td>
                          <td className="py-1.5 font-bold uppercase text-[10px]">{c.statusLabel}</td>
                          <td className="py-1.5 text-slate-800">{c.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* General Notes */}
            {(() => {
              const report = state.dailyReports?.[activeDate];
              if (!report?.generalNotes) return null;
              return (
                <div className="space-y-1 bg-slate-50 border border-slate-200 p-3 rounded-xl">
                  <h4 className="text-xs font-black uppercase text-slate-800">Observações Operacionais do Dia:</h4>
                  <p className="text-xs font-medium text-slate-700 whitespace-pre-wrap">{report.generalNotes}</p>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};
