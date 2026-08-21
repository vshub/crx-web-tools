import {
  acquire,
  flashError,
  getState,
  isEmulating,
  release,
  sendCommand,
  setBadge,
  setEmulating,
} from './session.js';
import { BADGE_COLOR_ON, isRestrictedUrl } from './constants.js';

export const DEFAULT_PRESETS = [
  {
    id: 'iphone-15',
    name: 'iPhone',
    icon: 'mobile',
    windowWidth: 390,
    windowHeight: 844,
    emulate: true,
    emulateWidth: 390,
    emulateHeight: 844,
    deviceScaleFactor: 3,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  },
  {
    id: 'iphone-se',
    name: 'iPhone SE',
    icon: 'mobile',
    windowWidth: 375,
    windowHeight: 667,
    emulate: true,
    emulateWidth: 375,
    emulateHeight: 667,
    deviceScaleFactor: 2,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  },
  {
    id: 'pixel',
    name: 'Pixel',
    icon: 'mobile',
    windowWidth: 412,
    windowHeight: 915,
    emulate: true,
    emulateWidth: 412,
    emulateHeight: 915,
    deviceScaleFactor: 2.625,
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  },
  {
    id: 'ipad',
    name: 'iPad',
    icon: 'tablet',
    windowWidth: 768,
    windowHeight: 1024,
    emulate: true,
    emulateWidth: 768,
    emulateHeight: 1024,
    deviceScaleFactor: 2,
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  },
  { id: 'd1920', name: 'Desktop 1920', icon: 'desktop', windowWidth: 1920, windowHeight: null, emulate: false },
  { id: 'd1440', name: 'Desktop 1440', icon: 'desktop', windowWidth: 1440, windowHeight: null, emulate: false },
  { id: 'd1280', name: 'Desktop 1280', icon: 'desktop', windowWidth: 1280, windowHeight: null, emulate: false },
];

export async function getPresets() {
  const { windowPresets } = await chrome.storage.local.get('windowPresets');
  if (Array.isArray(windowPresets) && windowPresets.length) return windowPresets;
  return DEFAULT_PRESETS;
}

export async function getLastEmulatePresetId() {
  const { lastEmulatePresetId } = await chrome.storage.local.get('lastEmulatePresetId');
  return lastEmulatePresetId || 'iphone-15';
}

function metricsParams(preset) {
  const width = Math.round(Number(preset.emulateWidth) || Number(preset.width) || 390);
  const height = Math.round(Number(preset.emulateHeight) || Number(preset.height) || 844);
  return {
    width,
    height,
    deviceScaleFactor: Number(preset.deviceScaleFactor) || 1,
    mobile: true,
    screenWidth: width,
    screenHeight: height,
  };
}

export async function enableEmulate(tabId, preset) {
  await acquire(tabId, 'emulate');
  try {
    await sendCommand(tabId, 'Emulation.setDeviceMetricsOverride', metricsParams(preset));
    await sendCommand(tabId, 'Emulation.setUserAgentOverride', {
      userAgent: preset.userAgent || '',
    });
    await setEmulating(tabId, preset);
    await setBadge(tabId, 'ON', BADGE_COLOR_ON);
    await chrome.storage.local.set({ lastEmulatePresetId: preset.id });
    await chrome.tabs.reload(tabId);
  } catch (err) {
    try {
      await release(tabId, 'emulate');
    } catch (_) {}
    throw err;
  }
}

export async function disableEmulate(tabId) {
  try {
    await sendCommand(tabId, 'Emulation.clearDeviceMetricsOverride');
    await sendCommand(tabId, 'Emulation.setUserAgentOverride', { userAgent: '' });
  } catch (_) {}
  await setEmulating(tabId, null);
  await release(tabId, 'emulate');
  await setBadge(tabId, '');
  try {
    await chrome.tabs.reload(tabId);
  } catch (_) {}
}

export async function toggleEmulate(tab, presetId) {
  if (isRestrictedUrl(tab.url)) {
    flashError(tab.id);
    throw new Error('restricted url');
  }
  const emulating = await isEmulating(tab.id);
  const st = await getState(tab.id);
  const presets = await getPresets();
  const lastId = await getLastEmulatePresetId();
  const resolvedId = presetId || lastId || 'iphone-15';
  const preset =
    presets.find((p) => p.id === resolvedId && p.emulate) ||
    presets.find((p) => p.emulate) ||
    DEFAULT_PRESETS.find((p) => p.emulate);

  if (emulating && (!presetId || presetId === st.emulatePresetId)) {
    await disableEmulate(tab.id);
    return { emulating: false };
  }
  if (!preset) throw new Error('no emulate preset');
  await enableEmulate(tab.id, preset);
  return { emulating: true };
}

export async function resizeWindow(width, height, windowId) {
  if (windowId == null) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    windowId = tab?.windowId;
  }
  if (windowId == null) throw new Error('no window');
  const update = { width: Math.round(Number(width)) };
  if (height != null && Number.isFinite(Number(height))) {
    update.height = Math.round(Number(height));
  }
  await chrome.windows.update(windowId, update);
}

export async function openSplitWindow(url, sourceWindowId) {
  const sourceWin = await chrome.windows.get(sourceWindowId);
  const desktopWidth = Math.round(sourceWin.width * 0.8);
  const mobileWidth = Math.max(375, sourceWin.width - desktopWidth);
  await chrome.windows.update(sourceWindowId, {
    width: desktopWidth,
    left: sourceWin.left,
    top: sourceWin.top,
  });
  await chrome.windows.create({
    url,
    type: 'normal',
    width: mobileWidth,
    height: sourceWin.height,
    left: sourceWin.left + desktopWidth,
    top: sourceWin.top,
    incognito: sourceWin.incognito,
  });
}
