import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useI18n, LanguageOption } from '../../i18n';
import { ThemeOption, AppState } from '../../types';
import { isCalendarOnlyExport, unwrapBackupJson } from '../../utils/backupImport';
import { ConfirmModal } from '../../components/ConfirmModal';
import { ConfirmImportBackupModal } from '../../components/ConfirmImportBackupModal';
import { AppsScriptModal } from '../../components/AppsScriptModal';
import {
  Smartphone,
  CheckCircle2,
  Download,
  Languages,
  Plus,
  Palette,
  Sparkles,
  Check,
  LayoutGrid,
  Radio,
  SlidersHorizontal,
  Box,
  RotateCcw,
  ListOrdered,
  ArrowUp,
  ArrowDown,
  Trash2,
  CloudOff,
  WifiOff,
  UserCheck,
  ShieldAlert,
  HardDriveDownload,
  Info,
  Globe,
  Presentation,
  Keyboard,
  Calendar,
  Activity,
  Send,
  CheckSquare,
  ListTodo,
  Shuffle,
  Clock,
  Share2,
  Users,
  FileText,
  Home,
  Settings,
  HelpCircle,
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface GeneralSettingsPanelProps {
  checkPermissionOrAlert: (requireAdmin?: boolean) => boolean;
}

export const GeneralSettingsPanel: React.FC<GeneralSettingsPanelProps> = ({
  checkPermissionOrAlert,
}) => {
  const {
    state,
    setTheme,
    importFullState,
    importFullStateWithBackup,
    resetAllData,
    showNotice,
    setModuleVisibility,
    setSidebarOrder,
    updateWidgetsConfig,
    setIsWidgetsModalOpen,
    setCustomShortcuts,
    resetNavigationSettings,
    exportBackupToFile,
    createAutoBackup,
  } = useApp();

  const {
    language,
    setLanguage,
    availableLanguages,
    registerCustomLanguage,
    removeCustomLanguage,
    t,
  } = useI18n();

  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
    };

    const onDisplayModeChange = () => {
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      setIsStandalone(standalone);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    window.addEventListener('appinstalled', onDisplayModeChange);
    onDisplayModeChange();

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      window.removeEventListener('appinstalled', onDisplayModeChange);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setInstallPrompt(null);
      setIsStandalone(true);
    }
  };

  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [isAddLanguageModalOpen, setIsAddLanguageModalOpen] = useState(false);
  const [newLangCode, setNewLangCode] = useState('');
  const [newLangLabel, setNewLangLabel] = useState('');
  const [newLangFlag, setNewLangFlag] = useState('');
  const [newLangNative, setNewLangNative] = useState('');
  const [newLangJson, setNewLangJson] = useState('');
  const [addLangError, setAddLangError] = useState('');

  // Safe import modal state
  const [pendingImportData, setPendingImportData] = useState<Partial<AppState> | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [showAppsScriptModal, setShowAppsScriptModal] = useState(false);

  const themeOptions: Array<{
    id: ThemeOption;
    name: string;
    category: string;
    colorBg: string;
    colorAccent: string;
  }> = [
    { id: 'dimensio', name: 'Índigo & Violeta', category: 'Padrão', colorBg: '#f5f6fb', colorAccent: '#4f46e5' },
    { id: 'aurora', name: 'Verde Aurora', category: 'Refrescante', colorBg: '#f0fbf7', colorAccent: '#0d9488' },
    { id: 'ocean', name: 'Azul Oceano', category: 'Claro', colorBg: '#f2f7fd', colorAccent: '#2563eb' },
    { id: 'sunset', name: 'Pôr do Sol', category: 'Caloroso', colorBg: '#fffaf5', colorAccent: '#ea580c' },
    { id: 'crimson', name: 'Crimson Moderno', category: 'Ousado', colorBg: '#fdf2f4', colorAccent: '#be123c' },
    { id: 'midnight', name: 'Meia-Noite', category: 'Modo Escuro', colorBg: '#0b0f1f', colorAccent: '#6366f1' },
    { id: 'graphite', name: 'Grafite Ouro', category: 'Modo Escuro', colorBg: '#16171c', colorAccent: '#f0b429' },
    { id: 'material-emerald', name: 'Material You Esmeralda', category: 'Material You', colorBg: '#f4fbf7', colorAccent: '#006c4c' },
    { id: 'material-blue', name: 'Material You Azul Cobalto', category: 'Material You', colorBg: '#f8f9ff', colorAccent: '#005ac1' },
    { id: 'material-purple', name: 'Material You Ametista', category: 'Material You', colorBg: '#fdf7ff', colorAccent: '#6b4ea2' },
    { id: 'material-terracotta', name: 'Material You Terracota', category: 'Material You', colorBg: '#fff8f5', colorAccent: '#984715' },
    { id: 'material-dark', name: 'Material You Dark Slate', category: 'Material You', colorBg: '#101412', colorAccent: '#81d5a2' },
  ];

  const handleExportConfig = () => {
    exportBackupToFile();
  };

  const handleSelectImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const json = JSON.parse(evt.target?.result as string);
        setPendingImportData(json);
        setIsImportModalOpen(true);
      } catch (err) {
        showNotice('Arquivo JSON inválido.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmImport = (mode: 'full' | 'config_only', createSafetyBackup: boolean) => {
    if (!pendingImportData) return;
    if (isCalendarOnlyExport(pendingImportData)) {
      const cal = unwrapBackupJson(pendingImportData) as any;
      if (createSafetyBackup) {
        createAutoBackup('Backup de Segurança Pré-Mesclagem de Calendário');
      }
      importFullState({
        calendar: { ...state.calendar, ...(cal?.calendar || {}) },
        ...(cal?.calendarEvents
          ? { calendarEvents: { ...(state.calendarEvents || {}), ...cal.calendarEvents } }
          : {}),
        ...(cal?.scaleGroups ? { scaleGroups: cal.scaleGroups } : {}),
        ...(cal?.scaleGroupDefs ? { scaleGroupDefs: cal.scaleGroupDefs } : {}),
        ...(cal?.year ? { year: cal.year } : {}),
      });
      showNotice('Calendário mesclado com sucesso! Colaboradores, tarefas, rotinas, pedidos e hub não foram alterados.');
      setPendingImportData(null);
      return;
    }
    importFullStateWithBackup(pendingImportData, mode, createSafetyBackup);
    setPendingImportData(null);
  };

  return (
    <>
        <div className="space-y-4">
          {/* Instalação & Modo Local */}
          <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl shadow-2xs">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-[var(--primary)]/10 border border-[var(--primary)]/20 text-[var(--primary)] flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm font-black text-[var(--ink)]">Instalação e Modo Local (Offline)</h3>
                  <p className="text-xs text-[var(--ink)] font-semibold leading-relaxed max-w-2xl">
                    O Dimensio é <span className="text-[var(--primary)] font-black">100% local</span>: seus dados ficam salvos neste navegador (cache PWA) e funcionam sem internet.
                    O compartilhamento ou a sincronização online só acontece quando você conecta uma planilha compartilhada ou webhook — e sempre com a sua autorização.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-black uppercase tracking-wider border border-emerald-300 dark:border-emerald-800">
                      <WifiOff className="w-3 h-3" /> Funciona Offline (PWA)
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] text-[10px] font-black uppercase tracking-wider border border-[var(--primary)]/30">
                      <HardDriveDownload className="w-3 h-3" /> Dados no dispositivo
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-300 text-[10px] font-black uppercase tracking-wider border border-sky-300 dark:border-sky-800">
                      <CloudOff className="w-3 h-3" /> Sem servidor obrigatório
                    </span>
                  </div>
                </div>
              </div>
              <div className="shrink-0">
                {isStandalone ? (
                  <div className="px-4 py-2.5 rounded-xl bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-xs font-black flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>App instalado neste dispositivo</span>
                  </div>
                ) : installPrompt ? (
                  <button
                    onClick={handleInstallClick}
                    className="px-5 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Instalar Aplicativo</span>
                  </button>
                ) : (
                  <div className="px-4 py-2.5 rounded-xl bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] text-xs font-bold flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-[var(--muted)]" />
                    <span>Instale pelo navegador: “Adicionar à tela inicial”</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Idioma da Plataforma & Multi-Idiomas (i18n) */}
          <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Languages className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-[var(--ink)]">
                      Idioma da Plataforma & Suporte Multi-Idiomas
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                      i18n Ativo
                    </span>
                  </div>
                  <p className="text-xs text-[var(--muted)] font-medium leading-relaxed max-w-2xl">
                    Alterne o idioma instantaneamente em todos os módulos ou adicione novos idiomas com fallback de segurança. Novas funções ou alterações na plataforma mantêm compatibilidade total automaticamente.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setNewLangCode('');
                    setNewLangLabel('');
                    setNewLangFlag('🌐');
                    setNewLangNative('');
                    setNewLangJson('');
                    setAddLangError('');
                    setIsAddLanguageModalOpen(true);
                  }}
                  className="px-3.5 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-black rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                  title="Cadastrar um novo idioma ou dialeto no sistema"
                >
                  <Plus className="w-4 h-4" />
                  <span>Adicionar Novo Idioma</span>
                </button>
              </div>
            </div>

            {/* Lista de idiomas disponíveis */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-1">
              {availableLanguages.map((l) => {
                const isSelected = language === l.code;
                const isBuiltin = ['pt', 'es', 'en', 'fr', 'de'].includes(l.code);
                return (
                  <div
                    key={l.code}
                    className={`relative p-3 rounded-xl border-2 transition-all flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)] shadow-xs scale-[1.02]'
                        : 'border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] hover:border-[var(--line)]/90'
                    }`}
                    onClick={() => setLanguage(l.code as any)}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-2xl">{l.flag}</span>
                      <div className="flex items-center gap-1">
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        )}
                        {!isBuiltin && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Remover o idioma customizado "${l.label}"?`)) {
                                removeCustomLanguage(l.code);
                              }
                            }}
                            className="text-[var(--muted)] hover:text-red-500 p-0.5 rounded cursor-pointer transition-colors"
                            title="Remover idioma customizado"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-black truncate">{l.label}</div>
                      <div className="text-[10px] text-[var(--muted)] font-medium truncate">{l.nativeName}</div>
                      <div className="text-[9px] font-mono text-[var(--muted)] uppercase mt-1">
                        Código: <span className="font-bold">{l.code}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Aviso arquitetural de resiliência e fallback */}
            <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl flex items-start gap-3">
              <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5 text-[11px] leading-relaxed">
                <span className="font-black text-blue-900 dark:text-blue-200">
                  Arquitetura Pronta para Futuras Atualizações e Novos Idiomas:
                </span>
                <p className="text-blue-800 dark:text-blue-300 font-medium">
                  Novos módulos, botões ou funcionalidades herdam o sistema de fallback multinível. Se uma nova alteração não tiver tradução no idioma atual ou customizado, o Dimensio recorre automaticamente ao dicionário base sem travar o aplicativo ou exibir erros na interface.
                </p>
              </div>
            </div>
          </div>

          {/* Central de Widgets & Menu Minimalista */}
          {(() => {
            const isWidgetsModuleEnabled = state.showWidgetsModule !== false && state.widgetsConfig?.enabled !== false;
            const activeDashboardWidgets = state.widgetsConfig?.dashboardWidgets || ['calendar', 'info_hub', 'stats', 'requests'];

            const toggleDashboardWidget = (id: string) => {
              if (!checkPermissionOrAlert()) return;
              const next = activeDashboardWidgets.includes(id)
                ? activeDashboardWidgets.filter((w) => w !== id)
                : [...activeDashboardWidgets, id];
              updateWidgetsConfig({ dashboardWidgets: next });
            };

            const toggleAllWidgetsModule = (enable: boolean) => {
              if (!checkPermissionOrAlert()) return;
              setModuleVisibility({ showWidgetsModule: enable });
            };

            return (
              <div className="bg-gradient-to-r from-[var(--paper)] to-[var(--primary-soft)] border-2 border-[var(--primary-border)] p-5 rounded-2xl space-y-4 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black shadow-xs shrink-0 ${
                      isWidgetsModuleEnabled ? 'bg-[var(--primary)] text-white' : 'bg-slate-400 text-white'
                    }`}>
                      <LayoutGrid className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-[var(--ink)]">
                          Central de Widgets & Menu Minimalista
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          isWidgetsModuleEnabled
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                        }`}>
                          {isWidgetsModuleEnabled ? 'Módulo Ativo' : 'Módulo Desativado'}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--muted)] font-medium">
                        Ative ou desative widgets rápidos no Painel Inicial e oculte itens secundários do menu lateral para manter uma interface limpa e focada.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <label className="flex items-center gap-2 cursor-pointer bg-[var(--paper)] px-3 py-2 rounded-xl border border-[var(--line)] shadow-xs hover:border-[var(--primary)] transition-all">
                      <input
                        type="checkbox"
                        checked={isWidgetsModuleEnabled}
                        onChange={(e) => toggleAllWidgetsModule(e.target.checked)}
                        className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-[var(--ink)]">
                        {isWidgetsModuleEnabled ? 'Módulo Ligado' : 'Módulo Desligado'}
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() => setIsWidgetsModalOpen(true)}
                      className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer shrink-0"
                    >
                      <LayoutGrid className="w-4 h-4" />
                      <span>Abrir Central Completa</span>
                    </button>
                  </div>
                </div>

                {/* Granular Widget Toggles directly in Settings */}
                <div className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-black uppercase tracking-wider text-[var(--ink)] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[var(--primary)]" />
                      <span>Widgets Rápidos Visíveis no Painel Inicial</span>
                    </div>
                    <span className="text-[11px] text-[var(--muted)] font-bold">
                      {isWidgetsModuleEnabled
                        ? `${activeDashboardWidgets.length} de 5 selecionado(s)`
                        : 'Módulo desativado'}
                    </span>
                  </div>

                  <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 transition-opacity ${
                    !isWidgetsModuleEnabled ? 'opacity-40 pointer-events-none' : ''
                  }`}>
                    {[
                      { id: 'calendar', label: 'Calendário & Escala', icon: Calendar },
                      { id: 'info_hub', label: 'Hub de Informações', icon: Info },
                      { id: 'stats', label: 'Panorama do Turno', icon: Activity },
                      { id: 'requests', label: 'Pedidos / Chamados', icon: Send },
                      { id: 'radio', label: 'Rádio PTT (Voz)', icon: Radio },
                    ].map((w) => {
                      const isActive = activeDashboardWidgets.includes(w.id);
                      const Icon = w.icon;
                      return (
                        <button
                          key={w.id}
                          type="button"
                          disabled={!isWidgetsModuleEnabled}
                          onClick={() => toggleDashboardWidget(w.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                            isActive
                              ? 'bg-[var(--primary)]/10 border-[var(--primary)] text-[var(--primary)] shadow-xs'
                              : 'bg-[var(--bg)] border-[var(--line)] text-[var(--muted)] hover:border-[var(--line)]/80'
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

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                  <div className="p-3 bg-[var(--paper)] border border-[var(--line)] rounded-xl">
                    <div className="text-[10px] font-bold text-[var(--muted)] uppercase">Status dos Widgets</div>
                    <div className={`text-sm font-black mt-0.5 ${isWidgetsModuleEnabled ? 'text-[var(--primary)]' : 'text-amber-600'}`}>
                      {isWidgetsModuleEnabled ? `${activeDashboardWidgets.length} ativo(s)` : 'Desativado'}
                    </div>
                  </div>
                  <div className="p-3 bg-[var(--paper)] border border-[var(--line)] rounded-xl">
                    <div className="text-[10px] font-bold text-[var(--muted)] uppercase">Itens Ocultos no Menu</div>
                    <div className="text-sm font-black text-amber-600 dark:text-amber-400 mt-0.5">
                      {(state.hiddenSidebarItems || []).length} item(ns)
                    </div>
                  </div>
                  <div className="p-3 bg-[var(--paper)] border border-[var(--line)] rounded-xl">
                    <div className="text-[10px] font-bold text-[var(--muted)] uppercase">Acesso Rápido</div>
                    <div className="text-xs font-bold text-[var(--ink)] mt-0.5">
                      {isWidgetsModuleEnabled ? 'Botão flutuante & Menu' : 'Oculto na barra flutuante'}
                    </div>
                  </div>
                  <div className="p-3 bg-[var(--paper)] border border-[var(--line)] rounded-xl">
                    <div className="text-[10px] font-bold text-[var(--muted)] uppercase">Preset Recomendado</div>
                    <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      Menu Minimalista
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Personalização da Navegação e Atalhos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Ordem dos itens do menu lateral */}
            <div className="bg-[var(--paper)] border border-[var(--line)] p-4 rounded-2xl space-y-3 shadow-2xs">
              <div className="flex items-center justify-between border-b border-[var(--line)] pb-2.5">
                <div className="flex items-center gap-2">
                  <ListOrdered className="w-4 h-4 text-[var(--primary)]" />
                  <h3 className="text-xs font-black text-[var(--ink)]">Ordem do Menu Lateral</h3>
                </div>
                <button
                  onClick={() => {
                    if (!checkPermissionOrAlert()) return;
                    resetNavigationSettings();
                  }}
                  className="px-2.5 py-1 bg-[var(--bg)] hover:bg-[var(--paper)] border border-[var(--line)] text-[var(--ink)] text-[11px] font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Restaurar ordem e atalhos padrão"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restaurar Padrão</span>
                </button>
              </div>

              <p className="text-[11px] text-[var(--ink)] font-semibold leading-relaxed">
                Defina a ordem dos itens no menu lateral usando as setas de reordenação.
              </p>

              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                {(() => {
                  const ALL_NAV_ITEMS = [
                    { id: 'presence', label: 'Presença de hoje', icon: CheckSquare, defaultShortcut: '1' },
                    { id: 'operator_portal', label: 'Portal do Operador', icon: Radio, defaultShortcut: 'P' },
                    { id: 'employee', label: 'Meu Painel', icon: UserCheck, defaultShortcut: 'M' },
                    { id: 'routines', label: 'Rotinas e Tarefas', icon: ListTodo, defaultShortcut: 'T' },
                    { id: 'assignment', label: 'Dimensionamento', icon: Shuffle, defaultShortcut: '2' },
                    { id: 'breaks', label: 'Intervalos', icon: Clock, defaultShortcut: '3' },
                    { id: 'share', label: 'Resumo / Compartilhar', icon: Share2, defaultShortcut: '4' },
                    { id: 'calendar', label: 'Calendário anual', icon: Calendar, defaultShortcut: '5' },
                    { id: 'team', label: 'Equipe e cadastros', icon: Users, defaultShortcut: '6' },
                    { id: 'info_hub', label: 'Hub de Informações', icon: Info, defaultShortcut: 'I' },
                    { id: 'briefing', label: 'Montagem de slide', icon: Presentation, defaultShortcut: '7' },
                    { id: 'requests', label: 'Pedidos de serviço', icon: Send, defaultShortcut: '8' },
                    { id: 'report', label: 'Relatório diário', icon: FileText, defaultShortcut: '9' },
                    { id: 'home', label: 'Visão geral', icon: Home, defaultShortcut: '0' },
                    { id: 'settings', label: 'Configurações', icon: Settings, defaultShortcut: 'S' },
                    { id: 'help', label: 'Ajuda', icon: HelpCircle, defaultShortcut: 'H' },
                  ];

                  const itemMap = new Map(ALL_NAV_ITEMS.map((item) => [item.id, item]));
                  const currentOrder = state.sidebarOrder && state.sidebarOrder.length > 0
                    ? state.sidebarOrder
                    : ALL_NAV_ITEMS.map((i) => i.id);

                  const orderedList: typeof ALL_NAV_ITEMS = [];
                  currentOrder.forEach((id) => {
                    const found = itemMap.get(id);
                    if (found) {
                      orderedList.push(found);
                      itemMap.delete(id);
                    }
                  });
                  itemMap.forEach((found) => orderedList.push(found));

                  const moveItem = (index: number, direction: 'up' | 'down') => {
                    if (!checkPermissionOrAlert()) return;
                    const newOrder = orderedList.map((item) => item.id);
                    const targetIndex = direction === 'up' ? index - 1 : index + 1;
                    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
                    const temp = newOrder[index];
                    newOrder[index] = newOrder[targetIndex];
                    newOrder[targetIndex] = temp;
                    setSidebarOrder(newOrder);
                  };

                  return orderedList.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2 bg-[var(--bg)] border border-[var(--line)] rounded-xl"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-[10px] font-mono text-[var(--muted)] font-black w-4 text-right">
                            {idx + 1}
                          </span>
                          <Icon className="w-4 h-4 text-[var(--primary)] shrink-0" />
                          <span className="text-xs font-bold text-[var(--ink)] truncate">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            disabled={idx === 0}
                            onClick={() => moveItem(idx, 'up')}
                            className="p-1 rounded-lg hover:bg-[var(--paper)] text-[var(--ink)] disabled:opacity-30 cursor-pointer transition-colors"
                            title="Mover para cima"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            disabled={idx === orderedList.length - 1}
                            onClick={() => moveItem(idx, 'down')}
                            className="p-1 rounded-lg hover:bg-[var(--paper)] text-[var(--ink)] disabled:opacity-30 cursor-pointer transition-colors"
                            title="Mover para baixo"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Personalização de atalhos do teclado */}
            <div className="bg-[var(--paper)] border border-[var(--line)] p-4 rounded-2xl space-y-3 shadow-2xs">
              <div className="flex items-center justify-between border-b border-[var(--line)] pb-2.5">
                <div className="flex items-center gap-2">
                  <Keyboard className="w-4 h-4 text-[var(--primary)]" />
                  <h3 className="text-xs font-black text-[var(--ink)]">Atalhos do Teclado</h3>
                </div>
                <button
                  onClick={() => {
                    if (!checkPermissionOrAlert()) return;
                    setCustomShortcuts({});
                  }}
                  className="px-2.5 py-1 bg-[var(--bg)] hover:bg-[var(--paper)] border border-[var(--line)] text-[var(--ink)] text-[11px] font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Restaurar atalhos originais"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restaurar Atalhos</span>
                </button>
              </div>

              <p className="text-[11px] text-[var(--ink)] font-semibold leading-relaxed">
                Personalize os atalhos de teclado para navegação direta entre as páginas do sistema.
              </p>

              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                {(() => {
                  const ALL_NAV_ITEMS = [
                    { id: 'presence', label: 'Presença de hoje', icon: CheckSquare, defaultShortcut: '1' },
                    { id: 'operator_portal', label: 'Portal do Operador', icon: Radio, defaultShortcut: 'P' },
                    { id: 'employee', label: 'Meu Painel', icon: UserCheck, defaultShortcut: 'M' },
                    { id: 'routines', label: 'Rotinas e Tarefas', icon: ListTodo, defaultShortcut: 'T' },
                    { id: 'assignment', label: 'Dimensionamento', icon: Shuffle, defaultShortcut: '2' },
                    { id: 'breaks', label: 'Intervalos', icon: Clock, defaultShortcut: '3' },
                    { id: 'share', label: 'Resumo / Compartilhar', icon: Share2, defaultShortcut: '4' },
                    { id: 'calendar', label: 'Calendário anual', icon: Calendar, defaultShortcut: '5' },
                    { id: 'team', label: 'Equipe e cadastros', icon: Users, defaultShortcut: '6' },
                    { id: 'info_hub', label: 'Hub de Informações', icon: Info, defaultShortcut: 'I' },
                    { id: 'briefing', label: 'Montagem de slide', icon: Presentation, defaultShortcut: '7' },
                    { id: 'requests', label: 'Pedidos de serviço', icon: Send, defaultShortcut: '8' },
                    { id: 'report', label: 'Relatório diário', icon: FileText, defaultShortcut: '9' },
                    { id: 'home', label: 'Visão geral', icon: Home, defaultShortcut: '0' },
                    { id: 'settings', label: 'Configurações', icon: Settings, defaultShortcut: 'S' },
                    { id: 'help', label: 'Ajuda', icon: HelpCircle, defaultShortcut: 'H' },
                  ];

                  const customMap = state.customShortcuts || {};

                  return ALL_NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const activeVal = customMap[item.id] !== undefined ? customMap[item.id] : item.defaultShortcut;

                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2 bg-[var(--bg)] border border-[var(--line)] rounded-xl"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon className="w-4 h-4 text-[var(--primary)] shrink-0" />
                          <span className="text-xs font-bold text-[var(--ink)] truncate">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            type="text"
                            maxLength={2}
                            value={activeVal}
                            onChange={(e) => {
                              if (!checkPermissionOrAlert()) return;
                              const val = e.target.value.toUpperCase().trim();
                              setCustomShortcuts({
                                ...(state.customShortcuts || {}),
                                [item.id]: val,
                              });
                            }}
                            className="w-12 h-7 text-center font-mono text-xs font-black bg-[var(--paper)] border border-[var(--line)] rounded-lg text-[var(--ink)] focus:border-[var(--primary)] focus:outline-none uppercase"
                            placeholder="—"
                          />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>

          {/* Painéis compactos lado a lado */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Módulos Opcionais */}
            <div className="bg-[var(--paper)] border border-[var(--line)] p-4 rounded-2xl space-y-3 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-[var(--line)] pb-2.5">
                <SlidersHorizontal className="w-4 h-4 text-[var(--primary)]" />
                <h3 className="text-xs font-black text-[var(--ink)]">Módulos Opcionais</h3>
              </div>
              <p className="text-[11px] text-[var(--ink)] font-semibold leading-relaxed">
                Controle quais módulos aparecem no menu lateral para evitar opções desnecessárias no seu setor.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <label className={`p-3 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                  state.showInfoHub !== false
                    ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--ink)]'
                    : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <Info className={`w-4 h-4 ${state.showInfoHub !== false ? 'text-[var(--primary)]' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-xs font-extrabold">Hub de Informações</div>
                      <div className="text-[10px] font-medium opacity-80">Preenchimento rápido, atalhos & lembretes</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={state.showInfoHub !== false}
                    onChange={(e) => setModuleVisibility({ showInfoHub: e.target.checked })}
                    className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                  />
                </label>

                <label className={`p-3 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                  state.showBriefingSlide !== false
                    ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--ink)]'
                    : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <Presentation className={`w-4 h-4 ${state.showBriefingSlide !== false ? 'text-[var(--primary)]' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-xs font-extrabold">Montagem de Slide</div>
                      <div className="text-[10px] font-medium opacity-80">Passagens de turno e alinhamentos</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={state.showBriefingSlide !== false}
                    onChange={(e) => setModuleVisibility({ showBriefingSlide: e.target.checked })}
                    className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                  />
                </label>

                <label className={`p-3 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                  state.showEmployeePortal !== false
                    ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--ink)]'
                    : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <UserCheck className={`w-4 h-4 ${state.showEmployeePortal !== false ? 'text-[var(--primary)]' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-xs font-extrabold">Meu Painel</div>
                      <div className="text-[10px] font-medium opacity-80">Painel do colaborador identificado</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={state.showEmployeePortal !== false}
                    onChange={(e) => setModuleVisibility({ showEmployeePortal: e.target.checked })}
                    className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                  />
                </label>

                <label className={`p-3 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                  state.showOperatorPortal !== false
                    ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--ink)]'
                    : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <Box className={`w-4 h-4 ${state.showOperatorPortal !== false ? 'text-[var(--primary)]' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-xs font-extrabold">Portal da Base</div>
                      <div className="text-[10px] font-medium opacity-80">Interface isolada para coletores e operadores</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={state.showOperatorPortal !== false}
                    onChange={(e) => setModuleVisibility({ showOperatorPortal: e.target.checked })}
                    className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                  />
                </label>

                <label className={`p-3 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                  state.showRadioModule !== false
                    ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--ink)]'
                    : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <Radio className={`w-4 h-4 ${state.showRadioModule !== false ? 'text-[var(--primary)]' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-xs font-extrabold">Rádio Walkie-Talkie (Dimensio Talk)</div>
                      <div className="text-[10px] font-medium opacity-80">Comunicação PTT por voz em tempo real entre coletores e gestão</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={state.showRadioModule !== false}
                    onChange={(e) => setModuleVisibility({ showRadioModule: e.target.checked })}
                    className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                  />
                </label>

                <label className={`p-3 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                  state.showWidgetsModule !== false && state.widgetsConfig?.enabled !== false
                    ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--ink)]'
                    : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <LayoutGrid className={`w-4 h-4 ${state.showWidgetsModule !== false && state.widgetsConfig?.enabled !== false ? 'text-[var(--primary)]' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-xs font-extrabold">Central de Widgets Rápidos</div>
                      <div className="text-[10px] font-medium opacity-80">Cards contextuais no painel inicial e atalhos rápidos</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={state.showWidgetsModule !== false && state.widgetsConfig?.enabled !== false}
                    onChange={(e) => setModuleVisibility({ showWidgetsModule: e.target.checked })}
                    className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* Ajuste de Tema Visual */}
            <div className="bg-[var(--paper)] border border-[var(--line)] p-4 rounded-2xl space-y-3 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-[var(--line)] pb-2.5">
                <Palette className="w-4 h-4 text-[var(--primary)]" />
                <h3 className="text-xs font-black text-[var(--ink)]">Ajuste de Tema Visual</h3>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {themeOptions.map((t) => {
                  const isSelected = state.theme === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      title={t.name}
                      className={`w-9 h-9 rounded-xl border-2 flex items-center justify-center transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[var(--primary)] shadow-2xs scale-105'
                          : 'border-[var(--line)] hover:border-slate-400'
                      }`}
                      style={{ backgroundColor: t.colorAccent }}
                    >
                      {isSelected && <Check className="w-4 h-4 text-white drop-shadow" strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-[var(--muted)] font-semibold">
                Tema ativo:{' '}
                <span className="text-[var(--ink)] font-black">
                  {themeOptions.find((t) => t.id === state.theme)?.name || state.theme}
                </span>
              </p>
            </div>

            {/* Gestão de Limpeza e Reset Local */}
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-4 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 border-b border-red-200 dark:border-red-800 pb-2.5">
                <ShieldAlert className="w-4 h-4 text-red-700 dark:text-red-300" />
                <h3 className="text-xs font-black text-red-800 dark:text-red-100">Gestão de Limpeza e Reset Local</h3>
              </div>
              <p className="text-[11px] text-red-900 dark:text-red-200 font-semibold leading-relaxed">
                Remove os dados salvos neste navegador sem alterar a planilha online conectada ao Google Sheets.
              </p>
              <button
                onClick={() => setResetModalOpen(true)}
                className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all"
              >
                <Trash2 className="w-4 h-4" />
                <span>Limpar Dados Locais</span>
              </button>
            </div>
          </div>
        </div>

      <ConfirmModal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        onConfirm={resetAllData}
        title="Limpar Dados Locais da Aplicação"
        description="Tem certeza de que deseja apagar os dados locais? Um backup automático será gerado antes da limpeza."
        confirmText="Limpar Dados Locais"
        requireKeyword="DELETAR"
      />


      <ConfirmImportBackupModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        importedData={pendingImportData}
        currentCollaboratorCount={state.collaborators.length}
        currentTeamName={state.teamName}
        onConfirmImport={handleConfirmImport}
      />

      <AppsScriptModal

        isOpen={showAppsScriptModal}
        onClose={() => setShowAppsScriptModal(false)}
      />

      {isAddLanguageModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--paper)] border border-[var(--line)] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2.5">
                <Languages className="w-5 h-5 text-[var(--primary)]" />
                <h3 className="text-base font-black text-[var(--ink)]">Cadastrar Novo Idioma</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddLanguageModalOpen(false)}
                className="text-[var(--muted)] hover:text-[var(--ink)] font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Adicione um novo idioma ou dialeto à plataforma. Se você não fornecer um arquivo JSON de traduções, o Dimensio criará automaticamente o idioma com fallback total para a base do sistema, permitindo operação imediata.
            </p>

            {addLangError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-300 font-bold">
                {addLangError}
              </div>
            )}

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[var(--ink)] block mb-1">
                    Código do Idioma (ISO) *
                  </label>
                  <input
                    type="text"
                    value={newLangCode}
                    onChange={(e) => setNewLangCode(e.target.value.toLowerCase().trim())}
                    placeholder="ex: it, ja, zh, ru"
                    maxLength={10}
                    className="w-full px-3 py-2 text-xs bg-[var(--bg)] border border-[var(--line)] rounded-xl font-mono text-[var(--ink)] focus:border-[var(--primary)] outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[var(--ink)] block mb-1">
                    Emoji / Bandeira
                  </label>
                  <input
                    type="text"
                    value={newLangFlag}
                    onChange={(e) => setNewLangFlag(e.target.value)}
                    placeholder="ex: 🇮🇹 ou 🌐"
                    maxLength={4}
                    className="w-full px-3 py-2 text-xs bg-[var(--bg)] border border-[var(--line)] rounded-xl text-[var(--ink)] focus:border-[var(--primary)] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[var(--ink)] block mb-1">
                    Nome em Português *
                  </label>
                  <input
                    type="text"
                    value={newLangLabel}
                    onChange={(e) => setNewLangLabel(e.target.value)}
                    placeholder="ex: Italiano"
                    className="w-full px-3 py-2 text-xs bg-[var(--bg)] border border-[var(--line)] rounded-xl text-[var(--ink)] focus:border-[var(--primary)] outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[var(--ink)] block mb-1">
                    Nome Nativo (Autônomo)
                  </label>
                  <input
                    type="text"
                    value={newLangNative}
                    onChange={(e) => setNewLangNative(e.target.value)}
                    placeholder="ex: Italiano"
                    className="w-full px-3 py-2 text-xs bg-[var(--bg)] border border-[var(--line)] rounded-xl text-[var(--ink)] focus:border-[var(--primary)] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[var(--ink)] block mb-1">
                  Traduções Personalizadas em JSON (Opcional)
                </label>
                <textarea
                  value={newLangJson}
                  onChange={(e) => setNewLangJson(e.target.value)}
                  placeholder={'{\n  "common": { "save": "Salva", "cancel": "Annulla" }\n}'}
                  rows={4}
                  className="w-full p-2.5 text-[11px] font-mono bg-[var(--bg)] border border-[var(--line)] rounded-xl text-[var(--ink)] focus:border-[var(--primary)] outline-none resize-none"
                />
                <span className="text-[10px] text-[var(--muted)]">
                  Deixe vazio para herdar todas as traduções com fallback dinâmico.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setIsAddLanguageModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!newLangCode) {
                    setAddLangError('O código do idioma é obrigatório.');
                    return;
                  }
                  if (!newLangLabel) {
                    setAddLangError('O nome do idioma é obrigatório.');
                    return;
                  }
                  let customDict = {};
                  if (newLangJson.trim()) {
                    try {
                      customDict = JSON.parse(newLangJson);
                    } catch (err) {
                      setAddLangError('JSON de traduções inválido: ' + (err as Error).message);
                      return;
                    }
                  }
                  const option: LanguageOption = {
                    code: newLangCode,
                    label: newLangLabel,
                    nativeName: newLangNative || newLangLabel,
                    flag: newLangFlag || '🌐',
                  };
                  registerCustomLanguage(option, customDict);
                  setLanguage(option.code as any);
                  setIsAddLanguageModalOpen(false);
                  showNotice(`Idioma "${option.label}" cadastrado e ativado com sucesso!`);
                }}
                className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Cadastrar e Ativar Idioma
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
};
