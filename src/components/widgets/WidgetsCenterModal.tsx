import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  LayoutGrid,
  Calendar,
  Info,
  Activity,
  Send,
  Radio,
  Eye,
  EyeOff,
  SlidersHorizontal,
  CheckSquare,
  Shuffle,
  Clock,
  Share2,
  Users,
  Presentation,
  FileText,
  Home,
  Settings,
  HelpCircle,
  UserCheck,
  CheckCircle2,
  Sparkles,
  Terminal,
  ListTodo,
  TrendingUp,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CalendarWidget } from './CalendarWidget';
import { InfoHubWidget } from './InfoHubWidget';
import { OperationalStatsWidget } from './OperationalStatsWidget';
import { ServiceRequestsWidget } from './ServiceRequestsWidget';
import { RadioWidget } from './RadioWidget';
import { BreaksMonitorWidget } from './BreaksMonitorWidget';
import { SmartCommandWidget } from './SmartCommandWidget';
import { RoutinesWidget } from './RoutinesWidget';
import { MetricsWidget } from './MetricsWidget';

interface WidgetsCenterModalProps {
  onNavigate?: (view: string) => void;
}

export const WidgetsCenterModal: React.FC<WidgetsCenterModalProps> = ({ onNavigate }) => {
  const {
    isWidgetsModalOpen,
    setIsWidgetsModalOpen,
    state,
    updateWidgetsConfig,
    toggleSidebarItemHidden,
    setHiddenSidebarItems,
    showNotice,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'widgets' | 'sidebar_settings'>('widgets');

  if (!isWidgetsModalOpen) return null;

  const config = state.widgetsConfig || {
    enabled: true,
    showCalendarWidget: true,
    showInfoHubWidget: true,
    showStatsWidget: true,
    showRequestsWidget: true,
    showRadioWidget: true,
    dashboardWidgets: ['calendar', 'info_hub', 'stats', 'requests'],
  };

  const isModuleEnabled = state.showWidgetsModule !== false && config.enabled !== false;
  const dashboardWidgets = config.dashboardWidgets || ['calendar', 'info_hub', 'stats', 'requests'];

  const toggleDashboardWidget = (id: string) => {
    const next = dashboardWidgets.includes(id)
      ? dashboardWidgets.filter((w) => w !== id)
      : [...dashboardWidgets, id];
    updateWidgetsConfig({ dashboardWidgets: next });
  };

  const hiddenSidebarItems = new Set(state.hiddenSidebarItems || []);

  const allNavItems = [
    { id: 'presence', label: 'Presença de hoje', icon: CheckSquare, category: 'Operação Principal' },
    { id: 'assignment', label: 'Dimensionamento', icon: Shuffle, category: 'Operação Principal' },
    { id: 'breaks', label: 'Intervalos', icon: Clock, category: 'Operação Principal' },
    { id: 'share', label: 'Resumo / Compartilhar', icon: Share2, category: 'Operação Principal' },
    { id: 'report', label: 'Relatório diário', icon: FileText, category: 'Operação Principal' },
    { id: 'calendar', label: 'Calendário anual', icon: Calendar, category: 'Planejamento & Cadastros' },
    { id: 'team', label: 'Equipe e cadastros', icon: Users, category: 'Planejamento & Cadastros' },
    { id: 'info_hub', label: 'Hub de Informações', icon: Info, category: 'Apoio & Comunicação' },
    { id: 'requests', label: 'Pedidos de serviço', icon: Send, category: 'Apoio & Comunicação' },
    { id: 'briefing', label: 'Montagem de slide', icon: Presentation, category: 'Apoio & Comunicação' },
    { id: 'employee', label: 'Meu Painel', icon: UserCheck, category: 'Portais' },
    { id: 'home', label: 'Visão geral', icon: Home, category: 'Sistema' },
  ];

  const handleNavigate = (view: string) => {
    setIsWidgetsModalOpen(false);
    if (onNavigate) {
      onNavigate(view);
    }
  };

  const handleSetCleanSidebar = () => {
    // Quick preset: Keep only core operations, hide secondary items so user can use widgets instead
    const cleanHidden = ['calendar', 'info_hub', 'briefing', 'requests'];
    setHiddenSidebarItems(cleanHidden);
    showNotice('Menu lateral simplificado! Calendário, Hub e Pedidos estão acessíveis nos Widgets.');
  };

  const handleResetSidebar = () => {
    setHiddenSidebarItems([]);
    showNotice('Todos os itens foram restaurados no menu lateral.');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.2 }}
          className="bg-[var(--paper)] border border-[var(--line)] rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        >
          {/* Modal Header */}
          <div className="p-4 sm:p-5 border-b border-[var(--line)] flex items-center justify-between gap-3 bg-[var(--bg)]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)]">
                <LayoutGrid className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-[var(--ink)] tracking-tight">Central de Widgets & Menu Lateral</h2>
                <p className="text-xs text-[var(--muted)]">Personalize sua área de trabalho e organize os itens da barra lateral</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsWidgetsModalOpen(false)}
              className="p-2 rounded-xl text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--line)]/50 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-[var(--line)] bg-[var(--bg)] px-5 gap-2 pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('widgets')}
              className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'widgets'
                  ? 'border-[var(--primary)] text-[var(--primary)]'
                  : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Painel de Widgets</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sidebar_settings')}
              className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'sidebar_settings'
                  ? 'border-[var(--primary)] text-[var(--primary)]'
                  : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Ocultar / Exibir no Menu Lateral</span>
              {hiddenSidebarItems.size > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 text-[10px] font-black">
                  {hiddenSidebarItems.size} oculto(s)
                </span>
              )}
            </button>
          </div>

          {/* Content Area */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
            {activeTab === 'widgets' && (
              <>
                {/* Master Module Enable/Disable Card */}
                <div className={`p-4 rounded-2xl border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isModuleEnabled
                    ? 'bg-[var(--primary-soft)] border-[var(--primary-border)]'
                    : 'bg-amber-500/10 border-amber-500/30'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black shrink-0 ${
                      isModuleEnabled ? 'bg-[var(--primary)] text-white' : 'bg-amber-500 text-white'
                    }`}>
                      <LayoutGrid className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-[var(--ink)]">Módulo de Widgets Rápidos</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          isModuleEnabled
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                        }`}>
                          {isModuleEnabled ? 'Ativo' : 'Desativado'}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--muted)] font-medium">
                        {isModuleEnabled
                          ? 'Os widgets estão habilitados e visíveis no Painel Inicial e acesso rápido.'
                          : 'O módulo está desligado. Os cards de widgets não aparecem na Visão Geral.'}
                      </p>
                    </div>
                  </div>

                  <label className="flex items-center gap-2.5 cursor-pointer bg-[var(--paper)] px-3.5 py-2 rounded-xl border border-[var(--line)] shadow-xs self-start sm:self-auto">
                    <input
                      type="checkbox"
                      checked={isModuleEnabled}
                      onChange={(e) => updateWidgetsConfig({ enabled: e.target.checked })}
                      className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-[var(--ink)]">
                      {isModuleEnabled ? 'Módulo Ligado' : 'Módulo Desligado'}
                    </span>
                  </label>
                </div>

                {/* Active Widgets on Dashboard Toggles */}
                <div className={`bg-[var(--bg)] border border-[var(--line)] rounded-2xl p-4 transition-opacity ${
                  !isModuleEnabled ? 'opacity-50 pointer-events-none' : ''
                }`}>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[var(--primary)]" />
                      <h3 className="text-xs font-black uppercase tracking-wider text-[var(--ink)]">
                        Widgets Ativos no Painel Inicial
                      </h3>
                    </div>
                    <span className="text-xs text-[var(--muted)]">Selecione quais widgets exibir na Visão Geral</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-5 gap-2">
                    {[
                      { id: 'breaks_monitor', label: 'Monitor de Pausas', icon: Clock },
                      { id: 'smart_command', label: 'Comandos & Busca', icon: Terminal },
                      { id: 'routines', label: 'Rotinas & Checklists', icon: ListTodo },
                      { id: 'metrics', label: 'Métricas do Setor', icon: TrendingUp },
                      { id: 'calendar', label: 'Calendário & Escala', icon: Calendar },
                      { id: 'info_hub', label: 'Hub de Informações', icon: Info },
                      { id: 'stats', label: 'Panorama do Turno', icon: Activity },
                      { id: 'requests', label: 'Pedidos / Chamados', icon: Send },
                      { id: 'radio', label: 'Rádio PTT (Voz)', icon: Radio },
                    ].map((w) => {
                      const isActive = dashboardWidgets.includes(w.id);
                      const Icon = w.icon;
                      return (
                        <button
                          key={w.id}
                          type="button"
                          disabled={!isModuleEnabled}
                          onClick={() => toggleDashboardWidget(w.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                            isActive
                              ? 'bg-[var(--primary)]/10 border-[var(--primary)] text-[var(--primary)] shadow-xs'
                              : 'bg-[var(--paper)] border-[var(--line)] text-[var(--muted)] hover:border-[var(--line)]/80'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <Icon className="w-4 h-4" />
                            {isActive ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--primary)]" />
                            ) : (
                              <span className="w-3 h-3 rounded-full border border-[var(--line)]" />
                            )}
                          </div>
                          <div className="text-xs font-bold leading-tight">{w.label}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Live Widgets Bento Grid Preview */}
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-[var(--muted)] mb-3">
                    Visualização Interativa de Todos os Widgets
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <BreaksMonitorWidget
                      onOpenMonitor={() => handleNavigate('home')}
                      onOpenBreaks={() => handleNavigate('breaks')}
                    />
                    <SmartCommandWidget onOpenGlobalSearch={() => handleNavigate('home')} />
                    <RoutinesWidget onOpenRoutines={() => handleNavigate('routines')} />
                    <MetricsWidget onOpenMetrics={() => handleNavigate('metrics')} />
                    <CalendarWidget onOpenFull={() => handleNavigate('calendar')} />
                    <InfoHubWidget onOpenFull={() => handleNavigate('info_hub')} />
                    <OperationalStatsWidget
                      onOpenPresence={() => handleNavigate('presence')}
                      onOpenTasks={() => handleNavigate('assignment')}
                    />
                    <ServiceRequestsWidget onOpenRequests={() => handleNavigate('requests')} />
                    <RadioWidget />
                  </div>
                </div>
              </>
            )}

            {activeTab === 'sidebar_settings' && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--bg)] border border-[var(--line)] rounded-2xl p-4">
                  <div>
                    <h3 className="text-sm font-bold text-[var(--ink)]">Desafogar Menu Lateral</h3>
                    <p className="text-xs text-[var(--muted)]">
                      Oculte itens secundários do menu lateral para manter o foco na operação. Você poderá acessá-los a qualquer momento aqui na Central de Widgets.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleSetCleanSidebar}
                      className="px-3 py-1.5 text-xs font-bold bg-[var(--primary)] text-white rounded-xl hover:opacity-90 transition-all cursor-pointer shadow-xs"
                    >
                      Preset: Menu Minimalista
                    </button>
                    <button
                      type="button"
                      onClick={handleResetSidebar}
                      className="px-3 py-1.5 text-xs font-bold bg-[var(--paper)] border border-[var(--line)] text-[var(--ink)] rounded-xl hover:bg-[var(--line)]/50 transition-all cursor-pointer"
                    >
                      Exibir Todos
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {allNavItems.map((item) => {
                    const isHidden = hiddenSidebarItems.has(item.id);
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                          isHidden
                            ? 'bg-[var(--bg)] border-[var(--line)] opacity-60'
                            : 'bg-[var(--paper)] border-[var(--line)] shadow-xs'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-2 rounded-xl ${isHidden ? 'bg-slate-500/10 text-slate-500' : 'bg-[var(--primary)]/10 text-[var(--primary)]'}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[var(--ink)] truncate">{item.label}</div>
                            <div className="text-[10px] text-[var(--muted)] uppercase font-semibold">{item.category}</div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleSidebarItemHidden(item.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                            isHidden
                              ? 'bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-300'
                              : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
                          }`}
                        >
                          {isHidden ? (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              <span>Oculto</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              <span>No Menu</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-4 border-t border-[var(--line)] bg-[var(--bg)] flex items-center justify-between">
            <div className="text-xs text-[var(--muted)]">
              {activeTab === 'widgets'
                ? 'Dica: Acesse os widgets a qualquer momento pelo botão na barra flutuante ou menu.'
                : `${allNavItems.length - hiddenSidebarItems.size} de ${allNavItems.length} itens visíveis no menu lateral.`}
            </div>

            <button
              type="button"
              onClick={() => setIsWidgetsModalOpen(false)}
              className="px-4 py-2 bg-[var(--ink)] text-[var(--paper)] rounded-xl font-bold text-xs hover:opacity-90 transition-all cursor-pointer"
            >
              Concluir
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
