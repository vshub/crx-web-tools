# WebTools

Personal Chrome extension for web design and UX QA: screenshots, device frames, measure tools, and annotated bug notes you can export as Markdown.

Not published to the Chrome Web Store — load it unpacked from this repo.

## Features

### Capture
- **Viewport** — PNG of what’s on screen
- **Delayed** — countdown on the extension badge, then viewport (handy for hover menus)
- **Full page** — long-page PNG (height capped in Settings)
- **Region** — drag a rectangle to crop

By default, shots go to **clipboard and Downloads**. Change that under Settings.

### Frames
- **Emulate** — CDP device emulation on the current tab (badge shows `ON`). Reloads the page so sites can serve a mobile layout.
- **Window presets** — resize so the **page viewport** matches the size (compensates for vertical tabs / side panel chrome)
- **Viewport size** — live HUD showing `innerWidth × innerHeight`, DPR, and screen size (like [whatismyviewport.com](https://whatismyviewport.com/)). Appears after a preset resize; toggle anytime from the popup. Click the size to copy; × or Esc to close.
- **Split window** — open a second window with the same URL beside the current one
- Per-preset **Emulate** on mobile/tablet rows

### Measure
- Hover any element to see `width × height`
- Click two elements (or points) to see gap / distance
- Press `c` to copy the readout; `Esc` to exit

### QA notes
For staging / UAT walkthroughs without dumping raw screenshots into Slack:

1. Click **QA notes**
2. Click UI elements and write notes (severity: blocker / bug / nit)
3. Use the bottom bar: **Export**, **Copy MD**, **Clear**, **Done**

**Export** downloads a folder like:

```text
WebTools-reports/2026-08-21-1430-example-checkout/
  report.md
  viewport.png
  01-submit.png
  …
```

Paste the Markdown into Linear / GitHub / Slack and attach the PNGs (or zip the folder).

## Install

### 1. Get the code

**Option A — ZIP (simplest)**  
1. Open https://github.com/vshub/crx-web-tools  
2. Code → **Download ZIP**  
3. Unzip somewhere permanent (e.g. `~/Extensions/crx-web-tools`)

**Option B — Git**

```bash
git clone https://github.com/vshub/crx-web-tools.git
```

### 2. Load in Chrome

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the folder that contains `manifest.json` (the repo root)

### 3. Pin it

Click the puzzle piece in the toolbar → pin **WebTools**.

### 4. First debugger use

The first time you **Emulate**, capture full page / region, or export QA crops, Chrome shows a yellow **“WebTools started debugging this browser”** bar. Click **Allow** (wording varies by Chrome version). Emulate needs that attachment to stay on.

## Use

Click the WebTools icon to open the popup.

| Section | What to do |
| --- | --- |
| Capture | Viewport / Delayed / Full page / Region |
| Frames | Emulate, Split window, Viewport size HUD, or click a preset size |
| Measure | Start measure overlay |
| QA | Start QA notes overlay |
| Settings | Filename pattern, folders, delay, save mode, handy presets |

Right-click the extension icon for Capture Viewport, Full Page, Toggle Emulate, Measure, and QA notes.

### Keyboard shortcuts

Defaults (change at `chrome://extensions/shortcuts`):

| Action | Mac | Windows / Linux |
| --- | --- | --- |
| Capture viewport | ⌘⇧S | Ctrl+Shift+S |
| Capture full page | ⌘⇧F | Ctrl+Shift+F |
| Toggle emulate | (unset) | (unset) |
| Measure | (unset) | (unset) |
| QA notes | (unset) | (unset) |

## Settings

Open **Settings** from the popup footer (or right-click the extension → Options).

- **Download folder** — default `Screenshots`
- **Filename pattern** — tokens: `{datetime}`, `{title}`, `{url}`, `{domain}`, `{subdomain}`, `{type}`  
  - `{type}`: `VP` viewport, `DL` delayed, `FS` full page, `RG` region  
  - `{domain}`: base name without TLD (`example` from `www.example.com`)  
  - `{subdomain}`: labels except TLD (`www_example`)
- **Delay seconds** — delayed capture countdown
- **Max full-page height** — safety cap (default 12000)
- **Save mode** — clipboard / download / both
- **QA report folder** — default `WebTools-reports`
- **Copy markdown on export** — also put `report.md` text on the clipboard
- **Handy** checkboxes — which device presets appear in the popup

## Limits

Won’t run on Chrome system pages (`chrome://…`, Web Store, etc.). Use a normal `https://` tab (staging/UAT is fine).

Everything stays local — no account, no server. Sharing QA reports means sending the exported files yourself.

## Update

1. Pull or re-download the latest code  
2. `chrome://extensions` → WebTools → **Reload**

## Stack

Vanilla ES modules, Manifest V3. No npm, bundler, or TypeScript.

Implementation details for contributors live in [`PLAN.md`](PLAN.md).
