/**
 * Utilitário de Registro e Gestão do Service Worker com Background Sync API e Verificação Contínua de Versões.
 */

import { initSwDiagnostics } from './utils/swDiagnostics';

let swRegistration: ServiceWorkerRegistration | null = null;

export async function checkForAppUpdates(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const reg = swRegistration || (await navigator.serviceWorker.getRegistration());
    if (reg) {
      swRegistration = reg;
      // Se já houver um worker em espera (waiting), notifica imediatamente
      if (reg.waiting) {
        console.log('[SW] Versão atualizada encontrada em espera no Service Worker.');
        window.dispatchEvent(new CustomEvent('dimensio-update-available'));
        return true;
      }
      // Força a checagem no servidor por nova versão do script de Service Worker
      await reg.update();
      if (reg.waiting) {
        window.dispatchEvent(new CustomEvent('dimensio-update-available'));
        return true;
      }
    }
  } catch (err) {
    console.debug('[SW] Verificação de atualização:', err);
  }
  return false;
}

export async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.log('[SW] Service Worker não é suportado neste navegador.');
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    swRegistration = reg;
    console.log('[SW] Service Worker registrado com sucesso:', reg.scope);

    // Inicializa o utilitário de diagnóstico contínuo de heartbeats e background sync
    initSwDiagnostics();

    // Se já existia um worker aguardando quando o app foi aberto:
    if (reg.waiting && navigator.serviceWorker.controller) {
      console.log('[SW] Nova versão já estava instalada aguardando ativação.');
      window.dispatchEvent(new CustomEvent('dimensio-update-available'));
    }

    // Detecta uma nova versão do build instalada em segundo plano.
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker?.controller) {
          console.log('[SW] Nova versão instalada — recarregue a página para ativá-la.');
          window.dispatchEvent(new CustomEvent('dimensio-update-available'));
        }
      });
    });

    // Força checagem de versão imediatamente na abertura do app
    setTimeout(() => {
      checkForAppUpdates();
    }, 1500);

    // Escuta mensagens do SW caso ele solicite ressincronização
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'DIMENSIO_RADIO_BACKGROUND_SYNC') {
        console.log('[SW Event] Recebido sinal de sincronização em segundo plano do Service Worker:', event.data);
        window.dispatchEvent(new CustomEvent('dimensio-radio-sw-sync', { detail: event.data }));
      }
    });

    // Aguarda o Service Worker estar ativo (ready) antes de registrar Background Sync
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => {
        triggerRadioBackgroundSync('radio-state-sync');
      }).catch(() => {});
    }

    return reg;
  } catch (error) {
    console.warn('[SW] Falha ao registrar Service Worker:', error);
    return null;
  }
}

/**
 * Solicita o registro de uma tarefa da API Background Sync no Service Worker.
 */
export async function triggerRadioBackgroundSync(tag = 'radio-sync-pending'): Promise<boolean> {
  try {
    if ('serviceWorker' in navigator) {
      const readyReg = await navigator.serviceWorker.ready.catch(() => null);
      if (readyReg) {
        swRegistration = readyReg;
      }
    }

    if (swRegistration && 'sync' in swRegistration) {
      // TypeScript type assertion for SyncManager
      const syncReg = swRegistration as ServiceWorkerRegistration & {
        sync: { register: (tag: string) => Promise<void> };
      };
      await syncReg.sync.register(tag);
      console.log(`[Background Sync] Tarefa "${tag}" registrada com sucesso.`);
      return true;
    }
  } catch (err) {
    console.debug(`[Background Sync] Não foi possível registrar a tag "${tag}":`, err);
  }
  return false;
}

// Auto-trigger background sync e verificação de versão em reconexão de rede ou quando o app acorda de suspensão
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[Network] Conectividade reestabelecida. Solicitando Background Sync e checando versão...');
    triggerRadioBackgroundSync('radio-sync-pending');
    checkForAppUpdates();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      console.log('[App Resume] Dispositivo reativado/visível. Solicitando Background Sync e checando versão...');
      triggerRadioBackgroundSync('radio-sync-pending');
      checkForAppUpdates();
    }
  });

  // Verificação periódica a cada 5 minutos
  setInterval(() => {
    checkForAppUpdates();
  }, 5 * 60 * 1000);
}
