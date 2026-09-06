// Dimensio Chrome Extension — Background Service Worker (Manifest V3)

// Setup periodic alarm for background checks (e.g. every 5 minutes)
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Dimensio Extension] Extensão instalada com sucesso!');

  // Create alarm for periodic background check
  chrome.alarms.create('dimensio_background_check', {
    periodInMinutes: 5,
  });

  // Set initial badge text
  chrome.action.setBadgeText({ text: 'OK' });
  chrome.action.setBadgeBackgroundColor({ color: '#4f46e5' });
});

// Alarm Listener for background tasks
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'dimensio_background_check') {
    checkPendingOperationalAlerts();
  }
});

// Function to trigger native Chrome OS notifications
function sendChromeNotification(id, title, message) {
  chrome.notifications.create(id, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: title || 'Dimensio — Alerta Operacional',
    message: message || 'Você tem uma atualização de escala ou intervalo pendente.',
    priority: 2,
    requireInteraction: false
  });
}

// Simulated background check handler
function checkPendingOperationalAlerts() {
  chrome.storage.local.get(['dimensio_last_check', 'dimensio_active_shift'], (result) => {
    const lastCheck = result.dimensio_last_check || 0;
    const now = Date.now();

    // Update badge or send notification if needed
    chrome.action.setBadgeText({ text: 'LIVE' });
    chrome.storage.local.set({ dimensio_last_check: now });
  });
}

// Message Listener from Popup or Content Script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'TEST_BACKGROUND_NOTIFICATION') {
    sendChromeNotification(
      'test_notif_' + Date.now(),
      request.title || 'Dimensio — Teste de Notificação',
      request.message || 'Notificação em segundo plano via Extensão Chrome funcionando perfeitamente!'
    );
    sendResponse({ success: true, timestamp: new Date().toISOString() });
  }

  if (request.action === 'GET_STATUS') {
    sendResponse({ active: true, version: '1.0.0' });
  }

  return true;
});

// Notification Click Listener
chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.tabs.create({ url: 'https://dimensio.app/' });
});

// ── Métricas: recebe coletas/seletores e entrega na página do Dimensio ─────
const RESULTS_KEY = 'dimensioMetricResults';

function dispatchToAllTabs(eventName, payload) {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id == null) continue;
      chrome.scripting
        .executeScript({
          target: { tabId: tab.id },
          func: (name, detail) => {
            try {
              document.dispatchEvent(new CustomEvent(name, { detail }));
            } catch (e) {}
          },
          args: [eventName, payload],
        })
        .catch(() => {});
    }
  });
}

chrome.runtime.onMessage.addListener((request) => {
  if (!request || request.source !== 'dimensio') return;
  if (request.action === 'collectResult') {
    chrome.storage.local.get(RESULTS_KEY, (data) => {
      const results = Array.isArray(data[RESULTS_KEY]) ? data[RESULTS_KEY] : [];
      results.push({
        metricId: request.metricId,
        values: request.values || {},
        url: request.url || '',
        capturedAt: new Date().toISOString(),
      });
      chrome.storage.local.set({ [RESULTS_KEY]: results.slice(-20) });
    });
    dispatchToAllTabs('dimensio-metric-result', {
      metricId: request.metricId,
      values: request.values || {},
      capturedBy: 'Extensão',
    });
  } else if (request.action === 'pickResult') {
    dispatchToAllTabs('dimensio-metric-pick-result', {
      metricId: request.metricId,
      selector: request.selector,
    });
  }
});
