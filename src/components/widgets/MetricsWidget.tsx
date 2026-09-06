import React from 'react';
import { motion } from 'motion/react';
import { Activity, TrendingUp, Cpu, ArrowUpRight, CheckCircle2, Layers } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface MetricsWidgetProps {
  onOpenMetrics?: () => void;
}

export const MetricsWidget: React.FC<MetricsWidgetProps> = ({ onOpenMetrics }) => {
  const { state } = useApp();

  const metricDefinitions = state.metricDefinitions || [];
  const metricReadings = state.metricReadings || [];

  // Summary
  const hasDefinitions = metricDefinitions.length > 0;
  const recentReadings = metricReadings.slice(-3);

  return (
    <div className="bg-[var(--paper)] border border-[var(--line)] rounded-2xl p-4 flex flex-col justify-between h-full shadow-xs hover:border-[var(--primary)]/30 transition-all">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-500">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[var(--ink)]">Métricas Operacionais</h3>
              <p className="text-[10px] text-[var(--muted)]">Leituras & telemetria do sistema</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenMetrics}
            className="text-[11px] font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400 flex items-center gap-0.5 cursor-pointer"
          >
            Ver mais <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-2 text-xs">
          {hasDefinitions ? (
            <div className="space-y-1.5">
              {metricDefinitions.slice(0, 3).map((def) => {
                const latestReading = metricReadings
                  .filter((r) => r.metricId === def.id)
                  .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];

                const firstValKey = Object.keys(latestReading?.values || {})[0];
                const displayVal = firstValKey ? latestReading?.values[firstValKey] : '--';

                return (
                  <div
                    key={def.id}
                    className="p-2 rounded-xl bg-[var(--bg)] border border-[var(--line)] flex items-center justify-between"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="text-[11px] font-semibold text-[var(--ink)] truncate">{def.name}</p>
                      <p className="text-[9px] text-[var(--muted)]">{def.unit || 'Indicador'}</p>
                    </div>
                    <span className="font-mono font-bold text-xs text-teal-600 dark:text-teal-400">
                      {displayVal}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--line)] text-center text-[11px] text-[var(--muted)]">
              <Cpu className="w-5 h-5 mx-auto mb-1 opacity-40 text-teal-500" />
              Nenhum indicador configurado ainda. Integre a extensão do Dimensio para capturar automaticamente.
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-[var(--line)] flex items-center justify-between text-[10px] text-[var(--muted)]">
        <span>Definições ativas: {metricDefinitions.length}</span>
        <span className="font-semibold text-teal-600 dark:text-teal-400 flex items-center gap-1">
          <TrendingUp className="w-3 h-3" /> Extensão Conectada
        </span>
      </div>
    </div>
  );
};
