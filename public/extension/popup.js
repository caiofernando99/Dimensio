'use strict';

const STORAGE_KEY = 'dimensioHighlight';
const QF_STORAGE_KEY = 'dimensioQuickFills';

const el = (id) => document.getElementById(id);
const namesEl = el('names');
const enabledEl = el('enabled');
const dotEl = el('dot');
const titleBox = el('titleBox');
const addInput = el('addInput');
const infoEl = el('info');

const tabHighlightBtn = el('tabHighlightBtn');
const tabQuickFillBtn = el('tabQuickFillBtn');
const tabMetricsBtn = el('tabMetricsBtn');
const sectionHighlight = el('sectionHighlight');
const sectionQuickFill = el('sectionQuickFill');
const sectionMetrics = el('sectionMetrics');
const qfSearchInput = el('qfSearchInput');
const qfList = el('qfList');
const qfInfo = el('qfInfo');

const METRICS_COLLECTS_KEY = 'dimensioCollects';
const METRICS_RESULTS_KEY = 'dimensioMetricResults';

let state = { names: [], title: '', enabled: true };
let quickFills = [];
let qfFilter = '';

function load(cb) {
  chrome.storage.local.get([STORAGE_KEY, QF_STORAGE_KEY], (data) => {
    state = data[STORAGE_KEY] || { names: [], title: '', enabled: true };
    quickFills = Array.isArray(data[QF_STORAGE_KEY]) ? data[QF_STORAGE_KEY] : [];
    cb && cb();
  });
}

function setState(next, cb) {
  state = next;
  chrome.storage.local.set({ [STORAGE_KEY]: state }, () => {
    chrome.runtime.sendMessage({ source: 'dimensio', action: 'apply' }).catch(() => {});
    cb && cb();
  });
}

function render() {
  enabledEl.checked = state.enabled;
  dotEl.className = 'dot' + (state.enabled ? '' : ' off');

  titleBox.hidden = !state.title;
  titleBox.textContent = 'Pedido: ' + state.title;

  namesEl.innerHTML = '';
  if (state.names.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'Nenhum nome marcado. Abra um pedido no Dimensio ou adicione manualmente.';
    namesEl.appendChild(empty);
  } else {
    state.names.forEach((name, i) => {
      const row = document.createElement('div');
      row.className = 'name';

      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.style.background = colorFor(i);

      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = name;

      const rm = document.createElement('button');
      rm.className = 'rm';
      rm.textContent = '✕';
      rm.title = 'Remover nome';
      rm.addEventListener('click', () => {
        setState({ ...state, names: state.names.filter((n) => n !== name) }, render);
      });

      row.appendChild(swatch);
      row.appendChild(label);
      row.appendChild(rm);
      namesEl.appendChild(row);
    });
  }

  const matches = state.enabled ? 'na página atual: atualize para ver' : 'destaque desativado';
  infoEl.textContent = state.names.length
    ? state.names.length + ' nome(s) ' + (state.names.length === 1 ? 'marcado' : 'marcados') + ' • ' + matches
    : 'Nenhum nome ainda.';

  renderQuickFills();
}

function renderQuickFills() {
  if (!qfList) return;
  qfList.innerHTML = '';

  const query = (qfFilter || '').toLowerCase().trim();
  const filtered = quickFills.filter((q) => {
    if (!query) return true;
    const matchTitle = (q.title || '').toLowerCase().includes(query);
    const matchCode = (q.codeValue || '').toLowerCase().includes(query);
    const matchCat = (q.category || '').toLowerCase().includes(query);
    const matchDesc = (q.description || '').toLowerCase().includes(query);
    const matchTags = (q.tags || []).some((t) => t.toLowerCase().includes(query));
    const matchItems = (q.items || []).some(
      (i) => (i.label || '').toLowerCase().includes(query) || (i.codeValue || '').toLowerCase().includes(query)
    );
    return matchTitle || matchCode || matchCat || matchDesc || matchTags || matchItems;
  });

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = query
      ? 'Nenhum item encontrado para a busca.'
      : 'Nenhum código de preenchimento rápido cadastrado. Cadastre no Dimensio no Hub de Informações.';
    qfList.appendChild(empty);
  } else {
    filtered.forEach((q) => {
      const subItems = Array.isArray(q.items) && q.items.length > 0 ? q.items : null;

      const item = document.createElement('div');
      item.className = 'qf-item';

      const hRow = document.createElement('div');
      hRow.className = 'header-row';

      const titleSpan = document.createElement('span');
      titleSpan.className = 'title';
      titleSpan.textContent = q.title;

      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = q.category || 'Geral';
      if (q.triggerUrl && q.triggerUrl.trim()) {
        badge.style.background = '#059669';
        badge.style.color = '#fff';
        badge.title = 'Gatilho de URL ativo: ' + q.triggerUrl;
        badge.textContent = '⚡ ' + (q.category || 'Geral');
      }

      hRow.appendChild(titleSpan);
      hRow.appendChild(badge);
      item.appendChild(hRow);

      if (subItems) {
        // Grupo com vários códigos: uma linha por item.
        subItems.forEach((sub) => {
          const codeRow = document.createElement('div');
          codeRow.className = 'code-row';

          const codeBox = document.createElement('div');
          codeBox.className = 'code';
          codeBox.textContent = (sub.label || '') + (sub.label && sub.codeValue ? ' — ' : '') + (sub.codeValue || '');
          codeBox.title = sub.codeValue || sub.label || '';

          const copyBtn = document.createElement('button');
          copyBtn.className = 'copy-btn';
          copyBtn.textContent = 'Copiar';
          copyBtn.addEventListener('click', async () => {
            try {
              await navigator.clipboard.writeText(sub.codeValue || '');
              copyBtn.textContent = '✓ Copiado!';
              copyBtn.classList.add('copied');
              setTimeout(() => {
                copyBtn.textContent = 'Copiar';
                copyBtn.classList.remove('copied');
              }, 1800);
            } catch {
              /* ignore */
            }
          });

          codeRow.appendChild(codeBox);
          codeRow.appendChild(copyBtn);
          item.appendChild(codeRow);
        });
      } else {
        // Grupo legado com código único.
        const codeRow = document.createElement('div');
        codeRow.className = 'code-row';

        const codeBox = document.createElement('div');
        codeBox.className = 'code';
        codeBox.textContent = q.codeValue;
        codeBox.title = q.codeValue;

        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.textContent = 'Copiar';
        copyBtn.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(q.codeValue);
            copyBtn.textContent = '✓ Copiado!';
            copyBtn.classList.add('copied');
            setTimeout(() => {
              copyBtn.textContent = 'Copiar';
              copyBtn.classList.remove('copied');
            }, 1800);
          } catch {
            /* ignore */
          }
        });

        codeRow.appendChild(codeBox);
        codeRow.appendChild(copyBtn);
        item.appendChild(codeRow);
      }

      qfList.appendChild(item);
    });
  }

  if (qfInfo) {
    qfInfo.textContent = `${filtered.length} de ${quickFills.length} código(s) cadastrado(s)`;
  }
}

function colorFor(i) {
  const p = ['#fde047', '#fca5a5', '#86efac', '#93c5fd', '#f0abfc', '#fbbf24', '#5eead4', '#fda4af'];
  return p[i % p.length];
}

// Tabs
tabHighlightBtn.addEventListener('click', () => {
  tabHighlightBtn.classList.add('active');
  tabQuickFillBtn.classList.remove('active');
  sectionHighlight.style.display = 'block';
  sectionQuickFill.style.display = 'none';
});

tabQuickFillBtn.addEventListener('click', () => {
  tabQuickFillBtn.classList.add('active');
  tabHighlightBtn.classList.remove('active');
  tabMetricsBtn.classList.remove('active');
  sectionHighlight.style.display = 'none';
  sectionQuickFill.style.display = 'block';
  sectionMetrics.style.display = 'none';
});

tabMetricsBtn.addEventListener('click', () => {
  tabMetricsBtn.classList.add('active');
  tabHighlightBtn.classList.remove('active');
  tabQuickFillBtn.classList.remove('active');
  sectionHighlight.style.display = 'none';
  sectionQuickFill.style.display = 'none';
  sectionMetrics.style.display = 'block';
  loadMetrics();
});

const FLOW_TYPES = [
  { type: 'open_url', label: 'Abrir link' },
  { type: 'click', label: 'Clicar' },
  { type: 'input', label: 'Digitar' },
  { type: 'select_option', label: 'Selecionar opção' },
  { type: 'wait', label: 'Aguardar (ms)' },
  { type: 'wait_selector', label: 'Aguardar elemento' },
];

function flowStepLabel(s) {
  if (!s) return '?';
  if (s.type === 'open_url') return 'Abrir ' + (s.url || 'link');
  if (s.type === 'click') return 'Clicar em ' + (s.selector || '—');
  if (s.type === 'input') return 'Digitar "' + (s.value || '') + '" em ' + (s.selector || '—');
  if (s.type === 'select_option') return 'Selecionar "' + (s.value || '') + '" em ' + (s.selector || '—');
  if (s.type === 'wait') return 'Aguardar ' + (s.ms || 1000) + ' ms';
  if (s.type === 'wait_selector') return 'Aguardar ' + (s.selector || '—');
  return s.type;
}

const expandedMetrics = {};
let collectsCache = [];
const syncTimers = {};

// Persiste o coletas local e envia (debounced) fluxo/áreas editados para o app.
function syncCollect(metricId) {
  chrome.storage.local.set({ [METRICS_COLLECTS_KEY]: collectsCache });
  const c = collectsCache.find((x) => x && x.metricId === metricId);
  if (!c) return;
  clearTimeout(syncTimers[metricId]);
  syncTimers[metricId] = setTimeout(() => {
    if (Array.isArray(c.flow)) {
      chrome.runtime
        .sendMessage({ source: 'dimensio', action: 'flowResult', metricId, flow: c.flow, url: location.href || '' })
        .catch(() => {});
    }
    if (c.mode === 'count') {
      chrome.runtime
        .sendMessage({
          source: 'dimensio',
          action: 'countConfigResult',
          metricId,
          countTerms: Array.isArray(c.countTerms) ? c.countTerms : [],
          countScope: c.countScope || '',
        })
        .catch(() => {});
    }
  }, 600);
}

async function runCollectOnTab(requestId) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id == null) return false;
  try {
    await chrome.tabs.sendMessage(tab.id, { source: 'dimensio', action: 'collectNow', requestId });
    return true;
  } catch {
    return false;
  }
}

function renderFlowEditor(c, container) {
  const sec = document.createElement('div');
  sec.className = 'auto-section';

  const label = document.createElement('div');
  label.className = 'sec-label';
  label.textContent = '🎬 Fluxo antes da coleta (aplicar filtros)';
  sec.appendChild(label);

  const stepsEl = document.createElement('div');
  (c.flow || []).forEach((step, idx) => {
    const row = document.createElement('div');
    row.className = 'auto-step';

    const head = document.createElement('div');
    head.className = 'step-head';

    const num = document.createElement('span');
    num.className = 'step-num';
    num.textContent = String(idx + 1);
    head.appendChild(num);

    const typeSel = document.createElement('select');
    FLOW_TYPES.forEach((t) => {
      const o = document.createElement('option');
      o.value = t.type;
      o.textContent = t.label;
      if (t.type === step.type) o.selected = true;
      typeSel.appendChild(o);
    });
    typeSel.addEventListener('change', () => {
      step.type = typeSel.value;
      syncCollect(c.metricId);
      renderMetricBody(c, container);
    });
    head.appendChild(typeSel);

    const actions = document.createElement('div');
    actions.className = 'step-actions';
    const up = document.createElement('button');
    up.textContent = '↑';
    up.disabled = idx === 0;
    up.addEventListener('click', () => {
      const arr = c.flow || [];
      if (idx > 0) {
        const t = arr[idx - 1];
        arr[idx - 1] = arr[idx];
        arr[idx] = t;
        syncCollect(c.metricId);
        renderMetricBody(c, container);
      }
    });
    const down = document.createElement('button');
    down.textContent = '↓';
    down.disabled = idx === (c.flow || []).length - 1;
    down.addEventListener('click', () => {
      const arr = c.flow || [];
      if (idx < arr.length - 1) {
        const t = arr[idx + 1];
        arr[idx + 1] = arr[idx];
        arr[idx] = t;
        syncCollect(c.metricId);
        renderMetricBody(c, container);
      }
    });
    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '✕';
    del.addEventListener('click', () => {
      c.flow = (c.flow || []).filter((_, i) => i !== idx);
      syncCollect(c.metricId);
      renderMetricBody(c, container);
    });
    actions.appendChild(up);
    actions.appendChild(down);
    actions.appendChild(del);
    head.appendChild(actions);

    row.appendChild(head);

    const params = document.createElement('div');
    params.className = 'auto-row';
    const makeInput = (val, ph, onChange) => {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.value = val || '';
      inp.placeholder = ph;
      inp.addEventListener('input', onChange);
      params.appendChild(inp);
    };
    if (step.type === 'open_url') {
      makeInput(step.url, 'https://...', (e) => {
        step.url = e.target.value;
        syncCollect(c.metricId);
      });
    } else if (step.type === 'wait') {
      makeInput(step.ms || 1000, 'ms', (e) => {
        step.ms = parseInt(e.target.value, 10) || 0;
        syncCollect(c.metricId);
      });
    } else {
      makeInput(step.selector, 'Seletor CSS', (e) => {
        step.selector = e.target.value;
        syncCollect(c.metricId);
      });
      if (step.type === 'input' || step.type === 'select_option') {
        makeInput(step.value, step.type === 'input' ? 'valor a digitar' : 'opção a selecionar', (e) => {
          step.value = e.target.value;
          syncCollect(c.metricId);
        });
      }
    }
    row.appendChild(params);

    stepsEl.appendChild(row);
  });
  sec.appendChild(stepsEl);

  if (!(c.flow || []).length) {
    const empty = document.createElement('div');
    empty.className = 'empty-term';
    empty.textContent = 'Nenhum passo. Grave na página ou adicione abaixo.';
    sec.appendChild(empty);
  }

  // Adicionar passo
  const addRow = document.createElement('div');
  addRow.className = 'auto-row';
  addRow.style.marginTop = '6px';
  const addSel = document.createElement('select');
  FLOW_TYPES.forEach((t) => {
    const o = document.createElement('option');
    o.value = t.type;
    o.textContent = t.label;
    addSel.appendChild(o);
  });
  const addBtn = document.createElement('button');
  addBtn.className = 'mini-btn primary';
  addBtn.textContent = '+ Passo';
  addBtn.addEventListener('click', () => {
    c.flow = c.flow || [];
    c.flow.push({ type: addSel.value, selector: '', value: '', url: '', ms: 1000 });
    syncCollect(c.metricId);
    renderMetricBody(c, container);
  });
  addRow.appendChild(addSel);
  addRow.appendChild(addBtn);
  sec.appendChild(addRow);

  const btnRow = document.createElement('div');
  btnRow.className = 'btn-row';
  const recBtn = document.createElement('button');
  recBtn.className = 'mini-btn violet';
  recBtn.textContent = '🎬 Gravar na página';
  recBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.id == null) return;
    try {
      await chrome.tabs.sendMessage(tab.id, { source: 'dimensio', action: 'startFlowRecord', metricId: c.metricId });
      window.close();
    } catch {
      /* ignore */
    }
  });
  const clearBtn = document.createElement('button');
  clearBtn.className = 'mini-btn red';
  clearBtn.textContent = 'Limpar fluxo';
  clearBtn.addEventListener('click', () => {
    c.flow = [];
    syncCollect(c.metricId);
    renderMetricBody(c, container);
  });
  btnRow.appendChild(recBtn);
  btnRow.appendChild(clearBtn);
  sec.appendChild(btnRow);

  container.appendChild(sec);
}

function renderCountAreas(c, container) {
  const sec = document.createElement('div');
  sec.className = 'auto-section';

  const label = document.createElement('div');
  label.className = 'sec-label';
  label.textContent = '🗂️ Áreas a contar (CTRL+F na página filtrada)';
  sec.appendChild(label);

  c.countTerms = c.countTerms || [];
  (c.countTerms || []).forEach((t, idx) => {
    const row = document.createElement('div');
    row.className = 'auto-step';
    row.style.background = '#ecfdf5';
    row.style.borderColor = '#a7f3d0';

    const head = document.createElement('div');
    head.className = 'step-head';
    const num = document.createElement('span');
    num.className = 'step-num';
    num.style.background = '#059669';
    num.textContent = String(idx + 1);
    head.appendChild(num);
    const areaInput = document.createElement('input');
    areaInput.type = 'text';
    areaInput.value = t.area || '';
    areaInput.placeholder = 'Nome da área (ex: Expedição)';
    areaInput.style.flex = '1';
    areaInput.style.minWidth = '0';
    areaInput.style.border = '1px solid #d1d5db';
    areaInput.style.borderRadius = '6px';
    areaInput.style.padding = '4px 6px';
    areaInput.style.fontSize = '11px';
    areaInput.addEventListener('input', (e) => {
      t.area = e.target.value;
      syncCollect(c.metricId);
    });
    head.appendChild(areaInput);
    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '✕';
    del.style.border = 'none';
    del.style.background = '#fee2e2';
    del.style.color = '#dc2626';
    del.style.borderRadius = '5px';
    del.style.width = '18px';
    del.style.height = '18px';
    del.style.cursor = 'pointer';
    del.addEventListener('click', () => {
      c.countTerms = (c.countTerms || []).filter((_, i) => i !== idx);
      syncCollect(c.metricId);
      renderMetricBody(c, container);
    });
    head.appendChild(del);
    row.appendChild(head);

    const selRow = document.createElement('div');
    selRow.className = 'auto-row';
    const selInput = document.createElement('input');
    selInput.type = 'text';
    selInput.value = t.selector || '';
    selInput.placeholder = 'Seletor opcional (conta apenas nesse elemento)';
    selInput.style.flex = '1';
    selInput.style.minWidth = '0';
    selInput.style.border = '1px solid #d1d5db';
    selInput.style.borderRadius = '6px';
    selInput.style.padding = '4px 6px';
    selInput.style.fontSize = '11px';
    selInput.addEventListener('input', (e) => {
      t.selector = e.target.value;
      syncCollect(c.metricId);
    });
    selRow.appendChild(selInput);
    row.appendChild(selRow);

    sec.appendChild(row);
  });

  if (!(c.countTerms || []).length) {
    const empty = document.createElement('div');
    empty.className = 'empty-term';
    empty.textContent = 'Nenhuma área. Adicione os nomes exatos que aparecem na página.';
    sec.appendChild(empty);
  }

  // Escopo
  const scopeRow = document.createElement('div');
  scopeRow.className = 'auto-row';
  scopeRow.style.marginTop = '6px';
  const scopeInput = document.createElement('input');
  scopeInput.type = 'text';
  scopeInput.value = c.countScope || '';
  scopeInput.placeholder = 'Contêiner da busca (opcional) — ex: .tabela-pendencias';
  scopeInput.style.flex = '1';
  scopeInput.style.minWidth = '0';
  scopeInput.style.border = '1px solid #d1d5db';
  scopeInput.style.borderRadius = '6px';
  scopeInput.style.padding = '4px 6px';
  scopeInput.style.fontSize = '11px';
  scopeInput.addEventListener('input', (e) => {
    c.countScope = e.target.value;
    syncCollect(c.metricId);
  });
  scopeRow.appendChild(scopeInput);
  sec.appendChild(scopeRow);

  // Adicionar área
  const addRow = document.createElement('div');
  addRow.className = 'auto-row';
  const addArea = document.createElement('input');
  addArea.type = 'text';
  addArea.placeholder = 'Nova área...';
  addArea.style.flex = '1';
  addArea.style.minWidth = '0';
  addArea.style.border = '1px solid #d1d5db';
  addArea.style.borderRadius = '6px';
  addArea.style.padding = '4px 6px';
  addArea.style.fontSize = '11px';
  const addBtn = document.createElement('button');
  addBtn.className = 'mini-btn green';
  addBtn.textContent = '+ Área';
  addBtn.addEventListener('click', () => {
    const name = addArea.value.trim();
    if (!name) return;
    c.countTerms = c.countTerms || [];
    c.countTerms.push({ area: name, selector: '' });
    addArea.value = '';
    syncCollect(c.metricId);
    renderMetricBody(c, container);
  });
  addArea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addBtn.click();
  });
  addRow.appendChild(addArea);
  addRow.appendChild(addBtn);
  sec.appendChild(addRow);

  container.appendChild(sec);
}

function renderMetricBody(c, container) {
  container.innerHTML = '';
  if (c.mode === 'count') renderCountAreas(c, container);
  renderFlowEditor(c, container);

  const btnRow = document.createElement('div');
  btnRow.className = 'btn-row';
  const collectBtn = document.createElement('button');
  collectBtn.className = 'mini-btn primary';
  collectBtn.textContent = '▶ Coletar aqui';
  collectBtn.addEventListener('click', async () => {
    syncCollect(c.metricId);
    const ok = await runCollectOnTab(c.requestId);
    collectBtn.textContent = ok ? 'Coletando…' : 'Recarregue a página';
  });
  const pickBtn = document.createElement('button');
  pickBtn.className = 'mini-btn';
  pickBtn.textContent = 'Marcar campo';
  pickBtn.title = 'Capturar o local de um campo com o seletor';
  pickBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.id == null) return;
    try {
      await chrome.tabs.sendMessage(tab.id, { source: 'dimensio', action: 'startPicker', metricId: c.metricId });
      window.close();
    } catch {
      /* ignore */
    }
  });
  if (c.mode === 'count') pickBtn.style.display = 'none';
  btnRow.appendChild(collectBtn);
  btnRow.appendChild(pickBtn);
  container.appendChild(btnRow);
}

function loadMetrics() {
  chrome.storage.local.get([METRICS_COLLECTS_KEY, METRICS_RESULTS_KEY], (data) => {
    const collects = Array.isArray(data[METRICS_COLLECTS_KEY]) ? data[METRICS_COLLECTS_KEY] : [];
    const results = Array.isArray(data[METRICS_RESULTS_KEY]) ? data[METRICS_RESULTS_KEY] : [];
    collectsCache = collects;

    const listEl = el('metricsList');
    listEl.innerHTML = '';
    if (collects.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'Nenhuma coleta pendente. Cadastre métricas no Dimensio (Equipe e cadastros › Métricas).';
      listEl.appendChild(empty);
    } else {
      collects.forEach((c) => {
        const isCount = c.mode === 'count';
        const card = document.createElement('div');
        card.className = 'auto-card';

        const head = document.createElement('div');
        head.className = 'auto-head' + (expandedMetrics[c.metricId] ? ' open' : '');
        const caret = document.createElement('span');
        caret.className = 'caret';
        caret.textContent = '▶';
        const title = document.createElement('span');
        title.className = 'title';
        title.textContent = c.name || 'Métrica';
        title.title = c.url || '';
        const modeBadge = document.createElement('span');
        modeBadge.className = 'auto-badge ' + (isCount ? 'badge-count' : 'badge-extract');
        modeBadge.textContent = isCount ? 'Contagem' : 'Coleta';
        const stepsBadge = document.createElement('span');
        if (isCount) {
          stepsBadge.className = 'auto-badge badge-count';
          stepsBadge.textContent = (c.countTerms || []).length + ' área(s)';
        } else if ((c.flow || []).length > 0) {
          stepsBadge.className = 'auto-badge badge-steps';
          stepsBadge.textContent = c.flow.length + ' passo(s)';
        }
        head.appendChild(caret);
        head.appendChild(title);
        head.appendChild(modeBadge);
        if ((c.flow || []).length > 0) {
          const flowBadge = document.createElement('span');
          flowBadge.className = 'auto-badge badge-flow';
          flowBadge.textContent = '🎬 ' + c.flow.length;
          head.appendChild(flowBadge);
        }
        if (stepsBadge) head.appendChild(stepsBadge);
        head.addEventListener('click', () => {
          expandedMetrics[c.metricId] = !expandedMetrics[c.metricId];
          loadMetrics();
        });
        card.appendChild(head);

        const body = document.createElement('div');
        body.className = 'auto-body';
        body.style.display = expandedMetrics[c.metricId] ? 'block' : 'none';
        if (expandedMetrics[c.metricId]) {
          renderMetricBody(c, body);
        }
        card.appendChild(body);

        listEl.appendChild(card);
      });
    }

    const resEl = el('metricsResults');
    resEl.innerHTML = '';
    if (results.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'Ainda não há coletas recebidas.';
      resEl.appendChild(empty);
    } else {
      [...results].reverse().slice(0, 8).forEach((r) => {
        const item = document.createElement('div');
        item.className = 'qf-item';
        const hRow = document.createElement('div');
        hRow.className = 'header-row';
        const title = document.createElement('span');
        title.className = 'title';
        title.textContent = r.metricId || 'Métrica';
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = new Date(r.capturedAt || Date.now()).toLocaleTimeString('pt-BR');
        hRow.appendChild(title);
        hRow.appendChild(badge);
        item.appendChild(hRow);
        const vals = document.createElement('div');
        vals.className = 'code';
        vals.style.marginTop = '4px';
        vals.textContent = Object.values(r.values || {}).join(' • ') || '—';
        item.appendChild(vals);
        resEl.appendChild(item);
      });
    }
  });
}

if (qfSearchInput) {
  qfSearchInput.addEventListener('input', (e) => {
    qfFilter = e.target.value;
    renderQuickFills();
  });
}

enabledEl.addEventListener('change', () => {
  setState({ ...state, enabled: enabledEl.checked }, () => {
    load(render);
  });
});

el('addBtn').addEventListener('click', () => {
  const v = addInput.value.trim();
  if (!v) return;
  const names = state.names.includes(v) ? state.names : [...state.names, v];
  setState({ ...state, names }, () => {
    addInput.value = '';
    load(render);
  });
});
addInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') el('addBtn').click();
});

el('clearBtn').addEventListener('click', () => {
  setState({ names: [], title: '', enabled: true }, render);
});

el('navBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id == null) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { source: 'dimensio', action: 'reveal' });
    window.close();
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const bar = document.getElementById('dimensio-toolbar');
          if (bar) bar.style.display = '';
        },
      });
    } catch {
      /* ignore */
    }
    window.close();
  }
});

el('globalSearchBtn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ source: 'dimensio', action: 'openGlobalSearch' }).catch(() => {});
  window.close();
});

load(render);
