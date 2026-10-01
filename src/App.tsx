import React, { useState, useEffect, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppProvider, useApp } from './context/AppContext';
import { CommunicationProvider } from './context/CommunicationContext';
import { CommunicationPanel } from './components/CommunicationPanel';
import CollabContextMenu from './components/CollabContextMenu';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { FloatingToast } from './components/FloatingToast';
import { FloatingQuickDock } from './components/FloatingQuickDock';
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt';
import { AndroidBackgroundKeepaliveBanner } from './components/AndroidBackgroundKeepaliveBanner';
import { OnboardingTutorial } from './components/OnboardingTutorial';
import { SessionShiftModal } from './components/SessionShiftModal';
import { ContextualGuide } from './components/ContextualGuide';
import { IncomingConnectionModal } from './components/IncomingConnectionModal';
import { OnboardingSetupWizard } from './components/OnboardingSetupWizard';
import { WidgetsCenterModal } from './components/widgets/WidgetsCenterModal';
import LoginScreen from './components/LoginScreen';
import AlwaysOnlineOverlay from './components/AlwaysOnlineOverlay';
import { onNavigateRequested } from './utils/navigation';
import { decodeConnectionParams } from './utils/urlConnection';

const HomeView = lazy(() => import('./views/HomeView').then((m) => ({ default: m.HomeView })));
const CalendarView = lazy(() => import('./views/CalendarView').then((m) => ({ default: m.CalendarView })));
const TeamView = lazy(() => import('./views/TeamView').then((m) => ({ default: m.TeamView })));
const PresenceView = lazy(() => import('./views/PresenceView').then((m) => ({ default: m.PresenceView })));
const AssignmentView = lazy(() => import('./views/AssignmentView').then((m) => ({ default: m.AssignmentView })));
const BreaksView = lazy(() => import('./views/BreaksView').then((m) => ({ default: m.BreaksView })));
const ShareView = lazy(() => import('./views/ShareView').then((m) => ({ default: m.ShareView })));
const ReportView = lazy(() => import('./views/ReportView').then((m) => ({ default: m.ReportView })));
const SettingsView = lazy(() => import('./views/SettingsView').then((m) => ({ default: m.SettingsView })));
const HelpView = lazy(() => import('./views/HelpView').then((m) => ({ default: m.HelpView })));
const BriefingView = lazy(() => import('./views/BriefingView').then((m) => ({ default: m.BriefingView })));
const ServiceRequestsView = lazy(() => import('./views/ServiceRequestsView').then((m) => ({ default: m.ServiceRequestsView })));
const InfoHubView = lazy(() => import('./views/InfoHubView').then((m) => ({ default: m.InfoHubView })));
const EmployeePanelView = lazy(() => import('./views/EmployeePanelView').then((m) => ({ default: m.EmployeePanelView })));
const OperatorPortalView = lazy(() => import('./views/OperatorPortalView').then((m) => ({ default: m.OperatorPortalView })));
const RoutinesView = lazy(() => import('./views/RoutinesView').then((m) => ({ default: m.RoutinesView })));

const TUTORIAL_SEEN_KEY = 'escalapro_tutorial_seen_v1';

const AppProviders: React.FC<{ children: React.ReactNode; theme: string }> = ({ children, theme }) => {
  return (
    <AppProvider>
      <CommunicationProvider>
        {children}
        <CommunicationPanel />
        <CollabContextMenu />
      </CommunicationProvider>
    </AppProvider>
  );
};

const MainLayout: React.FC = () => {
  const { clearSampleData, setOnlineSpreadsheetConfig, createAutoBackup, showNotice, fetchFromOnlineSpreadsheet } =
    useApp();
  const { setModuleVisibility, state, isSetupWizardOpen, openSetupWizard, closeSetupWizard } = useApp();
  const { sessionConfig, cloudOnline, identifiedUser, isConnectionBlocked } = useApp();
  const [currentView, setCurrentView] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view') || params.get('page');
      if (viewParam === 'portal' || viewParam === 'operator_portal' || params.has('portal')) {
        return 'portal';
      }
      if (viewParam === 'employee' || viewParam === 'employee_panel' || viewParam === 'meu_painel') {
        return 'employee';
      }
    } catch {
      // Fallback
    }
    return 'home';
  });
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);

  // Cloud connection modal state
  const [isCloudConnectOpen, setIsCloudConnectOpen] = useState(false);
  const [urlParamsConnection, setUrlParamsConnection] = useState<{
    sheetUrl?: string;
    webhookUrl?: string;
    sheetName?: string;
    teamName?: string;
  } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cxParam = params.get('cx');
    const connectSheet = params.get('connectSheet');
    const connectWebhook = params.get('connectWebhook');
    const sheetName = params.get('sheetName');
    const teamName = params.get('teamName');
    const viewParam = params.get('view') || params.get('page');
    const isPortalView = viewParam === 'portal' || viewParam === 'operator_portal' || params.has('portal');
    const isShareConnection = viewParam === 'share_connection';

    let parsed = cxParam ? decodeConnectionParams(cxParam) : null;
    if (!parsed && (connectSheet || connectWebhook)) {
      parsed = {
        sheetUrl: connectSheet || undefined,
        webhookUrl: connectWebhook || undefined,
        sheetName: sheetName || undefined,
        teamName: teamName || undefined,
      };
    }

    if (parsed && (parsed.sheetUrl || parsed.webhookUrl)) {
      if (isPortalView) {
        // Portal links automatically establish connection and pull cloud data
        setOnlineSpreadsheetConfig(
          {
            name: parsed.sheetName || 'Planilha Compartilhada em Nuvem',
            url: parsed.sheetUrl || '',
            webhookUrl: parsed.webhookUrl || undefined,
            autoSyncEnabled: true,
          },
          true
        );
      } else {
        setUrlParamsConnection(parsed);
        setIsCloudConnectOpen(true);
      }
    } else if (isShareConnection) {
      // The link was generated without a configured spreadsheet
      window.history.replaceState({}, '', window.location.pathname);
      showNotice(
        'Este link de conexão não contém dados de planilha. O gestor ainda não configurou a planilha online — peça um novo link.'
      );
    }

    // Auto-open tutorial on first visit or ask shift if session shift not selected
    try {
      const seen = localStorage.getItem(TUTORIAL_SEEN_KEY);
      if (!seen && !parsed) {
        setIsTutorialOpen(true);
      } else {
        const sessionShift = sessionStorage.getItem('escalapro_session_shift');
        if (!sessionShift && state.setupCompleted && !isPortalView) {
          setIsShiftModalOpen(true);
        }
      }
    } catch {
      // Fallback
    }
  }, []);

  useEffect(() => {
    return onNavigateRequested((view) => setCurrentView(view));
  }, []);

  // Mobile keep-alive: when the tab becomes visible again (or is restored from
  // bfcache after an app switch / background), re-sync immediately with the
  // cloud and keep the screen awake so timers/workers are not throttled.
  useEffect(() => {
    let wakeLock: (WakeLockSentinel & { released: boolean }) | null = null;
    let disposed = false;

    const requestWakeLock = async () => {
      try {
        if (!navigator.wakeLock) return;
        if (wakeLock && !wakeLock.released) return;
        wakeLock = await navigator.wakeLock.request('screen');
      } catch {
        // Wake lock unsupported/blocked — ignore.
      }
    };

    const releaseWakeLock = () => {
      try {
        if (wakeLock && !wakeLock.released) {
          wakeLock.release();
        }
      } catch {
        // ignore
      }
      wakeLock = null;
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
        fetchFromOnlineSpreadsheet(true);
      }
      // NOTE: we intentionally do NOT release the wake lock when the document
      // becomes hidden. The Dimensio Talk radio relies on the Screen Wake Lock
      // (plus its own silent-audio keepalive) to keep transmitting in the
      // background on mobile; explicitly releasing here would conflict with it.
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onVisibility);
    if (document.visibilityState === 'visible') {
      requestWakeLock();
    }

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onVisibility);
      releaseWakeLock();
    };
  }, [fetchFromOnlineSpreadsheet]);

  // Global Keyboard Shortcuts for Navigation
  useEffect(() => {
    const handleGlobalNavKeys = (e: KeyboardEvent) => {
      // Do not trigger if typing in form inputs, textareas, selects, or editable elements
      const activeEl = document.activeElement;
      const isEditable =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          (activeEl as HTMLElement).isContentEditable);

      if (isEditable) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const key = e.key.toLowerCase();

      const defaultShortcuts: Record<string, string> = {
        presence: '1',
        operator_portal: 'p',
        employee: 'm',
        assignment: '2',
        breaks: '3',
        share: '4',
        calendar: '5',
        team: '6',
        info_hub: 'i',
        briefing: '7',
        requests: '8',
        report: '9',
        home: '0',
        settings: 's',
        help: 'h',
      };

      const customShortcuts = state.customShortcuts || {};
      const viewMap: Record<string, string> = { '?': 'help' };

      Object.keys(defaultShortcuts).forEach((viewId) => {
        const custom = customShortcuts[viewId];
        const shortcutKey = (custom !== undefined ? custom : defaultShortcuts[viewId]).toLowerCase().trim();
        if (shortcutKey) {
          viewMap[shortcutKey] = viewId;
        }
      });

      if (viewMap[key]) {
        e.preventDefault();
        setCurrentView(viewMap[key]);
      }
    };

    window.addEventListener('keydown', handleGlobalNavKeys);
    return () => window.removeEventListener('keydown', handleGlobalNavKeys);
  }, [state.customShortcuts]);

  const handleCloseTutorial = () => {
    setIsTutorialOpen(false);
    try {
      localStorage.setItem(TUTORIAL_SEEN_KEY, 'true');
    } catch {
      // Fallback
    }
    if (state.isSampleData) {
      clearSampleData();
    } else if (!state.setupCompleted) {
      openSetupWizard();
    } else {
      setIsShiftModalOpen(true);
    }
  };

  const handleConnectCloudDataFromModal = () => {
    if (!urlParamsConnection) return;
    if (!urlParamsConnection.sheetUrl && !urlParamsConnection.webhookUrl) {
      setIsCloudConnectOpen(false);
      window.history.replaceState({}, '', window.location.pathname);
      showNotice(
        'Este link de conexão não contém dados de planilha. Peça ao gestor da equipe um novo link depois de configurar a planilha online.'
      );
      return;
    }
    // Preserve current local data before adopting the team's cloud data
    createAutoBackup('Backup de Segurança Antes de Conectar à Nuvem');
    setOnlineSpreadsheetConfig(
      {
        name: urlParamsConnection.sheetName || 'Planilha Compartilhada em Nuvem',
        url: urlParamsConnection.sheetUrl || '',
        webhookUrl: urlParamsConnection.webhookUrl || undefined,
        autoSyncEnabled: true,
      },
      true
    );
    setIsCloudConnectOpen(false);
    window.history.replaceState({}, '', window.location.pathname);
  };

  const getPageTitle = (view: string) => {
    switch (view) {
      case 'home':
        return 'Visão Geral da Operação';
      case 'calendar':
        return 'Calendário Anual da Escala 6x2';
      case 'team':
        return 'Equipe & Cadastros';
      case 'presence':
        return 'Presença de Hoje';
      case 'assignment':
        return 'Dimensionamento de Tarefas';
      case 'breaks':
        return 'Horários de Intervalo';
      case 'info_hub':
        return 'Hub de Informações do Setor';
      case 'requests':
        return 'Pedidos de Serviço Operacionais';
      case 'briefing':
        return 'Montagem de Slide';
      case 'employee':
        return 'Meu Painel do Colaborador';
      case 'routines':
        return 'Programação & Rotinas de Tarefas';
      case 'share':
        return 'Resumo para Compartilhar';
      case 'report':
        return 'Relatório Diário Operacional';
      case 'settings':
        return 'Configurações & Temas';
      case 'help':
        return 'Ajuda & Guia de Uso';
      default:
        return 'Visão Geral';
    }
  };

  const viewFallback = (
    <div className="h-full flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--primary)] border-t-transparent" />
    </div>
  );

  const renderView = () => {
    switch (currentView) {
      case 'home':
        return <Suspense fallback={viewFallback}><HomeView onNavigate={setCurrentView} /></Suspense>;
      case 'calendar':
        return <Suspense fallback={viewFallback}><CalendarView /></Suspense>;
      case 'team':
        return <Suspense fallback={viewFallback}><TeamView /></Suspense>;
      case 'presence':
        return <Suspense fallback={viewFallback}><PresenceView /></Suspense>;
      case 'assignment':
        return <Suspense fallback={viewFallback}><AssignmentView /></Suspense>;
      case 'breaks':
        return <Suspense fallback={viewFallback}><BreaksView /></Suspense>;
      case 'info_hub':
        return <Suspense fallback={viewFallback}><InfoHubView /></Suspense>;
      case 'requests':
        return <Suspense fallback={viewFallback}><ServiceRequestsView /></Suspense>;
      case 'briefing':
        return <Suspense fallback={viewFallback}><BriefingView /></Suspense>;
      case 'employee':
        return <Suspense fallback={viewFallback}><EmployeePanelView /></Suspense>;
      case 'routines':
        return <Suspense fallback={viewFallback}><RoutinesView /></Suspense>;
      case 'portal':
      case 'operator_portal':
        return (
          <Suspense fallback={viewFallback}>
            <OperatorPortalView onSwitchToManagement={() => setCurrentView('home')} />
          </Suspense>
        );
      case 'share':
        return <Suspense fallback={viewFallback}><ShareView onNavigate={setCurrentView} /></Suspense>;
      case 'report':
        return <Suspense fallback={viewFallback}><ReportView /></Suspense>;
      case 'settings':
        return <Suspense fallback={viewFallback}><SettingsView /></Suspense>;
      case 'help':
        return <Suspense fallback={viewFallback}><HelpView onOpenTutorial={() => setIsTutorialOpen(true)} /></Suspense>;
      default:
        return <Suspense fallback={viewFallback}><HomeView onNavigate={setCurrentView} /></Suspense>;
    }
  };

  const isUrlStandalonePortal = typeof window !== 'undefined' && (
    new URLSearchParams(window.location.search).get('view') === 'portal' ||
    new URLSearchParams(window.location.search).get('page') === 'portal' ||
    new URLSearchParams(window.location.search).has('portal')
  );

  // SESSÃO & SEGURANÇA — portões de acesso na frente de TODAS as telas:
  // 1) Modo sempre conectado: sem conexão → bloqueio total (somente leitura).
  // 2) Acesso anônimo desabilitado: sem usuário identificado → tela de login.
  const alwaysOnlineBlocked = sessionConfig.alwaysOnline && isConnectionBlocked();
  if (alwaysOnlineBlocked) {
    return <AlwaysOnlineOverlay onConnectCloud={() => setIsCloudConnectOpen(true)} />;
  }
  if (sessionConfig.allowAnonymousAccess === false && !identifiedUser) {
    return <LoginScreen onConnectCloud={() => setIsCloudConnectOpen(true)} />;
  }

  if (currentView === 'portal' || currentView === 'operator_portal') {
    return (
      <Suspense fallback={viewFallback}>
        <OperatorPortalView
          standalone={isUrlStandalonePortal}
          onSwitchToManagement={isUrlStandalonePortal ? undefined : () => setCurrentView('home')}
        />
        <AndroidBackgroundKeepaliveBanner />
        <FloatingToast />
      </Suspense>
    );
  }

  return (
    <div className="flex h-screen h-dvh overflow-hidden bg-[var(--bg)] text-[var(--ink)] transition-colors duration-200">
      <Sidebar
        currentView={currentView}
        onNavigate={setCurrentView}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />
      <main className="flex-1 flex flex-col min-w-0 h-screen h-dvh overflow-y-auto">
        <Header
          pageTitle={getPageTitle(currentView)}
          onOpenGuide={() => setIsGuideOpen(true)}
          onToggleMobileMenu={() => setIsMobileMenuOpen(true)}
          onOpenShiftModal={() => setIsShiftModalOpen(true)}
        />
        <div className="p-4 sm:p-5 md:p-6 flex-1 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="h-full max-w-[1600px] w-full mx-auto"
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Onboarding Tutorial Modal */}
      <OnboardingTutorial
        isOpen={isTutorialOpen}
        onClose={handleCloseTutorial}
        onConnectCloudData={() => setIsCloudConnectOpen(true)}
      />

      {/* Session Active Shift Selector Modal */}
      <SessionShiftModal
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
      />

      {/* Contextual Guide for the Current Screen */}
      <ContextualGuide
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        currentView={currentView}
      />

      {/* Guided First-Time Operation Setup Wizard */}
      <OnboardingSetupWizard
        isOpen={isSetupWizardOpen}
        onClose={closeSetupWizard}
      />

      {/* Cloud Connection Modal (URL or First Run) */}
      <IncomingConnectionModal
        isOpen={isCloudConnectOpen}
        onClose={() => setIsCloudConnectOpen(false)}
        sheetUrl={urlParamsConnection?.sheetUrl || ''}
        webhookUrl={urlParamsConnection?.webhookUrl}
        teamName={urlParamsConnection?.teamName || ''}
        onAcceptConnection={handleConnectCloudDataFromModal}
      />

      {/* Floating Action Notice Toast at Bottom */}
      <FloatingToast />

      {/* Central de Widgets & Personalização do Menu Lateral */}
      <WidgetsCenterModal onNavigate={setCurrentView} />

      {/* Modo de operação contínua e notificações em segundo plano para Android */}
      <AndroidBackgroundKeepaliveBanner />

      {/* New PWA version available → prompt reload */}
      <PwaUpdatePrompt />

      {/* Floating Quick Identification and Notifications Dock */}
      <FloatingQuickDock />
    </div>
  );
};

export default function App() {
  return (
    <AppProviders theme="dimensio">
      <MainLayout />
    </AppProviders>
  );
}