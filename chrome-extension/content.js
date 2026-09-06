// Dimensio Content Script for Google Sheets or Partner Webpages
console.log('[Dimensio Extension] Content script carregado.');

const COLLECTS_KEY = 'dimensioCollects';
const PICKS_KEY = 'dimensioPicks';
const PICKER_ID = 'dimensio-picker';

let pendingCollects = [];
let pendingPicks = [];
let collectInFlight = new Set();
let pickerActive = false;
let pickerMetricId = null;
let pickerFieldTarget = null;
let pickerDebounce = null;

// Bridge between webpage and Dimensio Chrome Extension background service worker
window.addEventListener('message', (event) => {
  const d = event && event.data;
  if (!d) return;
  if (d.source === 'DIMENSIO_WEB_APP' && d.action === 'TRIGGER_NOTIFICATION') {
    chrome.runtime.sendMessage({
      action: 'TEST_BACKGROUND_NOTIFICATION',
      title: d.title,
      message: d.message,
    });
  }
  if (d.source === 'DIMENSIO_APP' && d.type === 'DIMENSIO_COLLECT') {
    const c = d.collect;
    if (c && c.requestId && c.metricId) {
      loadCollects(() => {
        if (!pendingCollects.some((x) => x.requestId === c.requestId)) {
          pendingCollects.push(c);
          saveCollects();
        }
      });
    }
  } else if (d.source === 'DIMENSIO_APP' && d.type === 'DIMENSIO_PICK_START') {
    const p = d.pick;
    if (p && p.metricId && p.url) {
      loadPicks(() => {
        if (!pendingPicks.some((x) => x.metricId === p.metricId)) {
          pendingPicks.push(p);
          savePicks();
        }
      });
    }
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.source !== 'dimensio') return;
  if (msg.action === 'collectNow') runCollectNow(msg.requestId);
  else if (msg.action === 'startPicker') startPicker(msg.metricId);
});

// ── Engine de coleta de métricas (poderes Automa) ─────────────────────────
function loadCollects(cb) {
  chrome.storage.local.get(COLLECTS_KEY, (data) => {
    pendingCollects = Array.isArray(data[COLLECTS_KEY]) ? data[COLLECTS_KEY] : [];
    if (cb) cb();
  });
}

function saveCollects(cb) {
  chrome.storage.local.set({ [COLLECTS_KEY]: pendingCollects }, () => cb && cb());
}

function loadPicks(cb) {
  chrome.storage.local.get(PICKS_KEY, (data) => {
    pendingPicks = Array.isArray(data[PICKS_KEY]) ? data[PICKS_KEY] : [];
    if (cb) cb();
  });
}

function savePicks(cb) {
  chrome.storage.local.set({ [PICKS_KEY]: pendingPicks }, () => cb && cb());
}

function matchesUrl(targetUrl) {
  if (!targetUrl) return false;
  try {
    const target = new URL(targetUrl, location.href);
    if (target.origin !== location.origin) return false;
    const tPath = (target.pathname || '/').replace(/\/+$/, '') || '/';
    const curPath = (location.pathname || '/').replace(/\/+$/, '') || '/';
    if (tPath === '/') return true;
    return curPath === tPath || curPath.startsWith(tPath + '/') || tPath.startsWith(curPath + '/');
  } catch {
    return false;
  }
}

function extractFieldValue(field) {
  try {
    const el = document.querySelector(field.selector);
    if (!el) return null;
    const mode = field.mode || 'text';
    if (mode === 'attribute') return (el.getAttribute(field.attribute) || '').trim() || null;
    if (mode === 'value') {
      const v = el.value !== undefined ? el.value : el.textContent;
      return String(v).trim() || null;
    }
    return (el.textContent || '').trim() || null;
  } catch {
    return null;
  }
}

function waitForSelector(selector, timeoutMs, intervalMs) {
  return new Promise((resolve) => {
    const deadline = Date.now() + (timeoutMs || 8000);
    const probe = () => {
      const el = selector ? document.querySelector(selector) : null;
      if (el || Date.now() > deadline) return resolve(el);
      setTimeout(probe, intervalMs || 300);
    };
    probe();
  });
}

async function runCollect(request) {
  if (!request || collectInFlight.has(request.requestId)) return;
  if (!matchesUrl(request.url)) return;
  collectInFlight.add(request.requestId);
  try {
    const fields = Array.isArray(request.fields) ? request.fields : [];
    const values = {};
    for (const f of fields) {
      if (!f || !f.selector) continue;
      const el = await waitForSelector(f.selector);
      if (el) {
        const v = extractFieldValue(f);
        if (v != null) values[f.id] = v;
      }
    }
    if (Object.keys(values).length > 0) {
      chrome.runtime
        .sendMessage({
          source: 'dimensio',
          action: 'collectResult',
          requestId: request.requestId,
          metricId: request.metricId,
          values,
          url: location.href,
        })
        .catch(() => {});
    }
    pendingCollects = pendingCollects.filter((c) => c.requestId !== request.requestId);
    saveCollects();
  } finally {
    collectInFlight.delete(request.requestId);
  }
}

function runPendingCollects() {
  loadCollects(() => {
    pendingCollects.filter((c) => matchesUrl(c.url)).forEach((c) => runCollect(c));
  });
}

function runCollectNow(requestId) {
  loadCollects(() => {
    const req = pendingCollects.find((c) => c.requestId === requestId);
    if (req) runCollect(req);
  });
}

// ── Seletor de elementos (estilo Automa) ───────────────────────────────────
function escapeCss(str) {
  return String(str).replace(/([^a-zA-Z0-9\-_])/g, '\\$1');
}

function buildSelector(el) {
  if (!el || el.nodeType !== 1) return null;
  const path = [];
  let node = el;
  while (node && node.nodeType === 1 && node !== document.body && node !== document.documentElement) {
    let part = node.tagName.toLowerCase();
    if (node.id) {
      part = part + '#' + escapeCss(node.id);
      path.unshift(part);
      break;
    }
    const stableAttrs = ['data-testid', 'data-codigo', 'data-id', 'name', 'title'];
    for (const attr of stableAttrs) {
      const v = node.getAttribute(attr);
      if (v) {
        part = part + '[' + attr + '="' + escapeCss(v) + '"]';
        break;
      }
    }
    const parent = node.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter((s) => s.tagName === node.tagName);
      if (siblings.length > 1) {
        part = part + ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')';
      }
    }
    path.unshift(part);
    node = parent;
  }
  return path.join(' > ');
}

function ensurePickerOverlay() {
  let overlay = document.getElementById(PICKER_ID + '-overlay');
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = PICKER_ID + '-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483646;pointer-events:none;';
  const box = document.createElement('div');
  box.id = PICKER_ID + '-box';
  box.style.cssText =
    'position:absolute;display:none;border:2px dashed #4f46e5;background:rgba(79,70,229,.12);' +
    'border-radius:4px;pointer-events:none;box-shadow:0 0 0 2px rgba(79,70,229,.25);';
  overlay.appendChild(box);
  document.documentElement.appendChild(overlay);
  return overlay;
}

function showPickerBar(metricId) {
  const existing = document.getElementById(PICKER_ID + '-bar');
  if (existing) existing.remove();
  const bar = document.createElement('div');
  bar.id = PICKER_ID + '-bar';
  bar.style.cssText =
    'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:2147483647;' +
    'background:#ffffff;color:#111827;border:1px solid #d1d5db;border-radius:12px;' +
    'box-shadow:0 10px 30px rgba(0,0,0,.25);font-family:system-ui,sans-serif;font-size:12px;' +
    'max-width:520px;width:max-content;padding:8px 10px;display:flex;align-items:center;gap:8px;';
  const info = document.createElement('span');
  info.style.cssText = 'font-weight:700;white-space:nowrap;';
  info.textContent = 'Clique no elemento que contém o valor';
  const sel = document.createElement('code');
  sel.id = PICKER_ID + '-sel';
  sel.style.cssText =
    'flex:1;min-width:140px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:6px;' +
    'padding:3px 6px;font-size:11px;color:#4b5563;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
  sel.textContent = 'Seletor: —';
  const saveBtn = document.createElement('button');
  saveBtn.id = PICKER_ID + '-save';
  saveBtn.textContent = 'Usar seletor';
  saveBtn.disabled = true;
  saveBtn.style.cssText =
    'background:#4f46e5;color:#fff;border:none;border-radius:8px;padding:5px 10px;font-weight:700;cursor:pointer;font-size:11px;';
  saveBtn.addEventListener('click', () => {
    const css = sel.dataset.css;
    if (!css) return;
    chrome.runtime
      .sendMessage({
        source: 'dimensio',
        action: 'pickResult',
        metricId,
        selector: css,
        url: location.href,
      })
      .catch(() => {});
    exitPicker();
  });
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancelar';
  cancelBtn.style.cssText =
    'background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:5px 10px;font-weight:700;cursor:pointer;font-size:11px;color:#374151;';
  cancelBtn.addEventListener('click', exitPicker);
  bar.appendChild(info);
  bar.appendChild(sel);
  bar.appendChild(saveBtn);
  bar.appendChild(cancelBtn);
  document.documentElement.appendChild(bar);
}

function onPickerMove(e) {
  clearTimeout(pickerDebounce);
  pickerDebounce = setTimeout(() => {
    const box = document.getElementById(PICKER_ID + '-box');
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el.closest('[data-dimensio-ui]') || el.closest('#' + PICKER_ID)) {
      if (box) box.style.display = 'none';
      return;
    }
    const r = el.getBoundingClientRect();
    if (box) {
      box.style.display = 'block';
      box.style.left = r.left + 'px';
      box.style.top = r.top + 'px';
      box.style.width = r.width + 'px';
      box.style.height = r.height + 'px';
    }
    pickerFieldTarget = el;
  }, 30);
}

function onPickerClick(e) {
  if (!pickerActive) return;
  e.preventDefault();
  e.stopPropagation();
  const el = pickerFieldTarget || document.elementFromPoint(e.clientX, e.clientY);
  if (!el || el.closest('[data-dimensio-ui]') || el.closest('#' + PICKER_ID)) return;
  const css = buildSelector(el);
  if (!css) return;
  const sel = document.getElementById(PICKER_ID + '-sel');
  const saveBtn = document.getElementById(PICKER_ID + '-save');
  if (sel) {
    sel.textContent = 'Seletor: ' + css;
    sel.dataset.css = css;
  }
  if (saveBtn) saveBtn.disabled = false;
  const box = document.getElementById(PICKER_ID + '-box');
  if (box) box.style.display = 'none';
}

function onPickerKey(e) {
  if (e.key === 'Escape') exitPicker();
}

function startPicker(metricId) {
  exitPicker();
  pickerActive = true;
  pickerMetricId = metricId;
  ensurePickerOverlay();
  showPickerBar(metricId);
  document.addEventListener('mousemove', onPickerMove, true);
  document.addEventListener('click', onPickerClick, true);
  document.addEventListener('keydown', onPickerKey, true);
}

function exitPicker() {
  pickerActive = false;
  pickerMetricId = null;
  pickerFieldTarget = null;
  document.removeEventListener('mousemove', onPickerMove, true);
  document.removeEventListener('click', onPickerClick, true);
  document.removeEventListener('keydown', onPickerKey, true);
  const overlay = document.getElementById(PICKER_ID + '-overlay');
  if (overlay) overlay.remove();
  const bar = document.getElementById(PICKER_ID + '-bar');
  if (bar) bar.remove();
}

// ── Init: tenta coletas pendentes e responde a mudanças de DOM (SPA) ───────
loadCollects(runPendingCollects);
loadPicks();

let observerTimer = null;
const observer = new MutationObserver(() => {
  clearTimeout(observerTimer);
  observerTimer = setTimeout(runPendingCollects, 400);
});
if (document.body) {
  observer.observe(document.body, { childList: true, subtree: true });
}