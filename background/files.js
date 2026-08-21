import { DOWNLOAD_WAIT_MS } from './constants.js';

export const DEFAULT_SETTINGS = {
  downloadFolder: 'Screenshots',
  filenamePattern: 'screenshot_{type}_{datetime}_{title}',
  delaySeconds: 3,
  maxHeight: 12000,
  saveMode: 'both', // 'clipboard' | 'download' | 'both'
  reportFolder: 'WebTools-reports',
  copyMdOnExport: true,
  stampEnabled: false,
  stampPosition: 'br', // tl | tr | bl | br
  stampShowSize: true,
  stampShowHost: true,
  stampShowPath: false,
};

export const STAMP_POSITIONS = new Set(['tl', 'tr', 'bl', 'br']);

function sanitizeHostPart(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9.-]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Split hostname into {url, domain, subdomain} tokens for filenames. */
export function hostFilenameParts(hostnameRaw) {
  const hostname = sanitizeHostPart(hostnameRaw) || 'blank_page';
  const labels = hostname.split('.').filter(Boolean);
  if (labels.length === 0) {
    return { url: 'blank_page', domain: 'blank', subdomain: 'blank' };
  }
  if (labels.length === 1) {
    return { url: labels[0], domain: labels[0], subdomain: labels[0] };
  }
  // {domain}: base label without TLD — "example" from "www.example.com"
  // {subdomain}: labels except TLD joined with _ — "www_example"
  const domain = sanitizeHostPart(labels[labels.length - 2]) || 'blank';
  const subdomain = sanitizeHostPart(labels.slice(0, -1).join('_')) || domain;
  return { url: hostname, domain, subdomain };
}

export function formatFilename(settings, tab, typeStr) {
  const datetime = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];

  let url = 'blank_page';
  let domain = 'blank';
  let subdomain = 'blank';
  if (tab.url && tab.url !== 'about:blank') {
    try {
      const parts = hostFilenameParts(new URL(tab.url).hostname);
      url = parts.url;
      domain = parts.domain;
      subdomain = parts.subdomain;
    } catch (_) {}
  }

  const title = (tab.title || 'Untitled')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/[<>:"/\\|?*~]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^[.\s_]+|[.\s_]+$/g, '')
    .toLowerCase();

  let filename = (settings.filenamePattern || DEFAULT_SETTINGS.filenamePattern)
    .replaceAll('{type}', typeStr)
    .replaceAll('{datetime}', datetime)
    .replaceAll('{title}', title || 'untitled')
    .replaceAll('{url}', url)
    .replaceAll('{domain}', domain)
    .replaceAll('{subdomain}', subdomain);

  filename = filename.replace(/^[/\\.~]+/, '');
  filename = Array.from(filename).slice(0, 150).join('');
  const encoder = new TextEncoder();
  while (encoder.encode(filename).length > 240) {
    filename = Array.from(filename).slice(0, -1).join('');
  }
  filename = filename.replace(/[.\s_]+$/, '');
  return filename || 'screenshot';
}

export function sanitizeFolder(folder) {
  let f = (folder || '').trim().replace(/\\/g, '/');
  f = f.replace(/^[/~.]+/, '').replace(/\.{2,}/g, '.');
  return f
    .split('/')
    .filter(Boolean)
    .map((seg) => {
      let s = seg.replace(/[<>:"/\\|?*~]/g, '_').replace(/^[.\s_]+|[.\s_]+$/g, '');
      if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(s)) s += '_';
      return s || '_';
    })
    .join('/');
}

function isInvalidFilenameError(err) {
  return /invalid filename/i.test(String(err?.message || err));
}

export function waitForDownload(downloadId, timeoutMs = DOWNLOAD_WAIT_MS) {
  return new Promise((resolve) => {
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      chrome.downloads.onChanged.removeListener(onChanged);
      resolve(result);
    };

    const timer = setTimeout(() => finish(false), timeoutMs);

    function onChanged(delta) {
      if (delta.id !== downloadId || !delta.state) return;
      if (delta.state.current === 'complete') finish(true);
      else if (delta.state.current === 'interrupted') finish(false);
    }

    chrome.downloads.onChanged.addListener(onChanged);

    chrome.downloads.search({ id: downloadId }).then((items) => {
      const state = items[0]?.state;
      if (state === 'complete') finish(true);
      else if (state === 'interrupted') finish(false);
    }).catch(() => {});
  });
}

export async function downloadDataUrl(dataUrl, tab, settings, typeStr, extension) {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) {
    throw new Error('invalid data url');
  }
  const ext = extension || 'png';
  const folder = sanitizeFolder(settings.downloadFolder);
  const filename = formatFilename(settings, tab, typeStr);
  const datetime = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
  const ascii = `screenshot_${typeStr}_${datetime}.${ext}`;
  const fullPath = folder ? `${folder}/${filename}.${ext}` : `${filename}.${ext}`;
  const variants = [fullPath, folder ? `${folder}/${ascii}` : ascii, ascii];

  let lastError = new Error('download failed');
  for (const name of variants) {
    try {
      const downloadId = await chrome.downloads.download({
        url: dataUrl,
        filename: name,
        saveAs: false,
        conflictAction: 'uniquify',
      });
      if (downloadId == null) throw new Error('download failed');
      const ok = await waitForDownload(downloadId);
      if (!ok) throw new Error('download interrupted');
      return true;
    } catch (err) {
      lastError = err;
      if (!isInvalidFilenameError(err)) throw err;
    }
  }
  throw lastError;
}

export async function downloadNamed(dataUrl, filename) {
  if (!dataUrl || typeof dataUrl !== 'string') {
    throw new Error('invalid data url');
  }
  if (!dataUrl.startsWith('data:')) {
    throw new Error('invalid data url');
  }
  const clean = String(filename || 'file')
    .replace(/\\/g, '/')
    .replace(/^[/~.]+/, '');
  const parts = clean.split('/').filter(Boolean);
  const base = parts.pop() || 'file';
  const folder = sanitizeFolder(parts.join('/'));
  const datetime = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
  const ascii = `file_${datetime}_${base.replace(/[^a-z0-9._-]/gi, '_')}`;
  const fullPath = folder ? `${folder}/${base}` : base;
  const variants = [fullPath, folder ? `${folder}/${ascii}` : ascii, ascii];

  let lastError = new Error('download failed');
  for (const name of variants) {
    try {
      const downloadId = await chrome.downloads.download({
        url: dataUrl,
        filename: name,
        saveAs: false,
        conflictAction: 'uniquify',
      });
      if (downloadId == null) throw new Error('download failed');
      const ok = await waitForDownload(downloadId);
      if (!ok) throw new Error('download interrupted');
      return true;
    } catch (err) {
      lastError = err;
      if (!isInvalidFilenameError(err)) throw err;
    }
  }
  throw lastError;
}
