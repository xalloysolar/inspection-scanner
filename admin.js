/*
 * 智慧巡檢共用管理員效能監測模組 V1.0.0
 * 只顯示各版本提供的監測資料，不控制相機、登入、打卡或版本切換。
 * 重要：呼叫 mount 前，必須先由原系統的後端驗證 PS0021 與有效 Session。
 * 本模組只控制前端顯示，不能取代後端權限驗證。
 */
(function (global) {
  'use strict';
  if (global.InspectionAdminMonitor) return;

  const VERSION = '1.0.0';
  const STYLE_ID = 'inspection-admin-monitor-style';
  const PANEL_ID = 'inspection-admin-monitor-panel';
  let panel = null;
  let stats = { count: 0, success: 0, failure: 0, last: null, totalSum: 0 };

  function fmt(ms) {
    return Number.isFinite(ms) && ms >= 0 ? (ms / 1000).toFixed(2) + 's' : '—';
  }

  function el(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = el('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID} {box-sizing:border-box;width:100%;max-width:100%;margin:10px auto 0;padding:12px;border:1px solid #17a9bd;border-radius:12px;background:#0d2630;color:#fff;font:14px/1.5 system-ui,-apple-system,"Noto Sans TC",sans-serif;}
      #${PANEL_ID} * {box-sizing:border-box;}
      #${PANEL_ID} .iam-title {font-weight:700;color:#61e9f0;margin-bottom:10px;}
      #${PANEL_ID} .iam-grid {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}
      #${PANEL_ID} .iam-item {background:#173541;border-radius:8px;padding:8px 4px;text-align:center;min-width:0;}
      #${PANEL_ID} .iam-label {font-size:11px;color:#b5cbd0;}
      #${PANEL_ID} .iam-value {font-size:18px;font-weight:700;color:#68e9ef;overflow-wrap:anywhere;}
      #${PANEL_ID} .iam-foot {margin-top:9px;font-size:12px;color:#c1d2d8;overflow-wrap:anywhere;}
      @media(max-width:360px) {#${PANEL_ID}{padding:8px;}#${PANEL_ID} .iam-value{font-size:15px;}#${PANEL_ID} .iam-item{padding:7px 2px;}}
    `;
    document.head.appendChild(style);
  }

  function render() {
    if (!panel) return;
    const last = stats.last;
    const values = [fmt(last?.totalMs), fmt(last?.backendMs), fmt(last?.apiWaitMs)];
    panel.querySelectorAll('.iam-value').forEach((node, index) => { node.textContent = values[index]; });
    const avg = stats.count ? fmt(stats.totalSum / stats.count) : '—';
    panel.querySelector('.iam-foot').textContent =
      `成功 ${stats.success} 次｜失敗 ${stats.failure} 次｜平均總耗時 ${avg}` +
      (last?.message ? `｜最近結果：${last.message}` : '');
  }

  function mount(options) {
    options = options || {};
    // 此 authorized 參數必須由原系統「後端已確認」管理員身分後傳入。
    if (options.authorized !== true) { unmount(); return false; }
    const parent = typeof options.container === 'string'
      ? document.querySelector(options.container)
      : options.container;
    if (!parent || typeof parent.appendChild !== 'function') return false;
    installStyle();
    unmount();
    panel = el('section');
    panel.id = PANEL_ID;
    panel.setAttribute('aria-label', '管理員效能監測');
    panel.appendChild(el('div', 'iam-title', '管理員效能監測'));
    const grid = el('div', 'iam-grid');
    ['總耗時','後端合計','API等待'].forEach(label => {
      const item = el('div', 'iam-item');
      item.appendChild(el('div', 'iam-label', label));
      item.appendChild(el('div', 'iam-value', '—'));
      grid.appendChild(item);
    });
    panel.appendChild(grid);
    panel.appendChild(el('div', 'iam-foot'));
    parent.appendChild(panel);
    render();
    return true;
  }

  function record(result) {
    if (!panel || !result || typeof result !== 'object') return false;
    const clean = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
    const totalMs = clean(result.totalMs);
    const backendMs = clean(result.backendMs);
    const apiWaitMs = clean(result.apiWaitMs);
    const success = result.success === true;
    stats.count++;
    if (success) stats.success++; else stats.failure++;
    if (totalMs !== null) stats.totalSum += totalMs;
    stats.last = {
      totalMs, backendMs, apiWaitMs,
      message: typeof result.message === 'string' ? result.message.slice(0, 80) : ''
    };
    render();
    return true;
  }

  function reset() {
    stats = { count: 0, success: 0, failure: 0, last: null, totalSum: 0 };
    render();
  }

  function unmount() {
    if (panel) panel.remove();
    panel = null;
  }

  global.InspectionAdminMonitor = Object.freeze({ version: VERSION, mount, record, reset, unmount });
})(window);
