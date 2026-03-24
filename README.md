# CBLEL PREP-Companion

A daily routine, checklist, and Pomodoro app for the upcoming Computer Based Licensure Examination for Librarians (CBLEL). Built with React, Vite, and TypeScript.

I hope this apps help you to keep you focused, disciplined, and on track.

---

<img width="1419" height="655" alt="Screenshot 2026-03-24 at 8 00 43 PM" src="https://github.com/user-attachments/assets/8f32a4ff-475a-4753-a31e-70c69847c5d9" />

<img width="1432" height="667" alt="Screenshot 2026-03-24 at 7 39 33 PM" src="https://github.com/user-attachments/assets/e86f6af4-f422-4e2c-86de-34ecbb84101d" />

---

## Features
- **Customizable Onboarding:** Set your name, reorder the 6 CBLE subjects, and define your custom study cycle (e.g., 6 days per subject) and active study days.
- **Dynamic Daily Checklist:** Automatically generates a daily routine based on your assigned subject for the week. The checklist is a _prescription_—you can freely remove items or add your own custom tasks to fit your actual day.
- **Pomodoro Timer:** A built-in, floating 25/5 Pomodoro timer to help you maintain focus during study blocks.
- **Mock Exams:** Take full timed exams or immediate-feedback sessions. Upload your own `.txt` question banks.
- **Dashboard & Progress:** Track your study streak, days left until the exam, completion rates, and view a heat map of your recent mock exam scores.
- **Dark Mode:** Fully responsive dark mode for late-night review sessions.
- **Persistent Storage:** All your progress, custom tasks, deleted prescribed tasks, and mock exam scores are saved securely to your browser's `localStorage`.

---
<img width="1434" height="667" alt="Screenshot 2026-03-24 at 7 41 15 PM" src="https://github.com/user-attachments/assets/080f4156-6b30-4e17-b968-785abb575332" />

<img width="1423" height="741" alt="Screenshot 2026-03-24 at 7 42 54 PM" src="https://github.com/user-attachments/assets/029e714d-8895-472d-b306-407c58f09de6" />

---

## Quick start (Web)

```bash
cd cble-tracker
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Build for production (Web)

```bash
npm run build
# Output in /dist — you can serve this directory with any static web server
```

---

## Build for Desktop (Windows .exe / Mac .app) using Tauri

You can easily wrap this web application into a native desktop application using Tauri.

### Prerequisites (Windows)

1. **Microsoft C++ Build Tools:** Download and install the [Build Tools for Visual Studio](https://visualstudio.microsoft.com/visual-cpp-build-tools/). Make sure to check "Desktop development with C++" during installation.
2. **WebView2:** Download and install the [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/#download-section) (if you are on Windows 11, this is usually pre-installed).
3. **Rust:** Download and run `rustup-init.exe` from [rust-lang.org](https://www.rust-lang.org/tools/install).
4. **Node.js:** Ensure you have Node.js installed.

### Prerequisites (Mac)

1. **Rust:** `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
2. **Xcode Command Line Tools:** Run `xcode-select --install` in your terminal.

### Step-by-Step Tutorial to Wrap with Tauri

1. **Install the Tauri CLI:**

   ```bash
   npm install -D @tauri-apps/cli
   ```

2. **Initialize Tauri in the project:**

   ```bash
   npx tauri init
   ```

   _When prompted, answer the questions:_
   - App name: `CBLE Tracker`
   - Window title: `The Long Game`
   - Web assets location: `../dist`
   - Dev server URL: `http://localhost:5173`
   - Dev command: `npm run dev`
   - Build command: `npm run build`

3. **Run in Development Mode (Native Window):**
   This will start the Vite server and open the native Tauri desktop window.

   ```bash
   npx tauri dev
   ```

4. **Build the Final Executable:**
   This command will compile the React app and package it into a native installer.
   ```bash
   npx tauri build
   ```

   - **On Windows:** The output will be an `.msi` or `.exe` installer located in `src-tauri/target/release/bundle/msi/`.
   - **On Mac:** The output will be a `.dmg` or `.app` located in `src-tauri/target/release/bundle/macos/`.

---

## Mock Exam Format

To use the Mock Exam feature, create a `.txt` file using the following format. The first line must be your exam code. Prefix the correct option with an asterisk `*`.

```text
LOM_1

1. Which of the following is a cataloging standard?
*A. AACR2
B. HTML
C. SQL
D. ISBN

2. The Dewey Decimal System classifies by?
A. Author name
*B. Subject
C. Publication year
D. Country
```

---

## Fonts

Uses Google Fonts (Instrument Serif + DM Sans).
For offline/Tauri use, download and bundle the fonts locally:

- https://fonts.google.com/specimen/Instrument+Serif
- https://fonts.google.com/specimen/DM+Sans
