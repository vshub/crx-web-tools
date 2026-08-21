import { isRestrictedUrl } from '../background/constants.js';
import { DEFAULT_PRESETS } from '../background/device.js';
import { defaultHandyPresetIds, getSettings, saveSettings } from '../background/settings.js';

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

function ask(action, extra = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action, ...extra }, (result) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(result);
    });
  });
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

function onClick(id, handler) {
  const node = document.getElementById(id);
  if (node) node.addEventListener('click', handler);
}

document.addEventListener('DOMContentLoaded', async () => {
  const versionEl = document.getElementById('version');
  if (versionEl) {
    const ver = chrome.runtime.getManifest().version;
    versionEl.textContent = `v${ver}`;
  }

  const tab = await getActiveTab();
  const restricted = !tab || isRestrictedUrl(tab.url);
  const reason = document.getElementById('reason');
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
      const node = document.getElementById(id);
      if (node) node.disabled = true;
    }
    const stamp = document.getElementById('stampEnabled');
    if (stamp) stamp.disabled = true;
    const hud = document.getElementById('showViewportHud');
    if (hud) hud.disabled = true;
  }

  const settings = await getSettings();
  const stampInput = document.getElementById('stampEnabled');
  if (stampInput) {
    stampInput.checked = Boolean(settings.stampEnabled);
    stampInput.addEventListener('change', async () => {
      try {
        await saveSettings({ stampEnabled: stampInput.checked });
      } catch (_) {
        stampInput.checked = !stampInput.checked;
      }
    });
  }

  const hudInput = document.getElementById('showViewportHud');
  if (hudInput && !restricted) {
    const state = await ask('viewport_hud_state', { tabId: tab?.id });
    hudInput.checked = Boolean(state?.visible);
    hudInput.addEventListener('change', async () => {
      const result = await ask('set_viewport_hud', {
        tabId: tab?.id,
        enabled: hudInput.checked,
      });
      if (!result?.ok) hudInput.checked = !hudInput.checked;
    });
  }

  const [{ windowPresets }, { handyPresetIds }] = await Promise.all([
    chrome.storage.local.get('windowPresets'),
    chrome.storage.local.get('handyPresetIds'),
  ]);

  const presets = Array.isArray(windowPresets) && windowPresets.length ? windowPresets : DEFAULT_PRESETS;
  const handy = Array.isArray(handyPresetIds)
    ? new Set(handyPresetIds)
    : new Set(defaultHandyPresetIds(presets));
  const visiblePresets = presets.filter((p) => handy.has(p.id));

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
    list.appendChild(el('div', { className: 'preset', role: 'listitem' }, [main]));
  }

  onClick('capture_viewport', () => send('capture_viewport', { tabId: tab?.id }));
  onClick('capture_viewport_delayed', () => send('capture_viewport_delayed', { tabId: tab?.id }));
  onClick('capture_fullpage', () => send('capture_fullpage', { tabId: tab?.id }));
  onClick('capture_region', () => send('capture_region', { tabId: tab?.id }));
  onClick('start_measure', () => send('start_measure', { tabId: tab?.id }));
  onClick('start_qa', () => send('start_qa', { tabId: tab?.id }));
  onClick('settings', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });
});
