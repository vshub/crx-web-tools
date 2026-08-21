# WebTools — implementation spec

Personal unpacked Chrome extension (Manifest V3). **This file is the only source of truth.** Do not open, copy from, or depend on any sibling folder. Implement from this document until the extension loads unpacked and the acceptance checks pass.

- **Folder:** this repo (`icons/` already exists — use it, do not regenerate icons)
- **Audience:** one person, designing and developing for the web
- **Not for Chrome Web Store**
- **Stack:** vanilla ES modules, no bundler, no TypeScript, no npm
- **Goal:** one popup for capture + device frames + measure, working on first load

---

## 1. Product (v1, locked)

| Area | What ships |
| --- | --- |
| Capture | Viewport, delayed viewport, full page, region select |
| Output | Copy PNG to clipboard **and** download (setting can change this) |
| Frames | CDP device emulate on the current tab (badge `ON`), window-size presets, split mobile window, live viewport size HUD |
| Measure | Page overlay: hover shows `w × h`; two clicks show gap in px; Esc exits |
| QA notes | Live-page element pins with notes + severity; export Markdown report pack + screenshots |

**Out of v1:** grid overlay, color picker, a11y outline, export page logs, click-element capture (region replaces it), video/GIF, draw-on-PNG annotation, Jira/GitHub APIs, tests suite, store packaging.

---

## 2. Lessons from the previous screenshot/emulate tools (hard rules)

These are not suggestions. The last screenshot worker failed in ways that waste a design/dev session. Encode them in code.

### 2.1 Debugger is a shared resource

Both emulate and capture use `chrome.debugger`. Emulate **stays attached**. Capture **must not detach** if emulate is still on. Full-page capture **overwrites** `Emulation.setDeviceMetricsOverride`; you must snapshot and restore.

- `attach` is idempotent (already attached → continue).
- Track purposes per tab: `emulate` (long-lived) and `capture` (short).
- `detach` only when **both** purposes are false.
- Never `Promise.race` a timeout that abandons the in-flight capture without aborting it and running cleanup.
- Service workers die. Persist emulate-on in `chrome.storage.session` keyed by `tabId`. Do **not** use an in-memory `let isCapturing` / `Map` as the source of truth.

### 2.2 Never photograph your own UI

Do **not** inject a toast/overlay into the page **before** `captureVisibleTab` or `Page.captureScreenshot`. The previous tool painted “Capturing…” into every viewport shot.

- Hide measure/region overlay immediately before the pixels are taken; restore after if the mode is still active.
- Progress = `chrome.action.setBadgeText` (e.g. `…` then clear). Success/failure = badge flash or `chrome.notifications` is optional; **in-page toast after capture is allowed**, never before.
- Delayed capture countdown: badge text `3` `2` `1`, **not** a DOM overlay on the page you are about to shoot.

### 2.3 Capture quality (this is a design tool)

- Viewport: PNG via `chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' })`. Pass **`tab.windowId`**, never `null`.
- Full page: PNG, `deviceScaleFactor` from the tab (fallback `1`). **Do not** use JPEG for UI screenshots.
- Cap height at `settings.maxHeight` (default **12000**, range 500–20000). A 50000 cap OOMs Chrome.
- After emulate-on, viewport capture should show the emulated layout (debugger is already attached — use `Page.captureScreenshot` while emulating; `captureVisibleTab` also works but CDP matches DPR better).

### 2.4 Delayed capture

User gesture expires during the wait. That is expected. After the countdown, if `captureVisibleTab` throws, fall back to debugger `Page.captureScreenshot` **without** treating that as “bypass chrome://”. Restricted URLs still fail closed (section 6).

Timeout for the **capture itself** starts when capture starts, not when the user clicks Delayed. Countdown is outside the critical section.

### 2.5 Downloads

`chrome.downloads` rejects many filenames. Use the sanitizers in section 8 **verbatim**. Then try: primary path → ASCII fallback with folder → ASCII fallback no folder. `conflictAction: 'uniquify'`.

Wait for completion with `chrome.downloads.onChanged` and a **hard deadline** (e.g. 15s). Do **not** recurse `setTimeout` forever on `in_progress`.

### 2.6 Messages

Explicit action map. Unknown `action` → error, **never** fall through to full-page capture.

### 2.7 Do not add

- `web_accessible_resources` — inject CSS/JS with `chrome.scripting` only. WAR lets sites fingerprint the install and is unused if you inject.
- `Performance.enable` — dead CDP surface.
- `innerHTML` for user/page/error strings. Use `textContent`.
- Naive eTLD+1 parsing (`tld.length <= 3`). `{url}` = hostname; `{domain}` = hostname with leading `www.` stripped. Stop there.
- Logging full page URLs with query strings into storage (tokens in `?`). Strip `search` and `hash` if you log.

### 2.8 What was worth keeping (port the behavior, not the files)

- Filename/folder sanitization, Windows reserved names, 240-byte trim, uniquify fallbacks, `data:image/` prefix check.
- Emulate state in `chrome.storage.session` so toggling still works after the worker dies.
- Badge `ON` + green while emulating.
- Reload the tab after applying/clearing UA so the site can serve its mobile document.
- `debugger.onDetach` and `tabs.onRemoved` clear emulate state + badge.
- Isolated-world overlay (default `executeScript` world), not page-world `window.*` APIs the site can call.

---

## 3. File tree (create exactly this)

```
WebTools/
  PLAN.md                  (this file — do not delete)
  manifest.json
  icons/                   (already present)
    icon16.png
    icon32.png
    icon48.png
    icon128.png
  background/
    index.js               service worker entry (type: module)
    session.js
    lock.js
    capture.js
    device.js
    clipboard.js
    files.js
    settings.js
    constants.js
    report.js
  offscreen/
    clipboard.html
    clipboard.js
  content/
    overlay.js
    overlay.css
    viewport-hud.js
  popup/
    popup.html
    popup.js
    popup.css
  options/
    options.html
    options.js
    options.css
```

Service worker in `manifest.json`:

```json
"background": { "service_worker": "background/index.js", "type": "module" }
```

---

## 4. manifest.json (complete)

```json
{
  "manifest_version": 3,
  "name": "WebTools",
  "version": "1.0",
  "description": "Capture, device frames, and measure for web design and development.",
  "minimum_chrome_version": "116",
  "permissions": [
    "activeTab",
    "debugger",
    "scripting",
    "storage",
    "downloads",
    "windows",
    "clipboardWrite",
    "offscreen",
    "contextMenus"
  ],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background/index.js",
    "type": "module"
  },
  "options_page": "options/options.html",
  "action": {
    "default_popup": "popup/popup.html",
    "default_title": "WebTools",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "commands": {
    "capture_viewport": {
      "suggested_key": { "default": "Ctrl+Shift+S", "mac": "Command+Shift+S" },
      "description": "Capture viewport"
    },
    "capture_fullpage": {
      "suggested_key": { "default": "Ctrl+Shift+F", "mac": "Command+Shift+F" },
      "description": "Capture full page"
    },
    "toggle_emulate": {
      "description": "Toggle device emulation on this tab"
    },
    "start_measure": {
      "description": "Start measure overlay"
    }
  }
}
```

No `web_accessible_resources`. Overlay files are injected with `chrome.scripting.insertCSS` / `executeScript`.

---

## 5. Message protocol

All runtime messages are `{ action: string, ...payload }`. Service worker handles these **and only these**:

| action | from | payload | behavior |
| --- | --- | --- | --- |
| `capture_viewport` | popup / command | — | viewport PNG of **sender’s tab or active tab** |
| `capture_viewport_delayed` | popup | — | badge countdown then viewport |
| `capture_fullpage` | popup / command | — | full-page PNG |
| `capture_region` | popup | — | inject overlay in `region` mode |
| `region_coords` | overlay | `{ coords: { x, y, width, height, devicePixelRatio } }` | CDP clip PNG; coords are **CSS pixels relative to the layout viewport / document origin** (`getBoundingClientRect` + `scrollX/Y` of the **user-drawn rectangle**, not a guessed element) |
| `overlay_canceled` | overlay | — | clear badge; no capture |
| `toggle_emulate` | popup / command | optional `{ presetId }` | enable/disable CDP emulate on active tab |
| `resize_window` | popup | `{ width, height }` | size so **page viewport** (`innerWidth` / `innerHeight`) matches; compensates for vertical tabs / side panel / window chrome. `height` may be `null` (width only). Shows viewport HUD after resize. |
| `open_split_window` | popup | `{ url, sourceWindowId }` | shrink source, open sibling with same URL |
| `show_viewport_hud` | popup | — | inject live viewport size toast (W×H, DPR, screen) |
| `toggle_viewport_hud` | popup / command / menu | — | show/hide viewport size toast |
| `start_measure` | popup / command | — | inject overlay in `measure` mode |
| `start_qa` | popup / command / menu | — | inject overlay in `qa` mode |
| `qa_get` | overlay | — | return `{ pins }` from `chrome.storage.session` key `qa:${tabId}` |
| `qa_sync` | overlay | `{ pins }` | persist pins for the tab |
| `qa_export` | overlay | — | hide overlay, capture viewport + pin crops, download report pack, optional copy MD |
| `qa_copy_md` | overlay | — | copy Markdown report text to clipboard |
| `qa_clear` | overlay / popup | — | clear session pins for the tab |
| `copy_text` | overlay | `{ text }` | write string to clipboard via offscreen |

Popup always: query `{ active: true, currentWindow: true }`, send message, `window.close()` (except you may keep popup open — closing is fine; SW continues).

Commands: query active tab, dispatch the same actions.

`onMessage` must `return true` only when responding async. Prefer `async` IIFE + `sendResponse`.

**Default branch:** `console.warn` unknown action; do not capture.

---

## 6. Restricted URLs

```js
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
```

If restricted: set badge `!` briefly, do not attach debugger, do not inject overlay.

---

## 7. DebuggerSession (`background/session.js`)

Per-tab state in `chrome.storage.session`:

```js
// key: `dbg:${tabId}`
{
  attached: boolean,
  emulate: boolean,
  capture: boolean,
  emulatePresetId: string | null,
  snapshot: null | {
    width: number,
    height: number,
    deviceScaleFactor: number,
    mobile: boolean,
    userAgent: string
  }
}
```

API:

```text
ensureAttached(tabId) -> attach protocol "1.3" if not attached; ignore "Another debugger" only if we already own it; else throw
acquire(tabId, purpose) -> ensureAttached; set purpose true
release(tabId, purpose) -> set purpose false; if !emulate && !capture then detach
isEmulating(tabId) -> boolean
setEmulating(tabId, preset | null)
snapshotEmulation(tabId)  // before full-page override
restoreEmulation(tabId)   // after full-page: if emulate, re-apply preset metrics+UA (do not reload); else clearDeviceMetricsOverride
```

`chrome.debugger.onDetach`: clear session key, clear badge (unless reason is we detached ourselves).

`chrome.tabs.onRemoved`: `storage.session.remove`.

**Enable emulate:**

1. `acquire(tabId, 'emulate')`
2. `Emulation.setDeviceMetricsOverride` with preset width/height/DPR/`mobile: true`
3. `Emulation.setUserAgentOverride` `{ userAgent }`
4. persist session; badge text `ON`, background `#4CAF50`
5. `chrome.tabs.reload(tabId)` so the site can switch layout/UA

**Disable emulate:**

1. `Emulation.clearDeviceMetricsOverride`
2. `Emulation.setUserAgentOverride({ userAgent: "" })`
3. `release(tabId, 'emulate')` (detaches if capture is not running)
4. clear badge
5. `chrome.tabs.reload(tabId)`

**Capture while emulating:** `acquire('capture')` → screenshot → `restoreEmulation` if you changed metrics → `release('capture')` → debugger **stays** if emulate still true.

If `attach` fails because Chrome shows the yellow infobar and the user cancelled, fail visibly (badge `!`).

---

## 8. Files and filenames (`background/files.js`)

Port this behavior exactly. Type codes: `VP` viewport, `DL` delayed viewport, `FS` full page, `RG` region.

### Settings used

```js
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
```

Tokens in `filenamePattern`: `{type}`, `{datetime}`, `{title}`, `{url}`, `{domain}`, `{subdomain}`.

### formatFilename(settings, tab, typeStr)

```js
function formatFilename(settings, tab, typeStr) {
  const datetime = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];

  let hostname = 'blank_page';
  let domain = 'blank';
  if (tab.url && tab.url !== 'about:blank') {
    try {
      const urlObj = new URL(tab.url);
      hostname = urlObj.hostname.replace(/[^a-z0-9.-]/gi, '_').toLowerCase() || 'blank_page';
      domain = urlObj.hostname.toLowerCase().replace(/^www\./, '').replace(/[^a-z0-9.-]/gi, '_') || hostname;
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
    .replaceAll('{url}', hostname)
    .replaceAll('{domain}', domain);

  filename = filename.replace(/^[/\\.~]+/, '');
  filename = Array.from(filename).slice(0, 150).join('');
  const encoder = new TextEncoder();
  while (encoder.encode(filename).length > 240) {
    filename = Array.from(filename).slice(0, -1).join('');
  }
  filename = filename.replace(/[.\s_]+$/, '');
  return filename || 'screenshot';
}
```

### sanitizeFolder(folder)

```js
function sanitizeFolder(folder) {
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
```

### downloadDataUrl(dataUrl, tab, settings, typeStr, extension)

- Reject unless `dataUrl.startsWith('data:image/')`.
- `fullPath = folder ? folder + '/' + filename + '.' + extension : filename + '.' + extension`
- Variants: `fullPath`, then `screenshot_${typeStr}_${datetime}.${ext}` with folder, then that name with no folder.
- `chrome.downloads.download({ url, filename, saveAs: false, conflictAction: 'uniquify' })`
- On `Invalid filename`, try next variant.

### waitForDownload(downloadId, timeoutMs = 15000)

Listen to `chrome.downloads.onChanged` until `state.current === 'complete'` or `'interrupted'` or timeout. Remove listener in `finally`. Return boolean.

---

## 9. Capture (`background/capture.js`)

Use `lock.js`: `chrome.storage.session` key `lock:${tabId}` `{ at: number }`. TTL 60s. If lock held, badge `…` and return. Always clear lock in `finally`.

`AbortController` per capture. If aborted, `release(tabId, 'capture')` still runs.

### Viewport

1. If `isRestrictedUrl` → abort.
2. Take lock. Badge `…`.
3. If overlay is showing, send it a hide-for-capture ping (or `executeScript` to set overlay `display:none`) and `requestAnimationFrame` wait ~50ms.
4. Try `chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' })`.
5. On throw: `acquire(tabId, 'capture')`, `Page.captureScreenshot { format: 'png' }`, build `data:image/png;base64,` + data, `release(tabId, 'capture')`.
6. `deliver(dataUrl, tab, 'VP', 'png')`.
7. Clear badge.

### Delayed viewport

`delaySeconds` from settings (0–15, default 3). For `i` from n..1: badge text `String(i)`, `sleep(1000)`. Then same as viewport with type `DL`. Do not inject countdown into the page.

### Full page

1. Lock + `acquire('capture')`.
2. `snapshotEmulation(tabId)`.
3. `Page.enable`. `Page.getLayoutMetrics`. Use `cssContentSize || contentSize`.
4. `width = ceil(contentSize.width)`, `height = min(ceil(contentSize.height), settings.maxHeight)`.
5. Read DPR: `Emulation.setDeviceMetricsOverride` with `deviceScaleFactor` from `tab` via injected `window.devicePixelRatio` **or** `1` if emulate is on use the emulate preset’s DPR.
6. `Emulation.setDeviceMetricsOverride({ width, height, deviceScaleFactor: dpr, mobile: false })` — **except** if currently emulating, keep `mobile: true` and the emulate width if you want the mobile layout’s full scroll height instead of desktop. **Rule:** if emulating, do **not** switch to desktop metrics; capture full scroll height of the **current** emulated layout (`contentSize` after emulate). Skip the override that fights emulate; use `Page.captureScreenshot` with `clip: { x:0, y:0, width, height, scale: 1 }` on the emulated page.
7. If **not** emulating: override to content size, `sleep(300)` (not 500 cargo-cult; enough for layout), then `Page.captureScreenshot { format: 'png', clip: { x:0, y:0, width, height, scale: 1 } }`.
8. `restoreEmulation(tabId)` (re-apply preset without reload, or clear override).
9. `release('capture')`.
10. `deliver(..., 'FS', 'png')`.

Do not call `Performance.enable`. Do not use JPEG.

### Region

Inject overlay mode `region` (section 12). On `region_coords`: `acquire('capture')`, `Page.captureScreenshot` with clip:

```js
{
  x: Math.round(coords.x),
  y: Math.round(coords.y),
  width: Math.max(1, Math.round(coords.width)),
  height: Math.max(1, Math.round(coords.height)),
  scale: 1
}
```

Use CSS pixels. **Do not** set `scale: 1/dpr` (produces tiny/blurry crops). If the PNG is 1x on retina, set `scale` to `coords.devicePixelRatio || 1` only after verifying the clip is still CSS pixels — CDP `clip.scale` is “screenshot scale relative to CSS pixels”. Prefer `scale: 1` first; if the result is soft on retina, use `scale: dpr` **without** dividing width/height by dpr.

Then `release('capture')`, `deliver(..., 'RG', 'png')`.

### deliver()

```text
if stampEnabled → applyInfoStamp (OffscreenCanvas badge: viewport size / host / path)
if saveMode is clipboard or both → offscreen clipboard write
if saveMode is download or both → downloadDataUrl + waitForDownload
badge success then clear
```

Stamp is applied **after** capture pixels are taken (never as a live DOM overlay). Size line uses page `innerWidth×innerHeight`. QA export stamps `viewport.png` the same way; pin crops are not stamped. See `background/stamp.js`.

---

## 10. Clipboard (`background/clipboard.js` + `offscreen/`)

MV3 service workers cannot reliably write the clipboard. Use Offscreen Document.

`offscreen/clipboard.html`: empty page, script `clipboard.js`.

`clipboard.js` listens:

```js
chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
  if (msg.action !== 'offscreen_write') return;
  (async () => {
    if (msg.kind === 'image') {
      const res = await fetch(msg.dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    } else if (msg.kind === 'text') {
      await navigator.clipboard.writeText(msg.text);
    }
    sendResponse({ ok: true });
  })().catch((e) => sendResponse({ ok: false, error: String(e) }));
  return true;
});
```

SW helper: `chrome.offscreen.createDocument` if none (`reasons: ['CLIPBOARD']`, `justification: 'Copy screenshot or measure readout'`). Then `sendMessage` to offscreen. If clipboard fails, still download when `saveMode === 'both'`; if `clipboard` only, badge `!`.

---

## 11. Device / windows (`background/device.js`)

### Default presets (store as `windowPresets` in `chrome.storage.local`)

Seed on install if missing:

```js
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
  { id: 'd1920', name: '1920 × 1080', icon: 'desktop', windowWidth: 1920, windowHeight: 1080, emulate: false },
  { id: 'd1440', name: '1440 × 900', icon: 'desktop', windowWidth: 1440, windowHeight: 900, emulate: false },
  { id: 'd1280', name: '1280 × 800', icon: 'desktop', windowWidth: 1280, windowHeight: 800, emulate: false },
];
```

Default Handy (popup list): `d1440`, `d1920`. Emulate / Split are deferred in the popup UI.

Desktop presets: `chrome.windows.update` with **width and height** so the page viewport matches. Do not attach debugger.

Mobile/tablet row in the popup: **two actions** if `emulate: true`:

1. **Resize window** so the **page viewport** matches `windowWidth` × `windowHeight` (compensates for vertical tabs / side panel / frame chrome).
2. **Emulate this tab** with that preset (the big “Emulate” toggle uses the last-used emulate preset, default `iphone-15`).

Keep the popup simple:

- Button **Emulate iPhone** (toggle using `iphone-15`, or last `emulatePresetId`)
- Button **Split window** (see below)
- List of presets: click = resize window to that size. Do not auto-emulate on desktop clicks.

### Split window

```js
async function openSplitWindow(url, sourceWindowId) {
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
```

Do not auto-emulate the new window (user can toggle emulate there).

---

## 12. Overlay (`content/overlay.js` + `overlay.css`)

Inject once per job: `insertCSS` `content/overlay.css`, `executeScript` `content/overlay.js`. Script starts in a mode passed by executing a tiny function after load:

```js
await chrome.scripting.executeScript({
  target: { tabId },
  files: ['content/overlay.js'],
});
await chrome.scripting.executeScript({
  target: { tabId },
  func: (mode) => window.__webtoolsStart?.(mode),
  args: [mode], // 'measure' | 'region'
});
```

Guard re-entry: if overlay host exists, just switch mode.

**Host:** `position:fixed; inset:0; z-index:2147483646; pointer-events:none` on a root attached to `document.documentElement`. Interactive layer `pointer-events:auto`. Use a **closed shadow root** so page CSS cannot restyle it. All labels via `textContent`.

### Measure mode

- `mousemove` (capture): `elementFromPoint`, ignore the overlay host. Highlight with a box matching `getBoundingClientRect`. HUD: `Math.round(w) × Math.round(h)`.
- First click: freeze element A (or point). Second click: element B or point. HUD: `dx`, `dy`, and Euclidean distance, all CSS px, integer.
- `c` copies HUD text via `chrome.runtime.sendMessage({ action: 'copy_text', text })`.
- `Escape`: `overlay_canceled`, remove overlay, restore cursor.

### Region mode

- Drag rectangle on the page (mousedown/move/up). On mouseup, if width/height ≥ 4px, send `region_coords` with `x: left + scrollX`, `y: top + scrollY`, `width`, `height`, `devicePixelRatio`.
- `Escape`: cancel.
- Hide host (`visibility:hidden`) **before** sending coords so the rectangle is not in the shot; SW may also hide via script.

Cursor: `crosshair`. Do not `stopPropagation` in a way that breaks the page after exit; remove listeners on stop.

---

## 13. Popup UI

Dark, ~280px wide, Mobile-view energy (background `#1a1a2e`, text `#e0e0e0`, hover `#2a2a4a`, muted `#8e8e93`). Real `<button>` elements, not clickable `<div>`s.

Structure:

```
WebTools
── Capture
   [ Viewport ] [ Delayed ]
   [ Full page ] [ Region ]
── Frames
   [ Emulate ]          (toggles; aria-pressed when ON)
   [ Split window ]
   presets list (scroll, max-height ~220px)
── Measure
   [ Measure ]
── footer: Settings
```

Disable capture/emulate/measure on restricted URLs (query the tab on open). Show a one-line muted reason.

Do not use emoji as the only label; optional small text labels are enough.

`popup.js`: `DOMContentLoaded`, bind clicks to `chrome.runtime.sendMessage`, then `window.close()`.

---

## 14. Options UI

Two sections on one page (light or dark; match popup dark for consistency).

**Save**

- Download folder (text)
- Filename pattern (text) + help: `{type}` `{datetime}` `{title}` `{url}` `{domain}`
- Delay seconds 0–15
- Max full-page height 500–20000
- Save mode: clipboard / download / both

**Device presets**

- List with edit/delete
- Add modal: name, icon (desktop/laptop/tablet/mobile), window width, window height optional, emulate checkbox, emulate w/h/DPR/UA if emulate
- Reset to `DEFAULT_PRESETS`

Validate before save. Reset writes defaults immediately.

Do not create the Reset button in JS after load — put it in HTML.

---

## 15. Context menus (action icon)

On install, `chrome.contextMenus.create` with `contexts: ['action']`:

- Capture Viewport
- Capture Full Page
- separator
- Toggle Emulate
- Measure

No orphan trailing separator.

---

## 16. `background/index.js` responsibilities

- `onInstalled`: seed presets + settings if missing; create context menus (use stable ids; `create` in try/catch or `onInstalled` only to avoid duplicates — on extension reload Chrome drops menus, so creating in `onInstalled` is enough; also create on SW start if you want resilience).
- `onMessage`, `commands.onCommand`, `contextMenus.onClicked`, `debugger.onDetach`, `tabs.onRemoved`, `downloads.onChanged` (if used globally).
- Import modules; keep this file as wiring only.

---

## 17. Implementation order

1. `manifest.json` + empty SW that logs + popup shell that sends messages (so load unpacked works).
2. `settings.js` + `constants.js` + seed storage on install.
3. `session.js` + `device.js`: emulate toggle, badge, resize, split. Verify yellow infobar appears/disappears and badge survives SW sleep.
4. `files.js` + `clipboard.js` + `capture.js` viewport (no overlay in pixels). Then delayed, then full page with restore-emulation.
5. Overlay measure, then region.
6. Options page.
7. Commands + context menus.

---

## 18. Load unpacked

1. `chrome://extensions` → Developer mode → Load unpacked → this folder (`WebTools`).
2. Pin the icon. First use of emulate/capture: accept the debugger infobar.
3. Shortcuts: `chrome://extensions/shortcuts`.

---

## 19. Acceptance checks (do these before calling it done)

1. Viewport shot of a normal https page has **no** overlay, toast, or badge pixels in the image.
2. Delayed shot of a hover menu does not include a countdown chip on the page.
3. Full-page PNG of a long doc is sharp on a retina Mac (not a soft JPEG).
4. Turn **Emulate** on (badge `ON`, infobar visible, page looks mobile after reload). Take a **viewport** shot — still mobile. Take a **full page** shot — still mobile after the shot; badge still `ON`; debugger still attached.
5. Turn emulate **off** — infobar gone, badge empty, page desktop after reload.
6. Click Desktop 1440 — window width changes; debugger does not attach.
7. Split window opens a second window with the same URL.
8. Measure: hover a button, see its px size; two-element gap; Esc removes overlay; page clicks work again.
9. Region drag saves a crop without the selection rectangle in the image.
10. Clipboard paste into a doc/Figma gets the PNG when `saveMode` is `clipboard` or `both`.
11. Filename with a weird tab title still downloads (uniquify fallback).
12. `chrome://extensions` as active tab: capture/emulate/measure refuse cleanly.
13. Unknown message does not take a full-page screenshot.
14. Kill the service worker from `chrome://serviceworker-internals` while emulate is ON; click Emulate again — it **disables**, does not enable twice.
15. QA notes: pin two elements with notes; Export writes `report.md` + PNGs under `WebTools-reports/`; Copy MD puts markdown on the clipboard; overlay is not in the PNGs.

---

## 20. Architecture sketch

```text
popup/command/menu
        │
        ▼
background/index.js
        │
        ├── lock.js (storage.session)
        ├── session.js (debugger purposes emulate|capture)
        ├── device.js (metrics, UA, windows)
        ├── capture.js
        │       ├── files.js (sanitize + download)
        │       └── clipboard.js → offscreen document
        ├── report.js (QA markdown pack)
        └── scripting → content/overlay.js (measure | region | qa)
```

If emulate and capture disagree about device metrics, **emulate wins after the shot**. Capture is a guest.

---

## 21. QA notes (v1.1)

Live-page element comments for staging/UAT UX QA. No hosted sharing — export a local report pack.

### Flow

1. Popup **QA notes** (or command / action menu) injects overlay mode `qa`.
2. Hover highlights the element under the cursor; click opens a note panel (note text + severity: blocker / bug / nit).
3. Numbered pins stay on the page. Click a badge to edit/delete. Toolbar: Export, Copy MD, Clear, Done.
4. Esc exits the overlay but **keeps** pins in `chrome.storage.session` (`qa:${tabId}`) until Clear or tab close.
5. **Export**: hide overlay → viewport PNG → CDP clip per pin → download folder:

```text
WebTools-reports/{stamp}-{domain}-{title}/
  report.md
  viewport.png
  01-{label}.png
  …
```

`report.md` uses relative image links. Setting `copyMdOnExport` (default true) also copies the markdown text.

### Rules

- Same capture hard rules: no overlay pixels in shots; emulate stays attached; restricted URLs refuse.
- Selector helper: unique `#id` → `data-testid` → short `nth-of-type` path.
- Vanilla only — do not vendor marker.js / Fabric / React QA extensions.
