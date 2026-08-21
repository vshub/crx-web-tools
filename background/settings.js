import { DEFAULT_SETTINGS } from './files.js';
import { DEFAULT_PRESETS } from './device.js';
import { clamp } from './constants.js';

export async function seedStorage() {
  const local = await chrome.storage.local.get(['settings', 'windowPresets', 'lastEmulatePresetId']);
  const updates = {};

  if (!local.settings || typeof local.settings !== 'object') {
    updates.settings = { ...DEFAULT_SETTINGS };
  } else {
    let missing = false;
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (local.settings[key] == null) missing = true;
    }
    if (missing) updates.settings = { ...DEFAULT_SETTINGS, ...local.settings };
  }

  if (!Array.isArray(local.windowPresets) || local.windowPresets.length === 0) {
    updates.windowPresets = DEFAULT_PRESETS;
  }

  if (!local.lastEmulatePresetId) {
    updates.lastEmulatePresetId = 'iphone-15';
  }

  if (Object.keys(updates).length) {
    await chrome.storage.local.set(updates);
  }
}

export async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  const merged = { ...DEFAULT_SETTINGS, ...(settings && typeof settings === 'object' ? settings : {}) };
  merged.delaySeconds = clamp(merged.delaySeconds, 0, 15, DEFAULT_SETTINGS.delaySeconds);
  merged.maxHeight = clamp(merged.maxHeight, 500, 20000, DEFAULT_SETTINGS.maxHeight);
  if (!['clipboard', 'download', 'both'].includes(merged.saveMode)) {
    merged.saveMode = DEFAULT_SETTINGS.saveMode;
  }
  if (typeof merged.filenamePattern !== 'string' || !merged.filenamePattern.trim()) {
    merged.filenamePattern = DEFAULT_SETTINGS.filenamePattern;
  }
  if (typeof merged.downloadFolder !== 'string') {
    merged.downloadFolder = DEFAULT_SETTINGS.downloadFolder;
  }
  return merged;
}

export async function saveSettings(partial) {
  const current = await getSettings();
  const next = { ...current, ...partial };
  next.delaySeconds = clamp(next.delaySeconds, 0, 15, DEFAULT_SETTINGS.delaySeconds);
  next.maxHeight = clamp(next.maxHeight, 500, 20000, DEFAULT_SETTINGS.maxHeight);
  if (!['clipboard', 'download', 'both'].includes(next.saveMode)) {
    throw new Error('invalid save mode');
  }
  await chrome.storage.local.set({ settings: next });
  return next;
}
