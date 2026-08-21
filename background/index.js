import {
  captureFullPage,
  captureRegion,
  captureViewport,
  captureViewportDelayed,
  hideViewportHud,
  injectOverlay,
  isViewportHudVisible,
  setViewportHud,
  showViewportHud,
  toggleViewportHud,
} from './capture.js';
import { writeClipboard } from './clipboard.js';
import { KNOWN_ACTIONS, isRestrictedUrl } from './constants.js';
import { openSplitWindow, resizeWindow, toggleEmulate } from './device.js';
import {
  clearQaState,
  copyQaMarkdown,
  exportQaReport,
  getQaState,
  syncQaPins,
} from './report.js';
import { restoreBadge, registerSessionListeners } from './session.js';
import { seedStorage } from './settings.js';

registerSessionListeners();
seedStorage().catch(() => {});
ensureContextMenus();

chrome.runtime.onInstalled.addListener(() => {
  seedStorage().catch(() => {});
  ensureContextMenus();
});

async function ensureContextMenus() {
  try {
    await chrome.contextMenus.removeAll();
    const contexts = ['action'];
    chrome.contextMenus.create({ id: 'capture_viewport', title: 'Capture Viewport', contexts });
    chrome.contextMenus.create({ id: 'capture_fullpage', title: 'Capture Full Page', contexts });
    chrome.contextMenus.create({ id: 'sep_1', type: 'separator', contexts });
    chrome.contextMenus.create({ id: 'toggle_emulate', title: 'Toggle Emulate', contexts });
    chrome.contextMenus.create({ id: 'start_measure', title: 'Measure', contexts });
    chrome.contextMenus.create({ id: 'start_qa', title: 'QA notes', contexts });
    chrome.contextMenus.create({ id: 'toggle_viewport_hud', title: 'Viewport size', contexts });
  } catch (_) {}
}

export async function resolveTab(msg, sender) {
  if (sender?.tab?.id != null) return sender.tab;
  if (msg?.tabId != null) {
    try {
      return await chrome.tabs.get(msg.tabId);
    } catch (_) {}
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error('No active tab');
  return tab;
}

export async function dispatch(msg, sender) {
  const action = msg?.action;
  if (!KNOWN_ACTIONS.has(action)) {
    console.warn('Unknown action', action);
    return { ok: false, error: 'unknown_action' };
  }

  if (action === 'copy_text') {
    const result = await writeClipboard({ kind: 'text', text: String(msg.text || '') });
    return result?.ok ? { ok: true } : { ok: false, error: result?.error || 'clipboard failed' };
  }

  if (action === 'overlay_canceled') {
    const tab = sender?.tab;
    if (tab?.id != null) await restoreBadge(tab.id);
    return { ok: true };
  }

  if (action === 'qa_get') {
    const tab = await resolveTab(msg, sender);
    return getQaState(tab.id);
  }

  if (action === 'qa_sync') {
    const tab = await resolveTab(msg, sender);
    return syncQaPins(tab.id, msg.pins);
  }

  if (action === 'qa_clear') {
    const tab = await resolveTab(msg, sender);
    await clearQaState(tab.id);
    return { ok: true };
  }

  const tab = await resolveTab(msg, sender);

  switch (action) {
    case 'capture_viewport':
      return captureViewport(tab);
    case 'capture_viewport_delayed':
      return captureViewportDelayed(tab);
    case 'capture_fullpage':
      return captureFullPage(tab);
    case 'capture_region':
      return injectOverlay(tab, 'region');
    case 'region_coords':
      return captureRegion(tab, msg.coords || {});
    case 'toggle_emulate':
      return toggleEmulate(tab, msg.presetId);
    case 'resize_window':
      await resizeWindow(msg.width, msg.height, tab.windowId);
      if (!isRestrictedUrl(tab.url)) {
        try {
          await showViewportHud(tab);
        } catch (_) {}
      }
      return { ok: true };
    case 'open_split_window':
      await openSplitWindow(msg.url || tab.url, msg.sourceWindowId ?? tab.windowId);
      return { ok: true };
    case 'start_measure':
      return injectOverlay(tab, 'measure');
    case 'start_qa':
      return injectOverlay(tab, 'qa');
    case 'show_viewport_hud':
      return showViewportHud(tab);
    case 'hide_viewport_hud':
      return hideViewportHud(tab);
    case 'set_viewport_hud':
      return setViewportHud(tab, Boolean(msg.enabled));
    case 'viewport_hud_state':
      return { ok: true, visible: await isViewportHudVisible(tab) };
    case 'toggle_viewport_hud':
      return toggleViewportHud(tab);
    case 'qa_export':
      return exportQaReport(tab);
    case 'qa_copy_md':
      return copyQaMarkdown(tab);
    default:
      console.warn('Unknown action', action);
      return { ok: false, error: 'unknown_action' };
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.action === 'offscreen_write') return;
  if (!KNOWN_ACTIONS.has(msg?.action)) {
    console.warn('Unknown action', msg?.action);
    sendResponse({ ok: false, error: 'unknown_action' });
    return false;
  }
  (async () => {
    try {
      const result = await dispatch(msg, sender);
      sendResponse(result ?? { ok: true });
    } catch (err) {
      sendResponse({ ok: false, error: String(err?.message || err) });
    }
  })();
  return true;
});

async function runCommand(action, extra = {}, tab) {
  try {
    const resolved =
      tab?.id != null ? tab : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
    if (!resolved) return;
    await dispatch({ action, ...extra }, { tab: resolved });
  } catch (_) {}
}

chrome.commands.onCommand.addListener((command) => {
  runCommand(command);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const id = info.menuItemId;
  if (id === 'sep_1') return;
  runCommand(id, {}, tab);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  clearQaState(tabId).catch(() => {});
});
