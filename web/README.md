# Campus Pay Web (Django backend)

A modern web app for listing campus marketplace items, estimating prices, chatting with an AI assistant (Cerebras), taking photos via camera, and contacting sellers directly (Call/WhatsApp).

This README explains how to install and run on Windows and macOS with a Python/Django backend.

---

## Prerequisites
- Node.js LTS (v18+ recommended; v20/22 LTS also fine)
- npm (comes with Node)

Optional for AI mode (general Q&A):
- Cerebras API key (CEREBRAS_API_KEY)

Directory of web app:
- server/cerebras-proxy.js (Express server + Cerebras proxy)
- web/ (static files: index.html, styles.css, app.js)
- package.json
- .env (you can create or edit)

---

## Quick start (all platforms)
1) Download/clone the project on the machine.
2) In a terminal, change to the project root (folder containing manage.py).
3) Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4) (Optional) Create a .env file to set port and AI key:
   ```dotenv
   PORT=3001
   CEREBRAS_API_KEY=your_cerebras_key_here
   ```
5) Start the server:
   ```bash
   python manage.py runserver 0.0.0.0:3001
   ```
6) Open the app in your browser:
   - http://localhost:3001 (or the port you set)
   - Health check: http://localhost:3001/health (shows { ok: true, ai: true/false })

If CEREBRAS_API_KEY is not set, the app runs in Local mode and answers only with sample marketplace data. To get general Q&A, set the key and select a model in the UI (e.g., Llama 3.1 70B).

---

## Windows (PowerShell)
- Install Python via winget:
  ```powershell
  winget install -e --id Python.Python.3.12 --accept-source-agreements --accept-package-agreements
  ```
- From the project folder:
  ```powershell
  pip install -r requirements.txt
  # Optional: set env vars for this session
  $env:PORT="3001"
  $env:CEREBRAS_API_KEY="YOUR_KEY_HERE"
  python manage.py runserver 0.0.0.0:3001
  ```
- Open http://localhost:3001

Stop the server:
```powershell
Get-CimInstance Win32_Process -Filter "name='node.exe'" | ? { $_.CommandLine -match 'server/cerebras-proxy\.js' } | % { Stop-Process -Id $_.ProcessId -Force }
```

---

## macOS (Terminal)
- Install Python 3 via Homebrew or installer:
  ```bash
  brew install python
  ```
- From the project folder:
  ```bash
  pip3 install -r requirements.txt
  # Optional per-session env vars
  export PORT=3001
  export CEREBRAS_API_KEY=YOUR_KEY_HERE
  python3 manage.py runserver 0.0.0.0:3001
  ```
- Open http://localhost:3001

Stop the server:
```bash
pkill -f server/cerebras-proxy.js || true
```

---

## Features
- Full-screen Sign in/Sign up overlay
- Create a listing with category, condition, title, description, seller phone
- Camera support: capture a photo directly (or upload a file)
- Price estimate from sample data + heuristics
- “Latest Listings” grid with Buy action
  - Buy opens modal with Call (tel:) and WhatsApp links to the seller phone
- Assistant chat with model selector (Local fallback without key; AI mode with Cerebras)

---

## Configuration
- .env file (recommended):
  ```dotenv
  PORT=3001
  CEREBRAS_API_KEY=your_cerebras_key_here
  # CEREBRAS_API_URL can be overridden, default: https://api.cerebras.ai/v1/chat/completions
  ```
- Never commit real API keys to version control.

---

## Troubleshooting
- Port already in use: change PORT in .env or export a different one.
- npm not found: ensure Node.js installation is on PATH; reopen your terminal after install.
- Health shows ai:false: the server didn’t see CEREBRAS_API_KEY. Set it in .env or export it in the same terminal before npm start.
- Camera doesn’t open:
  - Allow camera permissions in the browser (Chrome/Edge/Safari settings)
  - Some browsers block camera on file:// — run via http://localhost using npm start (as described)
- WhatsApp link doesn’t work on desktop: make sure WhatsApp Desktop/Web is installed/signed in; on mobile devices tel:/wa.me links work natively.

---

## Notes
- This is a prototype. Listings are not persisted; images are kept in-memory/URL blobs per session.
- The Cerebras proxy keeps your API key on the server side; do not expose your key directly in the browser.
