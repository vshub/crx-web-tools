(() => {
  const HUD_VERSION = 2;
  if (window.__webtoolsViewportHudVersion === HUD_VERSION) return;
  window.__webtoolsViewportHud?.hide?.();
  document.querySelectorAll('[data-webtools="viewport-hud"]').forEach((node) => node.remove());
  window.__webtoolsViewportHudVersion = HUD_VERSION;
  window.__webtoolsViewportHudInit = true;

  const CSS = `
    :host {
      all: initial;
      position: fixed !important;
      left: 0 !important;
      top: 0 !important;
      width: 0 !important;
      height: 0 !important;
      overflow: visible !important;
      background: transparent !important;
      z-index: 2147483645 !important;
      pointer-events: none !important;
      display: block !important;
    }
    * { box-sizing: border-box; }
    .toast {
      position: fixed;
      left: 50%;
      bottom: 24px;
      transform: translateX(-50%);
      pointer-events: auto;
      display: flex;
      align-items: stretch;
      gap: 0;
      min-width: 220px;
      background: #1a1a2e;
      color: #e0e0e0;
      border: 1px solid #2f2f4a;
      border-radius: 12px;
      box-shadow: 0 8px 28px rgba(0,0,0,0.45);
      font: 13px/1.35 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      overflow: hidden;
    }
    .body {
      padding: 12px 14px 12px 16px;
      flex: 1;
      min-width: 0;
    }
    .label {
      color: #8e8e93;
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin: 0 0 6px;
    }
    .size {
      margin: 0;
      font: 650 28px/1.1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      letter-spacing: -0.02em;
      color: #f2f2f7;
      cursor: pointer;
      user-select: none;
    }
    .size:hover { color: #fff; }
    .meta {
      margin: 8px 0 0;
      color: #8e8e93;
      font: 11px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    .close {
      appearance: none;
      border: 0;
      border-left: 1px solid #2f2f4a;
      background: transparent;
      color: #8e8e93;
      width: 40px;
      cursor: pointer;
      font: 18px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 0;
    }
    .close:hover {
      background: #2a2a4a;
      color: #e0e0e0;
    }
    .copied {
      color: #81c784 !important;
    }
  `;

  let host = null;
  let shadow = null;
  let sizeEl = null;
  let metaEl = null;
  let visible = false;
  let copyTimer = null;

  function el(tag, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function read() {
    return {
      width: Math.round(window.innerWidth),
      height: Math.round(window.innerHeight),
      dpr: Math.round((window.devicePixelRatio || 1) * 1000) / 1000,
      screenW: Math.round(window.screen?.width || 0),
      screenH: Math.round(window.screen?.height || 0),
    };
  }

  function update() {
    if (!sizeEl || !metaEl) return;
    const v = read();
    sizeEl.textContent = `${v.width} × ${v.height}`;
    metaEl.textContent = `DPR ${v.dpr} · Screen ${v.screenW} × ${v.screenH}`;
  }

  function onResize() {
    if (visible) update();
  }

  function onKeyDown(ev) {
    if (!visible) return;
    if (ev.key === 'Escape') {
      ev.preventDefault();
      hide();
    }
  }

  function build() {
    host = document.createElement('webtools-viewport-hud');
    host.setAttribute('data-webtools', 'viewport-hud');
    host.style.cssText =
      'position:fixed;left:0;top:0;width:0;height:0;overflow:visible;background:transparent;z-index:2147483645;pointer-events:none;display:block;margin:0;padding:0;border:0;';
    shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = CSS;
    const toast = el('div', 'toast');
    const body = el('div', 'body');
    const label = el('p', 'label');
    label.textContent = 'Viewport';
    sizeEl = el('p', 'size');
    sizeEl.title = 'Click to copy';
    metaEl = el('p', 'meta');
    body.append(label, sizeEl, metaEl);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'close';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '×';
    toast.append(body, close);
    shadow.append(style, toast);
    (document.body || document.documentElement).appendChild(host);

    close.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      hide();
    });
    sizeEl.addEventListener('click', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const text = sizeEl.textContent || '';
      try {
        await chrome.runtime.sendMessage({ action: 'copy_text', text });
      } catch (_) {}
      sizeEl.classList.add('copied');
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => sizeEl.classList.remove('copied'), 900);
    });
  }

  function show() {
    if (!host || !host.isConnected) build();
    visible = true;
    host.style.visibility = 'visible';
    update();
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKeyDown, true);
  }

  function hide() {
    visible = false;
    window.removeEventListener('resize', onResize);
    window.removeEventListener('keydown', onKeyDown, true);
    if (host?.isConnected) host.remove();
    host = null;
    shadow = null;
    sizeEl = null;
    metaEl = null;
  }

  function toggle() {
    if (visible && host?.isConnected) hide();
    else show();
  }

  function hideForCapture() {
    if (host) host.style.visibility = 'hidden';
  }

  function restoreAfterCapture() {
    if (host && host.isConnected && visible) host.style.visibility = 'visible';
  }

  const prevHide = window.__webtoolsHideForCapture;
  const prevRestore = window.__webtoolsRestoreAfterCapture;
  window.__webtoolsHideForCapture = () => {
    prevHide?.();
    hideForCapture();
  };
  window.__webtoolsRestoreAfterCapture = () => {
    prevRestore?.();
    restoreAfterCapture();
  };

  window.__webtoolsViewportHud = { show, hide, toggle, update, isVisible: () => Boolean(visible && host?.isConnected) };
})();
