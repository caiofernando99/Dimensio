import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Home,
  Calendar,
  Users,
  CheckSquare,
  Shuffle,
  Clock,
  Share2,
  FileText,
  Settings,
  HelpCircle,
  X,
  Cloud,
  CheckCircle2,
  Presentation,
  UserCheck,
  Send,
  Info,
  LayoutGrid,
  ListTodo,
} from 'lucide-react';
import { DimensioLogo, DimensioMonogram } from './DimensioLogo';
import { useApp } from '../context/AppContext';
import { APP_VERSION, GIT_COMMIT, BUILD_TS, GIT_BRANCH } from '../version';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const NAV_ITEMS = [
  { id: 'presence', label: 'Presença de hoje', icon: CheckSquare, defaultShortcut: '1' },
  { id: 'employee', label: 'Meu Painel', icon: UserCheck, defaultShortcut: 'M' },
  { id: 'routines', label: 'Rotinas e Tarefas', icon: ListTodo, defaultShortcut: 'R' },
  { id: 'assignment', label: 'Dimensionamento', icon: Shuffle, defaultShortcut: '2' },
  { id: 'breaks', label: 'Intervalos', icon: Clock, defaultShortcut: '3' },
  { id: 'calendar', label: 'Calendário anual', icon: Calendar, defaultShortcut: '5' },
  { id: 'team', label: 'Equipe e cadastros', icon: Users, defaultShortcut: '6' },
  { id: 'share', label: 'Resumo / Compartilhar', icon: Share2, defaultShortcut: '4' },
  { id: 'info_hub', label: 'Hub de Informações', icon: Info, defaultShortcut: 'I' },
  { id: 'briefing', label: 'Montagem de slide', icon: Presentation, defaultShortcut: '7' },
  { id: 'requests', label: 'Pedidos de serviço', icon: Send, defaultShortcut: '8' },
  { id: 'report', label: 'Relatório diário', icon: FileText, defaultShortcut: '9' },
  { id: 'home', label: 'Visão geral', icon: Home, defaultShortcut: '0' },
  { id: 'settings', label: 'Configurações', icon: Settings, defaultShortcut: 'S' },
  { id: 'help', label: 'Ajuda', icon: HelpCircle, defaultShortcut: 'H' },
];

const ITEM_SECTION: Record<string, string> = {
  presence: 'Operação',
  employee: 'Operação',
  routines: 'Operação',
  assignment: 'Operação',
  breaks: 'Operação',
  calendar: 'Planejamento',
  team: 'Planejamento',
  share: 'Planejamento',
  info_hub: 'Comunicação',
  briefing: 'Comunicação',
  requests: 'Comunicação',
  report: 'Gestão',
  home: 'Gestão',
  settings: 'Sistema',
  help: 'Sistema',
};

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const { state, toggleSidebarCollapsed, setIsWidgetsModalOpen } = useApp();
  const isCollapsed = Boolean(state.isSidebarCollapsed);

  useEffect(() => {
    if (isMobileOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isMobileOpen]);

  const itemMap = new Map(NAV_ITEMS.map((item) => [item.id, item]));
  const order = state.sidebarOrder && state.sidebarOrder.length > 0
    ? state.sidebarOrder
    : NAV_ITEMS.map((i) => i.id);

  const orderedRawItems: typeof NAV_ITEMS = [];
  order.forEach((id) => {
    const item = itemMap.get(id);
    if (item) {
      orderedRawItems.push(item);
      itemMap.delete(id);
    }
  });
  itemMap.forEach((item) => orderedRawItems.push(item));

  const hiddenItems = new Set(state.hiddenSidebarItems || []);

  const navItems = orderedRawItems
    .filter((item) => {
      if (hiddenItems.has(item.id)) return false;
      if (item.id === 'briefing' && state.showBriefingSlide === false) return false;
      if (item.id === 'info_hub' && state.showInfoHub === false) return false;
      if (item.id === 'employee' && state.showEmployeePortal === false) return false;
      if (item.id === 'routines' && state.showRoutinesModule === false) return false;
      return true;
    })
    .map((item) => {
      const custom = state.customShortcuts?.[item.id];
      const shortcut = custom !== undefined ? custom : item.defaultShortcut;
      return { ...item, shortcut: shortcut || '' };
    });

  const handleSelect = (id: string) => {
    onNavigate(id);
    if (onCloseMobile) onCloseMobile();
  };

  const renderNavItem = (item: (typeof navItems)[number], showSectionLabel: boolean, showSectionHeader: boolean) => {
    const Icon = item.icon;
    const isActive = currentView === item.id;
    const sectionName = ITEM_SECTION[item.id];

    return (
      <React.Fragment key={item.id}>
        {!isCollapsed && showSectionLabel && (
          <div className="px-3 pt-4 pb-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/40">
            {sectionName}
          </div>
        )}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => handleSelect(item.id)}
          title={
            isCollapsed
              ? `${item.label}${item.shortcut ? ` (Atalho: ${item.shortcut})` : ''}`
              : undefined
          }
          className={`w-full flex items-center rounded-lg transition-colors duration-150 cursor-pointer ${
            isCollapsed ? 'justify-center gap-0 p-2.5' : 'gap-2.5 px-3 py-2 text-[13px] font-semibold'
          } ${
            isActive
              ? 'bg-[var(--sidebar-active)] text-white shadow-sm'
              : 'text-white/75 hover:bg-white/[0.07] hover:text-white'
          }`}
        >
          <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-white' : 'text-white/60'}`} />
          <div
            className={`flex-1 flex items-center justify-between min-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 ease-out ${
              isCollapsed ? 'max-w-0 opacity-0' : 'max-w-full opacity-100'
            }`}
          >
            <span className="truncate">{item.label}</span>
            {item.shortcut && (
              <span
                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                  isActive
                    ? 'bg-white/20 border-white/25 text-white'
                    : 'bg-white/[0.06] border-white/10 text-white/50'
                }`}
              >
                {item.shortcut}
              </span>
            )}
          </div>
        </motion.button>
        {!isCollapsed && showSectionHeader && (
          <div className="pt-2 border-t border-white/[0.08]" />
        )}
      </React.Fragment>
    );
  };

  const navContent = (
    <>
      <nav className="flex-1 overflow-y-auto pr-0.5">
        {navItems.map((item, idx) => {
          const prevItem = navItems[idx - 1];
          const prevSection = prevItem ? ITEM_SECTION[prevItem.id] : undefined;
          const section = ITEM_SECTION[item.id];
          const showSectionLabel = prevSection !== section;
          const showSectionHeader = prevSection !== undefined && prevSection !== section;
          return renderNavItem(item, showSectionLabel, showSectionHeader);
        })}

        <div className="pt-3 mt-2 border-t border-white/[0.08]">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              setIsWidgetsModalOpen(true);
              if (onCloseMobile) onCloseMobile();
            }}
            title={isCollapsed ? 'Central de Widgets & Menu' : undefined}
            className={`w-full flex items-center rounded-lg transition-colors duration-150 cursor-pointer bg-white/[0.06] hover:bg-white/[0.12] text-white/90 ${
              isCollapsed ? 'justify-center gap-0 p-2.5' : 'gap-2.5 px-3 py-2 text-xs font-bold'
            }`}
          >
            <LayoutGrid className="w-4 h-4 shrink-0 text-amber-300" />
            <div
              className={`flex-1 flex items-center justify-between min-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 ease-out ${
                isCollapsed ? 'max-w-0 opacity-0' : 'max-w-full opacity-100'
              }`}
            >
              <span className="truncate">Central de Widgets</span>
              {hiddenItems.size > 0 && (
                <span className="text-[9.5px] px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-black">
                  +{hiddenItems.size}
                </span>
              )}
            </div>
          </motion.button>
        </div>
      </nav>

      {state.onlineSpreadsheet?.lastSyncedAt && state.onlineSpreadsheet?.syncStatus !== 'error' ? (
        <div
          className={`mt-auto pt-3 border-t border-white/[0.08] flex items-center text-xs text-white/80 shrink-0 ${
            isCollapsed ? 'justify-center gap-0 px-1' : 'gap-2.5 px-2'
          }`}
          title={`Armazenamento na Nuvem Atualizado (${state.onlineSpreadsheet.lastSyncedAt}) • ${state.onlineSpreadsheet.name}`}
        >
          <div className="relative shrink-0 flex items-center justify-center">
            <Cloud className="w-5 h-5 text-emerald-400" />
            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-300 absolute -bottom-0.5 -right-0.5 bg-[var(--sidebar-bg)] rounded-full" />
          </div>
          <div
            className={`min-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 ease-out ${
              isCollapsed ? 'max-w-0 opacity-0' : 'max-w-full opacity-100'
            }`}
          >
            <div className="font-black text-[11px] text-emerald-300 leading-tight truncate">Nuvem Atualizada</div>
            <div className="text-[9.5px] text-white/70 font-mono truncate">{state.onlineSpreadsheet.lastSyncedAt}</div>
          </div>
        </div>
      ) : (
        <div
          className={`mt-auto pt-3 border-t border-white/[0.08] flex items-center text-xs text-white/60 shrink-0 ${
            isCollapsed ? 'justify-center gap-0 px-1' : 'gap-2 px-2'
          }`}
          title={
            state.onlineSpreadsheet?.syncStatus === 'error'
              ? 'Armazenamento Local Ativo (Falha de comunicação com a planilha)'
              : 'Armazenamento Local Ativo'
          }
        >
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              state.onlineSpreadsheet?.syncStatus === 'error' ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 animate-pulse'
            }`}
          ></span>
          <span
            className={`truncate font-semibold overflow-hidden whitespace-nowrap transition-all duration-300 ease-out ${
              isCollapsed ? 'max-w-0 opacity-0' : 'max-w-full opacity-100'
            }`}
          >
            Armazenamento Local Ativo
          </span>
        </div>
      )}

      <div
        className={`pt-2 text-[10px] text-white/50 font-mono font-medium tracking-wide border-t border-white/[0.06] shrink-0 ${
          isCollapsed ? 'text-center' : 'px-2'
        }`}
        title={`Dimensio v${APP_VERSION}${GIT_COMMIT ? ` (${GIT_COMMIT})` : ''}${BUILD_TS ? ` — build de ${BUILD_TS}` : ''}${GIT_BRANCH ? ` [${GIT_BRANCH}]` : ''}`}
      >
        {isCollapsed ? `v${APP_VERSION}` : `Dimensio v${APP_VERSION}${GIT_COMMIT ? ` (${GIT_COMMIT})` : ''}`}
      </div>
    </>
  );

  return (
    <>
      <aside
        className={`hidden md:flex bg-[var(--sidebar-bg)] text-[var(--sidebar-ink)] flex-col border-r border-black/10 shrink-0 min-h-screen no-print transition-all duration-300 ${
          isCollapsed ? 'w-18 p-2.5' : 'w-60 p-3'
        }`}
      >
        <div className="pb-3 mb-2 border-b border-white/10 flex items-center justify-center shrink-0">
          {isCollapsed ? (
            <button
              type="button"
              className="p-1 rounded-lg cursor-pointer hover:opacity-85 active:scale-95 transition-all"
              title="Dimensio — Clique para expandir o menu lateral"
              onClick={toggleSidebarCollapsed}
            >
              <DimensioMonogram size="md" variant="dark" />
            </button>
          ) : (
            <button
              type="button"
              className="w-full flex items-center justify-between px-1 py-1 rounded-lg cursor-pointer hover:bg-white/5 active:scale-[0.98] transition-all"
              title="Dimensio — Clique para recolher o menu lateral"
              onClick={toggleSidebarCollapsed}
            >
              <DimensioLogo size="md" variant="dark" />
            </button>
          )}
        </div>

        {navContent}
      </aside>

      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex no-print">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          <div className="relative z-10 w-72 max-w-[85vw] bg-[var(--sidebar-bg)] text-[var(--sidebar-ink)] flex flex-col p-3 shadow-2xl border-r border-white/10 h-full pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between px-1 py-3 mb-2 border-b border-white/10 shrink-0 pt-[calc(0.75rem+env(safe-area-inset-top))]">
              <DimensioLogo size="md" variant="dark" />
              <button
                onClick={onCloseMobile}
                className="p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
                aria-label="Fechar menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {navContent}
            </div>
          </div>
        </div>
      )}
    </>
  );
};