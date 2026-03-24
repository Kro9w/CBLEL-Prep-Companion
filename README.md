# CBLE Tracker

A daily routine + checklist app for CBLE board exam preparation.
Built with React + Vite + TypeScript. Wrap with Tauri for a native Mac app.

---

## Quick start

```bash
cd cble-tracker
npm install
npm run dev
```

Open http://localhost:5173

---

## Build for production (web)

```bash
npm run build
# Output in /dist — open dist/index.html
```

---

## Wrap with Tauri (Mac app)

### Prerequisites
- Rust: https://www.rust-lang.org/tools/install
- Tauri CLI: `npm install -g @tauri-apps/cli`
- Xcode Command Line Tools: `xcode-select --install`

### Add Tauri to this project

```bash
cd cble-tracker
npm install @tauri-apps/api
npx tauri init
```

When prompted:
- App name: CBLE Tracker
- Window title: CBLE Tracker
- Web assets location: `../dist`
- Dev server URL: `http://localhost:5173`
- Dev command: `npm run dev`
- Build command: `npm run build`

### Run in dev (native window)

```bash
npx tauri dev
```

### Build Mac .app

```bash
npx tauri build
# Output in src-tauri/target/release/bundle/macos/
```

---

## Features

- Daily checklist auto-generated based on the date
  - Adapts to capstone phase (Mar 23 – Apr 21) vs pure board prep (Apr 22 – Sep 2)
  - Gym days (Mon, Tue, Thu, Fri) and cardio day (Wed) handled automatically
  - Full rest on Sundays
- Subject rotation: 1 subject per week across all 5 CBLE subjects
- Progress bar per day
- Milestone countdown (Final Defense, Graduation, Board Registration, CBLE Exam)
- Checklist state saved to localStorage — persists across sessions
- Navigate between dates with ← → buttons

---

## Fonts

Uses Google Fonts (Instrument Serif + DM Sans).
For offline/Tauri use, download and bundle the fonts locally:
https://fonts.google.com/specimen/Instrument+Serif
https://fonts.google.com/specimen/DM+Sans
