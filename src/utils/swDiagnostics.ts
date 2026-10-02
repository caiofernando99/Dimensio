/**
 * Utilitário de Diagnóstico do Service Worker e Background Sync
 *
 * Registra intervalos de heartbeat no console, calcula pausas/congelamento
 * do processo pelo navegador ao minimizar, e gerencia os eventos de sincronização
 * em segundo plano para exibição de indicadores visuais na interface.
 */

export interface DiagnosticEvent {
  id: string;
  type: 'heartbeat' | 'sync' | 'warning' | 'delay';
  timestamp: number;
  message: string;
  deltaMs?: number;
  tag?: string;
}

export interface SwDiagnosticState {
  isSupported: boolean;
  isRegistered: boolean;
  hasBackgroundSync: boolean;
  heartbeatCount: number;
  lastHeartbeatTs: number | null;
  lastHeartbeatDelta: number | null;
  maxHeartbeatDelta: number;
  isSuspensionDetected: boolean;
  totalSuspensionsCount: number;
  syncTriggerCount: number;
  lastSyncTs: number | null;
  lastSyncTag: string | null;
  isSyncFlashing: boolean;
  recentEvents: DiagnosticEvent[];
}

let currentState: SwDiagnosticState = {
  isSupported: typeof window !== 'undefined' && 'serviceWorker' in navigator,
  isRegistered: false,
  hasBackgroundSync: false,
  heartbeatCount: 0,
  lastHeartbeatTs: null,
  lastHeartbeatDelta: null,
  maxHeartbeatDelta: 0,
  isSuspensionDetected: false,
  totalSuspensionsCount: 0,
  syncTriggerCount: 0,
  lastSyncTs: null,
  lastSyncTag: null,
  isSyncFlashing: false,
  recentEvents: [],
};

const listeners = new Set<(state: SwDiagnosticState) => void>();
let flashTimer: ReturnType<typeof setTimeout> | null = null;
let clientHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
let lastClientHeartbeatTs = Date.now();

function notifyListeners() {
  const snapshot = { ...currentState };
  listeners.forEach((fn) => fn(snapshot));
}

function addEvent(event: Omit<DiagnosticEvent, 'id'>) {
  const item: DiagnosticEvent = {
    ...event,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  };
  currentState.recentEvents = [item, ...currentState.recentEvents].slice(0, 30);
}

/**
 * Registra no console estilizado e atualiza estado de heartbeat
 */
export function handleHeartbeatReceived(data: {
  count: number;
  timestamp: number;
  delta: number;
  isDelayed?: boolean;
  uptimeSec?: number;
}) {
  const { count, timestamp, delta, isDelayed } = data;
  currentState.heartbeatCount = count;
  currentState.lastHeartbeatTs = timestamp;
  currentState.lastHeartbeatDelta = delta;

  if (delta > currentState.maxHeartbeatDelta) {
    currentState.maxHeartbeatDelta = delta;
  }

  const timeStr = new Date(timestamp).toLocaleTimeString('pt-BR', { hour12: false });
  const deltaSec = (delta / 1000).toFixed(2);

  if (isDelayed || delta > 10000) {
    currentState.isSuspensionDetected = true;
    currentState.totalSuspensionsCount++;

    console.warn(
      `%c[SW Diagnóstico]%c ⚠️ Alerta de Suspensão de Segundo Plano! Heartbeat #${count} atrasou por ${deltaSec}s (esperado: ~5s). ` +
      `O navegador/Android provavelmente congelou o processo enquanto o app estava minimizado.`,
      'background: #f59e0b; color: #000; font-weight: bold; padding: 2px 4px; border-radius: 3px;',
      'color: #f59e0b; font-weight: bold;'
    );

    addEvent({
      type: 'warning',
      timestamp,
      deltaMs: delta,
      message: `Suspensão detectada: atraso de ${deltaSec}s no heartbeat #${count}`,
    });
  } else {
    currentState.isSuspensionDetected = false;
    console.log(
      `%c[SW Heartbeat]%c #${count} às ${timeStr} | Intervalo: ${delta}ms (${deltaSec}s) | Status: EM EXECUÇÃO`,
      'background: #0284c7; color: white; padding: 2px 5px; border-radius: 3px; font-weight: 500;',
      'color: #0284c7;'
    );

    addEvent({
      type: 'heartbeat',
      timestamp,
      deltaMs: delta,
      message: `Heartbeat #${count} ativo (intervalo: ${delta}ms)`,
    });
  }

  notifyListeners();
}

/**
 * Manipula o evento de Background Sync recebido do Service Worker
 */
export function handleBackgroundSyncTriggered(data: {
  tag: string;
  timestamp: number;
  syncCount: number;
  deltaSinceLastSync?: number;
}) {
  const { tag, timestamp, syncCount, deltaSinceLastSync } = data;
  currentState.syncTriggerCount = syncCount;
  currentState.lastSyncTs = timestamp;
  currentState.lastSyncTag = tag;
  currentState.isSyncFlashing = true;

  const timeStr = new Date(timestamp).toLocaleTimeString('pt-BR', { hour12: false });
  const deltaMsg = deltaSinceLastSync ? ` (intervalo desde o último: ${(deltaSinceLastSync / 1000).toFixed(1)}s)` : '';

  console.log(
    `%c[SW Sync Indicator]%c 🔄 Evento de Background Sync disparado no Service Worker! ` +
    `Tag: "${tag}" às ${timeStr}${deltaMsg} [Disparo #${syncCount}]`,
    'background: #10b981; color: white; font-weight: bold; padding: 3px 6px; border-radius: 4px;',
    'color: #10b981; font-weight: bold;'
  );

  addEvent({
    type: 'sync',
    timestamp,
    tag,
    message: `Background Sync disparado: tag "${tag}" (disparo #${syncCount})`,
  });

  if (flashTimer) clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    currentState.isSyncFlashing = false;
    notifyListeners();
  }, 8000);

  // Notifica o restante da aplicação via CustomEvent
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('dimensio-sw-sync-triggered', {
        detail: { tag, timestamp, syncCount },
      })
    );
  }

  notifyListeners();
}

/**
 * Inicializa os ouvintes do Service Worker para diagnósticos
 */
export function initSwDiagnostics(): () => void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return () => {};
  }

  // Verifica suporte a Background Sync
  navigator.serviceWorker.ready.then((reg) => {
    currentState.isRegistered = true;
    currentState.hasBackgroundSync = 'sync' in reg;
    notifyListeners();
  }).catch(() => {});

  const handleMessage = (event: MessageEvent) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'SW_HEARTBEAT_DIAGNOSTIC') {
      handleHeartbeatReceived(data);
    } else if (data.type === 'SW_BACKGROUND_SYNC_TRIGGERED') {
      handleBackgroundSyncTriggered(data);
    } else if (data.type === 'DIMENSIO_RADIO_BACKGROUND_SYNC') {
      handleBackgroundSyncTriggered({
        tag: data.tag || 'radio-sync-pending',
        timestamp: data.timestamp || Date.now(),
        syncCount: currentState.syncTriggerCount + 1,
      });
    }
  };

  navigator.serviceWorker.addEventListener('message', handleMessage);

  // Monitora também pausas no lado cliente (visibilitychange)
  const handleVisibility = () => {
    const now = Date.now();
    const elapsedSinceLastClientBeat = now - lastClientHeartbeatTs;
    lastClientHeartbeatTs = now;

    if (document.visibilityState === 'visible') {
      if (elapsedSinceLastClientBeat > 8000) {
        console.info(
          `%c[Diagnóstico de Retomada]%c App voltou ao primeiro plano após ${(elapsedSinceLastClientBeat / 1000).toFixed(1)}s em segundo plano/oculto.`,
          'background: #8b5cf6; color: white; padding: 2px 4px; border-radius: 3px;',
          'color: #8b5cf6;'
        );
      }
      // Requisita métricas atualizadas ao Service Worker
      requestSwDiagnostics();
    }
  };

  document.addEventListener('visibilitychange', handleVisibility);

  // Heartbeat do cliente para verificar se o JS da página continua rodando
  clientHeartbeatTimer = setInterval(() => {
    lastClientHeartbeatTs = Date.now();
  }, 4000);

  return () => {
    navigator.serviceWorker.removeEventListener('message', handleMessage);
    document.removeEventListener('visibilitychange', handleVisibility);
    if (clientHeartbeatTimer) clearInterval(clientHeartbeatTimer);
  };
}

/**
 * Solicita ao Service Worker a execução de um ciclo de diagnóstico
 */
export function requestSwDiagnostics(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then((reg) => {
    if (reg.active) {
      reg.active.postMessage({ type: 'TRIGGER_SW_HEARTBEAT' });
    }
  }).catch(() => {});
}

/**
 * Dispara uma sincronização em segundo plano de diagnóstico via API Background Sync
 */
export async function triggerDiagnosticBackgroundSync(tag = 'sw-diagnostic-sync'): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    console.warn('[SW Diagnostic] Service Worker não suportado.');
    return false;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    if ('sync' in reg) {
      const syncReg = reg as ServiceWorkerRegistration & {
        sync: { register: (tag: string) => Promise<void> };
      };
      await syncReg.sync.register(tag);
      console.log(`%c[SW Diagnostic]%c Registro de Background Sync solicitado com a tag: "${tag}"`, 'color: #0284c7; font-weight: bold;', '');
      return true;
    } else {
      console.warn('[SW Diagnostic] API Background Sync (SyncManager) não é suportada por este navegador.');
      // Simula localmente via mensagem para teste em navegadores sem suporte nativo
      reg.active?.postMessage({
        type: 'SIMULATE_BACKGROUND_SYNC',
        tag,
      });
      return false;
    }
  } catch (err) {
    console.error('[SW Diagnostic] Falha ao registrar Background Sync:', err);
    return false;
  }
}

/**
 * Inscreve um ouvinte para alterações no estado de diagnóstico
 */
export function subscribeSwDiagnostics(callback: (state: SwDiagnosticState) => void): () => void {
  listeners.add(callback);
  callback({ ...currentState });
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Gera relatório legível de diagnóstico para análise
 */
export function getDiagnosticReportText(): string {
  const s = currentState;
  return `=== RELATÓRIO DE DIAGNÓSTICO DO SERVICE WORKER & SEGUNDO PLANO ===
Data: ${new Date().toLocaleString('pt-BR')}
Navegador Suporta SW: ${s.isSupported ? 'Sim' : 'Não'}
SW Registrado: ${s.isRegistered ? 'Sim' : 'Não'}
Suporte à API Background Sync: ${s.hasBackgroundSync ? 'Sim' : 'Não'}

--- HEARTBEATS DO SERVICE WORKER ---
Total de Heartbeats Registrados: ${s.heartbeatCount}
Último Heartbeat: ${s.lastHeartbeatTs ? new Date(s.lastHeartbeatTs).toLocaleTimeString('pt-BR') : 'Nenhum'}
Último Intervalo (Delta): ${s.lastHeartbeatDelta ? `${s.lastHeartbeatDelta}ms` : 'N/A'}
Maior Atraso Detectado: ${s.maxHeartbeatDelta ? `${(s.maxHeartbeatDelta / 1000).toFixed(1)}s` : 'Nenhum'}
Suspensões Detectadas pelo Navegador: ${s.totalSuspensionsCount}

--- BACKGROUND SYNC ---
Total de Sincronizações Disparadas: ${s.syncTriggerCount}
Último Sync Disparado: ${s.lastSyncTs ? new Date(s.lastSyncTs).toLocaleTimeString('pt-BR') : 'Nenhum'}
Última Tag de Sync: ${s.lastSyncTag || 'Nenhuma'}

--- EVENTOS RECENTES ---
${s.recentEvents
  .slice(0, 10)
  .map(
    (e) =>
      `[${new Date(e.timestamp).toLocaleTimeString('pt-BR')}] [${e.type.toUpperCase()}] ${e.message}`
  )
  .join('\n')}
===================================================================`;
}
