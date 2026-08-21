/**
 * Burn a small info badge into a capture PNG after the shot (never a live DOM overlay).
 * Failures return the original data URL so the capture is never lost.
 */

const PATH_MAX = 56;

async function readInnerSize(tabId) {
  try {
    const [inj] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({
        width: window.innerWidth,
        height: window.innerHeight,
      }),
    });
    const value = inj?.result;
    if (
      value &&
      Number.isFinite(value.width) &&
      value.width > 0 &&
      Number.isFinite(value.height) &&
      value.height > 0
    ) {
      return value;
    }
  } catch (_) {}
  return null;
}

function middleTruncate(text, max = PATH_MAX) {
  const s = String(text || '');
  if (s.length <= max) return s;
  const keep = max - 1;
  const head = Math.ceil(keep / 2);
  const tail = Math.floor(keep / 2);
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

function stampLines(tab, settings, inner) {
  const lines = [];
  if (settings.stampShowSize !== false && inner) {
    lines.push(`${Math.round(inner.width)}×${Math.round(inner.height)}`);
  }
  let host = '';
  let pathLine = '';
  try {
    if (tab?.url && tab.url !== 'about:blank') {
      const u = new URL(tab.url);
      host = u.hostname || '';
      if (settings.stampShowPath) {
        pathLine = `${u.origin}${u.pathname || '/'}`;
      }
    }
  } catch (_) {}

  if (settings.stampShowPath && pathLine) {
    lines.push(middleTruncate(pathLine));
  } else if (settings.stampShowHost !== false && host) {
    lines.push(host);
  }
  return lines;
}

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function stampOrigin(position, imgW, imgH, boxW, boxH, pad) {
  const pos = position || 'br';
  let x = pad;
  let y = pad;
  if (pos === 'tr' || pos === 'br') x = imgW - boxW - pad;
  if (pos === 'bl' || pos === 'br') y = imgH - boxH - pad;
  return { x, y };
}

async function blobToDataUrl(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

/**
 * @param {string} dataUrl
 * @param {chrome.tabs.Tab} tab
 * @param {object} settings
 * @returns {Promise<string>}
 */
export async function applyInfoStamp(dataUrl, tab, settings) {
  if (!settings?.stampEnabled) return dataUrl;
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return dataUrl;

  try {
    const inner = tab?.id != null ? await readInnerSize(tab.id) : null;
    const lines = stampLines(tab, settings, inner);
    if (!lines.length) return dataUrl;

    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const dpr =
      inner && Number.isFinite(inner.width) && inner.width > 0
        ? bitmap.width / inner.width
        : 1;
    const scale = Math.max(0.75, Math.min(dpr || 1, 4));

    const pad = Math.round(16 * scale);
    const fontSize = Math.round(12 * scale);
    const lineGap = Math.round(4 * scale);
    const padX = Math.round(10 * scale);
    const padY = Math.round(8 * scale);
    const radius = Math.round(8 * scale);

    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return dataUrl;
    }

    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    ctx.font = `600 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    ctx.textBaseline = 'top';
    const metrics = lines.map((line) => ctx.measureText(line));
    const textW = Math.max(...metrics.map((m) => m.width), 0);
    const textH = lines.length * fontSize + (lines.length - 1) * lineGap;
    const boxW = Math.ceil(textW + padX * 2);
    const boxH = Math.ceil(textH + padY * 2);
    const { x, y } = stampOrigin(settings.stampPosition, canvas.width, canvas.height, boxW, boxH, pad);

    roundRectPath(ctx, x, y, boxW, boxH, radius);
    ctx.fillStyle = 'rgba(26, 26, 46, 0.88)';
    ctx.fill();

    ctx.fillStyle = '#f2f2f7';
    lines.forEach((line, i) => {
      ctx.fillText(line, x + padX, y + padY + i * (fontSize + lineGap));
    });

    const out = await canvas.convertToBlob({ type: 'image/png' });
    return await blobToDataUrl(out);
  } catch (_) {
    return dataUrl;
  }
}
