'use strict';

const STORAGE_KEY = 'dimensioHighlight';
const WINDOW_KEY = 'dimensioWindowId';

const defaultState = () => ({ names: [], title: '', enabled: true });

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(STORAGE_KEY, (data) => {
    if (!data[STORAGE_KEY]) chrome.storage.local.set({ [STORAGE_KEY]: defaultState() });
  });
});

function broadcast(message) {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, message).catch(() => {});
    }
  });
}

function normalizeNames(names) {
  return Array.from(new Set((names || []).map((n) => (n || '').trim()).filter(Boolean)));
}

// Fecha a janela dedicada do sistema (botão "Fechar janela" na barra flutuante).
async function closeSystemWindow(windowId) {
  const data = await chrome.storage.local.get(WINDOW_KEY);
  const storedId = data[WINDOW_KEY];
  if (storedId == null) return;
  if (windowId != null && windowId !== storedId) return;
  try {
    const win = await chrome.windows.get(storedId);
    if (win) await chrome.windows.remove(storedId);
  } catch (e) {}
  await chrome.storage.local.remove(WINDOW_KEY);
}

// Localiza a aba do Dimensio (marcada com data-dimensio-app), foca e pede para
// abrir a Busca Global.
async function openGlobalSearchOnApp() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    try {
      const resp = await chrome.tabs.sendMessage(tab.id, { source: 'dimensio', action: 'openGlobalSearch' });
      if (resp && resp.ok) {
        try {
          await chrome.windows.update(tab.windowId, { focused: true });
          await chrome.tabs.update(tab.id, { active: true });
        } catch (e) {}
        break;
      }
    } catch (e) {
      /* aba sem content script instalado */
    }
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.source !== 'dimensio') return;
  if (msg.action === 'amIManaged') {
    chrome.storage.local.get(WINDOW_KEY, (data) => {
      sendResponse({ ok: !!sender && !!sender.tab && data[WINDOW_KEY] === sender.tab.windowId });
    });
    return true;
  }
  if (msg.action === 'closeSystem') {
    closeSystemWindow(sender && sender.tab && sender.tab.windowId);
    return false;
  }
  if (msg.action === 'openGlobalSearch') {
    openGlobalSearchOnApp();
    return false;
  }
});

// Resultados de coleta de métricas e seletores capturados pela extensão.
// Guarda um histórico local e encaminha para a aba do Dimensio (data-dimensio-app).
const RESULTS_KEY = 'dimensioMetricResults';

function relayToApp(message) {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, message).catch(() => {});
    }
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.source !== 'dimensio') return;
  if (msg.action === 'collectResult') {
    chrome.storage.local.get(RESULTS_KEY, (data) => {
      const results = Array.isArray(data[RESULTS_KEY]) ? data[RESULTS_KEY] : [];
      results.push({
        metricId: msg.metricId,
        values: msg.values || {},
        url: msg.url || '',
        capturedAt: new Date().toISOString(),
      });
      chrome.storage.local.set({ [RESULTS_KEY]: results.slice(-20) });
    });
    relayToApp({
      source: 'dimensio',
      action: 'metricResult',
      metricId: msg.metricId,
      values: msg.values || {},
      capturedBy: 'Extensão',
    });
    return false;
  }
  if (msg.action === 'pickResult') {
    relayToApp({
      source: 'dimensio',
      action: 'metricPickResult',
      metricId: msg.metricId,
      selector: msg.selector,
    });
    return false;
  }
  if (msg.action === 'flowResult') {
    relayToApp({
      source: 'dimensio',
      action: 'metricFlowResult',
      metricId: msg.metricId,
      flow: Array.isArray(msg.flow) ? msg.flow : [],
    });
    return false;
  }
  if (msg.action === 'countConfigResult') {
    relayToApp({
      source: 'dimensio',
      action: 'metricCountConfigResult',
      metricId: msg.metricId,
      countTerms: Array.isArray(msg.countTerms) ? msg.countTerms : [],
      countScope: msg.countScope || '',
    });
    return false;
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.source !== 'dimensio') return;
  chrome.storage.local.get(STORAGE_KEY, (data) => {
    const state = data[STORAGE_KEY] || defaultState();
    switch (msg.action) {
      case 'highlight':
        state.names = normalizeNames(msg.names);
        state.title = msg.title || state.title || '';
        state.enabled = true;
        break;
      case 'addName':
        state.names = normalizeNames([...state.names, msg.name]);
        break;
      case 'removeName':
        state.names = state.names.filter((n) => n !== msg.name);
        break;
      case 'setEnabled':
        state.enabled = msg.enabled !== false;
        break;
      case 'clear':
        state.names = [];
        state.title = '';
        break;
      case 'openSystem':
        openSystemWindow(msg.url);
        break;
    }
    chrome.storage.local.set({ [STORAGE_KEY]: state }, () => {
      broadcast({ source: 'dimensio', action: 'apply' });
      if (sendResponse) sendResponse({ ok: true, state });
    });
  });
  return true;
});

chrome.tabs.onRemoved.addListener(() => {});

// Abre URLs do sistema em uma única janela dedicada: o primeiro pedido cria a
// janela com uma guia; os demais pedidos abrem como novas guias da mesma
// janela. Se a janela foi fechada, uma nova é criada no próximo pedido.
async function openSystemWindow(url) {
  if (!url || typeof url !== 'string' || !/^https?:/.test(url)) return;
  const data = await chrome.storage.local.get(WINDOW_KEY);
  const existingId = data[WINDOW_KEY];
  if (existingId != null) {
    try {
      const win = await chrome.windows.get(existingId);
      if (win) {
        await chrome.tabs.create({ url, windowId: existingId });
        await chrome.windows.update(existingId, { focused: true });
        return;
      }
    } catch (e) {
      // Janela não existe mais (fechada/recriada): cai no fluxo abaixo.
    }
  }
  try {
    const win = await chrome.windows.create({ url, focused: true });
    await chrome.storage.local.set({ [WINDOW_KEY]: win.id });
  } catch (e) {}
}

// Reaplicar os nomes armazenados assim que uma aba termina de carregar
// (navegar para um novo pedido/sistema já abre a página marcada). Também cobre
// atualizações de página gerais e abas recém-criadas.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab && tab.url && /^https?:/.test(tab.url)) {
    chrome.storage.local.get(STORAGE_KEY, (data) => {
      const state = data[STORAGE_KEY] || defaultState();
      if (state.names && state.names.length) {
        chrome.tabs.sendMessage(tabId, { source: 'dimensio', action: 'apply' }).catch(() => {});
      }
    });
  }
});

chrome.tabs.onCreated.addListener(() => {
  chrome.storage.local.get(STORAGE_KEY, (data) => {
    const state = data[STORAGE_KEY] || defaultState();
    if (state.names && state.names.length) {
      broadcast({ source: 'dimensio', action: 'apply' });
    }
  });
});
