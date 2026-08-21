(() => {
  if (window.__webtoolsOverlayInit) return;
  window.__webtoolsOverlayInit = true;

  const SHADOW_CSS = `
    :host {
      all: initial;
      position: fixed !important;
      inset: 0 !important;
      z-index: 2147483646 !important;
      pointer-events: none !important;
    }
    * { box-sizing: border-box; }
    .layer {
      position: fixed;
      inset: 0;
      pointer-events: auto;
      cursor: crosshair;
    }
    .box {
      position: fixed;
      pointer-events: none;
      border: 1px solid #6c9eff;
      background: rgba(108, 158, 255, 0.12);
    }
    .box.a { border-color: #ffb74d; background: rgba(255, 183, 77, 0.12); }
    .box.b { border-color: #81c784; background: rgba(129, 199, 132, 0.12); }
    .box.region { border-color: #6c9eff; background: rgba(108, 158, 255, 0.18); }
    .hud {
      position: fixed;
      pointer-events: none;
      background: #1a1a2e;
      color: #e0e0e0;
      font: 12px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      padding: 4px 8px;
      border-radius: 4px;
      white-space: nowrap;
      box-shadow: 0 2px 10px rgba(0,0,0,0.45);
      z-index: 1;
    }
  `;

  let host = null;
  let shadow = null;
  let layer = null;
  let hoverBox = null;
  let boxA = null;
  let boxB = null;
  let regionBox = null;
  let hud = null;
  let mode = null;
  let running = false;
  let pointA = null;
  let pointB = null;
  let regionStart = null;
  let dragging = false;
  const listeners = [];

  function on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    listeners.push([target, type, fn, opts]);
  }

  function offAll() {
    for (const [target, type, fn, opts] of listeners) {
      target.removeEventListener(type, fn, opts);
    }
    listeners.length = 0;
  }

  function el(tag, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function applyRect(node, rect) {
    if (!rect || (rect.width <= 0 && rect.height <= 0 && !rect.fromPoint)) {
      node.style.display = 'none';
      return;
    }
    const size = rect.fromPoint ? 6 : 0;
    const left = rect.fromPoint ? rect.left - 3 : rect.left;
    const top = rect.fromPoint ? rect.top - 3 : rect.top;
    const width = rect.fromPoint ? size : rect.width;
    const height = rect.fromPoint ? size : rect.height;
    node.style.display = 'block';
    node.style.left = `${left}px`;
    node.style.top = `${top}px`;
    node.style.width = `${Math.max(0, width)}px`;
    node.style.height = `${Math.max(0, height)}px`;
  }

  function placeHud(clientX, clientY) {
    const pad = 14;
    const w = hud.offsetWidth || 80;
    const h = hud.offsetHeight || 24;
    let x = clientX + pad;
    let y = clientY + pad;
    if (x + w > window.innerWidth - 8) x = clientX - w - pad;
    if (y + h > window.innerHeight - 8) y = clientY - h - pad;
    hud.style.left = `${Math.max(8, x)}px`;
    hud.style.top = `${Math.max(8, y)}px`;
  }

  function setHud(text) {
    hud.textContent = text || '';
    hud.style.display = text ? 'block' : 'none';
  }

  function hitRect(clientX, clientY) {
    layer.style.pointerEvents = 'none';
    host.style.pointerEvents = 'none';
    const node = document.elementFromPoint(clientX, clientY);
    layer.style.pointerEvents = 'auto';
    if (!node || node === host) {
      return {
        left: clientX,
        top: clientY,
        right: clientX,
        bottom: clientY,
        width: 0,
        height: 0,
        fromPoint: true,
      };
    }
    const r = node.getBoundingClientRect();
    return {
      left: r.left,
      top: r.top,
      right: r.right,
      bottom: r.bottom,
      width: r.width,
      height: r.height,
      fromPoint: false,
    };
  }

  function axisGap(a0, a1, b0, b1) {
    if (a1 < b0) return b0 - a1;
    if (b1 < a0) return a0 - b1;
    return 0;
  }

  function gapText(a, b) {
    const dx = Math.round(axisGap(a.left, a.right, b.left, b.right));
    const dy = Math.round(axisGap(a.top, a.bottom, b.top, b.bottom));
    const cxA = a.left + a.width / 2;
    const cyA = a.top + a.height / 2;
    const cxB = b.left + b.width / 2;
    const cyB = b.top + b.height / 2;
    const dist = Math.round(Math.hypot(cxB - cxA, cyB - cyA));
    return `dx ${dx}  dy ${dy}  dist ${dist}`;
  }

  function resetTransient() {
    pointA = null;
    pointB = null;
    regionStart = null;
    dragging = false;
    applyRect(hoverBox, null);
    applyRect(boxA, null);
    applyRect(boxB, null);
    applyRect(regionBox, null);
    setHud('');
  }

  function build() {
    host = document.createElement('webtools-overlay');
    host.setAttribute('data-webtools', 'overlay');
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483646;pointer-events:none;';
    shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = SHADOW_CSS;
    layer = el('div', 'layer');
    hoverBox = el('div', 'box');
    boxA = el('div', 'box a');
    boxB = el('div', 'box b');
    regionBox = el('div', 'box region');
    hud = el('div', 'hud');
    hoverBox.style.display = 'none';
    boxA.style.display = 'none';
    boxB.style.display = 'none';
    regionBox.style.display = 'none';
    hud.style.display = 'none';
    shadow.append(style, layer);
    layer.append(hoverBox, boxA, boxB, regionBox, hud);
    document.documentElement.appendChild(host);
  }

  function bind() {
    offAll();
    const capture = true;
    on(window, 'mousemove', onMouseMove, capture);
    on(window, 'mousedown', onMouseDown, capture);
    on(window, 'mouseup', onMouseUp, capture);
    on(window, 'click', onClick, capture);
    on(window, 'keydown', onKeyDown, capture);
    on(window, 'scroll', onScroll, true);
  }

  function onScroll() {
    if (mode === 'measure' && pointA) applyRect(boxA, pointA);
    if (mode === 'measure' && pointB) applyRect(boxB, pointB);
  }

  function onMouseMove(ev) {
    if (!running) return;
    if (mode === 'measure') {
      const rect = hitRect(ev.clientX, ev.clientY);
      if (!pointB) applyRect(hoverBox, rect);
      if (!pointA) {
        setHud(`${Math.round(rect.width)} × ${Math.round(rect.height)}`);
      } else if (!pointB) {
        setHud(gapText(pointA, rect));
      }
      placeHud(ev.clientX, ev.clientY);
      return;
    }
    if (mode === 'region' && dragging && regionStart) {
      const left = Math.min(regionStart.x, ev.clientX);
      const top = Math.min(regionStart.y, ev.clientY);
      const width = Math.abs(ev.clientX - regionStart.x);
      const height = Math.abs(ev.clientY - regionStart.y);
      applyRect(regionBox, { left, top, width, height, right: left + width, bottom: top + height });
      setHud(`${Math.round(width)} × ${Math.round(height)}`);
      placeHud(ev.clientX, ev.clientY);
    }
  }

  function onMouseDown(ev) {
    if (!running || ev.button !== 0) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (mode === 'region') {
      dragging = true;
      regionStart = { x: ev.clientX, y: ev.clientY };
      applyRect(regionBox, {
        left: ev.clientX,
        top: ev.clientY,
        width: 0,
        height: 0,
        right: ev.clientX,
        bottom: ev.clientY,
      });
    }
  }

  function onMouseUp(ev) {
    if (!running || mode !== 'region' || !dragging) return;
    ev.preventDefault();
    ev.stopPropagation();
    dragging = false;
    const x0 = regionStart.x;
    const y0 = regionStart.y;
    const width = Math.abs(ev.clientX - x0);
    const height = Math.abs(ev.clientY - y0);
    const left = Math.min(x0, ev.clientX);
    const top = Math.min(y0, ev.clientY);
    if (width < 4 || height < 4) {
      applyRect(regionBox, null);
      setHud('');
      regionStart = null;
      return;
    }
    commitRegion({
      x: left + window.scrollX,
      y: top + window.scrollY,
      width,
      height,
      devicePixelRatio: window.devicePixelRatio || 1,
    });
  }

  function onClick(ev) {
    if (!running) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (mode !== 'measure') return;
    const rect = hitRect(ev.clientX, ev.clientY);
    if (!pointA) {
      pointA = rect;
      applyRect(boxA, pointA);
      applyRect(hoverBox, null);
      return;
    }
    if (!pointB) {
      pointB = rect;
      applyRect(boxB, pointB);
      applyRect(hoverBox, null);
      setHud(gapText(pointA, pointB));
      placeHud(ev.clientX, ev.clientY);
      return;
    }
    pointA = rect;
    pointB = null;
    applyRect(boxA, pointA);
    applyRect(boxB, null);
  }

  function onKeyDown(ev) {
    if (!running) return;
    if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      stop(true);
      return;
    }
    if ((ev.key === 'c' || ev.key === 'C') && !ev.metaKey && !ev.ctrlKey && !ev.altKey) {
      if (mode !== 'measure') return;
      ev.preventDefault();
      const text = hud.textContent || '';
      if (!text) return;
      chrome.runtime.sendMessage({ action: 'copy_text', text }, () => {
        void chrome.runtime.lastError;
      });
    }
  }

  async function commitRegion(coords) {
    if (host) host.style.visibility = 'hidden';
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
    chrome.runtime.sendMessage({ action: 'region_coords', coords }, () => {
      void chrome.runtime.lastError;
    });
    stop(false);
  }

  function stop(canceled) {
    if (!running && !host) return;
    running = false;
    offAll();
    resetTransient();
    if (host?.isConnected) host.remove();
    host = null;
    shadow = null;
    layer = null;
    if (canceled) {
      chrome.runtime.sendMessage({ action: 'overlay_canceled' }, () => {
        void chrome.runtime.lastError;
      });
    }
  }

  function start(nextMode) {
    if (nextMode !== 'measure' && nextMode !== 'region') return;
    if (host && host.isConnected) {
      mode = nextMode;
      resetTransient();
      running = true;
      bind();
      return;
    }
    mode = nextMode;
    running = true;
    build();
    bind();
  }

  function hideForCapture() {
    if (host) host.style.visibility = 'hidden';
  }

  function restoreAfterCapture() {
    if (host && host.isConnected) host.style.visibility = 'visible';
  }

  window.__webtoolsStart = start;
  window.__webtoolsHideForCapture = hideForCapture;
  window.__webtoolsRestoreAfterCapture = restoreAfterCapture;
})();
