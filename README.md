# CBLEL PREP-Companion

A daily routine, checklist, and Pomodoro app for the upcoming Computer Based Licensure Examination for Librarians (CBLEL).

I hope this apps help you to keep you focused, disciplined, and on track.

---

## Features

- **Customizable Onboarding:** Set your name, reorder the 6 CBLE subjects, and define your custom study cycle (e.g., 6 days per subject) and active study days.
  ![1](https://github.com/user-attachments/assets/f040ae8d-82bb-4ee2-ae8d-a7ce3f45b6b6)

- **Dynamic Daily Checklist:** Automatically generates a daily routine based on your assigned subject for the week. The checklist is a _prescription_—you can freely remove items or add your own custom tasks to fit your actual day.
  ![2](https://github.com/user-attachments/assets/a4f04a68-59ec-4897-8df2-12b79114b46d)

- **Pomodoro Timer:** A built-in, floating 25/5 Pomodoro timer to help you maintain focus during study blocks.
  ![3](https://github.com/user-attachments/assets/65873a74-9968-4404-bc0a-6131ad1fdce6)

- **Mock Exams:** Take full timed exams or immediate-feedback sessions. Upload your own `.txt` question banks.
  ![4](https://github.com/user-attachments/assets/3d5a0297-d9b5-4be0-98a5-5d29fb6c36e2)

- **Dashboard & Progress:** Track your study streak, days left until the exam, completion rates, and view a heat map of your recent mock exam scores.
  <img width="1424" height="743" alt="5" src="https://github.com/user-attachments/assets/daa0007d-8e85-4cb8-838c-35d91e3d4e91" />

- **Dark Mode:** Fully responsive dark mode for late-night review sessions.
  ![6](https://github.com/user-attachments/assets/0fecd999-b068-4edd-b772-7117cae818a8)

- **Persistent Storage:** All your progress, custom tasks, deleted prescribed tasks, and mock exam scores are saved securely to your browser's `localStorage`.

## For Developers

---

## Quick start (Web)

```bash
cd cble-tracker
npm install
npm run dev
```

Open `http://localhost:9326` in your browser.
Bonus if you can figure out the reason behind that port number :)

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
   - App name: `CBLEL Review Companion`
   - Window title: `CBLEL Review Companion`
   - Web assets location: `../dist`
   - Dev server URL: `http://localhost:9326`
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
