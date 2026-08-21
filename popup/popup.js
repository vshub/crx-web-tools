import { isRestrictedUrl } from '../background/constants.js';
import { DEFAULT_PRESETS } from '../background/device.js';
import { stateKey } from '../background/session.js';

function sizeLabel(preset) {
  if (preset.windowHeight == null) return String(preset.windowWidth);
  return `${preset.windowWidth}×${preset.windowHeight}`;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function send(action, extra = {}) {
  chrome.runtime.sendMessage({ action, ...extra }, () => {
    void chrome.runtime.lastError;
  });
  window.close();
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (key === 'disabled') node.disabled = value;
    else if (value != null) node.setAttribute(key, value);
  }
  for (const child of children) node.appendChild(child);
  return node;
}

document.addEventListener('DOMContentLoaded', async () => {
  const tab = await getActiveTab();
  const restricted = !tab || isRestrictedUrl(tab.url);
  const reason = document.getElementById('reason');
  const emulateBtn = document.getElementById('toggle_emulate');
  const pageActions = [
    'capture_viewport',
    'capture_viewport_delayed',
    'capture_fullpage',
    'capture_region',
    'toggle_emulate',
    'start_measure',
    'start_qa',
  ];

  if (restricted) {
    reason.hidden = false;
    reason.textContent = 'This page can’t be captured or emulated.';
    for (const id of pageActions) {
      document.getElementById(id).disabled = true;
    }
  }

  const [{ windowPresets }, { lastEmulatePresetId }, { handyPresetIds }, session] = await Promise.all([
    chrome.storage.local.get('windowPresets'),
    chrome.storage.local.get('lastEmulatePresetId'),
    chrome.storage.local.get('handyPresetIds'),
    tab?.id != null ? chrome.storage.session.get(stateKey(tab.id)) : {},
  ]);

  const presets = Array.isArray(windowPresets) && windowPresets.length ? windowPresets : DEFAULT_PRESETS;
  const handy = Array.isArray(handyPresetIds)
    ? new Set(handyPresetIds)
    : new Set(presets.map((p) => p.id));
  const visiblePresets = presets.filter((p) => handy.has(p.id));
  const dbg = tab?.id != null ? session[stateKey(tab.id)] : null;
  const emulating = Boolean(dbg?.emulate);
  const currentPresetId = dbg?.emulatePresetId || lastEmulatePresetId || 'iphone-15';
  const currentPreset = presets.find((p) => p.id === currentPresetId && p.emulate) || presets.find((p) => p.emulate);

  emulateBtn.setAttribute('aria-pressed', emulating ? 'true' : 'false');
  emulateBtn.textContent = `Emulate ${currentPreset?.name || 'iPhone'}`;

  const list = document.getElementById('presets');
  for (const preset of visiblePresets) {
    const icon = el('span', { className: `ico ico-${preset.icon || 'desktop'}`, 'aria-hidden': 'true' });
    const name = el('span', { className: 'preset-name', text: preset.name || 'Preset' });
    const meta = el('span', { className: 'meta', text: sizeLabel(preset) });
    const main = el('button', { type: 'button', className: 'preset-main' }, [icon, name, meta]);
    main.addEventListener('click', () => {
      send('resize_window', {
        width: preset.windowWidth,
        height: preset.windowHeight,
        tabId: tab?.id,
      });
    });
    const row = el('div', { className: 'preset', role: 'listitem' }, [main]);

    if (preset.emulate) {
      const emu = el('button', {
        type: 'button',
        className: 'preset-emulate',
        text: 'Emulate',
        disabled: restricted,
      });
      emu.addEventListener('click', () => {
        send('toggle_emulate', { presetId: preset.id, tabId: tab?.id });
      });
      row.appendChild(emu);
    }
    list.appendChild(row);
  }

  document.getElementById('capture_viewport').addEventListener('click', () => {
    send('capture_viewport', { tabId: tab?.id });
  });
  document.getElementById('capture_viewport_delayed').addEventListener('click', () => {
    send('capture_viewport_delayed', { tabId: tab?.id });
  });
  document.getElementById('capture_fullpage').addEventListener('click', () => {
    send('capture_fullpage', { tabId: tab?.id });
  });
  document.getElementById('capture_region').addEventListener('click', () => {
    send('capture_region', { tabId: tab?.id });
  });
  emulateBtn.addEventListener('click', () => {
    send('toggle_emulate', { tabId: tab?.id });
  });
  document.getElementById('open_split_window').addEventListener('click', () => {
    send('open_split_window', {
      url: tab?.url,
      sourceWindowId: tab?.windowId,
      tabId: tab?.id,
    });
  });
  document.getElementById('start_measure').addEventListener('click', () => {
    send('start_measure', { tabId: tab?.id });
  });
  document.getElementById('start_qa').addEventListener('click', () => {
    send('start_qa', { tabId: tab?.id });
  });
  document.getElementById('settings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });
});
