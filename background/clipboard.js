async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen/clipboard.html',
      reasons: ['CLIPBOARD'],
      justification: 'Copy screenshot or measure readout',
    });
  } catch (err) {
    if (!/already exists|duplicate/i.test(String(err?.message || err))) throw err;
  }
}

export async function writeClipboard(payload) {
  await ensureOffscreen();
  const result = await chrome.runtime.sendMessage({
    action: 'offscreen_write',
    kind: payload.kind,
    dataUrl: payload.dataUrl,
    text: payload.text,
  });
  return result;
}
