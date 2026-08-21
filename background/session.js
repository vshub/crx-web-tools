import {
  BADGE_COLOR_BUSY,
  BADGE_COLOR_ERROR,
  BADGE_COLOR_ON,
  BADGE_ERROR_MS,
  BADGE_OK_MS,
  PROTOCOL_VERSION,
  sleep,
} from './constants.js';
import { lockKey } from './lock.js';

const selfDetach = new Set();

export function stateKey(tabId) {
  return `dbg:${tabId}`;
}

function emptyState() {
  return {
    attached: false,
    emulate: false,
    capture: false,
    emulatePresetId: null,
    snapshot: null,
  };
}

export async function getState(tabId) {
  const key = stateKey(tabId);
  const data = await chrome.storage.session.get(key);
  return data[key] ? { ...emptyState(), ...data[key] } : emptyState();
}

export async function setState(tabId, patch) {
  const next = { ...(await getState(tabId)), ...patch };
  await chrome.storage.session.set({ [stateKey(tabId)]: next });
  return next;
}

export async function clearState(tabId) {
  await chrome.storage.session.remove(stateKey(tabId));
}

export async function sendCommand(tabId, method, params) {
  if (params === undefined) {
    return chrome.debugger.sendCommand({ tabId }, method);
  }
  return chrome.debugger.sendCommand({ tabId }, method, params);
}

async function probeOwned(tabId) {
  await sendCommand(tabId, 'Page.enable');
}

export async function ensureAttached(tabId) {
  const st = await getState(tabId);

  const attach = async () => {
    await chrome.debugger.attach({ tabId }, PROTOCOL_VERSION);
    await setState(tabId, { attached: true });
  };

  const ownExisting = async () => {
    await probeOwned(tabId);
    await setState(tabId, { attached: true });
  };

  if (st.attached) {
    try {
      await probeOwned(tabId);
      return;
    } catch (_) {
      try {
        await attach();
        return;
      } catch (err) {
        if (/already attached/i.test(String(err?.message || err))) {
          try {
            await ownExisting();
            return;
          } catch {
            throw err;
          }
        }
        throw err;
      }
    }
  }

  try {
    await attach();
  } catch (err) {
    const msg = String(err?.message || err);
    if (/already attached/i.test(msg)) {
      try {
        await ownExisting();
        return;
      } catch {
        throw err;
      }
    }
    throw err;
  }
}

export async function acquire(tabId, purpose) {
  if (purpose !== 'emulate' && purpose !== 'capture') {
    throw new Error('invalid purpose');
  }
  await ensureAttached(tabId);
  await setState(tabId, { [purpose]: true, attached: true });
}

async function detachIdle(tabId) {
  selfDetach.add(tabId);
  try {
    await chrome.debugger.detach({ tabId });
  } catch (_) {}
  await clearState(tabId);
  selfDetach.delete(tabId);
}

export async function release(tabId, purpose) {
  const st = await setState(tabId, { [purpose]: false });
  if (!st.emulate && !st.capture) {
    await detachIdle(tabId);
  }
}

export async function isEmulating(tabId) {
  const st = await getState(tabId);
  return Boolean(st.emulate);
}

export async function setEmulating(tabId, preset) {
  if (!preset) {
    await setState(tabId, { emulate: false, emulatePresetId: null, snapshot: null });
    return;
  }
  await setState(tabId, {
    emulate: true,
    emulatePresetId: preset.id || null,
    snapshot: {
      width: Number(preset.emulateWidth) || Number(preset.width) || 390,
      height: Number(preset.emulateHeight) || Number(preset.height) || 844,
      deviceScaleFactor: Number(preset.deviceScaleFactor) || 1,
      mobile: preset.mobile !== false,
      userAgent: preset.userAgent || '',
    },
  });
}

export async function snapshotEmulation(tabId) {
  const st = await getState(tabId);
  if (!st.emulate) {
    await setState(tabId, { snapshot: null });
    return;
  }
  if (st.snapshot) return;
  await setState(tabId, {
    snapshot: {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
      userAgent: '',
    },
  });
}

export async function restoreEmulation(tabId) {
  const st = await getState(tabId);
  if (st.emulate && st.snapshot) {
    const snap = st.snapshot;
    await sendCommand(tabId, 'Emulation.setDeviceMetricsOverride', {
      width: Math.round(snap.width),
      height: Math.round(snap.height),
      deviceScaleFactor: snap.deviceScaleFactor || 1,
      mobile: Boolean(snap.mobile),
      screenWidth: Math.round(snap.width),
      screenHeight: Math.round(snap.height),
    });
    await sendCommand(tabId, 'Emulation.setUserAgentOverride', {
      userAgent: snap.userAgent || '',
    });
    return;
  }
  try {
    await sendCommand(tabId, 'Emulation.clearDeviceMetricsOverride');
  } catch (_) {}
}

export async function setBadge(tabId, text, color) {
  if (tabId == null) return;
  try {
    if (color) {
      await chrome.action.setBadgeBackgroundColor({ tabId, color });
    }
    try {
      await chrome.action.setBadgeTextColor({ tabId, color: '#ffffff' });
    } catch (_) {}
    await chrome.action.setBadgeText({ tabId, text: text || '' });
  } catch (_) {}
}

export async function restoreBadge(tabId) {
  if (await isEmulating(tabId)) {
    await setBadge(tabId, 'ON', BADGE_COLOR_ON);
  } else {
    await setBadge(tabId, '', BADGE_COLOR_ON);
  }
}

export async function flashError(tabId) {
  await setBadge(tabId, '!', BADGE_COLOR_ERROR);
  await sleep(BADGE_ERROR_MS);
  await restoreBadge(tabId);
}

export async function flashOk(tabId) {
  await setBadge(tabId, 'OK', BADGE_COLOR_ON);
  await sleep(BADGE_OK_MS);
  await restoreBadge(tabId);
}

export async function setBusyBadge(tabId) {
  await setBadge(tabId, '…', BADGE_COLOR_BUSY);
}

export function registerSessionListeners() {
  chrome.debugger.onDetach.addListener((source) => {
    const tabId = source?.tabId;
    if (tabId == null) return;
    if (selfDetach.has(tabId)) {
      selfDetach.delete(tabId);
      return;
    }
    chrome.storage.session.remove([stateKey(tabId), lockKey(tabId)]);
    chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    chrome.storage.session.remove([stateKey(tabId), lockKey(tabId)]);
  });
}
