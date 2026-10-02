import React, { useState } from 'react';
import {
  Activity,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Copy,
  Check,
  X,
  Radio,
  Sliders,
  Info,
} from 'lucide-react';
import { useSwDiagnostics } from '../hooks/useSwDiagnostics';
import { useApp } from '../context/AppContext';

export const SwDiagnosticIndicator: React.FC = () => {
  const {
    isSupported,
    isRegistered,
    hasBackgroundSync,
    heartbeatCount,
    lastHeartbeatTs,
    lastHeartbeatDelta,
    maxHeartbeatDelta,
    isSuspensionDetected,
    totalSuspensionsCount,
    syncTriggerCount,
    lastSyncTs,
    lastSyncTag,
    isSyncFlashing,
    recentEvents,
    triggerSync,
    requestHeartbeat,
    copyReport,
  } = useSwDiagnostics();

  const { showNotice } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isTestingSync, setIsTestingSync] = useState(false);

  if (!isSupported) {
    return null;
  }

  const handleTestSync = async () => {
    setIsTestingSync(true);
    const ok = await triggerSync(`manual-test-${Date.now().toString(36).slice(-4)}`);
    if (ok) {
      showNotice('🔄 Tarefa de Background Sync solicitada! Observe o indicador visual piscar.');
    } else {
      showNotice('ℹ️ Background Sync disparado via canal de teste local.');
    }
    setTimeout(() => setIsTestingSync(false), 1200);
  };

  const handleCopy = () => {
    copyReport();
    setCopied(true);
    showNotice('📋 Relatório de diagnóstico copiado para a área de transferência!');
    setTimeout(() => setCopied(false), 2500);
  };

  const formattedLastSyncTime = lastSyncTs
    ? new Date(lastSyncTs).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  const formattedLastHeartbeatTime = lastHeartbeatTs
    ? new Date(lastHeartbeatTs).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <>
      {/* Visual Indicator Pill in Header */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`px-2 py-1 rounded-lg text-[10px] font-extrabold flex items-center gap-1.5 transition-all duration-300 cursor-pointer border shrink-0 ${
          isSyncFlashing
            ? 'bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 border-emerald-500 ring-2 ring-emerald-500/40 shadow-xs shadow-emerald-500/30 animate-pulse'
            : isSuspensionDetected
            ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
            : 'bg-[var(--bg)] text-[var(--muted)] border-[var(--line)] hover:text-[var(--ink)] hover:border-[var(--line-strong)]'
        }`}
        title={
          isSyncFlashing
            ? `Background Sync Disparado! Tag: ${lastSyncTag || 'sync'} às ${formattedLastSyncTime}`
            : isSuspensionDetected
            ? `Aviso: Processo foi pausado pelo navegador em segundo plano (${(
                (lastHeartbeatDelta || 0) / 1000
              ).toFixed(1)}s)`
            : `Service Worker Ativo | Heartbeats: ${heartbeatCount} | Syncs: ${syncTriggerCount}`
        }
        aria-label="Diagnóstico de Service Worker e Background Sync"
      >
        {isSyncFlashing ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <Zap className="w-3 h-3 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <span className="hidden sm:inline font-black tracking-tight">
              Sync 2º Plano: {lastSyncTag ? String(lastSyncTag).replace('radio-', '') : 'Ativo'}
            </span>
            <span className="sm:hidden font-black">Sync!</span>
          </>
        ) : isSuspensionDetected ? (
          <>
            <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
            <span className="hidden sm:inline font-bold">
              Pausa {((lastHeartbeatDelta || 0) / 1000).toFixed(0)}s
            </span>
            <span className="sm:hidden font-bold">Pausa</span>
          </>
        ) : (
          <>
            <Activity className="w-3 h-3 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <span className="hidden sm:inline font-bold">
              SW {hasBackgroundSync ? 'Sync' : 'Ativo'}
            </span>
            <span className="sm:hidden font-bold">SW</span>
          </>
        )}
      </button>

      {/* Diagnostic Details Modal */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sw-diagnostic-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div className="bg-[var(--paper)] border border-[var(--line)] rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-4 border-b border-[var(--line)] flex items-center justify-between bg-[var(--bg)]/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="sw-diagnostic-title" className="font-extrabold text-[var(--ink)] text-sm sm:text-base flex items-center gap-2">
                    Diagnóstico de Segundo Plano (Service Worker)
                    {isSyncFlashing && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500 text-white font-black animate-pulse">
                        SYNC ATIVO
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-[var(--muted)]">
                    Verificação de heartbeats e prevenção de encerramento em segundo plano
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-3)] rounded-lg transition-colors cursor-pointer"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              {/* Status Banner */}
              <div
                className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                  isSyncFlashing
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                    : isSuspensionDetected
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200'
                    : 'bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-200'
                }`}
              >
                {isSyncFlashing ? (
                  <Zap className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5 animate-bounce" />
                ) : isSuspensionDetected ? (
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <div className="font-extrabold text-xs">
                    {isSyncFlashing
                      ? `🔄 Evento de Background Sync Ativo: "${lastSyncTag || 'sync'}"`
                      : isSuspensionDetected
                      ? `⚠️ O navegador pausou o processo ao minimizar o app!`
                      : `✅ Processo em execução contínua no navegador`}
                  </div>
                  <p className="text-[11px] leading-relaxed text-[var(--muted)]">
                    {isSyncFlashing
                      ? `O evento de sincronização disparou com sucesso em segundo plano às ${formattedLastSyncTime}.`
                      : isSuspensionDetected
                      ? `Detectamos um atraso de ${(
                          (lastHeartbeatDelta || 0) / 1000
                        ).toFixed(1)}s no heartbeat. Ao minimizar no Android, o sistema tenta suspender o processo a menos que o áudio de suporte ou o Background Sync estejam mantendo-o ativo.`
                      : `Heartbeats regulares a cada ~5s estão sendo registrados no console.`}
                  </p>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl space-y-1">
                  <span className="text-[10px] text-[var(--muted)] font-bold flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[var(--primary)]" />
                    Último Intervalo (Delta)
                  </span>
                  <div className="font-black text-sm text-[var(--ink)]">
                    {lastHeartbeatDelta ? `${lastHeartbeatDelta} ms` : 'Aguardando...'}
                  </div>
                  <span className="text-[9.5px] text-[var(--muted)] block">
                    {formattedLastHeartbeatTime ? `Às ${formattedLastHeartbeatTime}` : 'Nenhum registro'}
                  </span>
                </div>

                <div className="p-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl space-y-1">
                  <span className="text-[10px] text-[var(--muted)] font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                    Maior Pausa Detectada
                  </span>
                  <div className="font-black text-sm text-[var(--ink)]">
                    {maxHeartbeatDelta > 0 ? `${(maxHeartbeatDelta / 1000).toFixed(1)} s` : '0 s (Sem pausas)'}
                  </div>
                  <span className="text-[9.5px] text-[var(--muted)] block">
                    {totalSuspensionsCount > 0
                      ? `${totalSuspensionsCount} suspensões registradas`
                      : 'Execução sem congelamento'}
                  </span>
                </div>

                <div className="p-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl space-y-1">
                  <span className="text-[10px] text-[var(--muted)] font-bold flex items-center gap-1">
                    <Zap className="w-3 h-3 text-emerald-500" />
                    Disparos de Background Sync
                  </span>
                  <div className="font-black text-sm text-[var(--ink)]">
                    {syncTriggerCount} eventos
                  </div>
                  <span className="text-[9.5px] text-[var(--muted)] block truncate" title={lastSyncTag || 'Nenhum'}>
                    {lastSyncTag ? `Tag: ${lastSyncTag}` : 'Nenhum disparo ainda'}
                  </span>
                </div>

                <div className="p-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl space-y-1">
                  <span className="text-[10px] text-[var(--muted)] font-bold flex items-center gap-1">
                    <Activity className="w-3 h-3 text-blue-500" />
                    Total de Heartbeats
                  </span>
                  <div className="font-black text-sm text-[var(--ink)]">
                    {heartbeatCount} ciclos
                  </div>
                  <span className="text-[9.5px] text-[var(--muted)] block">
                    {hasBackgroundSync ? 'Background Sync suportado' : 'Simulação de Sync'}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTestSync}
                  disabled={isTestingSync}
                  className="flex-1 min-w-[140px] px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50 text-[11px]"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingSync ? 'animate-spin' : ''}`} />
                  <span>Testar Background Sync</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    requestHeartbeat();
                    showNotice('💓 Heartbeat manual solicitado ao Service Worker!');
                  }}
                  className="px-3 py-2 bg-[var(--bg)] border border-[var(--line)] hover:bg-[var(--surface-3)] text-[var(--ink)] font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer text-[11px]"
                  title="Forçar ciclo de heartbeat imediato"
                >
                  <Activity className="w-3.5 h-3.5 text-blue-500" />
                  <span>Pulse Heartbeat</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 py-2 bg-[var(--bg)] border border-[var(--line)] hover:bg-[var(--surface-3)] text-[var(--ink)] font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer text-[11px]"
                  title="Copiar relatório completo"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copiado!' : 'Relatório'}</span>
                </button>
              </div>

              {/* Instructions Tip */}
              <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl space-y-1.5 text-[10.5px]">
                <div className="font-extrabold text-[var(--ink)] flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                  Como verificar se o navegador está matando o app ao minimizar:
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[var(--muted)] leading-relaxed pl-1">
                  <li>
                    Abra o <strong>DevTools Console (F12)</strong> ou conecte via <code>chrome://inspect</code> no Android.
                  </li>
                  <li>
                    Minimize o app ou desligue a tela por <strong>30 a 60 segundos</strong>.
                  </li>
                  <li>
                    Ao reabrir ou durante a execução, observe os registros <code>[SW Heartbeat]</code> e o indicador visual: se o delta passar de <strong>10s</strong>, o alerta amarelo indicará o tempo exato em que o SO congelou o processo.
                  </li>
                  <li>
                    Se o rádio PTT estiver ligado com a portadora contínua de áudio, o heartbeat manterá a cadência regular sem interrupções.
                  </li>
                </ol>
              </div>

              {/* Recent Events Log */}
              <div className="space-y-1.5">
                <div className="font-extrabold text-[var(--ink)] text-[11px] flex items-center justify-between">
                  <span>Log Recente de Eventos do Service Worker</span>
                  <span className="text-[9px] text-[var(--muted)] font-normal">
                    Console exibe logs completos
                  </span>
                </div>
                <div className="max-h-36 overflow-y-auto bg-[var(--bg)] border border-[var(--line)] rounded-xl p-2 font-mono text-[10px] space-y-1">
                  {recentEvents.length === 0 ? (
                    <div className="text-[var(--muted)] text-center py-3">
                      Aguardando eventos do Service Worker...
                    </div>
                  ) : (
                    recentEvents.slice(0, 10).map((ev) => (
                      <div
                        key={ev.id}
                        className={`flex items-center justify-between gap-2 p-1 rounded ${
                          ev.type === 'sync'
                            ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                            : ev.type === 'warning'
                            ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300'
                            : 'text-[var(--ink)]'
                        }`}
                      >
                        <span className="truncate flex-1">
                          {ev.type === 'sync' ? '🔄 ' : ev.type === 'warning' ? '⚠️ ' : '💓 '}
                          {ev.message}
                        </span>
                        <span className="text-[9px] text-[var(--muted)] shrink-0">
                          {new Date(ev.timestamp).toLocaleTimeString('pt-BR', { hour12: false })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 bg-[var(--bg)] border-t border-[var(--line)] flex items-center justify-between text-[11px]">
              <span className="text-[var(--muted)] text-[10px]">
                Dimensio Talk PWA Diagnostics • v1.5
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 bg-[var(--paper)] border border-[var(--line)] hover:bg-[var(--surface-3)] text-[var(--ink)] font-bold rounded-lg transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
