import { writeClipboard } from './clipboard.js';
import {
  BADGE_COLOR_BUSY,
  CAPTURE_TIMEOUT_MS,
  FULLPAGE_LAYOUT_WAIT_MS,
  OVERLAY_HIDE_MS,
  TYPE,
  clamp,
  isRestrictedUrl,
  sleep,
  withAbort,
} from './constants.js';
import { downloadDataUrl } from './files.js';
import { acquireLock, releaseLock } from './lock.js';
import {
  acquire,
  flashError,
  flashOk,
  isEmulating,
  release,
  restoreEmulation,
  sendCommand,
  setBadge,
  setBusyBadge,
  snapshotEmulation,
} from './session.js';
import { getSettings } from './settings.js';
import { applyInfoStamp } from './stamp.js';

async function hideOverlays(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (waitMs) => {
        window.__webtoolsHideForCapture?.();
        document.querySelectorAll('[data-webtools="overlay"], [data-webtools="viewport-hud"]').forEach((node) => {
          node.style.visibility = 'hidden';
        });
        return new Promise((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => setTimeout(resolve, waitMs));
          });
        });
      },
      args: [OVERLAY_HIDE_MS],
    });
  } catch (_) {
    await sleep(OVERLAY_HIDE_MS);
  }
}

async function restoreOverlays(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        window.__webtoolsRestoreAfterCapture?.();
        document.querySelectorAll('[data-webtools="overlay"], [data-webtools="viewport-hud"]').forEach((node) => {
          node.style.visibility = 'visible';
        });
      },
    });
  } catch (_) {}
}

async function readDpr(tabId) {
  try {
    const [inj] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => window.devicePixelRatio || 1,
    });
    const value = inj?.result;
    return typeof value === 'number' && value > 0 ? value : 1;
  } catch {
    return 1;
  }
}

function toDataUrl(result) {
  if (!result?.data) throw new Error('empty screenshot');
  return `data:image/png;base64,${result.data}`;
}

async function deliver(dataUrl, tab, typeStr, extension = 'png') {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) {
    throw new Error('invalid data url');
  }
  const settings = await getSettings();
  let out = dataUrl;
  if (extension === 'png') {
    out = await applyInfoStamp(dataUrl, tab, settings);
  }
  const mode = settings.saveMode || 'both';
  let clipboardFailed = false;

  if (mode === 'clipboard' || mode === 'both') {
    const result = await writeClipboard({ kind: 'image', dataUrl: out });
    if (!result?.ok) {
      clipboardFailed = true;
      if (mode === 'clipboard') {
        flashError(tab.id);
        return { ok: false, error: result?.error || 'clipboard failed' };
      }
    }
  }

  if (mode === 'download' || mode === 'both') {
    await downloadDataUrl(out, tab, settings, typeStr, extension);
  }

  flashOk(tab.id);
  return {
    ok: true,
    clipboard: (mode === 'clipboard' || mode === 'both') && !clipboardFailed,
  };
}

async function guardRestricted(tab) {
  if (isRestrictedUrl(tab.url)) {
    flashError(tab.id);
    throw new Error('restricted url');
  }
}

async function withCaptureLock(tab, fn) {
  if (!(await acquireLock(tab.id))) {
    await setBusyBadge(tab.id);
    return { ok: false, error: 'busy' };
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), CAPTURE_TIMEOUT_MS);
  try {
    await setBusyBadge(tab.id);
    await hideOverlays(tab.id);
    return await fn(ac.signal);
  } catch (err) {
    flashError(tab.id);
    throw err;
  } finally {
    clearTimeout(timer);
    try {
      await restoreOverlays(tab.id);
    } catch (_) {}
    await releaseLock(tab.id);
  }
}

async function captureViaCdp(tabId, signal, extra = {}) {
  await acquire(tabId, 'capture');
  try {
    if (signal?.aborted) throw new Error('aborted');
    await withAbort(signal, sendCommand(tabId, 'Page.enable'));
    const result = await withAbort(
      signal,
      sendCommand(tabId, 'Page.captureScreenshot', { format: 'png', ...extra }),
    );
    return toDataUrl(result);
  } finally {
    await release(tabId, 'capture');
  }
}

export async function captureViewport(tab, typeStr = TYPE.viewport) {
  await guardRestricted(tab);
  return withCaptureLock(tab, async (signal) => {
    const dataUrl = await captureViewportRaw(tab, signal);
    if (signal.aborted) throw new Error('aborted');
    return deliver(dataUrl, tab, typeStr, 'png');
  });
}

async function captureViewportRaw(tab, signal) {
  let dataUrl;
  const emulating = await isEmulating(tab.id);
  if (emulating) {
    dataUrl = await captureViaCdp(tab.id, signal);
  } else {
    try {
      if (tab.windowId == null) throw new Error('no windowId');
      dataUrl = await withAbort(
        signal,
        chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }),
      );
    } catch (err) {
      if (signal?.aborted) throw err;
      dataUrl = await captureViaCdp(tab.id, signal);
    }
  }
  return dataUrl;
}

/** Viewport PNG data URL without download/clipboard delivery (for QA packs). */
export async function captureViewportDataUrl(tab) {
  await guardRestricted(tab);
  return withCaptureLock(tab, async (signal) => captureViewportRaw(tab, signal));
}

/** Region/clip PNG data URL without download/clipboard delivery (for QA pin crops). */
export async function captureClipDataUrl(tab, coords) {
  await guardRestricted(tab);
  return withCaptureLock(tab, async (signal) => {
    await acquire(tab.id, 'capture');
    try {
      await withAbort(signal, sendCommand(tab.id, 'Page.enable'));
      const dpr = Number(coords?.devicePixelRatio) || 1;
      const clip = {
        x: Math.round(Number(coords?.x) || 0),
        y: Math.round(Number(coords?.y) || 0),
        width: Math.max(1, Math.round(Number(coords?.width) || 0)),
        height: Math.max(1, Math.round(Number(coords?.height) || 0)),
        scale: dpr > 1 ? dpr : 1,
      };
      const result = await withAbort(
        signal,
        sendCommand(tab.id, 'Page.captureScreenshot', {
          format: 'png',
          captureBeyondViewport: true,
          clip,
        }),
      );
      return toDataUrl(result);
    } finally {
      await release(tab.id, 'capture');
    }
  });
}

export async function captureViewportDelayed(tab) {
  await guardRestricted(tab);
  const settings = await getSettings();
  const n = clamp(settings.delaySeconds, 0, 15, 3);
  for (let i = n; i >= 1; i -= 1) {
    await setBadge(tab.id, String(i), BADGE_COLOR_BUSY);
    await sleep(1000);
  }
  return captureViewport(tab, TYPE.delayed);
}

export async function captureFullPage(tab) {
  await guardRestricted(tab);
  return withCaptureLock(tab, async (signal) => {
    await acquire(tab.id, 'capture');
    let dataUrl;
    try {
      await snapshotEmulation(tab.id);
      await withAbort(signal, sendCommand(tab.id, 'Page.enable'));
      const metrics = await withAbort(signal, sendCommand(tab.id, 'Page.getLayoutMetrics'));
      const content = metrics.cssContentSize || metrics.contentSize || { width: 1, height: 1 };
      const settings = await getSettings();
      const maxH = clamp(settings.maxHeight, 500, 20000, 12000);
      const width = Math.max(1, Math.ceil(content.width));
      const height = Math.max(1, Math.min(Math.ceil(content.height), maxH));
      const emulating = await isEmulating(tab.id);

      if (!emulating) {
        const dpr = await readDpr(tab.id);
        await withAbort(
          signal,
          sendCommand(tab.id, 'Emulation.setDeviceMetricsOverride', {
            width,
            height,
            deviceScaleFactor: dpr,
            mobile: false,
          }),
        );
        await sleep(FULLPAGE_LAYOUT_WAIT_MS);
      }

      if (signal.aborted) throw new Error('aborted');
      const result = await withAbort(
        signal,
        sendCommand(tab.id, 'Page.captureScreenshot', {
          format: 'png',
          captureBeyondViewport: true,
          clip: { x: 0, y: 0, width, height, scale: 1 },
        }),
      );
      dataUrl = toDataUrl(result);
      await restoreEmulation(tab.id);
    } catch (err) {
      try {
        await restoreEmulation(tab.id);
      } catch (_) {}
      throw err;
    } finally {
      await release(tab.id, 'capture');
    }
    return deliver(dataUrl, tab, TYPE.fullpage, 'png');
  });
}

export async function captureRegion(tab, coords) {
  await guardRestricted(tab);
  return withCaptureLock(tab, async (signal) => {
    await acquire(tab.id, 'capture');
    try {
      await withAbort(signal, sendCommand(tab.id, 'Page.enable'));
      const dpr = Number(coords?.devicePixelRatio) || 1;
      const clip = {
        x: Math.round(Number(coords?.x) || 0),
        y: Math.round(Number(coords?.y) || 0),
        width: Math.max(1, Math.round(Number(coords?.width) || 0)),
        height: Math.max(1, Math.round(Number(coords?.height) || 0)),
        scale: dpr > 1 ? dpr : 1,
      };
      const result = await withAbort(
        signal,
        sendCommand(tab.id, 'Page.captureScreenshot', {
          format: 'png',
          captureBeyondViewport: true,
          clip,
        }),
      );
      return deliver(toDataUrl(result), tab, TYPE.region, 'png');
    } finally {
      await release(tab.id, 'capture');
    }
  });
}

export async function injectOverlay(tab, mode) {
  await guardRestricted(tab);
  try {
    try {
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['content/overlay.css'],
      });
    } catch (_) {}
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/overlay.js'],
    });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (m) => window.__webtoolsStart?.(m),
      args: [mode],
    });
    return { ok: true };
  } catch (err) {
    flashError(tab.id);
    throw err;
  }
}

export async function showViewportHud(tab) {
  await guardRestricted(tab);
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/viewport-hud.js'],
    });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.__webtoolsViewportHud?.show(),
    });
    return { ok: true };
  } catch (err) {
    flashError(tab.id);
    throw err;
  }
}

export async function hideViewportHud(tab) {
  await guardRestricted(tab);
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/viewport-hud.js'],
    });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.__webtoolsViewportHud?.hide(),
    });
    return { ok: true };
  } catch (err) {
    flashError(tab.id);
    throw err;
  }
}

export async function isViewportHudVisible(tab) {
  if (!tab?.id || isRestrictedUrl(tab.url)) return false;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/viewport-hud.js'],
    });
    const [inj] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => Boolean(window.__webtoolsViewportHud?.isVisible?.()),
    });
    return Boolean(inj?.result);
  } catch (_) {
    return false;
  }
}

export async function setViewportHud(tab, enabled) {
  return enabled ? showViewportHud(tab) : hideViewportHud(tab);
}

export async function toggleViewportHud(tab) {
  await guardRestricted(tab);
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/viewport-hud.js'],
    });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.__webtoolsViewportHud?.toggle(),
    });
    return { ok: true };
  } catch (err) {
    flashError(tab.id);
    throw err;
  }
}

export { deliver };
