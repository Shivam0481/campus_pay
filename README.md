# Campus Pay Web

Modern web version of Campus Pay — list items with photos (camera upload supported), get price estimates from sample marketplace data, chat with an AI assistant (Cerebras), and contact sellers directly via Call/WhatsApp.

Important paths:
- server/cerebras-proxy.js (Express web server + Cerebras proxy)
- web/ (static site: index.html, styles.css, app.js, data/)
- web/README.md (full install and run instructions for Windows and macOS)

Quick start (Django):
```bash
# Install Python 3.12+
pip install -r requirements.txt

# Run the Django dev server on port 3001
python manage.py runserver 0.0.0.0:3001
# open http://localhost:3001
```

Enable AI (general Q&A): set CEREBRAS_API_KEY in .env then restart the Django server.
