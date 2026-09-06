import React from 'react';
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
import { LayoutGrid, SlidersHorizontal } from 'lucide-react';
import { SectionHeader, Button } from '../ui';

interface DashboardWidgetsContainerProps {
  onNavigate: (view: string) => void;
}

export const DashboardWidgetsContainer: React.FC<DashboardWidgetsContainerProps> = ({ onNavigate }) => {
  const { state, setIsWidgetsModalOpen } = useApp();
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
  const activeWidgets = config.dashboardWidgets || ['calendar', 'info_hub', 'stats', 'requests'];

  if (!isModuleEnabled || activeWidgets.length === 0) {
    return null;
  }

  return (
    <div>
      <SectionHeader
        icon={<LayoutGrid className="w-4 h-4" />}
        title="Widgets Rápidos do Setor"
        subtitle="Informações contextuais e atalhos em tempo real"
        right={
          <Button
            variant="outline"
            size="sm"
            icon={SlidersHorizontal}
            onClick={() => setIsWidgetsModalOpen(true)}
            title="Personalizar quais widgets aparecem aqui"
          >
            Configurar Widgets
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
        {activeWidgets.includes('breaks_monitor') && (
          <BreaksMonitorWidget
            onOpenMonitor={() => onNavigate('home')}
            onOpenBreaks={() => onNavigate('breaks')}
          />
        )}
        {activeWidgets.includes('smart_command') && (
          <SmartCommandWidget onOpenGlobalSearch={() => {}} />
        )}
        {activeWidgets.includes('routines') && (
          <RoutinesWidget onOpenRoutines={() => onNavigate('routines')} />
        )}
        {activeWidgets.includes('metrics') && (
          <MetricsWidget onOpenMetrics={() => onNavigate('metrics')} />
        )}
        {activeWidgets.includes('calendar') && (
          <CalendarWidget onOpenFull={() => onNavigate('calendar')} />
        )}
        {activeWidgets.includes('info_hub') && (
          <InfoHubWidget onOpenFull={() => onNavigate('info_hub')} />
        )}
        {activeWidgets.includes('stats') && (
          <OperationalStatsWidget
            onOpenPresence={() => onNavigate('presence')}
            onOpenTasks={() => onNavigate('assignment')}
            onOpenRequests={() => onNavigate('requests')}
          />
        )}
        {activeWidgets.includes('requests') && (
          <ServiceRequestsWidget onOpenRequests={() => onNavigate('requests')} />
        )}
        {activeWidgets.includes('radio') && (
          <RadioWidget />
        )}
      </div>
    </div>
  );
};

