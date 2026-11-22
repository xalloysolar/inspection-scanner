/*
 * 智慧巡檢共用管理員效能監測模組 V1.0.2
 * V1.0.2：管理員開啟版本選單時，自動讀取 index.html 與 index3.html 的 SYSTEM_VERSION。
 * 不必再手動維護 V2／V3 選單名稱；不修改各 HTML 的原始版本設定。
 * 不控制相機、登入、打卡、版本切換及結束登入。
 * 重要：呼叫 mount 前，必須先由原系統的後端驗證 PS0021 與有效 Session。
 * 本模組只控制前端顯示，不能取代後端權限驗證。
 */
(function (global) {
  'use strict';
  if (global.InspectionAdminMonitor) return;

  const VERSION = '1.0.2';
  const STYLE_ID = 'inspection-admin-monitor-style';
  const PANEL_ID = 'inspection-admin-monitor-panel';

  // 版本由各 HTML 的 SYSTEM_VERSION 自動取得，不能寫死在 admin.js。
  const VERSION_FILES = Object.freeze({
    stable: './index.html',
    test: './index3.html'
  });
  let latestVersions = null;
  let versionRequestId = 0;

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

  // 僅在原版管理員選單確實開啟、且原版授權判斷通過時執行。
  // 這只是顯示層功能；不能取代 GAS 後端的管理員權限驗證。
  function isAdminModalOpen() {
    const modal = document.getElementById('versionModal');
    return !!(
      modal && modal.classList.contains('show') &&
      typeof global.isVersionAdmin === 'function' &&
      global.isVersionAdmin() === true
    );
  }

  // 只改按鈕內的版本文字；不動按鈕事件、頁面網址或原本狀態。
  function renderVersionLabels() {
    if (!latestVersions || !isAdminModalOpen()) return;
    const stable = document.getElementById('stableVersionText');
    const test = document.getElementById('testVersionText');
    if (stable && stable.textContent !== latestVersions.stable) {
      stable.textContent = latestVersions.stable;
    }
    if (test && test.textContent !== latestVersions.test) {
      test.textContent = latestVersions.test;
    }
  }

  function readHtmlVersion(path) {
    const url = new URL(path, document.baseURI);
    // 用額外查詢參數降低 GitHub Pages / 瀏覽器沿用舊快取的機率。
    url.searchParams.set('_version_check', String(Date.now()));
    return fetch(url.toString(), { cache: 'no-store' })
      .then(function(response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.text();
      })
      .then(function(html) {
        const match = html.match(
          /\b(?:const|let|var)\s+SYSTEM_VERSION\s*=\s*['"](V\d+\.\d+\.\d+)['"]/
        );
        if (!match) throw new Error('找不到 SYSTEM_VERSION：' + path);
        return match[1];
      });
  }

  function refreshVersions() {
    if (!isAdminModalOpen()) return;
    const requestId = ++versionRequestId;
    Promise.all([
      readHtmlVersion(VERSION_FILES.stable),
      readHtmlVersion(VERSION_FILES.test)
    ]).then(function(versions) {
      if (requestId !== versionRequestId) return;
      latestVersions = { stable: versions[0], test: versions[1] };
      renderVersionLabels();
    }).catch(function(error) {
      // 讀取失敗時保留既有按鈕名稱，不干擾版本切換。
      console.warn('[admin.js V1.0.2] 無法取得版本名稱：', error);
      renderVersionLabels();
    });
  }

  function installVersionLabelSync() {
    const modal = document.getElementById('versionModal');
    const stable = document.getElementById('stableVersionText');
    const test = document.getElementById('testVersionText');
    if (!modal || !stable || !test) return;

    // 原版 toggleVersionModal() 切換 show 時觸發，無須修改 V2/V3。
    const modalObserver = new MutationObserver(function() {
      if (isAdminModalOpen()) {
        renderVersionLabels();
        refreshVersions();
      } else {
        versionRequestId++; // 已關閉的請求結果不應改動畫面
      }
    });
    modalObserver.observe(modal, { attributes: true, attributeFilter: ['class'] });

    // 原版 updateVersionControl() 若重寫版本文字，恢復剛抓到的名稱。
    const labelObserver = new MutationObserver(renderVersionLabels);
    [stable, test].forEach(function(node) {
      labelObserver.observe(node, { childList: true, characterData: true, subtree: true });
    });

    if (isAdminModalOpen()) refreshVersions();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installVersionLabelSync, { once: true });
  } else {
    installVersionLabelSync();
  }

  global.InspectionAdminMonitor = Object.freeze({ version: VERSION, mount, record, reset, unmount });
})(window);
