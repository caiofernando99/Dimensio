// Service Worker com Diagnóstico Contínuo de Heartbeat e Suporte a Background Sync
const CACHE_NAME = 'dimensio-radio-v2';
const DB_NAME = 'DimensioRadioDB';
const STORE_NAME = 'radioState';
const CONFIG_KEY = 'radio_config';

// Estado de Diagnóstico Interno do Service Worker
let heartbeatCount = 0;
let lastHeartbeatTime = Date.now();
let totalSyncEvents = 0;
let lastSyncEventTime = 0;
let lastSyncTag = '';
const swStartTime = Date.now();
let heartbeatTimer = null;

// Função diagnóstica que calcula intervalos e emite heartbeat para o console
function runDiagnosticHeartbeat(triggerReason = 'timer') {
  const now = Date.now();
  const delta = now - lastHeartbeatTime;
  heartbeatCount++;
  lastHeartbeatTime = now;

  const isDelayed = delta > 12000;
  const timeStr = new Date(now).toLocaleTimeString('pt-BR', { hour12: false });
  const deltaSec = (delta / 1000).toFixed(2);
  const uptimeSec = Math.round((now - swStartTime) / 1000);

  if (isDelayed) {
    console.warn(
      `[SW Diagnostic] ⚠️ Processo acordou após atraso de ${deltaSec}s! ` +
      `O navegador/Android provavelmente congelou o Service Worker enquanto estava em segundo plano. ` +
      `(Heartbeat #${heartbeatCount} às ${timeStr} | Motivo: ${triggerReason})`
    );
  } else {
    console.log(
      `[SW Diagnostic] 💓 Heartbeat #${heartbeatCount} às ${timeStr} | ` +
      `Intervalo: ${delta}ms (${deltaSec}s) | Status: ATIVO | Uptime: ${uptimeSec}s`
    );
  }

  // Notifica clientes da janela para manter o painel de diagnóstico atualizado
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      client.postMessage({
        type: 'SW_HEARTBEAT_DIAGNOSTIC',
        count: heartbeatCount,
        timestamp: now,
        delta,
        isDelayed,
        uptimeSec,
        totalSyncs: totalSyncEvents,
        lastSyncTag,
        lastSyncEventTime,
      });
    }
  }).catch(() => {});
}

self.addEventListener('install', (event) => {
  console.log('[SW Lifecycle] Service Worker instalado com utilitário de diagnóstico de heartbeat.');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW Lifecycle] Service Worker ativado e controlando clientes.');
  event.waitUntil(self.clients.claim());

  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => {
    runDiagnosticHeartbeat('interval');
  }, 5000);
});

// Helper para ler estado do IndexedDB no Service Worker
async function getPersistedRadioState() {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          resolve(null);
          return;
        }
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(CONFIG_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      };
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

// Handler da API Background Sync com diagnóstico de execução
self.addEventListener('sync', (event) => {
  totalSyncEvents++;
  const now = Date.now();
  const deltaSinceLastSync = lastSyncEventTime ? now - lastSyncEventTime : 0;
  lastSyncEventTime = now;
  lastSyncTag = event.tag;

  console.log(
    `%c[SW Background Sync Event]%c 🔄 Evento de sincronização disparado pelo navegador! ` +
    `Tag: "${event.tag}" às ${new Date(now).toLocaleTimeString()} (Delta desde último sync: ${(deltaSinceLastSync / 1000).toFixed(1)}s, Total: ${totalSyncEvents})`,
    'background: #10b981; color: white; font-weight: bold; padding: 2px 6px; border-radius: 4px;',
    'color: inherit;'
  );

  event.waitUntil(
    (async () => {
      // 1. Notifica todos os clientes ativos com payload de diagnóstico para o indicador visual da UI
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of allClients) {
        client.postMessage({
          type: 'SW_BACKGROUND_SYNC_TRIGGERED',
          tag: event.tag,
          timestamp: now,
          syncCount: totalSyncEvents,
          deltaSinceLastSync,
        });

        // Compatibilidade com listener legado do rádio
        client.postMessage({
          type: 'DIMENSIO_RADIO_BACKGROUND_SYNC',
          tag: event.tag,
          timestamp: now,
        });
      }

      // Executa heartbeat para registrar o momento exato em que o background sync acordou o worker
      runDiagnosticHeartbeat(`background-sync:${event.tag}`);

      // 2. Se houver requisições pendentes gravadas no IndexedDB, realiza heartbeat na API
      const state = await getPersistedRadioState();
      if (state && state.enabled) {
        try {
          await fetch('/api/signal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'ping',
              peerId: 'sw-sync-keepalive',
              channel: state.activeChannel || 'geral',
              timestamp: now,
              syncTag: event.tag,
            }),
          });
        } catch (err) {
          console.warn('[SW Background Sync] Tentativa de ping falhou (sem rede):', err);
        }
      }
    })()
  );
});

// Suporte à API Periodic Background Sync (quando disponível no navegador)
self.addEventListener('periodicsync', (event) => {
  console.log('[SW Periodic Sync] Sincronização periódica disparada:', event.tag);
  runDiagnosticHeartbeat(`periodic-sync:${event.tag}`);
});

// Permite comunicação bidirecional com a aplicação principal
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'PING_SW') {
    event.ports[0]?.postMessage({
      status: 'active',
      bgSyncSupported: 'sync' in self.registration,
      heartbeatCount,
      totalSyncEvents,
    });
  } else if (event.data.type === 'TRIGGER_SW_HEARTBEAT') {
    runDiagnosticHeartbeat('manual-request');
  } else if (event.data.type === 'SIMULATE_BACKGROUND_SYNC') {
    const simTag = event.data.tag || 'simulated-sync';
    totalSyncEvents++;
    const now = Date.now();
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        client.postMessage({
          type: 'SW_BACKGROUND_SYNC_TRIGGERED',
          tag: simTag,
          timestamp: now,
          syncCount: totalSyncEvents,
          simulated: true,
        });
      }
    });
  } else if (event.data.type === 'SHOW_NOTIFICATION') {
    const payload = event.data.payload || {};
    self.registration.showNotification(payload.title || 'Dimensio', {
      body: payload.body || '',
      icon: payload.icon || '/icons/icon-192.png',
      badge: payload.badge || '/icons/badge-96.png',
      tag: payload.tag || 'dimensio-bg-alert',
      vibrate: payload.vibrate || [200, 100, 200],
      renotify: true,
      data: { url: payload.url || '/' },
    });
  }
});

// Manipulador de clique em notificações no Android (abre ou foca a janela do Dimensio)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se houver uma janela aberta do Dimensio, foca nela
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client && urlToOpen !== '/') {
            client.navigate(urlToOpen);
          }
          return client.focus();
        }
      }
      // Se nenhuma estiver aberta, abre uma nova janela/aba do app
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// Suporte a Web Push Notifications caso configurado
self.addEventListener('push', (event) => {
  let data = { title: 'Dimensio Alerta', body: 'Nova notificação operacional' };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Dimensio', {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: 'dimensio-push-alert',
      vibrate: [250, 100, 250],
      renotify: true,
      data: { url: data.url || '/' },
    })
  );
});

