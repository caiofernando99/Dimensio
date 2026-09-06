'use strict';

(function () {
  const STORAGE_KEY = 'dimensioHighlight';
  const MARK_CLASS = 'dimensio-mark';
  const TOOLBAR_ID = 'dimensio-toolbar';
  const COLLECTS_KEY = 'dimensioCollects';
  const PICKS_KEY = 'dimensioPicks';
  const PICKER_ID = 'dimensio-picker';
  const QF_STORAGE_KEY = 'dimensioQuickFills';

  document.documentElement.setAttribute('data-dimensio-ext', '1');

  let currentNames = [];
  let currentTitle = '';
  let enabled = true;
  let marks = [];
  let markIndex = -1;
  let debounceTimer = null;

  // ── Métricas: coleta automática & seletor "Automa" ──────────────────────
  let pendingCollects = [];
  let pendingPicks = [];
  let collectInFlight = new Set();
  let pickerActive = false;
  let pickerMetricId = null;
  let pickerMetricFields = [];
  let pickerFieldCursor = 0;
  let pickerFieldTarget = null;

  // ── Fluxo de automação (recorder / executor) ────────────────────────────
  let flowRecording = false;
  let flowMetricId = null;
  let flowSteps = [];
  let flowRecordBinder = null;

  // ── Preenchimento rápido com gatilho de URL ─────────────────────────────
  let quickFills = [];
  let qfPanelOpenId = null;
  let qfDismissedId = null;

  const PALETTE = ['#fde047', '#fca5a5', '#86efac', '#93c5fd', '#f0abfc', '#fbbf24', '#5eead4', '#fda4af'];

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function normalizeNames(names) {
    return Array.from(new Set((names || []).map((n) => (n || '').trim()).filter(Boolean)));
  }

  function loadState(cb) {
    chrome.storage.local.get(STORAGE_KEY, (data) => {
      const s = data[STORAGE_KEY] || { names: [], title: '', enabled: true };
      currentNames = Array.isArray(s.names) ? s.names.filter(Boolean) : [];
      currentTitle = s.title || '';
      enabled = s.enabled !== false;
      if (cb) cb();
    });
  }

  function clearMarks() {
    for (const m of marks) {
      if (m && m.parentNode) m.parentNode.replaceChild(document.createTextNode(m.textContent), m);
    }
    marks = [];
    markIndex = -1;
  }

  function nameColor(i) {
    return PALETTE[i % PALETTE.length];
  }

  function highlight() {
    clearMarks();
    if (!enabled || currentNames.length === 0) {
      updateToolbar();
      return;
    }

    const patterns = currentNames
      .map((name, i) => ({ name, i, re: new RegExp('(?<![\\p{L}\\p{N}])' + escapeRegExp(name) + '(?![\\p{L}\\p{N}])', 'giu') }))
      .filter((p) => {
        try {
          p.re.test('');
          return true;
        } catch {
          return false;
        }
      })
      .sort((a, b) => b.name.length - a.name.length);

    if (patterns.length === 0) {
      updateToolbar();
      return;
    }

    let combinedRe;
    try {
      combinedRe = new RegExp(
        '(?<![\\p{L}\\p{N}])(?:' + patterns.map((p) => escapeRegExp(p.name)).join('|') + ')(?![\\p{L}\\p{N}])',
        'giu'
      );
    } catch {
      combinedRe = new RegExp(patterns.map((p) => escapeRegExp(p.name)).join('|'), 'gi');
    }

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (p.closest('script,style,noscript,textarea,input,select,option,canvas,svg,mark')) return NodeFilter.FILTER_REJECT;
        if (p.closest('.' + MARK_CLASS)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    for (const node of textNodes) {
      const text = node.nodeValue;
      const frag = document.createDocumentFragment();
      let last = 0;
      let created = false;
      const matcher = combinedRe;
      matcher.lastIndex = 0;
      let m;
      while ((m = matcher.exec(text)) !== null) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const matched = m[0];
        const target = patterns.find((p) => p.name.toLowerCase() === matched.toLowerCase());
        const mark = document.createElement('mark');
        mark.className = MARK_CLASS;
        mark.dataset.dim = target ? target.name : matched;
        mark.dataset.dimIndex = String(target ? target.i : 0);
        mark.textContent = matched;
        mark.title = 'Dimensio: ' + (target ? target.name : matched) + (target ? '  [' + (target.i + 1) + ']' : '');
        mark.style.backgroundColor = target ? nameColor(target.i) : PALETTE[0];
        mark.style.color = '#1f2937';
        mark.style.padding = '0 2px';
        mark.style.borderRadius = '3px';
        mark.style.boxShadow = '0 0 0 1px rgba(0,0,0,.15)';
        mark.style.fontWeight = '600';
        mark.style.cursor = 'pointer';
        mark.addEventListener('click', () => jumpTo(mark));
        frag.appendChild(mark);
        marks.push(mark);
        created = true;
        last = m.index + m[0].length;
      }
      if (created) {
        if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
        node.parentNode.replaceChild(frag, node);
      }
    }
    updateToolbar();
  }

  function jumpTo(el) {
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.outline = '3px solid rgba(59,130,246,.9)';
    el.style.outlineOffset = '2px';
    setTimeout(() => {
      if (el) el.style.outline = '';
    }, 1800);
  }

  function next() {
    if (marks.length === 0) return;
    markIndex = (markIndex + 1) % marks.length;
    jumpTo(marks[markIndex]);
  }

  function prev() {
    if (marks.length === 0) return;
    markIndex = (markIndex - 1 + marks.length) % marks.length;
    jumpTo(marks[markIndex]);
  }

  // ── Métricas: engine de coleta automática ────────────────────────────────
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

  function loadQuickFills(cb) {
    chrome.storage.local.get(QF_STORAGE_KEY, (data) => {
      quickFills = Array.isArray(data[QF_STORAGE_KEY]) ? data[QF_STORAGE_KEY] : [];
      if (cb) cb();
    });
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

  // ── Fluxo de automação: executor ────────────────────────────────────────
  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function runFlow(steps) {
    if (!Array.isArray(steps) || steps.length === 0) return;
    for (const s of steps) {
      if (!s || !s.type) continue;
      if (s.type === 'open_url') {
        const url = s.url;
        if (url && !matchesUrl(url)) {
          location.href = url;
          return;
        }
      } else if (s.type === 'wait') {
        await sleep(s.ms || 1000);
      } else if (s.type === 'wait_selector') {
        await waitForSelector(s.selector, s.ms || 8000);
      } else if (s.type === 'click') {
        const el = await waitForSelector(s.selector);
        if (el && typeof el.click === 'function') el.click();
        await sleep(250);
      } else if (s.type === 'input') {
        const el = await waitForSelector(s.selector);
        if (el) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
          if (setter && setter.set && el instanceof HTMLInputElement) setter.set.call(el, s.value || '');
          else el.value = s.value || '';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
        await sleep(250);
      } else if (s.type === 'select_option') {
        const el = await waitForSelector(s.selector);
        if (el && typeof el.tagName === 'string') {
          const isSelect = el.tagName.toLowerCase() === 'select';
          if (isSelect) {
            const opts = Array.from(el.options || []);
            const target = opts.find((o) => o.value === s.value || o.textContent === s.value);
            if (target) {
              el.value = target.value;
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }
          } else {
            // Dropdown custom: clica no elemento e tenta achar a opção com o texto.
            if (typeof el.click === 'function') el.click();
            const opt = await waitForSelector('option[value="' + escapeRegExp(s.value) + '"], [role=option]', 1500);
            if (opt && typeof opt.click === 'function') opt.click();
          }
        }
        await sleep(400);
      }
    }
  }

  // Conta as ocorrências de um termo dentro de um elemento (ou página toda),
  // estilo CTRL+F: percorre os nós de texto e soma as correspondências com
  // bordas de palavra (não conta "Exp" dentro de "Exportação", por exemplo).
  function countOccurrencesIn(scopeEl, areaName) {
    const name = String(areaName || '').trim();
    if (!name) return 0;
    let re;
    try {
      re = new RegExp('(?<![\\p{L}\\p{N}])' + escapeRegExp(name) + '(?![\\p{L}\\p{N}])', 'giu');
    } catch (e) {
      try {
        re = new RegExp('(^|[^\\wÀ-ÿ])' + escapeRegExp(name) + '($|[^\\wÀ-ÿ])', 'gi');
      } catch (e2) {
        return 0;
      }
    }
    const walker = document.createTreeWalker(scopeEl, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const t = node && node.textContent;
        if (!t || !t.trim()) return NodeFilter.FILTER_REJECT;
        if (node.parentElement && node.parentElement.closest('[data-dimensio-ui]')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let total = 0;
    let node = walker.nextNode();
    while (node) {
      const text = node.textContent || '';
      const m = text.match(re);
      if (m) total += m.length;
      node = walker.nextNode();
    }
    return total;
  }

  async function runCollect(request) {
    if (!request || collectInFlight.has(request.requestId)) return;
    if (!matchesUrl(request.url)) return;
    collectInFlight.add(request.requestId);
    try {
      // Executa a sequência de passos (ex: aplicar filtros) antes de extrair.
      await runFlow(request.flow);
      const values = {};
      if (request.mode === 'count') {
        // Contagem de áreas por ocorrência de texto (CTRL+F).
        const terms = Array.isArray(request.countTerms) ? request.countTerms : [];
        for (const t of terms) {
          if (!t || !t.area) continue;
          const scopeEl = t.selector
            ? document.querySelector(t.selector)
            : request.countScope
              ? document.querySelector(request.countScope)
              : document.body;
          if (!scopeEl) continue;
          const n = countOccurrencesIn(scopeEl, t.area);
          if (n > 0) values[t.area] = String(n);
        }
        await sleep(300);
      } else {
        const fields = Array.isArray(request.fields) ? request.fields : [];
        for (const f of fields) {
          if (!f || !f.selector) continue;
          const el = await waitForSelector(f.selector);
          if (el) {
            const v = extractFieldValue(f);
            if (v != null) values[f.id] = v;
          }
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
      updateToolbar();
    } finally {
      collectInFlight.delete(request.requestId);
    }
  }

  function runPendingCollects() {
    loadCollects(() => {
      const matching = pendingCollects.filter((c) => matchesUrl(c.url));
      matching.forEach((c) => runCollect(c));
    });
  }

  function runCollectNow(requestId) {
    loadCollects(() => {
      const req = pendingCollects.find((c) => c.requestId === requestId);
      if (req) runCollect(req);
    });
  }

  // ── Seletor de elementos (estilo Automa) — versão corrigida ─────────────
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

  function currentFieldLabel() {
    const f = pickerMetricFields[pickerFieldCursor];
    return f && f.label ? f.label : 'Campo ' + (pickerFieldCursor + 1);
  }

  function showPickerBar(metricId, fields) {
    const existing = document.getElementById(PICKER_ID + '-bar');
    if (existing) existing.remove();
    const bar = document.createElement('div');
    bar.id = PICKER_ID + '-bar';
    bar.style.cssText =
      'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:2147483647;' +
      'background:#ffffff;color:#111827;border:1px solid #d1d5db;border-radius:12px;' +
      'box-shadow:0 10px 30px rgba(0,0,0,.25);font-family:system-ui,sans-serif;font-size:12px;' +
      'max-width:560px;width:max-content;padding:8px 10px;display:flex;align-items:center;gap:8px;';

    const status = document.createElement('span');
    status.style.cssText = 'font-weight:700;white-space:nowrap;';
    status.textContent =
      pickerMetricFields.length > 0
        ? 'Campo ' + (pickerFieldCursor + 1) + '/' + pickerMetricFields.length + ' — ' + currentFieldLabel() + ':'
        : 'Clique no elemento que contém o valor:';

    const sel = document.createElement('code');
    sel.id = PICKER_ID + '-sel';
    sel.style.cssText =
      'flex:1;min-width:140px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:6px;' +
      'padding:3px 6px;font-size:11px;color:#4b5563;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    sel.textContent = 'Passe o mouse e clique no elemento';

    const saveBtn = document.createElement('button');
    saveBtn.id = PICKER_ID + '-save';
    saveBtn.textContent = 'Usar este campo';
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
      // Avança para o próximo campo sem seletores (se houver).
      pickerFieldCursor += 1;
      if (pickerFieldCursor < pickerMetricFields.length) {
        const next = pickerMetricFields[pickerFieldCursor];
        if (next && !next.selector) {
          const s = document.getElementById(PICKER_ID + '-sel');
          const b = document.getElementById(PICKER_ID + '-save');
          if (s) s.textContent = 'Passe o mouse e clique no elemento';
          if (b) b.disabled = true;
          status.textContent = 'Campo ' + (pickerFieldCursor + 1) + '/' + pickerMetricFields.length + ' — ' + currentFieldLabel() + ':';
          delete sel.dataset.css;
          return;
        }
      }
      exitPicker();
      showNoticeBar('Seletores enviados ao Dimensio. Pode fechar esta página.');
    });
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancelar';
    cancelBtn.style.cssText =
      'background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:5px 10px;font-weight:700;cursor:pointer;font-size:11px;color:#374151;';
    cancelBtn.addEventListener('click', exitPicker);
    bar.appendChild(status);
    bar.appendChild(sel);
    bar.appendChild(saveBtn);
    bar.appendChild(cancelBtn);
    document.documentElement.appendChild(bar);
  }

  function showNoticeBar(text) {
    const el = document.createElement('div');
    el.style.cssText =
      'position:fixed;bottom:64px;left:50%;transform:translateX(-50%);z-index:2147483647;' +
      'background:#065f46;color:#fff;border-radius:10px;padding:8px 14px;font-family:system-ui,sans-serif;' +
      'font-size:12px;font-weight:700;box-shadow:0 8px 24px rgba(0,0,0,.25);';
    el.textContent = text;
    document.documentElement.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  function onPickerMove(e) {
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

  function startPicker(metricId, fields) {
    exitPicker();
    pickerActive = true;
    pickerMetricId = metricId;
    pickerMetricFields = Array.isArray(fields) ? fields : [];
    pickerFieldCursor = 0;
    // Começa no primeiro campo sem seletor preenchido.
    if (pickerMetricFields.length > 0) {
      const firstEmpty = pickerMetricFields.findIndex((f) => !f.selector || !f.selector.trim());
      pickerFieldCursor = firstEmpty >= 0 ? firstEmpty : 0;
    }
    ensurePickerOverlay();
    showPickerBar(metricId, pickerMetricFields);
    document.addEventListener('mousemove', onPickerMove, true);
    document.addEventListener('click', onPickerClick, true);
    document.addEventListener('keydown', onPickerKey, true);
  }

  function exitPicker() {
    pickerActive = false;
    pickerMetricId = null;
    pickerMetricFields = [];
    pickerFieldCursor = 0;
    pickerFieldTarget = null;
    document.removeEventListener('mousemove', onPickerMove, true);
    document.removeEventListener('click', onPickerClick, true);
    document.removeEventListener('keydown', onPickerKey, true);
    const overlay = document.getElementById(PICKER_ID + '-overlay');
    if (overlay) overlay.remove();
    const bar = document.getElementById(PICKER_ID + '-bar');
    if (bar) bar.remove();
  }

  // Abre o seletor automaticamente quando a página corresponde a um pedido de
  // marcação (DIMENSIO_PICK_START) — corrige o "nada acontece ao abrir a página".
  function runPendingPicks() {
    loadPicks(() => {
      const pick = pendingPicks.find((p) => p && p.metricId && matchesUrl(p.url));
      if (pick && !pickerActive) {
        startPicker(pick.metricId, Array.isArray(pick.fields) ? pick.fields : []);
        pendingPicks = pendingPicks.filter((p) => p !== pick);
        savePicks();
      }
    });
  }

  // ── Gravador de fluxo (cliques/digitações) ──────────────────────────────
  function showFlowRecordBar(metricId, existingFlow) {
    const existing = document.getElementById(PICKER_ID + '-flowbar');
    if (existing) existing.remove();
    const bar = document.createElement('div');
    bar.id = PICKER_ID + '-flowbar';
    bar.setAttribute('data-dimensio-ui', '1');
    bar.style.cssText =
      'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:2147483647;' +
      'background:#7c3aed;color:#fff;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.3);' +
      'font-family:system-ui,sans-serif;font-size:12px;max-width:560px;width:max-content;padding:10px 14px;' +
      'display:flex;align-items:center;gap:10px;';

    const status = document.createElement('span');
    status.id = PICKER_ID + '-flowstatus';
    status.style.cssText = 'font-weight:700;white-space:nowrap;';
    status.textContent = '🔴 Gravando — execute as ações na página (cliques, digitações, seleções).';

    const steps = document.createElement('span');
    steps.id = PICKER_ID + '-flowcount';
    steps.style.cssText = 'background:rgba(255,255,255,.22);padding:2px 8px;border-radius:999px;font-weight:700;font-size:11px;';
    steps.textContent = String(existingFlow.length) + ' passo(s) iniciais';

    const sendBtn = document.createElement('button');
    sendBtn.textContent = 'Parar e enviar fluxo';
    sendBtn.style.cssText =
      'background:#fff;color:#7c3aed;border:none;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer;font-size:11px;';
    sendBtn.addEventListener('click', () => {
      const steps = flowSteps.slice();
      chrome.runtime
        .sendMessage({ source: 'dimensio', action: 'flowResult', metricId, flow: steps, url: location.href })
        .catch(() => {});
      // Mantém a coleta local (popup/barra) com o fluxo atualizado.
      loadCollects(() => {
        const c = pendingCollects.find((x) => x && x.metricId === metricId);
        if (c) {
          c.flow = steps;
          saveCollects();
        }
      });
      stopFlowRecord();
      showNoticeBar('Fluxo de ' + steps.length + ' passo(s) enviado ao Dimensio.');
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancelar';
    cancelBtn.style.cssText =
      'background:transparent;color:#fff;border:1px solid rgba(255,255,255,.5);border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer;font-size:11px;';
    cancelBtn.addEventListener('click', stopFlowRecord);

    bar.appendChild(status);
    bar.appendChild(steps);
    bar.appendChild(sendBtn);
    bar.appendChild(cancelBtn);
    document.documentElement.appendChild(bar);
  }

  function updateFlowCount() {
    const c = document.getElementById(PICKER_ID + '-flowcount');
    if (c) c.textContent = flowSteps.length + ' passo(s) gravado(s)';
  }

  function onFlowClick(e) {
    if (!flowRecording) return;
    const el = e.target;
    if (!el || el.closest('[data-dimensio-ui]')) return;
    const selector = buildSelector(el);
    if (!selector) return;
    if (el.tagName && (el.tagName.toLowerCase() === 'input' || el.tagName.toLowerCase() === 'textarea' || el.tagName.toLowerCase() === 'select')) {
      // campos serão registrados no evento input/change
      return;
    }
    flowSteps.push({ type: 'click', selector });
    updateFlowCount();
  }

  function onFlowInput(e) {
    if (!flowRecording) return;
    const el = e.target;
    if (!el || el.closest('[data-dimensio-ui]')) return;
    if (el.tagName && el.tagName.toLowerCase() === 'select') return;
    const selector = buildSelector(el);
    if (!selector) return;
    const last = flowSteps[flowSteps.length - 1];
    if (last && last.type === 'input' && last.selector === selector) {
      last.value = el.value;
    } else {
      flowSteps.push({ type: 'input', selector, value: el.value });
    }
    updateFlowCount();
  }

  function onFlowChange(e) {
    if (!flowRecording) return;
    const el = e.target;
    if (!el || el.closest('[data-dimensio-ui]')) return;
    if (el.tagName && el.tagName.toLowerCase() === 'select') {
      const selector = buildSelector(el);
      if (!selector) return;
      const last = flowSteps[flowSteps.length - 1];
      if (last && last.type === 'select_option' && last.selector === selector) {
        last.value = el.value;
      } else {
        flowSteps.push({ type: 'select_option', selector, value: el.value });
      }
      updateFlowCount();
    }
  }

  function startFlowRecord(metricId, existingFlow) {
    stopFlowRecord();
    flowRecording = true;
    flowMetricId = metricId;
    flowSteps = (Array.isArray(existingFlow) ? existingFlow : []).map((s) => ({ ...s }));
    flowRecordBinder = {
      click: onFlowClick,
      input: onFlowInput,
      change: onFlowChange,
      keydown: (e) => {
        if (e.key === 'Escape') stopFlowRecord();
      },
    };
    document.addEventListener('click', flowRecordBinder.click, true);
    document.addEventListener('input', flowRecordBinder.input, true);
    document.addEventListener('change', flowRecordBinder.change, true);
    document.addEventListener('keydown', flowRecordBinder.keydown, true);
    showFlowRecordBar(metricId, existingFlow);
  }

  function stopFlowRecord() {
    flowRecording = false;
    flowMetricId = null;
    if (flowRecordBinder) {
      document.removeEventListener('click', flowRecordBinder.click, true);
      document.removeEventListener('input', flowRecordBinder.input, true);
      document.removeEventListener('change', flowRecordBinder.change, true);
      document.removeEventListener('keydown', flowRecordBinder.keydown, true);
      flowRecordBinder = null;
    }
    flowSteps = [];
    const bar = document.getElementById(PICKER_ID + '-flowbar');
    if (bar) bar.remove();
  }

  // ── Preenchimento rápido com gatilho de URL ─────────────────────────────
  function quickFillMatches(qf) {
    const trig = (qf && qf.triggerUrl || '').trim().toLowerCase();
    if (!trig) return false;
    try {
      return location.href.toLowerCase().includes(trig);
    } catch {
      return false;
    }
  }

  function buildQuickFillPanel(qf) {
    const panel = document.createElement('div');
    panel.id = PICKER_ID + '-qfpanel';
    panel.setAttribute('data-dimensio-ui', '1');
    panel.style.cssText =
      'position:fixed;right:14px;top:14px;z-index:2147483647;width:300px;max-height:78vh;overflow-y:auto;' +
      'background:#ffffff;color:#111827;border:1px solid #d1d5db;border-radius:12px;' +
      'box-shadow:0 12px 32px rgba(0,0,0,.25);font-family:system-ui,sans-serif;font-size:12px;';

    const header = document.createElement('div');
    header.style.cssText =
      'display:flex;align-items:center;gap:8px;padding:10px 12px;background:#059669;color:#fff;border-radius:12px 12px 0 0;';
    const hTitle = document.createElement('div');
    hTitle.style.cssText = 'font-weight:800;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    hTitle.textContent = (qf.title || 'Preenchimento rápido') + (qf.category ? ' — ' + qf.category : '');
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'background:none;border:none;color:#fff;cursor:pointer;font-size:13px;line-height:1;padding:2px;';
    closeBtn.addEventListener('click', () => {
      qfDismissedId = qfPanelOpenId;
      qfPanelOpenId = null;
      panel.remove();
    });
    header.appendChild(hTitle);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    const sub = document.createElement('div');
    sub.style.cssText = 'padding:8px 12px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;';
    sub.textContent = 'Gatilho de URL ativo — escolha um código:';
    panel.appendChild(sub);

    const list = document.createElement('div');
    list.style.cssText = 'padding:8px;';
    const items = (qf.items || []).filter((i) => i && (i.codeValue || i.label));
    if (items.length === 0 && qf.codeValue) {
      items.push({ id: qf.id, label: qf.title, codeValue: qf.codeValue });
    }
    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:10px;color:#6b7280;font-style:italic;';
      empty.textContent = 'Grupo sem códigos cadastrados.';
      list.appendChild(empty);
    } else {
      items.forEach((it) => {
        const row = document.createElement('div');
        row.style.cssText =
          'display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid #f3f4f6;border-radius:8px;cursor:pointer;';
        row.addEventListener('mouseenter', () => (row.style.background = '#f9fafb'));
        row.addEventListener('mouseleave', () => (row.style.background = ''));
        const text = document.createElement('div');
        text.style.cssText = 'flex:1;min-width:0;';
        const name = document.createElement('div');
        name.style.cssText = 'font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
        name.textContent = it.label || 'Código';
        const code = document.createElement('div');
        code.style.cssText = 'font-family:monospace;font-size:11px;color:#047857;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        code.textContent = it.codeValue || '';
        text.appendChild(name);
        text.appendChild(code);
        const copyBtn = document.createElement('button');
        copyBtn.textContent = 'Copiar';
        copyBtn.style.cssText =
          'background:#059669;color:#fff;border:none;border-radius:6px;padding:4px 10px;font-weight:700;cursor:pointer;font-size:11px;flex-shrink:0;';
        copyBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          copyText(it.codeValue || '').then((ok) => {
            copyBtn.textContent = ok ? '✓ Copiado' : 'Copiar';
          });
        });
        row.appendChild(text);
        row.appendChild(copyBtn);
        row.addEventListener('click', () => copyText(it.codeValue || ''));
        list.appendChild(row);
      });
    }
    panel.appendChild(list);
    document.documentElement.appendChild(panel);
    return panel;
  }

  function copyText(text) {
    return new Promise((resolve) => {
      if (!text) return resolve(false);
      const done = (ok) => resolve(ok);
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard
            .writeText(text)
            .then(() => done(true))
            .catch(() => fallbackCopy(text, done));
        } else {
          fallbackCopy(text, done);
        }
      } catch {
        fallbackCopy(text, done);
      }
    });
  }

  function fallbackCopy(text, done) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      done(ok);
    } catch {
      done(false);
    }
  }

  function checkQuickFillTrigger() {
    loadQuickFills(() => {
      const matching = quickFills.find((q) => quickFillMatches(q));
      const openId = matching ? matching.id : null;
      const existing = document.getElementById(PICKER_ID + '-qfpanel');
      if (matching && qfPanelOpenId !== matching.id && qfDismissedId !== matching.id) {
        if (existing) existing.remove();
        qfPanelOpenId = matching.id;
        buildQuickFillPanel(matching);
      } else if (!matching) {
        if (existing) existing.remove();
        qfPanelOpenId = null;
        qfDismissedId = null;
      }
    });
  }

  // ----- Floating toolbar -----
  function buildToolbar() {
    const existing = document.getElementById(TOOLBAR_ID);
    if (existing) existing.remove();

    const bar = document.createElement('div');
    bar.id = TOOLBAR_ID;
    bar.setAttribute('data-dimensio-ui', '1');
    bar.style.cssText =
      'position:fixed;top:14px;right:14px;z-index:2147483647;max-width:320px;width:auto;' +
      'background:#ffffff;color:#111827;border:1px solid #d1d5db;border-radius:12px;' +
      'box-shadow:0 8px 24px rgba(0,0,0,.18);font-family:system-ui,sans-serif;font-size:12px;' +
      'user-select:none;overflow:hidden;';

    const header = document.createElement('div');
    header.style.cssText =
      'display:flex;align-items:center;gap:8px;padding:8px 10px;background:#4f46e5;color:#fff;cursor:move;';

    const title = document.createElement('div');
    title.style.cssText = 'font-weight:700;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    title.textContent = currentTitle || 'Dimensio — Destacar nomes';
    header.appendChild(title);

    const count = document.createElement('span');
    count.id = 'dimensio-count';
    count.style.cssText = 'background:rgba(255,255,255,.22);padding:2px 8px;border-radius:999px;font-weight:700;font-size:11px;';
    count.textContent = '0';
    header.appendChild(count);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'background:none;border:none;color:#fff;cursor:pointer;font-size:13px;line-height:1;padding:2px;';
    closeBtn.title = 'Esconder barra';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      bar.style.display = 'none';
    });
    header.appendChild(closeBtn);
    bar.appendChild(header);

    const nav = document.createElement('div');
    nav.style.cssText = 'display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid #e5e7eb;';
    const btnPrev = makeBtn('◀', 'Anterior');
    const btnNext = makeBtn('▶', 'Próximo');
    const btnClear = makeBtn('Limpar', 'Limpar destaques');
    btnClear.style.cssText =
      'margin-left:auto;background:#fee2e2;color:#b91c1c;border:1px solid #fecaca;border-radius:8px;padding:4px 8px;font-weight:700;cursor:pointer;font-size:11px;';
    const btnCloseWin = makeBtn('Fechar janela', 'Fechar a janela do sistema');
    btnCloseWin.style.cssText =
      'background:#dc2626;color:#fff;border:none;border-radius:8px;padding:4px 8px;font-weight:700;cursor:pointer;font-size:11px;display:none;';
    btnCloseWin.addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({ source: 'dimensio', action: 'closeSystem' }).catch(() => {});
    });
    try {
      chrome.runtime.sendMessage({ source: 'dimensio', action: 'amIManaged' }, (resp) => {
        if (resp && resp.ok) btnCloseWin.style.display = '';
      });
    } catch (e) {}
    btnPrev.addEventListener('click', prev);
    btnNext.addEventListener('click', next);
    btnClear.addEventListener('click', () => {
      chrome.storage.local.set({ [STORAGE_KEY]: { names: [], title: '', enabled: true } }, () => {
        chrome.runtime.sendMessage({ source: 'dimensio', action: 'apply' }).catch(() => {});
        loadState(highlight);
      });
    });
    nav.appendChild(btnPrev);
    nav.appendChild(btnNext);
    nav.appendChild(btnClear);
    nav.appendChild(btnCloseWin);
    bar.appendChild(nav);

    const list = document.createElement('div');
    list.id = 'dimensio-names';
    list.style.cssText = 'max-height:180px;overflow-y:auto;';
    bar.appendChild(list);

    const metricsWrap = document.createElement('div');
    metricsWrap.id = 'dimensio-metrics';
    const metricsToggle = document.createElement('button');
    metricsToggle.textContent = '📊 Coletar métricas';
    metricsToggle.style.cssText =
      'display:flex;width:100%;align-items:center;gap:6px;padding:8px 10px;background:#eef2ff;color:#3730a3;' +
      'border:none;border-top:1px solid #e0e7ff;font-weight:700;font-size:11px;cursor:pointer;';
    metricsToggle.addEventListener('click', () => {
      const listEl = document.getElementById('dimensio-metrics-list');
      if (listEl) {
        const show = listEl.style.display === 'none';
        listEl.style.display = show ? 'block' : 'none';
        if (show) loadCollects(renderMetricsToolbar);
      }
    });
    const metricsList = document.createElement('div');
    metricsList.id = 'dimensio-metrics-list';
    metricsList.style.cssText = 'display:none;max-height:160px;overflow-y:auto;border-top:1px solid #e5e7eb;';
    metricsWrap.appendChild(metricsToggle);
    metricsWrap.appendChild(metricsList);
    bar.appendChild(metricsWrap);

    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;gap:6px;padding:8px 10px;border-top:1px solid #e5e7eb;';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Adicionar nome...';
    input.style.cssText =
      'flex:1;border:1px solid #d1d5db;border-radius:8px;padding:5px 8px;font-size:12px;outline:none;';
    const addBtn = makeBtn('Adicionar', 'Adicionar nome manualmente');
    addBtn.style.background = '#4f46e5';
    addBtn.style.color = '#fff';
    addBtn.addEventListener('click', () => {
      const v = input.value.trim();
      if (!v) return;
      chrome.runtime.sendMessage({ source: 'dimensio', action: 'addName', name: v }).catch(() => {});
      input.value = '';
      setTimeout(() => loadState(highlight), 60);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addBtn.click();
    });
    footer.appendChild(input);
    footer.appendChild(addBtn);
    bar.appendChild(footer);

    document.documentElement.appendChild(bar);
    makeDraggable(bar, header);
  }

  function makeBtn(text, tip) {
    const b = document.createElement('button');
    b.textContent = text;
    b.style.cssText =
      'background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:4px 10px;font-weight:700;cursor:pointer;font-size:11px;color:#111827;';
    b.title = tip || '';
    return b;
  }

  function makeDraggable(el, handle) {
    let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
    handle.addEventListener('mousedown', (e) => {
      dragging = true;
      sx = e.clientX;
      sy = e.clientY;
      const r = el.getBoundingClientRect();
      ox = r.left;
      oy = r.top;
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      el.style.left = ox + (e.clientX - sx) + 'px';
      el.style.top = oy + (e.clientY - sy) + 'px';
      el.style.right = 'auto';
    });
    window.addEventListener('mouseup', () => {
      dragging = false;
    });
  }

  function renderNames() {
    const list = document.getElementById('dimensio-names');
    if (!list) return;
    list.innerHTML = '';
    if (currentNames.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'Nenhum nome marcado.';
      empty.style.cssText = 'padding:10px;color:#6b7280;font-style:italic;';
      list.appendChild(empty);
      return;
    }
    currentNames.forEach((name, i) => {
      const row = document.createElement('label');
      row.style.cssText =
        'display:flex;align-items:center;gap:8px;padding:5px 10px;cursor:pointer;border-bottom:1px solid #f3f4f6;';
      const swatch = document.createElement('span');
      swatch.style.cssText = 'width:10px;height:10px;border-radius:3px;background:' + nameColor(i) + ';flex-shrink:0;';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = true;
      cb.style.cssText = 'accent-color:#4f46e5;';
      cb.addEventListener('change', () => {
        const names = currentNames.slice();
        const idx = names.indexOf(name);
        if (cb.checked) {
          if (idx === -1) names.push(name);
        } else if (idx !== -1) {
          names.splice(idx, 1);
        }
        chrome.storage.local.set({ [STORAGE_KEY]: { names, title: currentTitle, enabled } }, () => {
          chrome.runtime.sendMessage({ source: 'dimensio', action: 'apply' }).catch(() => {});
          loadState(highlight);
        });
      });
      const text = document.createElement('span');
      text.textContent = name;
      text.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      row.appendChild(swatch);
      row.appendChild(cb);
      row.appendChild(text);
      list.appendChild(row);
    });
  }

  function updateToolbar() {
    if (!document.getElementById(TOOLBAR_ID)) buildToolbar();
    const count = document.getElementById('dimensio-count');
    if (count) count.textContent = String(marks.length);
    const title = document.getElementById(TOOLBAR_ID)?.querySelector('div:first-child div');
    if (title && currentTitle) title.textContent = currentTitle;
    renderNames();
    loadCollects(renderMetricsToolbar);
  }

  function renderMetricsToolbar() {
    const listEl = document.getElementById('dimensio-metrics-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    const items = (pendingCollects || []).filter((c) => c && c.metricId);
    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'Nenhuma coleta pendente. Cadastre em Dimensio › Equipe e cadastros › Métricas.';
      empty.style.cssText = 'padding:8px 10px;color:#6b7280;font-style:italic;';
      listEl.appendChild(empty);
      return;
    }
    items.forEach((c) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:6px 10px;border-bottom:1px solid #f3f4f6;';
      const label = document.createElement('span');
      label.textContent = c.name || 'Métrica';
      label.title = c.url || '';
      label.style.cssText =
        'flex:1;min-width:0;font-weight:700;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      const stepsBadge = document.createElement('span');
      stepsBadge.textContent =
        c.mode === 'count'
          ? (c.countTerms && c.countTerms.length ? c.countTerms.length + ' áreas' : '0 áreas')
          : c.flow && c.flow.length
            ? c.flow.length + ' passos'
            : '';
      stepsBadge.style.cssText =
        'font-size:9px;font-weight:700;color:' +
        (c.mode === 'count' ? '#047857' : '#7c3aed') +
        ';background:' +
        (c.mode === 'count' ? '#d1fae5' : '#f3e8ff') +
        ';border-radius:6px;padding:1px 5px;white-space:nowrap;';
      const collectBtn = document.createElement('button');
      collectBtn.textContent = 'Coletar';
      collectBtn.style.cssText =
        'background:#4f46e5;color:#fff;border:none;border-radius:6px;padding:3px 8px;font-weight:700;font-size:10px;cursor:pointer;';
      collectBtn.title = 'Extrair os valores agora nesta página';
      collectBtn.addEventListener('click', () => {
        runCollectNow(c.requestId);
        collectBtn.textContent = 'Coletando…';
        collectBtn.disabled = true;
      });
      const pickBtn = document.createElement('button');
      pickBtn.textContent = 'Marcar';
      pickBtn.style.cssText =
        'background:#fff;color:#4f46e5;border:1px solid #c7d2fe;border-radius:6px;padding:3px 8px;font-weight:700;font-size:10px;cursor:pointer;';
      pickBtn.title = 'Ativar o seletor para capturar o local do campo na página';
      pickBtn.addEventListener('click', () => startPicker(c.metricId, c.fields || []));
      if (c.mode === 'count') pickBtn.style.display = 'none';
      const flowBtn = document.createElement('button');
      flowBtn.textContent = 'Fluxo';
      flowBtn.style.cssText =
        'background:#fff;color:#7c3aed;border:1px solid #ddd6fe;border-radius:6px;padding:3px 8px;font-weight:700;font-size:10px;cursor:pointer;';
      flowBtn.title = 'Gravar fluxo de cliques (ex: aplicar filtros)';
      flowBtn.addEventListener('click', () => startFlowRecord(c.metricId, c.flow || []));
      row.appendChild(label);
      row.appendChild(stepsBadge);
      row.appendChild(collectBtn);
      row.appendChild(pickBtn);
      row.appendChild(flowBtn);
      listEl.appendChild(row);
    });
  }

  function scheduleHighlight() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      loadState(highlight);
      runPendingCollects();
      runPendingPicks();
      checkQuickFillTrigger();
    }, 250);
  }

  const observer = new MutationObserver(scheduleHighlight);
  function startObserver() {
    observer.disconnect();
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ----- Communication -----
  function handleHighlight(names, title) {
    const cleanNames = normalizeNames(names);
    chrome.storage.local.set({ [STORAGE_KEY]: { names: cleanNames, title: title || '', enabled: true } }, () => {
      chrome.runtime.sendMessage({ source: 'dimensio', action: 'apply' }).catch(() => {});
      loadState(highlight);
    });
  }

  function handleClear() {
    chrome.storage.local.set({ [STORAGE_KEY]: { names: [], title: '', enabled: true } }, () => {
      chrome.runtime.sendMessage({ source: 'dimensio', action: 'apply' }).catch(() => {});
      loadState(highlight);
    });
  }

  window.addEventListener('message', (event) => {
    const d = event && event.data;
    if (!d || d.source !== 'DIMENSIO_APP') return;
    if (d.type === 'DIMENSIO_HIGHLIGHT') handleHighlight(d.names, d.title);
    else if (d.type === 'DIMENSIO_CLEAR') handleClear();
    else if (d.type === 'DIMENSIO_OPEN_SYSTEM') {
      chrome.runtime.sendMessage({ source: 'dimensio', action: 'openSystem', url: d.url }).catch(() => {});
    } else if (d.type === 'DIMENSIO_QUICK_FILLS') {
      chrome.storage.local.set({ dimensioQuickFills: d.quickFills || [] }, () => {
        quickFills = Array.isArray(d.quickFills) ? d.quickFills : [];
        checkQuickFillTrigger();
      });
    } else if (d.type === 'DIMENSIO_COLLECT') {
      const c = d.collect;
      if (c && c.requestId && c.metricId) {
        loadCollects(() => {
          // Substitui por metricId para não acumular duplicados quando o app
          // reenvia a configuração (fluxo/áreas editados no popup são mantidos).
          const existing = pendingCollects.find((x) => x && x.metricId === c.metricId);
          if (existing) {
            Object.assign(existing, c);
          } else {
            pendingCollects.push(c);
          }
          saveCollects(updateToolbar);
        });
      }
    } else if (d.type === 'DIMENSIO_PICK_START') {
      const p = d.pick;
      if (p && p.metricId && p.url) {
        loadPicks(() => {
          pendingPicks = pendingPicks.filter((x) => x.metricId !== p.metricId);
          pendingPicks.push(p);
          savePicks(() => runPendingPicks());
        });
      }
    } else if (d.type === 'DIMENSIO_FLOW_RECORD_START') {
      const r = d.record;
      if (r && r.metricId && r.url) {
        // Se esta página já corresponde ao link, inicia direto; senão guarda para a próxima página.
        if (matchesUrl(r.url)) {
          startFlowRecord(r.metricId, Array.isArray(r.flow) ? r.flow : []);
        } else {
          chrome.storage.local.set({ dimensioFlowPending: r }, () => {});
        }
      }
    }
  });

  document.addEventListener('dimensio-highlight', (e) => {
    const d = e && e.detail;
    if (d) handleHighlight(d.names, d.title);
  });

  function injectPageBridge() {
    try {
      if (document.getElementById('dimensio-bridge-script')) return;
      const s = document.createElement('script');
      s.id = 'dimensio-bridge-script';
      s.textContent =
        '(' +
        function () {
          if (window.__DIMENSIO_BRIDGE__) return;
          window.__DIMENSIO_BRIDGE__ = {
            installed: true,
            version: '1.1.0',
            dispatch: function (names, title) {
              window.postMessage(
                {
                  source: 'DIMENSIO_APP',
                  type: 'DIMENSIO_HIGHLIGHT',
                  names: (names || []).map(String).filter(Boolean),
                  title: title || '',
                },
                '*'
              );
            },
            clear: function () {
              window.postMessage({ source: 'DIMENSIO_APP', type: 'DIMENSIO_CLEAR' }, '*');
            },
            openSystem: function (url) {
              window.postMessage(
                { source: 'DIMENSIO_APP', type: 'DIMENSIO_OPEN_SYSTEM', url: String(url || '') },
                '*'
              );
            },
            collectMetric: function (config) {
              window.postMessage(
                { source: 'DIMENSIO_APP', type: 'DIMENSIO_COLLECT', collect: config || {} },
                '*'
              );
            },
            startPicker: function (config) {
              window.postMessage(
                { source: 'DIMENSIO_APP', type: 'DIMENSIO_PICK_START', pick: config || {} },
                '*'
              );
            },
            recordFlow: function (config) {
              window.postMessage(
                { source: 'DIMENSIO_APP', type: 'DIMENSIO_FLOW_RECORD_START', record: config || {} },
                '*'
              );
            },
            quickFills: function (items) {
              window.postMessage(
                { source: 'DIMENSIO_APP', type: 'DIMENSIO_QUICK_FILLS', quickFills: items || [] },
                '*'
              );
            },
          };
          try {
            document.documentElement.setAttribute('data-dimensio-ext', '1');
          } catch (e) {}
        }.toString() +
        ')();';
      (document.head || document.documentElement).appendChild(s);
      setTimeout(() => {
        if (s.parentNode) s.parentNode.removeChild(s);
      }, 100);
    } catch (e) {}
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.source !== 'dimensio') return;
    if (msg.action === 'openGlobalSearch') {
      if (document.documentElement.hasAttribute('data-dimensio-app')) {
        document.dispatchEvent(new CustomEvent('open-global-search', { bubbles: true, cancelable: true }));
        sendResponse({ ok: true });
      }
      return true;
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.source !== 'dimensio') return;
    if (msg.action === 'metricResult') {
      if (document.documentElement.hasAttribute('data-dimensio-app')) {
        document.dispatchEvent(
          new CustomEvent('dimensio-metric-result', {
            detail: { metricId: msg.metricId, values: msg.values || {}, capturedBy: msg.capturedBy || 'Extensão' },
          })
        );
      }
    } else if (msg.action === 'metricPickResult') {
      if (document.documentElement.hasAttribute('data-dimensio-app')) {
        document.dispatchEvent(
          new CustomEvent('dimensio-metric-pick-result', {
            detail: { metricId: msg.metricId, selector: msg.selector },
          })
        );
      }
    } else if (msg.action === 'metricFlowResult') {
      if (document.documentElement.hasAttribute('data-dimensio-app')) {
        document.dispatchEvent(
          new CustomEvent('dimensio-metric-flow-result', {
            detail: { metricId: msg.metricId, flow: Array.isArray(msg.flow) ? msg.flow : [] },
          })
        );
      }
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.source !== 'dimensio') return;
    if (msg.action === 'apply') {
      loadState(() => {
        highlight();
        if (!document.getElementById(TOOLBAR_ID)) updateToolbar();
      });
    } else if (msg.action === 'reveal') {
      const bar = document.getElementById(TOOLBAR_ID);
      if (bar) bar.style.display = '';
    } else if (msg.action === 'collectNow') {
      runCollectNow(msg.requestId);
    } else if (msg.action === 'startPicker') {
      const pick = pendingPicks.find((p) => p.metricId === msg.metricId);
      startPicker(msg.metricId, pick ? pick.fields : []);
    } else if (msg.action === 'startFlowRecord') {
      const c = pendingCollects.find((x) => x.metricId === msg.metricId);
      startFlowRecord(msg.metricId, c ? c.flow || [] : []);
    }
  });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.source !== 'dimensio' || msg.action !== 'getInfo') return;
    sendResponse({ count: marks.length, names: currentNames, enabled, title: currentTitle });
    return false;
  });

  // ----- Init -----
  loadState(() => {
    highlight();
    updateToolbar();
    injectPageBridge();
    startObserver();
    // Fluxo pendente (gravado a partir do app antes de abrir a página).
    chrome.storage.local.get('dimensioFlowPending', (data) => {
      const r = data && data.dimensioFlowPending;
      if (r && r.metricId) {
        chrome.storage.local.remove('dimensioFlowPending');
        if (matchesUrl(r.url)) startFlowRecord(r.metricId, Array.isArray(r.flow) ? r.flow : []);
      }
    });
  });
  loadCollects(runPendingCollects);
  loadPicks(runPendingPicks);
  loadQuickFills(checkQuickFillTrigger);
})();