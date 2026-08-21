import { writeClipboard } from './clipboard.js';
import { safeUrl } from './constants.js';
import { captureClipDataUrl, captureViewportDataUrl } from './capture.js';
import { downloadNamed, hostFilenameParts, sanitizeFolder } from './files.js';
import { flashError, flashOk, isEmulating, getState } from './session.js';
import { getSettings } from './settings.js';

export function qaKey(tabId) {
  return `qa:${tabId}`;
}

export async function getQaState(tabId) {
  const key = qaKey(tabId);
  const data = await chrome.storage.session.get(key);
  const raw = data[key];
  return {
    pins: Array.isArray(raw?.pins) ? raw.pins : [],
    title: typeof raw?.title === 'string' ? raw.title : '',
  };
}

export async function setQaState(tabId, patch) {
  const current = await getQaState(tabId);
  const next = { ...current, ...patch };
  await chrome.storage.session.set({ [qaKey(tabId)]: next });
  return next;
}

export async function clearQaState(tabId) {
  await chrome.storage.session.remove(qaKey(tabId));
}

export async function syncQaPins(tabId, pins) {
  const cleaned = (Array.isArray(pins) ? pins : []).map((p, i) => ({
    id: String(p.id || `pin-${i + 1}`),
    n: Number(p.n) || i + 1,
    selector: String(p.selector || ''),
    tag: String(p.tag || ''),
    label: String(p.label || 'element').slice(0, 80),
    note: String(p.note || ''),
    severity: ['blocker', 'bug', 'nit'].includes(p.severity) ? p.severity : 'bug',
    rect: {
      x: Number(p.rect?.x) || 0,
      y: Number(p.rect?.y) || 0,
      width: Math.max(1, Number(p.rect?.width) || 1),
      height: Math.max(1, Number(p.rect?.height) || 1),
      devicePixelRatio: Number(p.rect?.devicePixelRatio) || 1,
    },
  }));
  return setQaState(tabId, { pins: cleaned });
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function reportStamp(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}-${pad2(date.getHours())}${pad2(date.getMinutes())}`;
}

function slugPart(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'page';
}

function pinFileName(pin) {
  const n = pad2(pin.n);
  const slug = slugPart(pin.label).slice(0, 24) || 'element';
  return `${n}-${slug}.png`;
}

function reportFolderName(tab, settings) {
  const root = sanitizeFolder(settings.reportFolder || 'WebTools-reports') || 'WebTools-reports';
  let domain = 'page';
  try {
    if (tab.url && tab.url !== 'about:blank') {
      domain = hostFilenameParts(new URL(tab.url).hostname).domain || 'page';
    }
  } catch (_) {}
  const titleSlug = slugPart(tab.title).slice(0, 30);
  return `${root}/${reportStamp()}-${domain}-${titleSlug}`;
}

export function buildMarkdown({ tab, pins, viewportName, pinFiles, emulating, emulatePresetId, when }) {
  const url = safeUrl(tab.url) || tab.url || '';
  const title = (tab.title || 'Untitled').trim() || 'Untitled';
  const lines = [];
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`- URL: ${url}`);
  lines.push(`- Viewport: ${windowSizeLine(tab)}`);
  if (emulating) {
    lines.push(`- Emulate: ON${emulatePresetId ? ` (${emulatePresetId})` : ''}`);
  }
  lines.push(`- When: ${when}`);
  lines.push(`- Pins: ${pins.length}`);
  lines.push('');
  if (viewportName) {
    lines.push('![Viewport](./viewport.png)');
    lines.push('');
  }
  for (let i = 0; i < pins.length; i += 1) {
    const pin = pins[i];
    const file = pinFiles[i];
    lines.push(`## ${pin.n}. ${pin.label}`);
    lines.push(`- Severity: ${pin.severity}`);
    lines.push(`- Selector: \`${pin.selector || pin.tag || 'unknown'}\``);
    lines.push(
      `- Size: ${Math.round(pin.rect.width)} × ${Math.round(pin.rect.height)}`,
    );
    lines.push('');
    lines.push(pin.note || '_No note_');
    lines.push('');
    if (file) {
      lines.push(`![${pin.label}](./${file})`);
      lines.push('');
    }
  }
  return `${lines.join('\n').trim()}\n`;
}

function windowSizeLine(tab) {
  // Filled asynchronously when available; placeholder uses tab dims if present
  const w = tab.width || '?';
  const h = tab.height || '?';
  return `${w} × ${h}`;
}

async function enrichTab(tab) {
  try {
    const [inj] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
      }),
    });
    if (inj?.result) {
      return {
        ...tab,
        width: inj.result.innerWidth,
        height: inj.result.innerHeight,
      };
    }
  } catch (_) {}
  return tab;
}

function markdownDataUrl(text) {
  return `data:text/markdown;charset=utf-8,${encodeURIComponent(text)}`;
}

export async function copyQaMarkdown(tab) {
  const state = await getQaState(tab.id);
  if (!state.pins.length) {
    flashError(tab.id);
    return { ok: false, error: 'no pins' };
  }
  const enriched = await enrichTab(tab);
  const emulating = await isEmulating(tab.id);
  const st = await getState(tab.id);
  const when = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const md = buildMarkdown({
    tab: enriched,
    pins: state.pins,
    viewportName: 'viewport.png',
    pinFiles: state.pins.map(pinFileName),
    emulating,
    emulatePresetId: st.emulatePresetId,
    when,
  });
  const result = await writeClipboard({ kind: 'text', text: md });
  if (!result?.ok) {
    flashError(tab.id);
    return { ok: false, error: result?.error || 'clipboard failed' };
  }
  flashOk(tab.id);
  return { ok: true };
}

export async function exportQaReport(tab) {
  const state = await getQaState(tab.id);
  if (!state.pins.length) {
    flashError(tab.id);
    return { ok: false, error: 'no pins' };
  }
  const settings = await getSettings();
  const folder = reportFolderName(tab, settings);
  const enriched = await enrichTab(tab);
  const emulating = await isEmulating(tab.id);
  const st = await getState(tab.id);
  const when = new Date().toISOString().replace('T', ' ').slice(0, 16);

  const viewportDataUrl = await captureViewportDataUrl(tab);
  if (typeof viewportDataUrl !== 'string' || !viewportDataUrl.startsWith('data:image/')) {
    throw new Error(viewportDataUrl?.error || 'viewport capture failed');
  }
  await downloadNamed(viewportDataUrl, `${folder}/viewport.png`);

  const pinFiles = [];
  for (const pin of state.pins) {
    const name = pinFileName(pin);
    pinFiles.push(name);
    try {
      const crop = await captureClipDataUrl(tab, pin.rect);
      if (typeof crop === 'string' && crop.startsWith('data:image/')) {
        await downloadNamed(crop, `${folder}/${name}`);
      }
    } catch (_) {
      // skip failed crop; still list in markdown
    }
  }

  const md = buildMarkdown({
    tab: enriched,
    pins: state.pins,
    viewportName: 'viewport.png',
    pinFiles,
    emulating,
    emulatePresetId: st.emulatePresetId,
    when,
  });
  await downloadNamed(markdownDataUrl(md), `${folder}/report.md`);

  if (settings.copyMdOnExport !== false) {
    await writeClipboard({ kind: 'text', text: md });
  }

  flashOk(tab.id);
  return { ok: true, folder };
}
