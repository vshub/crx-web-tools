import { DEFAULT_SETTINGS, STAMP_POSITIONS } from './files.js';
import { DEFAULT_HANDY_PRESET_IDS, DEFAULT_PRESETS } from './device.js';
import { clamp } from './constants.js';

export function defaultHandyPresetIds(presets = DEFAULT_PRESETS) {
  const list = Array.isArray(presets) ? presets : DEFAULT_PRESETS;
  const preferred = DEFAULT_HANDY_PRESET_IDS.filter((id) => list.some((p) => p.id === id));
  if (preferred.length) return preferred;
  return list.filter((p) => !p.emulate).map((p) => p.id).filter(Boolean);
}

const DESKTOP_SIZE_PATCH = {
  d1440: { windowWidth: 1440, windowHeight: 900, name: '1440 × 900' },
  d1920: { windowWidth: 1920, windowHeight: 1080, name: '1920 × 1080' },
  d1280: { windowWidth: 1280, windowHeight: 800, name: '1280 × 800' },
};

function patchDesktopPresetSizes(presets) {
  if (!Array.isArray(presets) || !presets.length) return null;
  let changed = false;
  const next = presets.map((preset) => {
    const patch = DESKTOP_SIZE_PATCH[preset?.id];
    if (!patch) return preset;
    // Don't overwrite a custom height the user set in Settings.
    if (preset.windowHeight != null && preset.windowHeight !== patch.windowHeight) {
      return preset;
    }
    if (
      preset.windowWidth === patch.windowWidth &&
      preset.windowHeight === patch.windowHeight &&
      preset.name === patch.name
    ) {
      return preset;
    }
    changed = true;
    return { ...preset, ...patch };
  });
  return changed ? next : null;
}

export async function seedStorage() {
  const local = await chrome.storage.local.get([
    'settings',
    'windowPresets',
    'lastEmulatePresetId',
    'handyPresetIds',
  ]);
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
  } else {
    const patched = patchDesktopPresetSizes(local.windowPresets);
    if (patched) updates.windowPresets = patched;
  }

  if (!local.lastEmulatePresetId) {
    updates.lastEmulatePresetId = 'iphone-15';
  }

  if (!Array.isArray(local.handyPresetIds)) {
    const presets =
      Array.isArray(local.windowPresets) && local.windowPresets.length
        ? updates.windowPresets || local.windowPresets
        : updates.windowPresets || DEFAULT_PRESETS;
    updates.handyPresetIds = defaultHandyPresetIds(presets);
  } else {
    // Older installs defaulted Handy to every preset → trim to the short desktop set once.
    const allIds = (Array.isArray(local.windowPresets) && local.windowPresets.length
      ? local.windowPresets
      : DEFAULT_PRESETS
    ).map((p) => p.id);
    const handy = local.handyPresetIds.filter((id) => typeof id === 'string');
    const looksLikeLegacyAll =
      allIds.length > 2 &&
      handy.length >= allIds.length &&
      allIds.every((id) => handy.includes(id));
    if (looksLikeLegacyAll) {
      updates.handyPresetIds = defaultHandyPresetIds(
        updates.windowPresets || local.windowPresets || DEFAULT_PRESETS,
      );
    }
  }

  if (Object.keys(updates).length) {
    await chrome.storage.local.set(updates);
  }
}

function normalizeStampSettings(merged) {
  if (typeof merged.stampEnabled !== 'boolean') {
    merged.stampEnabled = DEFAULT_SETTINGS.stampEnabled;
  }
  if (!STAMP_POSITIONS.has(merged.stampPosition)) {
    merged.stampPosition = DEFAULT_SETTINGS.stampPosition;
  }
  if (typeof merged.stampShowSize !== 'boolean') {
    merged.stampShowSize = DEFAULT_SETTINGS.stampShowSize;
  }
  if (typeof merged.stampShowHost !== 'boolean') {
    merged.stampShowHost = DEFAULT_SETTINGS.stampShowHost;
  }
  if (typeof merged.stampShowPath !== 'boolean') {
    merged.stampShowPath = DEFAULT_SETTINGS.stampShowPath;
  }
  return merged;
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
  if (typeof merged.reportFolder !== 'string') {
    merged.reportFolder = DEFAULT_SETTINGS.reportFolder;
  }
  if (typeof merged.copyMdOnExport !== 'boolean') {
    merged.copyMdOnExport = DEFAULT_SETTINGS.copyMdOnExport;
  }
  return normalizeStampSettings(merged);
}

export async function saveSettings(partial) {
  const current = await getSettings();
  const next = normalizeStampSettings({ ...current, ...partial });
  next.delaySeconds = clamp(next.delaySeconds, 0, 15, DEFAULT_SETTINGS.delaySeconds);
  next.maxHeight = clamp(next.maxHeight, 500, 20000, DEFAULT_SETTINGS.maxHeight);
  if (!['clipboard', 'download', 'both'].includes(next.saveMode)) {
    throw new Error('invalid save mode');
  }
  if (!STAMP_POSITIONS.has(next.stampPosition)) {
    throw new Error('invalid stamp position');
  }
  await chrome.storage.local.set({ settings: next });
  return next;
}

export async function getHandyPresetIds(presets) {
  const { handyPresetIds } = await chrome.storage.local.get('handyPresetIds');
  if (!Array.isArray(handyPresetIds)) {
    return defaultHandyPresetIds(presets);
  }
  return handyPresetIds.filter((id) => typeof id === 'string');
}

export async function setHandyPresetIds(ids) {
  const next = Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : [];
  await chrome.storage.local.set({ handyPresetIds: next });
  return next;
}
