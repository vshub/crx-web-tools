chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
  if (msg.action !== 'offscreen_write') return;
  (async () => {
    if (msg.kind === 'image') {
      const res = await fetch(msg.dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    } else if (msg.kind === 'text') {
      await navigator.clipboard.writeText(msg.text);
    } else {
      throw new Error('unknown kind');
    }
    sendResponse({ ok: true });
  })().catch((e) => sendResponse({ ok: false, error: String(e) }));
  return true;
});
