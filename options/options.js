import { DEFAULT_PRESETS } from '../background/device.js';
import {
  defaultHandyPresetIds,
  getHandyPresetIds,
  getSettings,
  saveSettings,
  setHandyPresetIds,
} from '../background/settings.js';

const ICONS = new Set(['desktop', 'laptop', 'tablet', 'mobile']);

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (typeof value === 'boolean') {
      if (value) node.setAttribute(key, '');
      else node.removeAttribute(key);
    } else if (value != null) node.setAttribute(key, value);
  }
  for (const child of children) node.appendChild(child);
  return node;
}

function showStatus(id, text, isError = false) {
  const node = document.getElementById(id);
  node.hidden = !text;
  node.textContent = text || '';
  node.classList.toggle('error', Boolean(isError));
}

async function loadPresets() {
  const { windowPresets } = await chrome.storage.local.get('windowPresets');
  return Array.isArray(windowPresets) && windowPresets.length ? windowPresets : DEFAULT_PRESETS.slice();
}

async function savePresets(presets) {
  await chrome.storage.local.set({ windowPresets: presets });
}

function fillSaveForm(settings) {
  document.getElementById('downloadFolder').value = settings.downloadFolder;
  document.getElementById('filenamePattern').value = settings.filenamePattern;
  document.getElementById('delaySeconds').value = String(settings.delaySeconds);
  document.getElementById('maxHeight').value = String(settings.maxHeight);
  document.getElementById('saveMode').value = settings.saveMode;
  document.getElementById('reportFolder').value = settings.reportFolder || 'WebTools-reports';
  document.getElementById('copyMdOnExport').checked = settings.copyMdOnExport !== false;
}

function validateSettingsFromForm() {
  const downloadFolder = document.getElementById('downloadFolder').value;
  const filenamePattern = document.getElementById('filenamePattern').value.trim();
  const delaySeconds = Number(document.getElementById('delaySeconds').value);
  const maxHeight = Number(document.getElementById('maxHeight').value);
  const saveMode = document.getElementById('saveMode').value;
  const reportFolder = document.getElementById('reportFolder').value;
  const copyMdOnExport = document.getElementById('copyMdOnExport').checked;
  if (!filenamePattern) throw new Error('Filename pattern is required.');
  if (!Number.isFinite(delaySeconds) || delaySeconds < 0 || delaySeconds > 15) {
    throw new Error('Delay must be between 0 and 15.');
  }
  if (!Number.isFinite(maxHeight) || maxHeight < 500 || maxHeight > 20000) {
    throw new Error('Max height must be between 500 and 20000.');
  }
  if (!['clipboard', 'download', 'both'].includes(saveMode)) {
    throw new Error('Invalid save mode.');
  }
  return {
    downloadFolder,
    filenamePattern,
    delaySeconds: Math.round(delaySeconds),
    maxHeight: Math.round(maxHeight),
    saveMode,
    reportFolder,
    copyMdOnExport,
  };
}

function optionalNumber(id) {
  const raw = document.getElementById(id).value;
  if (raw === '' || raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

function readPresetForm() {
  const name = document.getElementById('preset-name').value.trim();
  const icon = document.getElementById('preset-icon').value;
  const windowWidth = Number(document.getElementById('preset-window-width').value);
  const windowHeight = optionalNumber('preset-window-height');
  const emulate = document.getElementById('preset-emulate').checked;
  if (!name) throw new Error('Name is required.');
  if (!ICONS.has(icon)) throw new Error('Invalid icon.');
  if (!Number.isFinite(windowWidth) || windowWidth < 200) throw new Error('Window width is invalid.');
  if (windowHeight != null && (!Number.isFinite(windowHeight) || windowHeight < 200)) {
    throw new Error('Window height is invalid.');
  }
  const preset = {
    id: document.getElementById('preset-id').value || `custom-${Date.now().toString(36)}`,
    name,
    icon,
    windowWidth: Math.round(windowWidth),
    windowHeight: windowHeight == null ? null : Math.round(windowHeight),
    emulate,
  };
  if (emulate) {
    const emulateWidth = Number(document.getElementById('preset-emulate-width').value);
    const emulateHeight = Number(document.getElementById('preset-emulate-height').value);
    const deviceScaleFactor = Number(document.getElementById('preset-dpr').value);
    const userAgent = document.getElementById('preset-ua').value.trim();
    if (!Number.isFinite(emulateWidth) || emulateWidth < 1) throw new Error('Emulate width is invalid.');
    if (!Number.isFinite(emulateHeight) || emulateHeight < 1) throw new Error('Emulate height is invalid.');
    if (!Number.isFinite(deviceScaleFactor) || deviceScaleFactor <= 0 || deviceScaleFactor > 8) {
      throw new Error('Device scale factor is invalid.');
    }
    if (!userAgent) throw new Error('User agent is required when emulating.');
    preset.emulateWidth = Math.round(emulateWidth);
    preset.emulateHeight = Math.round(emulateHeight);
    preset.deviceScaleFactor = deviceScaleFactor;
    preset.userAgent = userAgent;
  }
  return preset;
}

function fillPresetForm(preset) {
  document.getElementById('preset-id').value = preset?.id || '';
  document.getElementById('preset-name').value = preset?.name || '';
  document.getElementById('preset-icon').value = ICONS.has(preset?.icon) ? preset.icon : 'mobile';
  document.getElementById('preset-window-width').value = preset?.windowWidth ?? 390;
  document.getElementById('preset-window-height').value = preset?.windowHeight ?? '';
  document.getElementById('preset-emulate').checked = Boolean(preset?.emulate);
  document.getElementById('preset-emulate-width').value = preset?.emulateWidth ?? preset?.windowWidth ?? 390;
  document.getElementById('preset-emulate-height').value = preset?.emulateHeight ?? preset?.windowHeight ?? 844;
  document.getElementById('preset-dpr').value = preset?.deviceScaleFactor ?? 2;
  document.getElementById('preset-ua').value = preset?.userAgent || '';
  syncEmulateFields();
}

function syncEmulateFields() {
  const on = document.getElementById('preset-emulate').checked;
  document.getElementById('emulate-fields').hidden = !on;
}

async function renderPresets() {
  const list = document.getElementById('preset-list');
  while (list.firstChild) list.removeChild(list.firstChild);
  const presets = await loadPresets();
  const handy = new Set(await getHandyPresetIds(presets));
  for (const preset of presets) {
    const metaBits = [`${preset.windowWidth}${preset.windowHeight ? `×${preset.windowHeight}` : ''}`];
    if (preset.emulate) metaBits.push('emulate');

    const handyInput = el('input', { type: 'checkbox' });
    handyInput.checked = handy.has(preset.id);
    handyInput.addEventListener('change', async () => {
      const current = new Set(await getHandyPresetIds(await loadPresets()));
      if (handyInput.checked) current.add(preset.id);
      else current.delete(preset.id);
      await setHandyPresetIds([...current]);
      showStatus('preset-status', 'Handy list updated.');
    });
    const handyLabel = el('label', { className: 'handy' }, [
      handyInput,
      document.createTextNode('Handy'),
    ]);

    const edit = el('button', { type: 'button', text: 'Edit' });
    const del = el('button', { type: 'button', text: 'Delete' });
    edit.addEventListener('click', () => openPresetDialog(preset));
    del.addEventListener('click', async () => {
      const all = await loadPresets();
      const next = all.filter((p) => p.id !== preset.id);
      await savePresets(next);
      const handyIds = (await getHandyPresetIds(all)).filter((id) => id !== preset.id);
      await setHandyPresetIds(handyIds);
      await renderPresets();
    });
    list.appendChild(
      el('div', { className: 'preset-row' }, [
        handyLabel,
        el('div', { className: 'name', text: preset.name || 'Preset' }),
        el('div', { className: 'meta', text: metaBits.join(' · ') }),
        el('div', { className: 'actions' }, [edit, del]),
      ]),
    );
  }
}

function openPresetDialog(preset) {
  const dialog = document.getElementById('preset-dialog');
  document.getElementById('preset-dialog-title').textContent = preset ? 'Edit preset' : 'Add preset';
  showStatus('preset-error', '');
  fillPresetForm(preset || {
    icon: 'mobile',
    windowWidth: 390,
    windowHeight: 844,
    emulate: true,
    emulateWidth: 390,
    emulateHeight: 844,
    deviceScaleFactor: 3,
  });
  dialog.showModal();
}

document.addEventListener('DOMContentLoaded', async () => {
  fillSaveForm(await getSettings());
  await renderPresets();

  document.getElementById('save-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try {
      await saveSettings(validateSettingsFromForm());
      showStatus('save-status', 'Saved.');
    } catch (err) {
      showStatus('save-status', String(err?.message || err), true);
    }
  });

  document.getElementById('add-preset').addEventListener('click', () => openPresetDialog(null));
  document.getElementById('reset-presets').addEventListener('click', async () => {
    const defaults = DEFAULT_PRESETS.slice();
    await savePresets(defaults);
    await setHandyPresetIds(defaultHandyPresetIds(defaults));
    await chrome.storage.local.set({ lastEmulatePresetId: 'iphone-15' });
    await renderPresets();
    showStatus('preset-status', 'Presets reset to defaults.');
  });

  document.getElementById('preset-emulate').addEventListener('change', syncEmulateFields);
  document.getElementById('preset-cancel').addEventListener('click', () => {
    document.getElementById('preset-dialog').close();
  });

  document.getElementById('preset-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try {
      const preset = readPresetForm();
      const presets = await loadPresets();
      const idx = presets.findIndex((p) => p.id === preset.id);
      const isNew = idx < 0;
      if (idx >= 0) presets[idx] = preset;
      else presets.push(preset);
      await savePresets(presets);
      if (isNew) {
        const handy = new Set(await getHandyPresetIds(presets));
        handy.add(preset.id);
        await setHandyPresetIds([...handy]);
      }
      document.getElementById('preset-dialog').close();
      await renderPresets();
      showStatus('preset-status', 'Preset saved.');
    } catch (err) {
      showStatus('preset-error', String(err?.message || err), true);
    }
  });
});
