# WebTools

Personal Chrome extension for web design and UX QA: screenshots, device frames, inspect, measure, and annotated bug notes you can export as Markdown.

Not published to the Chrome Web Store — load it unpacked from this repo.

## Features

### Capture
- **Viewport** — PNG of what’s on screen
- **Delayed** — countdown on the extension badge, then viewport (handy for hover menus)
- **Full page** — long-page PNG (height capped in Settings)
- **Region** — drag a rectangle to crop

By default, shots go to **clipboard and Downloads**. Change that under Settings.

Optional **Add info** (popup checkbox next to Capture; full options in Settings) burns viewport size / host onto capture PNGs after the shot.

### Frames
- **Window presets** — resize so the **page viewport** matches width × height (compensates for vertical tabs / side panel chrome). Defaults: **1440×900** and **1920×1080**; enable more under Settings → Handy.
- **Show current** — checkbox in the popup toggles the live HUD (`innerWidth × innerHeight`, DPR, screen). Also appears after a preset resize. Click the size to copy; × or Esc to close.
- Emulate / Split window — available in code but hidden from the popup for now

### Measure
- Hover any element to see `width × height`
- Click two elements (or points) to see gap / distance
- Press `c` to copy the readout; `Esc` to exit

### Inspect
Point at a control and copy a spec for design / frontend:

1. Click **Inspect**
2. Hover to see name + size; click to freeze
3. **Copy** (or `c`) puts a text block on the clipboard: name, selector, classes, type, color, spacing, tokens
4. `Esc` or **Done** to exit

Names come from the DOM (`data-component`, `data-slot`, `data-testid`, aria, or a distinctive class) — not from a design-system registry.

### QA notes
For staging / UAT walkthroughs without dumping raw screenshots into Slack:

1. Click **QA notes**
2. Click UI elements and write notes (severity: blocker / bug / nit)
3. Use the bottom bar: **Export**, **Copy MD**, **Clear**, **Done**

**Export** downloads a pack under Chrome’s download location (configure the path in Settings), e.g.:

```text
Team/QA/WebTools-reports/2026-08-21-1430-example-checkout/
  2026-08-21-1430-example-checkout.md
  viewport.png
  01-submit.png
  …
```

The markdown file uses the same stamp / domain / title slug as the pack folder. Paths are relative to Chrome’s download directory — set that to a synced team folder (or use a nested path under Downloads) so exports land where the team expects.

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
| Inspect | Start inspect overlay |
| QA | Start QA notes overlay |
| Settings | Filename pattern, folders, delay, save mode, handy presets |

Right-click the extension icon for Capture Viewport, Full Page, Toggle Emulate, Measure, Inspect, and QA notes.

### Keyboard shortcuts

Defaults (change at `chrome://extensions/shortcuts`):

| Action | Mac | Windows / Linux |
| --- | --- | --- |
| Capture viewport | ⌘⇧S | Ctrl+Shift+S |
| Capture full page | ⌘⇧F | Ctrl+Shift+F |
| Toggle emulate | (unset) | (unset) |
| Measure | (unset) | (unset) |
| Inspect | (unset) | (unset) |
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
- **Screenshot stamp** — optional badge on capture PNGs. Toggle **Include screenshot info** in the popup; corner/fields in Settings.
- **QA report path** — under Chrome’s download location (default `WebTools-reports`). Nested OK, e.g. `Team/QA/WebTools-reports`
- **Copy markdown on export** — also put the report markdown on the clipboard
- **Handy** checkboxes — which device presets appear in the popup (defaults: 1440×900, 1920×1080)

## Limits

Won’t run on Chrome system pages (`chrome://…`, Web Store, etc.). Use a normal `https://` tab (staging/UAT is fine).

Everything stays local — no account, no server. Sharing QA reports means sending the exported files yourself.

## Update

1. Pull or re-download the latest code  
2. `chrome://extensions` → WebTools → **Reload**

## Stack

Vanilla ES modules, Manifest V3. No npm, bundler, or TypeScript.

Implementation details for contributors live in [`PLAN.md`](PLAN.md).
