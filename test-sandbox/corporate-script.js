/**
 * Dimensio Corporate Zero-Install QuickTools Script
 * For managed corporate environments where browser extension developer mode is restricted.
 */
(function () {
  const DOCK_ID = '__dimensio_corporate_dock__';
  if (document.getElementById(DOCK_ID)) {
    const el = document.getElementById(DOCK_ID);
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
    return;
  }

  // Create floating container
  const container = document.createElement('div');
  container.id = DOCK_ID;
  container.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 999999;
    background: #0f172a;
    color: #f8fafc;
    border: 1px solid #334155;
    border-radius: 16px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
    padding: 14px;
    width: 280px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 12px;
  `;

  container.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid #334155; padding-bottom: 8px;">
      <div style="display: flex; align-items: center; gap: 6px; font-weight: 800; font-size: 13px;">
        <span style="background: #4f46e5; color: white; border-radius: 6px; padding: 2px 6px;">D</span>
        <span>Dimensio QuickTools</span>
      </div>
      <button id="__dimensio_close__" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 16px;">&times;</button>
    </div>
    
    <div style="margin-bottom: 8px;">
      <input id="__dimensio_search__" type="text" placeholder="Destacar colaborador..." style="width: 100%; box-sizing: border-box; background: #1e293b; border: 1px solid #475569; border-radius: 8px; padding: 6px 8px; color: white; font-size: 11px; outline: none;" />
    </div>

    <div style="display: flex; flex-direction: column; gap: 6px;">
      <button id="__dimensio_fill_sku__" style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 6px 10px; color: #cbd5e1; cursor: pointer; text-align: left; font-size: 11px;">
        ⚡ Injetar SKU Padrão
      </button>
      <button id="__dimensio_open_app__" style="background: #4f46e5; border: none; border-radius: 8px; padding: 8px 10px; color: white; cursor: pointer; font-weight: bold; text-align: center; font-size: 11px;">
        Abrir Dimensio Escalas ↗
      </button>
    </div>
  `;

  document.body.appendChild(container);

  // Close handler
  document.getElementById('__dimensio_close__').onclick = function () {
    container.style.display = 'none';
  };

  // Open App handler
  document.getElementById('__dimensio_open_app__').onclick = function () {
    window.open('http://127.0.0.1:3000', '_blank');
  };

  // Fill SKU handler
  document.getElementById('__dimensio_fill_sku__').onclick = function () {
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      active.value = 'SKU-77291-DIMENSIO';
      active.dispatchEvent(new Event('input', { bubbles: true }));
      active.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      const firstInput = document.querySelector('input[type="text"], input:not([type])');
      if (firstInput) {
        firstInput.value = 'SKU-77291-DIMENSIO';
        firstInput.focus();
      }
    }
  };

  // Search / Highlight handler
  document.getElementById('__dimensio_search__').oninput = function (e) {
    const term = e.target.value.trim().toLowerCase();
    if (!term) return;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement && node.parentElement.tagName !== 'SCRIPT' && node.parentElement.tagName !== 'STYLE') {
        if (node.nodeValue && node.nodeValue.toLowerCase().includes(term)) {
          node.parentElement.style.backgroundColor = '#fef08a';
          node.parentElement.style.color = '#854d0e';
        }
      }
    }
  };

  console.log('[Dimensio] QuickTools corporativo injetado com sucesso.');
})();
