export const PROTOCOL_VERSION = '1.3';

export const TYPE = {
  viewport: 'VP',
  delayed: 'DL',
  fullpage: 'FS',
  region: 'RG',
};

export const LOCK_TTL_MS = 60_000;
export const DOWNLOAD_WAIT_MS = 15_000;
export const CAPTURE_TIMEOUT_MS = 45_000;
export const FULLPAGE_LAYOUT_WAIT_MS = 300;
export const OVERLAY_HIDE_MS = 50;
export const BADGE_OK_MS = 900;
export const BADGE_ERROR_MS = 1600;

export const BADGE_COLOR_ON = '#4CAF50';
export const BADGE_COLOR_ERROR = '#E53935';
export const BADGE_COLOR_BUSY = '#5C6BC0';

export const KNOWN_ACTIONS = new Set([
  'capture_viewport',
  'capture_viewport_delayed',
  'capture_fullpage',
  'capture_region',
  'region_coords',
  'overlay_canceled',
  'toggle_emulate',
  'resize_window',
  'open_split_window',
  'start_measure',
  'start_inspect',
  'start_qa',
  'show_viewport_hud',
  'hide_viewport_hud',
  'set_viewport_hud',
  'viewport_hud_state',
  'toggle_viewport_hud',
  'qa_sync',
  'qa_get',
  'qa_export',
  'qa_copy_md',
  'qa_clear',
  'copy_text',
]);

export function isRestrictedUrl(url) {
  if (!url) return true;
  if (url === 'about:blank') return false; // capture via debugger is allowed
  const prefixes = [
    'chrome://',
    'chrome-untrusted://',
    'devtools://',
    'edge://',
    'opera://',
    'about:',
    'chrome-extension://',
    'https://chrome.google.com/webstore',
    'https://chromewebstore.google.com/',
    'view-source:',
  ];
  return prefixes.some((p) => url.startsWith(p));
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function clamp(value, min, max, fallback = min) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function safeUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return '';
  }
}

export function withAbort(signal, promise) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('aborted'));
      return;
    }
    const onAbort = () => reject(new Error('aborted'));
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        if (signal) signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (err) => {
        if (signal) signal.removeEventListener('abort', onAbort);
        reject(err);
      },
    );
  });
}
