(() => {
  const OVERLAY_VERSION = 2;
  if (window.__webtoolsOverlayVersion === OVERLAY_VERSION) return;
  window.__webtoolsStop?.();
  document.querySelectorAll('[data-webtools="overlay"]').forEach((node) => node.remove());
  window.__webtoolsOverlayVersion = OVERLAY_VERSION;
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
    .layer.qa {
      cursor: pointer;
      bottom: 48px;
    }
    .layer.inspect {
      cursor: pointer;
    }
    .layer.inspect.panel-open {
      bottom: min(42vh, 280px);
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
    .box.qa-pin {
      border-color: #ef5350;
      background: rgba(239, 83, 80, 0.14);
    }
    .box.qa-pin.blocker { border-color: #e53935; }
    .box.qa-pin.bug { border-color: #fb8c00; }
    .box.qa-pin.nit { border-color: #42a5f5; }
    .badge {
      position: fixed;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #e53935;
      color: #fff;
      font: 700 11px/22px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      text-align: center;
      pointer-events: auto;
      cursor: pointer;
      z-index: 2;
      box-shadow: 0 1px 4px rgba(0,0,0,0.4);
      border: 0;
      padding: 0;
    }
    .badge.blocker { background: #c62828; }
    .badge.bug { background: #ef6c00; }
    .badge.nit { background: #1565c0; }
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
    .toolbar {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      height: 48px;
      display: none;
      align-items: center;
      gap: 8px;
      padding: 0 12px;
      background: #121225;
      border-top: 1px solid #2f2f4a;
      box-shadow: 0 -4px 18px rgba(0,0,0,0.35);
      pointer-events: auto;
      z-index: 5;
    }
    .toolbar.visible { display: flex; }
    .toolbar .title {
      color: #e0e0e0;
      font: 650 12px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      margin-right: 4px;
      flex: none;
    }
    .toolbar button {
      appearance: none;
      background: #2a2a4a;
      color: #e0e0e0;
      border: 1px solid #3a3a5c;
      border-radius: 6px;
      padding: 7px 12px;
      font: 12px/1.2 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      cursor: pointer;
    }
    .toolbar button:hover { background: #34345a; }
    .toolbar button.primary {
      background: #2e4a36;
      border-color: #4caf50;
    }
    .toolbar .count {
      color: #8e8e93;
      font: 12px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 0 4px;
      min-width: 3em;
    }
    .toolbar .spacer { flex: 1; }
    .note-panel {
      position: fixed;
      left: 50%;
      top: 20%;
      transform: translateX(-50%);
      width: min(360px, calc(100vw - 24px));
      background: #1a1a2e;
      color: #e0e0e0;
      border: 1px solid #2f2f4a;
      border-radius: 10px;
      padding: 14px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.5);
      pointer-events: auto;
      z-index: 4;
      display: none;
      font: 13px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .note-panel.visible { display: block; }
    .note-panel h3 {
      margin: 0 0 8px;
      font-size: 14px;
      font-weight: 650;
    }
    .note-panel .meta {
      color: #8e8e93;
      font-size: 11px;
      margin: 0 0 10px;
      word-break: break-all;
    }
    .note-panel label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 10px;
      font-size: 12px;
      color: #8e8e93;
    }
    .note-panel textarea,
    .note-panel select {
      background: #121225;
      color: #e0e0e0;
      border: 1px solid #2f2f4a;
      border-radius: 6px;
      padding: 8px;
      font: inherit;
      color: #e0e0e0;
    }
    .note-panel textarea { min-height: 80px; resize: vertical; }
    .note-actions {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-top: 4px;
    }
    .note-actions button {
      appearance: none;
      background: #2a2a4a;
      color: #e0e0e0;
      border: 1px solid #3a3a5c;
      border-radius: 6px;
      padding: 7px 12px;
      font: inherit;
      cursor: pointer;
    }
    .note-actions button.primary {
      background: #2e4a36;
      border-color: #4caf50;
    }
    .note-actions button.danger {
      background: #3a1f24;
      border-color: #e53935;
      margin-left: auto;
    }
    .inspect-panel {
      position: fixed;
      left: 10px;
      right: 10px;
      bottom: 10px;
      max-height: min(42vh, 280px);
      overflow: auto;
      background: #1a1a2e;
      color: #e0e0e0;
      border: 1px solid #2f2f4a;
      border-radius: 10px;
      padding: 12px 12px 10px;
      box-shadow: 0 8px 28px rgba(0,0,0,0.5);
      pointer-events: auto;
      z-index: 5;
      display: none;
      font: 13px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .inspect-panel.visible { display: block; }
    .inspect-head {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 8px;
    }
    .inspect-head h3 {
      margin: 0;
      font-size: 14px;
      font-weight: 650;
      flex: 1;
      min-width: 0;
      word-break: break-word;
    }
    .inspect-head button {
      appearance: none;
      flex: none;
      background: #2a2a4a;
      color: #e0e0e0;
      border: 1px solid #3a3a5c;
      border-radius: 6px;
      padding: 6px 10px;
      font: 12px/1.2 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      cursor: pointer;
    }
    .inspect-head button.primary {
      background: #2e4a36;
      border-color: #4caf50;
    }
    .inspect-sel {
      color: #8e8e93;
      font: 11px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      margin: 0 0 10px;
      word-break: break-all;
    }
    .inspect-row {
      display: flex;
      gap: 10px;
      margin-bottom: 6px;
      font-size: 12px;
    }
    .inspect-row .k {
      flex: none;
      width: 58px;
      color: #8e8e93;
    }
    .inspect-row .v {
      flex: 1;
      min-width: 0;
      font: 12px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      word-break: break-word;
    }
  `;

  const SEVERITIES = ['bug', 'blocker', 'nit'];

  let host = null;
  let shadow = null;
  let layer = null;
  let hoverBox = null;
  let boxA = null;
  let boxB = null;
  let regionBox = null;
  let hud = null;
  let toolbar = null;
  let notePanel = null;
  let pinLayer = null;
  let mode = null;
  let running = false;
  let pointA = null;
  let pointB = null;
  let regionStart = null;
  let dragging = false;
  let qaPins = [];
  let editingPinId = null;
  let pendingHit = null;
  let noteOpen = false;
  let inspectPanel = null;
  let inspectSelected = null;
  let inspectInfo = null;
  let inspectUi = null;
  const listeners = [];
  const pinNodes = new Map();

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
    const barReserve = mode === 'qa' ? 56 : mode === 'inspect' && inspectPanel?.classList.contains('visible') ? 200 : 8;
    const w = hud.offsetWidth || 80;
    const h = hud.offsetHeight || 24;
    let x = clientX + pad;
    let y = clientY + pad;
    if (x + w > window.innerWidth - 8) x = clientX - w - pad;
    if (y + h > window.innerHeight - barReserve) y = clientY - h - pad;
    hud.style.left = `${Math.max(8, x)}px`;
    hud.style.top = `${Math.max(8, Math.min(y, window.innerHeight - barReserve - h))}px`;
  }

  function setHud(text) {
    hud.textContent = text || '';
    hud.style.display = text ? 'block' : 'none';
  }

  function hitElement(clientX, clientY) {
    layer.style.pointerEvents = 'none';
    host.style.pointerEvents = 'none';
    if (toolbar) toolbar.style.pointerEvents = 'none';
    if (notePanel) notePanel.style.pointerEvents = 'none';
    if (inspectPanel) inspectPanel.style.pointerEvents = 'none';
    const node = document.elementFromPoint(clientX, clientY);
    layer.style.pointerEvents = 'auto';
    if (toolbar) toolbar.style.pointerEvents = 'auto';
    if (notePanel) notePanel.style.pointerEvents = 'auto';
    if (inspectPanel) inspectPanel.style.pointerEvents = 'auto';
    if (!node || node === host || host.contains(node)) return null;
    return node;
  }

  function hitRect(clientX, clientY) {
    const node = hitElement(clientX, clientY);
    if (!node) {
      return {
        left: clientX,
        top: clientY,
        right: clientX,
        bottom: clientY,
        width: 0,
        height: 0,
        fromPoint: true,
        element: null,
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
      element: node,
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

  function cssEscape(value) {
    if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value);
    return String(value).replace(/([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
  }

  function cssPath(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) {
      const idSel = `#${cssEscape(el.id)}`;
      try {
        if (document.querySelectorAll(idSel).length === 1) return idSel;
      } catch (_) {}
    }
    const testid = el.getAttribute('data-testid');
    if (testid) {
      const sel = `[data-testid="${cssEscape(testid)}"]`;
      try {
        if (document.querySelectorAll(sel).length === 1) return sel;
      } catch (_) {}
    }
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && cur !== document.documentElement) {
      const tag = cur.tagName.toLowerCase();
      let part = tag;
      if (cur.parentElement) {
        const siblings = [...cur.parentElement.children].filter((c) => c.tagName === cur.tagName);
        if (siblings.length > 1) {
          part += `:nth-of-type(${siblings.indexOf(cur) + 1})`;
        }
      }
      parts.unshift(part);
      if (parts.length >= 6) break;
      cur = cur.parentElement;
    }
    return parts.join(' > ') || el.tagName.toLowerCase();
  }

  function shortLabel(el) {
    const testid = el.getAttribute?.('data-testid');
    if (testid) return testid.slice(0, 40);
    const aria = el.getAttribute?.('aria-label');
    if (aria) return aria.slice(0, 40);
    const text = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');
    if (text) return text.slice(0, 40);
    return el.tagName?.toLowerCase() || 'element';
  }

  function toHex(color) {
    if (!color) return '';
    const s = String(color).trim();
    if (s === 'transparent' || s === 'rgba(0, 0, 0, 0)') return 'transparent';
    const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i);
    if (!m) return s;
    const a = m[4] === undefined ? 1 : Number(m[4]);
    if (!Number.isFinite(a) || a <= 0) return 'transparent';
    const hex = [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
    if (a < 1) return `#${hex} ${Math.round(a * 100)}%`;
    return `#${hex}`;
  }

  function roundPx(value) {
    const n = parseFloat(value);
    if (!Number.isFinite(n)) return String(value || '0');
    return String(Math.round(n));
  }

  function boxSides(cs, prop) {
    const t = roundPx(cs[`${prop}Top`]);
    const r = roundPx(cs[`${prop}Right`]);
    const b = roundPx(cs[`${prop}Bottom`]);
    const l = roundPx(cs[`${prop}Left`]);
    if (t === r && r === b && b === l) return t;
    if (t === b && r === l) return `${t} ${r}`;
    return `${t} ${r} ${b} ${l}`;
  }

  function inspectName(el) {
    const component = el.getAttribute?.('data-component') || el.getAttribute?.('data-name');
    if (component) return component.slice(0, 60);
    const slot = el.getAttribute?.('data-slot');
    if (slot) return slot.slice(0, 60);
    const testid = el.getAttribute?.('data-testid');
    if (testid) return testid.slice(0, 60);
    const aria = el.getAttribute?.('aria-label');
    if (aria) return aria.slice(0, 60);
    const cls = [...(el.classList || [])].find(
      (c) => /^(Mui|ant-|chakra-|Button|Card|Dialog|Input|Badge)/.test(c) || /[A-Z]/.test(c),
    );
    if (cls) return cls.slice(0, 60);
    return shortLabel(el);
  }

  function collectTokens(el) {
    const names = [];
    const seen = new Set();
    let node = el;
    let depth = 0;
    while (node && node.nodeType === 1 && depth < 5 && names.length < 8) {
      let cs;
      try {
        cs = getComputedStyle(node);
      } catch (_) {
        break;
      }
      for (const prop of cs) {
        if (!prop.startsWith('--')) continue;
        if (!/(color|bg|background|font|space|spacing|size|radius|shadow|gap|pad|margin|primary|accent)/i.test(prop)) {
          continue;
        }
        if (seen.has(prop)) continue;
        const val = cs.getPropertyValue(prop).trim();
        if (!val) continue;
        seen.add(prop);
        names.push(prop);
        if (names.length >= 8) break;
      }
      node = node.parentElement;
      depth += 1;
    }
    return names;
  }

  function extractInspect(el) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const classes = [...(el.classList || [])].filter((c) => c && c.length < 64).slice(0, 10);
    const family = (cs.fontFamily || '').split(',')[0].replace(/['"]/g, '').trim();
    const size = roundPx(cs.fontSize);
    const lhRaw = cs.lineHeight;
    const lh = lhRaw === 'normal' ? '' : roundPx(lhRaw);
    const font = `${family} ${size}${lh ? `/${lh}` : ''} · ${cs.fontWeight}`;
    const fg = toHex(cs.color);
    const bg = toHex(cs.backgroundColor);
    const colors = bg && bg !== 'transparent' ? `${fg} on ${bg}` : fg;
    const spacing = `margin ${boxSides(cs, 'margin')} · padding ${boxSides(cs, 'padding')} · radius ${roundPx(cs.borderRadius)}`;
    const tokens = collectTokens(el);
    const role = el.getAttribute('role') || '';
    const tag = el.tagName.toLowerCase();
    const info = {
      name: inspectName(el),
      tag: role ? `${tag} [${role}]` : tag,
      selector: cssPath(el),
      classes: classes.join('  '),
      width: Math.round(r.width),
      height: Math.round(r.height),
      font,
      colors,
      spacing,
      tokens: tokens.join(', '),
    };
    const lines = [info.name, `${info.tag} · ${info.selector}`];
    if (info.classes) lines.push(info.classes);
    lines.push(`${info.width} × ${info.height}`);
    if (info.font) lines.push(info.font);
    if (info.colors) lines.push(info.colors);
    if (info.spacing) lines.push(info.spacing);
    if (info.tokens) lines.push(`tokens: ${info.tokens}`);
    info.copy = lines.join('\n');
    return info;
  }

  function setInspectRow(id, text) {
    const node = inspectUi?.[id];
    if (!node) return;
    node.textContent = text || '—';
  }

  function closeInspect() {
    inspectSelected = null;
    inspectInfo = null;
    inspectPanel?.classList.remove('visible');
    layer?.classList.remove('panel-open');
    applyRect(boxA, null);
  }

  function showInspect(el) {
    if (!el || !inspectPanel || !inspectUi) return;
    inspectSelected = el;
    inspectInfo = extractInspect(el);
    inspectUi.name.textContent = inspectInfo.name;
    inspectUi.sel.textContent = `${inspectInfo.tag} · ${inspectInfo.selector}`;
    setInspectRow('classes', inspectInfo.classes);
    setInspectRow('size', `${inspectInfo.width} × ${inspectInfo.height}`);
    setInspectRow('font', inspectInfo.font);
    setInspectRow('colors', inspectInfo.colors);
    setInspectRow('spacing', inspectInfo.spacing);
    setInspectRow('tokens', inspectInfo.tokens);
    inspectUi.copyBtn.textContent = 'Copy';
    inspectPanel.classList.add('visible');
    layer?.classList.add('panel-open');
    const r = el.getBoundingClientRect();
    applyRect(boxA, {
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
      right: r.right,
      bottom: r.bottom,
    });
  }

  function copyInspect() {
    const text = inspectInfo?.copy || '';
    if (!text) return;
    send({ action: 'copy_text', text });
    if (inspectUi?.copyBtn) {
      inspectUi.copyBtn.textContent = 'Copied';
      setTimeout(() => {
        if (inspectUi?.copyBtn) inspectUi.copyBtn.textContent = 'Copy';
      }, 900);
    }
  }

  function buildInspectPanel() {
    inspectPanel = el('div', 'inspect-panel');
    const head = el('div', 'inspect-head');
    const title = el('h3');
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'primary';
    copyBtn.textContent = 'Copy';
    const doneBtn = document.createElement('button');
    doneBtn.type = 'button';
    doneBtn.textContent = 'Done';
    head.append(title, copyBtn, doneBtn);
    const sel = el('p', 'inspect-sel');
    inspectPanel.append(head, sel);
    inspectUi = { name: title, sel, copyBtn };
    const rows = [
      ['classes', 'Class'],
      ['size', 'Size'],
      ['font', 'Type'],
      ['colors', 'Color'],
      ['spacing', 'Space'],
      ['tokens', 'Tokens'],
    ];
    for (const [id, label] of rows) {
      const row = el('div', 'inspect-row');
      const k = el('span', 'k');
      k.textContent = label;
      const v = el('span', 'v');
      row.append(k, v);
      inspectPanel.appendChild(row);
      inspectUi[id] = v;
    }
    copyBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      copyInspect();
    });
    doneBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      stop(false);
    });
    const stopUi = (ev) => {
      ev.stopPropagation();
    };
    for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click', 'mousemove']) {
      inspectPanel.addEventListener(type, stopUi, false);
    }
    shadow.appendChild(inspectPanel);
  }

  function rectFromElement(el) {
    const r = el.getBoundingClientRect();
    return {
      x: r.left + window.scrollX,
      y: r.top + window.scrollY,
      width: Math.max(1, r.width),
      height: Math.max(1, r.height),
      devicePixelRatio: window.devicePixelRatio || 1,
      left: r.left,
      top: r.top,
      right: r.right,
      bottom: r.bottom,
    };
  }

  function resetTransient() {
    pointA = null;
    pointB = null;
    regionStart = null;
    dragging = false;
    pendingHit = null;
    applyRect(hoverBox, null);
    applyRect(boxA, null);
    applyRect(boxB, null);
    applyRect(regionBox, null);
    closeInspect();
    setHud('');
  }

  function send(msg) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(msg, (res) => {
        void chrome.runtime.lastError;
        resolve(res);
      });
    });
  }

  async function syncPins() {
    await send({ action: 'qa_sync', pins: qaPins.map(serializePin) });
    updateToolbarCount();
  }

  function serializePin(pin) {
    return {
      id: pin.id,
      n: pin.n,
      selector: pin.selector,
      tag: pin.tag,
      label: pin.label,
      note: pin.note,
      severity: pin.severity,
      rect: {
        x: pin.rect.x,
        y: pin.rect.y,
        width: pin.rect.width,
        height: pin.rect.height,
        devicePixelRatio: pin.rect.devicePixelRatio,
      },
    };
  }

  function updateToolbarCount() {
    if (!toolbar) return;
    const count = toolbar.querySelector('.count');
    if (count) {
      const n = qaPins.length;
      count.textContent = n === 1 ? '1 pin' : `${n} pins`;
    }
  }

  function clearPinNodes() {
    for (const nodes of pinNodes.values()) {
      nodes.box?.remove();
      nodes.badge?.remove();
    }
    pinNodes.clear();
  }

  function placePinNodes(pin) {
    let nodes = pinNodes.get(pin.id);
    if (!nodes) {
      const box = el('div', `box qa-pin ${pin.severity || 'bug'}`);
      const badge = el('button', `badge ${pin.severity || 'bug'}`);
      badge.type = 'button';
      badge.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        openNoteForPin(pin.id);
      });
      pinLayer.append(box, badge);
      nodes = { box, badge };
      pinNodes.set(pin.id, nodes);
    }
    nodes.box.className = `box qa-pin ${pin.severity || 'bug'}`;
    nodes.badge.className = `badge ${pin.severity || 'bug'}`;
    nodes.badge.textContent = String(pin.n);
    let left = pin.rect.left;
    let top = pin.rect.top;
    let width = pin.rect.width;
    let height = pin.rect.height;
    try {
      const found = document.querySelector(pin.selector);
      if (found) {
        const r = found.getBoundingClientRect();
        left = r.left;
        top = r.top;
        width = r.width;
        height = r.height;
        pin.rect = {
          ...pin.rect,
          ...rectFromElement(found),
        };
      }
    } catch (_) {}
    applyRect(nodes.box, { left, top, width, height, right: left + width, bottom: top + height });
    nodes.badge.style.left = `${Math.max(4, left - 8)}px`;
    nodes.badge.style.top = `${Math.max(4, top - 8)}px`;
  }

  function renderPins() {
    const keep = new Set(qaPins.map((p) => p.id));
    for (const id of [...pinNodes.keys()]) {
      if (!keep.has(id)) {
        const nodes = pinNodes.get(id);
        nodes.box?.remove();
        nodes.badge?.remove();
        pinNodes.delete(id);
      }
    }
    for (const pin of qaPins) placePinNodes(pin);
    updateToolbarCount();
  }

  function buildNotePanel() {
    notePanel = el('div', 'note-panel');
    const title = el('h3');
    title.textContent = 'QA note';
    const meta = el('p', 'meta');
    meta.id = 'qa-meta';
    const noteLabel = el('label');
    noteLabel.appendChild(document.createTextNode('Note'));
    const textarea = document.createElement('textarea');
    textarea.id = 'qa-note';
    textarea.setAttribute('rows', '4');
    noteLabel.appendChild(textarea);
    const sevLabel = el('label');
    sevLabel.appendChild(document.createTextNode('Severity'));
    const select = document.createElement('select');
    select.id = 'qa-severity';
    for (const s of SEVERITIES) {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      select.appendChild(opt);
    }
    sevLabel.appendChild(select);
    const actions = el('div', 'note-actions');
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'primary';
    saveBtn.textContent = 'Save';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'danger';
    delBtn.id = 'qa-delete';
    delBtn.textContent = 'Delete';
    delBtn.hidden = true;
    actions.append(saveBtn, cancelBtn, delBtn);
    notePanel.append(title, meta, noteLabel, sevLabel, actions);
    saveBtn.addEventListener('click', () => saveNote());
    cancelBtn.addEventListener('click', () => closeNote(false));
    delBtn.addEventListener('click', () => deleteEditingPin());
    // Bubble phase only — capture would swallow Save/Cancel before buttons see the click.
    const stopUi = (ev) => {
      ev.stopPropagation();
    };
    for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click']) {
      notePanel.addEventListener(type, stopUi, false);
    }
    shadow.appendChild(notePanel);
  }

  function buildToolbar() {
    toolbar = el('div', 'toolbar');
    const title = el('span', 'title');
    title.textContent = 'QA notes';
    const count = el('span', 'count');
    count.textContent = '0 pins';
    const spacer = el('span', 'spacer');
    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'primary';
    exportBtn.textContent = 'Export';
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.textContent = 'Copy MD';
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.textContent = 'Clear';
    const doneBtn = document.createElement('button');
    doneBtn.type = 'button';
    doneBtn.textContent = 'Done';
    toolbar.append(title, count, spacer, exportBtn, copyBtn, clearBtn, doneBtn);

    // Bubble phase only so Export/Copy handlers still receive the click.
    const stopUi = (ev) => {
      ev.stopPropagation();
    };
    for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click', 'mousemove']) {
      toolbar.addEventListener(type, stopUi, false);
    }

    exportBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      send({ action: 'qa_export' });
    });
    copyBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      send({ action: 'qa_copy_md' });
    });
    clearBtn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      qaPins = [];
      clearPinNodes();
      await syncPins();
      await send({ action: 'qa_clear' });
    });
    doneBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      stop(false);
    });
    shadow.appendChild(toolbar);
  }

  function openNoteForHit(hit) {
    const elTarget = hit.element;
    if (!elTarget) return;
    pendingHit = {
      element: elTarget,
      selector: cssPath(elTarget),
      tag: elTarget.tagName.toLowerCase(),
      label: shortLabel(elTarget),
      rect: rectFromElement(elTarget),
    };
    editingPinId = null;
    noteOpen = true;
    notePanel.classList.add('visible');
    const meta = notePanel.querySelector('#qa-meta');
    meta.textContent = `${pendingHit.label} · ${pendingHit.selector}`;
    const textarea = notePanel.querySelector('#qa-note');
    textarea.value = '';
    notePanel.querySelector('#qa-severity').value = 'bug';
    notePanel.querySelector('#qa-delete').hidden = true;
    textarea.focus();
  }

  function openNoteForPin(pinId) {
    const pin = qaPins.find((p) => p.id === pinId);
    if (!pin) return;
    editingPinId = pinId;
    pendingHit = null;
    noteOpen = true;
    notePanel.classList.add('visible');
    const meta = notePanel.querySelector('#qa-meta');
    meta.textContent = `#${pin.n} ${pin.label} · ${pin.selector}`;
    notePanel.querySelector('#qa-note').value = pin.note || '';
    notePanel.querySelector('#qa-severity').value = pin.severity || 'bug';
    notePanel.querySelector('#qa-delete').hidden = false;
    notePanel.querySelector('#qa-note').focus();
  }

  function closeNote() {
    noteOpen = false;
    editingPinId = null;
    pendingHit = null;
    notePanel.classList.remove('visible');
  }

  async function saveNote() {
    const note = notePanel.querySelector('#qa-note').value.trim();
    const severity = notePanel.querySelector('#qa-severity').value || 'bug';
    if (!note) {
      notePanel.querySelector('#qa-note').focus();
      return;
    }
    if (editingPinId) {
      const pin = qaPins.find((p) => p.id === editingPinId);
      if (pin) {
        pin.note = note;
        pin.severity = severity;
      }
    } else if (pendingHit) {
      const n = qaPins.length ? Math.max(...qaPins.map((p) => p.n)) + 1 : 1;
      qaPins.push({
        id: `pin-${Date.now().toString(36)}-${n}`,
        n,
        selector: pendingHit.selector,
        tag: pendingHit.tag,
        label: pendingHit.label,
        note,
        severity,
        rect: pendingHit.rect,
      });
    }
    closeNote();
    renderPins();
    await syncPins();
  }

  async function deleteEditingPin() {
    if (!editingPinId) return;
    qaPins = qaPins.filter((p) => p.id !== editingPinId);
    qaPins.forEach((p, i) => {
      p.n = i + 1;
    });
    closeNote();
    renderPins();
    await syncPins();
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
    pinLayer = el('div', 'pin-layer');
    pinLayer.style.cssText = 'position:fixed;inset:0;pointer-events:none;';
    hud = el('div', 'hud');
    hoverBox.style.display = 'none';
    boxA.style.display = 'none';
    boxB.style.display = 'none';
    regionBox.style.display = 'none';
    hud.style.display = 'none';
    shadow.append(style, layer);
    layer.append(hoverBox, boxA, boxB, regionBox, pinLayer, hud);
    document.documentElement.appendChild(host);
    buildToolbar();
    buildNotePanel();
    buildInspectPanel();
  }

  function bind() {
    offAll();
    // Pointer pick runs on the content layer only — not on the docked QA bar —
    // so Export/Copy never get treated as page-element clicks.
    const capture = true;
    on(layer, 'mousemove', onMouseMove, capture);
    on(layer, 'mousedown', onMouseDown, capture);
    on(layer, 'mouseup', onMouseUp, capture);
    on(layer, 'click', onClick, capture);
    on(window, 'keydown', onKeyDown, capture);
    on(window, 'scroll', onScroll, true);
    on(window, 'resize', onScroll, true);
  }

  function onScroll() {
    if (mode === 'measure' && pointA) applyRect(boxA, pointA);
    if (mode === 'measure' && pointB) applyRect(boxB, pointB);
    if (mode === 'qa') renderPins();
    if (mode === 'inspect' && inspectSelected?.isConnected) {
      const r = inspectSelected.getBoundingClientRect();
      applyRect(boxA, {
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
        right: r.right,
        bottom: r.bottom,
      });
      if (inspectUi?.size) {
        inspectUi.size.textContent = `${Math.round(r.width)} × ${Math.round(r.height)}`;
      }
    }
  }

  function onMouseMove(ev) {
    if (!running || noteOpen) return;
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
    if (mode === 'qa') {
      const rect = hitRect(ev.clientX, ev.clientY);
      applyRect(hoverBox, rect);
      if (rect.element) {
        setHud(`${shortLabel(rect.element)} · ${Math.round(rect.width)}×${Math.round(rect.height)}`);
      } else {
        setHud('Click an element');
      }
      placeHud(ev.clientX, ev.clientY);
      return;
    }
    if (mode === 'inspect') {
      const rect = hitRect(ev.clientX, ev.clientY);
      applyRect(hoverBox, rect);
      if (rect.element) {
        setHud(`${inspectName(rect.element)} · ${Math.round(rect.width)}×${Math.round(rect.height)}`);
      } else {
        setHud('Click an element');
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
    if (!running || ev.button !== 0 || noteOpen) return;
    if (mode === 'qa' || mode === 'inspect') return;
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
    if (!running || noteOpen) return;
    if (mode === 'qa') {
      const path = typeof ev.composedPath === 'function' ? ev.composedPath() : [];
      // Badge has its own handler; layer listens in capture so bail early.
      if (path.some((n) => n?.classList?.contains?.('badge'))) return;
      ev.preventDefault();
      ev.stopPropagation();
      const hit = hitRect(ev.clientX, ev.clientY);
      if (!hit.element) return;
      openNoteForHit(hit);
      return;
    }
    if (mode === 'inspect') {
      ev.preventDefault();
      ev.stopPropagation();
      const hit = hitRect(ev.clientX, ev.clientY);
      if (!hit.element) return;
      showInspect(hit.element);
      return;
    }
    if (mode !== 'measure') return;
    ev.preventDefault();
    ev.stopPropagation();
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
      if (noteOpen) {
        closeNote();
        return;
      }
      // QA: exit overlay but keep session pins
      stop(mode !== 'qa');
      return;
    }
    if ((ev.key === 'c' || ev.key === 'C') && !ev.metaKey && !ev.ctrlKey && !ev.altKey) {
      if (noteOpen) return;
      if (mode === 'inspect') {
        ev.preventDefault();
        copyInspect();
        return;
      }
      if (mode !== 'measure') return;
      ev.preventDefault();
      const text = hud.textContent || '';
      if (!text) return;
      send({ action: 'copy_text', text });
    }
  }

  async function commitRegion(coords) {
    if (host) host.style.visibility = 'hidden';
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
    send({ action: 'region_coords', coords });
    stop(false);
  }

  function stop(canceled) {
    if (!running && !host) return;
    running = false;
    offAll();
    resetTransient();
    closeNote();
    closeInspect();
    clearPinNodes();
    if (toolbar) toolbar.classList.remove('visible');
    if (inspectPanel) inspectPanel.classList.remove('visible');
    if (host?.isConnected) host.remove();
    host = null;
    shadow = null;
    layer = null;
    toolbar = null;
    notePanel = null;
    inspectPanel = null;
    inspectUi = null;
    pinLayer = null;
    if (canceled) {
      send({ action: 'overlay_canceled' });
    }
  }

  async function start(nextMode) {
    if (nextMode !== 'measure' && nextMode !== 'region' && nextMode !== 'qa' && nextMode !== 'inspect') return;
    if (host && host.isConnected) {
      mode = nextMode;
      resetTransient();
      running = true;
      layer.classList.toggle('qa', nextMode === 'qa');
      layer.classList.toggle('inspect', nextMode === 'inspect');
      if (toolbar) toolbar.classList.toggle('visible', nextMode === 'qa');
      if (nextMode === 'qa') {
        const state = await send({ action: 'qa_get' });
        qaPins = Array.isArray(state?.pins) ? state.pins.map(hydratePin) : [];
        renderPins();
      } else {
        qaPins = [];
        clearPinNodes();
      }
      bind();
      return;
    }
    mode = nextMode;
    running = true;
    build();
    layer.classList.toggle('qa', nextMode === 'qa');
    layer.classList.toggle('inspect', nextMode === 'inspect');
    if (toolbar) toolbar.classList.toggle('visible', nextMode === 'qa');
    if (nextMode === 'qa') {
      const state = await send({ action: 'qa_get' });
      qaPins = Array.isArray(state?.pins) ? state.pins.map(hydratePin) : [];
      renderPins();
    }
    bind();
  }

  function hydratePin(raw) {
    return {
      id: raw.id,
      n: Number(raw.n) || 1,
      selector: raw.selector || '',
      tag: raw.tag || '',
      label: raw.label || 'element',
      note: raw.note || '',
      severity: SEVERITIES.includes(raw.severity) ? raw.severity : 'bug',
      rect: {
        x: Number(raw.rect?.x) || 0,
        y: Number(raw.rect?.y) || 0,
        width: Math.max(1, Number(raw.rect?.width) || 1),
        height: Math.max(1, Number(raw.rect?.height) || 1),
        devicePixelRatio: Number(raw.rect?.devicePixelRatio) || window.devicePixelRatio || 1,
        left: (Number(raw.rect?.x) || 0) - window.scrollX,
        top: (Number(raw.rect?.y) || 0) - window.scrollY,
      },
    };
  }

  function hideForCapture() {
    if (host) host.style.visibility = 'hidden';
  }

  function restoreAfterCapture() {
    if (host && host.isConnected) host.style.visibility = 'visible';
  }

  window.__webtoolsStart = start;
  window.__webtoolsStop = () => stop(false);
  window.__webtoolsHideForCapture = hideForCapture;
  window.__webtoolsRestoreAfterCapture = restoreAfterCapture;
})();
