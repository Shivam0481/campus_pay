import os
import json
import mimetypes
from pathlib import Path
import requests
from django.http import JsonResponse, HttpResponse, FileResponse
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt

WEB_DIR = Path(getattr(settings, 'WEB_DIR', Path(__file__).resolve().parent.parent / 'web'))


def health(request):
    return JsonResponse({
        'ok': True,
        'ai': bool(os.getenv('CEREBRAS_API_KEY')),
    })


@csrf_exempt
def api_chat(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    api_key = os.getenv('CEREBRAS_API_KEY')
    if not api_key:
        return JsonResponse({'error': 'AI not configured'}, status=501)
    try:
        data = json.loads(request.body.decode('utf-8') or '{}')
    except Exception:
        data = {}
    messages = data.get('messages', [])
    model = data.get('model', 'llama3.1-8b')
    url = os.getenv('CEREBRAS_API_URL', 'https://api.cerebras.ai/v1/chat/completions')
    try:
        r = requests.post(url, headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}, json={
            'model': model,
            'messages': messages,
            'temperature': 0.3,
            'max_tokens': 512,
        }, timeout=60)
        j = r.json()
        if not r.ok:
            return JsonResponse({'error': j.get('error', j)}, status=r.status_code)
        text = (
            (j.get('choices') or [{}])[0].get('message', {}).get('content')
            or (j.get('choices') or [{}])[0].get('text')
            or ''
        )
        return JsonResponse({'text': text, 'provider': 'cerebras', 'model': model})
    except requests.RequestException:
        return JsonResponse({'error': 'Chat proxy error'}, status=500)


def _safe_path(rel: str) -> Path:
    rel = rel.lstrip('/')
    p = (WEB_DIR / rel).resolve()
    if WEB_DIR in p.parents or p == WEB_DIR:
        return p
    return WEB_DIR / 'index.html'


def serve_web(request, path=''):
    target = _safe_path(path or 'index.html')
    if target.is_dir():
        target = target / 'index.html'
    if not target.exists():
        # SPA fallback to index.html
        target = WEB_DIR / 'index.html'
    ctype, _ = mimetypes.guess_type(str(target))
    if not ctype:
        ctype = 'application/octet-stream'
    try:
        return FileResponse(open(target, 'rb'), content_type=ctype)
    except FileNotFoundError:
        return HttpResponse('Not found', status=404)
