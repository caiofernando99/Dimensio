import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { AppState, ThemeOption } from '../types';
import { THEME_OPTIONS } from '../constants';

const STORAGE_KEY = 'people-scheduler-v3';

interface UIContextType {
  state: {
    theme: ThemeOption;
    isSidebarCollapsed?: boolean;
    showBriefingSlide?: boolean;
    showEmployeePortal?: boolean;
    showOperatorPortal?: boolean;
    showInfoHub?: boolean;
    showRadioModule?: boolean;
    customShortcuts?: Record<string, string>;
    sidebarOrder?: string[];
    selectedShiftFilter?: string;
    selectedTLFilter?: string;
    showResetModal: boolean;
    showImportModal: boolean;
    showAppsScriptModal: boolean;
    showConnectModal: boolean;
    pendingImportData: Partial<AppState> | null;
  };
  setTheme: (theme: ThemeOption) => void;
  toggleSidebarCollapsed: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setModuleVisibility: (modules: { showBriefingSlide?: boolean; showEmployeePortal?: boolean; showOperatorPortal?: boolean; showInfoHub?: boolean; showRadioModule?: boolean }) => void;
  setCustomShortcuts: (shortcuts: Record<string, string>) => void;
  setSidebarOrder: (order: string[]) => void;
  resetNavigationSettings: () => void;
  setSelectedGlobalFilters: (filters: { shift?: string; teamLeader?: string }) => void;
  showResetModal: () => void;
  hideResetModal: () => void;
  showImportModal: (data: Partial<AppState>) => void;
  hideImportModal: () => void;
  showAppsScriptModal: () => void;
  hideAppsScriptModal: () => void;
  showConnectModal: () => void;
  hideConnectModal: () => void;
  showNotice: (msg: string, actionLabel?: string, onAction?: () => void, noticeType?: 'success' | 'sync' | 'info') => void;
  noticeMessage: string | null;
  noticeType?: 'success' | 'sync' | 'info';
  noticeActionLabel?: string | null;
  onNoticeAction?: (() => void) | null;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode; theme: ThemeOption }> = ({ children, theme }) => {
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const validThemes = THEME_OPTIONS;
        const currentTheme: ThemeOption = validThemes.includes(parsed.theme) ? parsed.theme : 'dimensio';
        return {
          theme: currentTheme,
          isSidebarCollapsed: parsed.isSidebarCollapsed,
          showBriefingSlide: parsed.showBriefingSlide !== false,
          showEmployeePortal: parsed.showEmployeePortal !== false,
          showOperatorPortal: parsed.showOperatorPortal !== false,
          showInfoHub: parsed.showInfoHub !== false,
          showRadioModule: parsed.showRadioModule !== false,
          selectedShiftFilter: parsed.selectedShiftFilter,
          selectedTLFilter: parsed.selectedTLFilter,
          showResetModal: false,
          showImportModal: false,
          showAppsScriptModal: false,
          showConnectModal: false,
          pendingImportData: null,
        };
      }
    } catch {
      // Fallback
    }
    return {
      theme,
      isSidebarCollapsed: false,
      showBriefingSlide: true,
      showEmployeePortal: true,
      showOperatorPortal: true,
      showInfoHub: true,
      showRadioModule: true,
      selectedShiftFilter: 'ALL',
      selectedTLFilter: 'ALL',
      showResetModal: false,
      showImportModal: false,
      showAppsScriptModal: false,
      showConnectModal: false,
      pendingImportData: null,
    };
  });

  const [noticeState, setNoticeState] = useState<{
    message: string | null;
    noticeType?: 'success' | 'sync' | 'info';
    actionLabel?: string | null;
    onAction?: (() => void) | null;
  }>({ message: null, noticeType: 'success' });

  // Apply theme to document element
  useEffect(() => {
    const currentTheme = state.theme || 'dimensio';
    document.documentElement.setAttribute('data-theme', currentTheme);
    const isDark = ['midnight', 'graphite', 'material-dark'].includes(currentTheme);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.theme]);

  // Save state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('Failed to save UI state', err);
    }
  }, [state]);

  const setTheme = (newTheme: ThemeOption) => {
    setState((prev) => ({ ...prev, theme: newTheme }));
  };

  const toggleSidebarCollapsed = () => {
    setState((prev) => ({ ...prev, isSidebarCollapsed: !prev.isSidebarCollapsed }));
  };

  const setSidebarCollapsed = (collapsed: boolean) => {
    setState((prev) => ({ ...prev, isSidebarCollapsed: collapsed }));
  };

  const setModuleVisibility = (modules: { showBriefingSlide?: boolean; showEmployeePortal?: boolean; showOperatorPortal?: boolean; showInfoHub?: boolean; showRadioModule?: boolean }) => {
    setState((prev) => ({
      ...prev,
      showBriefingSlide: modules.showBriefingSlide !== undefined ? modules.showBriefingSlide : prev.showBriefingSlide,
      showEmployeePortal: modules.showEmployeePortal !== undefined ? modules.showEmployeePortal : prev.showEmployeePortal,
      showOperatorPortal: modules.showOperatorPortal !== undefined ? modules.showOperatorPortal : prev.showOperatorPortal,
      showInfoHub: modules.showInfoHub !== undefined ? modules.showInfoHub : prev.showInfoHub,
      showRadioModule: modules.showRadioModule !== undefined ? modules.showRadioModule : prev.showRadioModule,
    }));
  };

  const setCustomShortcuts = (shortcuts: Record<string, string>) => {
    setState((prev) => ({ ...prev, customShortcuts: shortcuts }));
  };

  const setSidebarOrder = (order: string[]) => {
    setState((prev) => ({ ...prev, sidebarOrder: order }));
  };

  const resetNavigationSettings = () => {
    setState((prev) => ({
      ...prev,
      customShortcuts: {},
      sidebarOrder: [
        'presence',
        'operator_portal',
        'employee',
        'assignment',
        'breaks',
        'share',
        'calendar',
        'team',
        'info_hub',
        'briefing',
        'requests',
        'report',
        'home',
        'settings',
        'help',
      ],
    }));
  };

  const setSelectedGlobalFilters = (filters: { shift?: string; teamLeader?: string }) => {
    setState((prev) => ({
      ...prev,
      selectedShiftFilter: filters.shift !== undefined ? filters.shift : prev.selectedShiftFilter,
      selectedTLFilter: filters.teamLeader !== undefined ? filters.teamLeader : prev.selectedTLFilter,
    }));
  };

  const showResetModal = () => {
    setState((prev) => ({ ...prev, showResetModal: true }));
  };

  const hideResetModal = () => {
    setState((prev) => ({ ...prev, showResetModal: false }));
  };

  const showImportModal = (data: Partial<AppState>) => {
    setState((prev) => ({ ...prev, showImportModal: true, pendingImportData: data }));
  };

  const hideImportModal = () => {
    setState((prev) => ({ ...prev, showImportModal: false, pendingImportData: null }));
  };

  const showAppsScriptModal = () => {
    setState((prev) => ({ ...prev, showAppsScriptModal: true }));
  };

  const hideAppsScriptModal = () => {
    setState((prev) => ({ ...prev, showAppsScriptModal: false }));
  };

  const showConnectModal = () => {
    setState((prev) => ({ ...prev, showConnectModal: true }));
  };

  const hideConnectModal = () => {
    setState((prev) => ({ ...prev, showConnectModal: false }));
  };

  const showNotice = (
    msg: string,
    actionLabel?: string | null,
    onAction?: (() => void) | null,
    noticeType: 'success' | 'sync' | 'info' = 'success'
  ) => {
    setNoticeState({ message: msg, actionLabel, onAction, noticeType });
    setTimeout(() => {
      setNoticeState((prev) => (prev.message === msg ? { message: null } : prev));
    }, 7000);
  };

  return (
    <UIContext.Provider
      value={{
        state,
        setTheme,
        toggleSidebarCollapsed,
        setSidebarCollapsed,
        setModuleVisibility,
        setCustomShortcuts,
        setSidebarOrder,
        resetNavigationSettings,
        setSelectedGlobalFilters,
        showResetModal,
        hideResetModal,
        showImportModal,
        hideImportModal,
        showAppsScriptModal,
        hideAppsScriptModal,
        showConnectModal,
        hideConnectModal,
        showNotice,
        noticeMessage: noticeState.message,
        noticeType: noticeState.noticeType,
        noticeActionLabel: noticeState.actionLabel,
        onNoticeAction: noticeState.onAction,
      }}
    >
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) throw new Error('useUI must be used within a UIProvider');
  return context;
};