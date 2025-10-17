// Campus Pay web app logic

const state = {
  records: [],
  listings: [],
  chatHistory: [{ role: 'system', content: 'You are a helpful, general-purpose assistant for Campus Pay. Answer any question on any topic clearly and concisely.' }],
  model: 'llama3.1-8b',
  photoBlob: null,
};

function csvParse(text) {
  const out = [];
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return out;
  const start = lines[0].toLowerCase().includes('category,') ? 1 : 0;
  for (let i = start; i < lines.length; i++) {
    const cols = [];
    let cur = '';
    let inQ = false;
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      if (c === '"') inQ = !inQ;
      else if (c === ',' && !inQ) { cols.push(cur.trim().replace(/^\"|\"$/g, '')); cur = ''; }
      else cur += c;
    }
    cols.push(cur.trim().replace(/^\"|\"$/g, ''));
    if (cols.length >= 5) out.push({
      category: cols[0],
      condition: cols[1],
      title: cols[2],
      price: Number(cols[3]),
      platform: cols[4],
    });
  }
  return out;
}

async function loadSampleData() {
  try {
    const res = await fetch('data/sample_listings.csv');
    const txt = await res.text();
    state.records = csvParse(txt);
  } catch { state.records = []; }
}

function estimatePrice(category, condition, title, description) {
  const recs = state.records;
  const matches = recs.filter(r => r.category?.toLowerCase() === (category||'').toLowerCase() && r.condition?.toLowerCase() === (condition||'').toLowerCase());
  let base = avg(matches);
  if (Number.isNaN(base)) {
    const cat = recs.filter(r => r.category?.toLowerCase() === (category||'').toLowerCase());
    base = avg(cat);
  }
  if (Number.isNaN(base)) base = 100.0;
  const text = `${title||''} ${description||''}`.toLowerCase();
  if (text.includes('leather')) base *= 1.15;
  if (text.includes('solid wood') || text.includes('oak')) base *= 1.10;
  if (text.includes('scratches') || text.includes('worn')) base *= 0.85;
  if (text.includes('broken') || text.includes('damage')) base *= 0.70;
  return Math.max(10.0, Math.round(base * 100) / 100);
}

function avg(list) { if (!list.length) return NaN; return list.reduce((s,r)=>s+(r.price||0),0)/list.length; }

function avgByCategory() {
  const m = new Map();
  for (const r of state.records) {
    const key = r.category||'unknown';
    const a = m.get(key) || [0,0];
    a[0]+=r.price||0; a[1]+=1; m.set(key,a);
  }
  const out = []; for (const [k,[s,n]] of m.entries()) out.push([k, s/n]); return out;
}

function avgByPlatform(category) {
  const m = new Map();
  for (const r of state.records) {
    if (category && r.category?.toLowerCase() !== category.toLowerCase()) continue;
    const key = r.platform||'unknown';
    const a = m.get(key) || [0,0]; a[0]+=r.price||0; a[1]+=1; m.set(key,a);
  }
  const out = []; for (const [k,[s,n]] of m.entries()) out.push([k, s/n]); return out;
}

function localSearch(query) {
  const q = (query||'').toLowerCase();
  const out = [];
  for (const r of state.records) {
    const t = (r.title||'').toLowerCase();
    if (!q || t.includes(q) || q.includes((r.category||'').toLowerCase())) {
      out.push(`${r.category}: ${r.title} — $${(r.price||0).toFixed(2)} (${r.platform})`);
      if (out.length >= 6) break;
    }
  }
  if (!out.length) {
    out.push('No direct matches. Here are some sample prices:');
    for (let i=0;i<Math.min(5,state.records.length);i++) {
      const r = state.records[i];
      out.push(`${r.category}: ${r.title} — $${(r.price||0).toFixed(2)} (${r.platform})`);
    }
  }
  return out.join('\n');
}

async function callCerebras(messages, model) {
  try {
    const useModel = model || state.model || 'llama3.1-8b';
    const res = await fetch('/api/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ messages, model: useModel }) });
    if (res.status === 501) { return { mode: 'Local', text: null }; }
    if (!res.ok) throw new Error('AI error');
    const data = await res.json();
    return { mode: 'AI', text: data.text || '' };
  } catch {
    return { mode: 'Local', text: null };
  }
}

function appendChat(role, text) {
  const area = document.getElementById('chat-area');
  const div = document.createElement('div');
  div.className = `msg ${role==='user'?'me':'ai'}`;
  div.textContent = `${role==='user'?'You':'AI'}: ${text}`;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

function setMode(text) { document.getElementById('chat-mode').textContent = text; }

function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tab-body').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  }));
}

function setupPhotoPreview() {
  const input = document.getElementById('photo');
  const preview = document.getElementById('photo-preview');
  input.addEventListener('change', () => {
    const f = input.files && input.files[0];
    if (!f) { preview.innerHTML = ''; preview.classList.add('hidden'); state.photoBlob=null; return; }
    const url = URL.createObjectURL(f);
    state.photoBlob = f;
    preview.innerHTML = `<img src="${url}" alt="preview">`;
    preview.classList.remove('hidden');
  });
}

function setupCamera() {
  const openBtn = document.getElementById('camera-btn');
  const modal = document.getElementById('camera-modal');
  const video = document.getElementById('camera-video');
  const capBtn = document.getElementById('camera-capture');
  const cancelBtn = document.getElementById('camera-cancel');
  let stream = null;

  async function openCam() {
    try {
      modal.classList.remove('hidden');
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      video.srcObject = stream; await video.play();
    } catch (e) {
      alert('Camera access failed. Please allow camera permissions or use file upload.');
      modal.classList.add('hidden');
    }
  }
  function stop() { try { if (stream) stream.getTracks().forEach(t=>t.stop()); } catch {} stream = null; }
  function close() { stop(); modal.classList.add('hidden'); }

  if (openBtn) openBtn.addEventListener('click', openCam);
  if (cancelBtn) cancelBtn.addEventListener('click', close);
  if (capBtn) capBtn.addEventListener('click', async () => {
    try {
      const canvas = document.createElement('canvas');
      const w = video.videoWidth || 1280, h = video.videoHeight || 720;
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, w, h);
      canvas.toBlob((blob)=>{
        if (blob) {
          state.photoBlob = blob;
          const url = URL.createObjectURL(blob);
          const preview = document.getElementById('photo-preview');
          preview.innerHTML = `<img src="${url}" alt="preview">`;
          preview.classList.remove('hidden');
        }
        close();
      }, 'image/jpeg', 0.92);
    } catch { close(); }
  });
}

function renderListings(){
  const wrap = document.getElementById('listings');
  if (!wrap) return;
  wrap.innerHTML = '';
  for (const it of state.listings) {
    const card = document.createElement('div');
    card.className = 'card';
    const imgHtml = it.photo ? `<img src="${it.photo}" alt="${it.title}">` : `<div class="cover">No photo</div>`;
    card.innerHTML = `${imgHtml}
      <div class="body">
        <div class="meta">${it.category} • ${it.condition}</div>
        <div class="title" style="font-weight:700">${it.title}</div>
        <div class="price">$${it.estimate.toFixed(2)}</div>
        <div class="buy"><button data-id="${it.id}" class="buy-btn">Buy</button></div>
      </div>`;
    wrap.appendChild(card);
  }
  wrap.querySelectorAll('.buy-btn').forEach(btn=>btn.addEventListener('click',()=>{
    const id = btn.getAttribute('data-id');
    const it = state.listings.find(x=>x.id===id);
    if (it) openBuy(it);
  }));
}

function phoneDigits(p){ return String(p||'').replace(/\D+/g,''); }
function openBuy(it){
  const modal = document.getElementById('buy-modal');
  document.getElementById('buy-title').textContent = `Contact seller for: ${it.title}`;
  const phone = it.phone || '';
  document.getElementById('buy-phone').textContent = `Seller phone: ${phone}`;
  const digits = phoneDigits(phone);
  const text = encodeURIComponent(`Hi! I'm interested in '${it.title}' listed on Campus Pay.`);
  const call = document.getElementById('buy-call');
  const wa = document.getElementById('buy-wh');
  call.href = `tel:${digits}`;
  wa.href = `https://wa.me/${digits}?text=${text}`;
  modal.classList.remove('hidden');
  const close = document.getElementById('buy-close');
  close.onclick = ()=> modal.classList.add('hidden');
}

function setupListingForm() {
  document.getElementById('estimate-btn').addEventListener('click', () => {
    const category = document.getElementById('category').value;
    const condition = document.getElementById('condition').value;
    const title = document.getElementById('title').value;
    const description = document.getElementById('description').value;
    const est = estimatePrice(category, condition, title, description);
    const out = [];
    out.push(`Estimated price: $${est.toFixed(2)}`);
    const byPlatform = avgByPlatform(category).map(([k,v])=>`- ${k}: $${v.toFixed(2)}`).join('\n');
    if (byPlatform) {
      out.push('', 'By platform averages:', byPlatform);
    }
    const byCat = avgByCategory().map(([k,v])=>`- ${k}: $${v.toFixed(2)}`).join('\n');
    if (byCat) {
      out.push('', 'Category averages:', byCat);
    }
    document.getElementById('estimate-output').textContent = out.join('\n');
  });

  document.getElementById('listing-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('title').value.trim();
    const category = document.getElementById('category').value;
    const condition = document.getElementById('condition').value;
    const description = document.getElementById('description').value;
    const phone = document.getElementById('seller-phone').value.trim();
    if (!(title && phone)) return;
    const estimate = estimatePrice(category, condition, title, description);
    let photoUrl = null;
    if (state.photoBlob) { try { photoUrl = URL.createObjectURL(state.photoBlob); } catch {}
    }
    const id = Math.random().toString(36).slice(2);
    state.listings.unshift({ id, title, category, condition, estimate, phone, photo: photoUrl });
    renderListings();

    document.getElementById('market-output').textContent = `Listed '${title}'. (Stub — no persistence yet)`;
    e.target.reset();
    state.photoBlob = null;
    document.getElementById('photo-preview').innerHTML='';
    document.getElementById('photo-preview').classList.add('hidden');
  });
}

// Auth overlay (sign in / sign up)
function isValidEmail(email){ return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email); }
function setupAuth() {
  // tabs inside auth card
  const tabs = document.querySelectorAll('.a-tab');
  const bodies = document.querySelectorAll('.a-body');
  tabs.forEach(btn => btn.addEventListener('click', () => {
    tabs.forEach(b=>b.classList.remove('active'));
    bodies.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  }));

  const auth = document.getElementById('auth');
  const main = document.getElementById('main');
  const logout = document.getElementById('logout-btn');
  const msgEl = document.getElementById('auth-msg');
  function showMain(user){ auth.classList.add('hidden'); main.classList.remove('hidden'); logout.classList.remove('hidden'); if (msgEl) msgEl.classList.add('hidden'); }
  function showAuth(){ auth.classList.remove('hidden'); main.classList.add('hidden'); logout.classList.add('hidden'); }
  function msg(text, type='error'){ if(!msgEl) return; msgEl.textContent=text; msgEl.classList.remove('hidden','error','success'); msgEl.classList.add(type); }
  function clearMsg(){ if(msgEl) msgEl.classList.add('hidden'); }

  // sign in
  const si = document.getElementById('signin-form');
  if (si) si.addEventListener('submit',(e)=>{
    e.preventDefault();
    clearMsg();
    const emailEl = document.getElementById('signin-email');
    const email = emailEl.value.trim();
    const pass = document.getElementById('signin-pass').value.trim();
    if (!(email && pass)) { msg('Please enter email and password'); emailEl.classList.toggle('invalid', !email); return; }
    if (!isValidEmail(email)) { msg('Enter a valid email address'); emailEl.classList.add('invalid'); return; } else { emailEl.classList.remove('invalid'); }
    const name = email.split('@')[0];
    // In a real app, validate against server; here we just sign in.
    localStorage.setItem('cp_user', JSON.stringify({name,email}));
    showMain({name,email});
  });

  // sign up
  const su = document.getElementById('signup-form');
  if (su) su.addEventListener('submit',(e)=>{
    e.preventDefault();
    clearMsg();
    const name = document.getElementById('signup-name').value.trim();
    const username = (document.getElementById('signup-username')?.value || '').trim();
    const regno = (document.getElementById('signup-regno')?.value || '').trim();
    const emailEl = document.getElementById('signup-email');
    const email = emailEl.value.trim();
    const pass = document.getElementById('signup-pass').value.trim();
    if (!(name && username && regno && email && pass)) { msg('Please fill all fields'); emailEl.classList.toggle('invalid', !email); return; }
    if (!/^RA/i.test(regno)) { msg('Registration number must start with "RA"'); return; }
    if (!isValidEmail(email)) { msg('Enter a valid email address'); emailEl.classList.add('invalid'); return; } else { emailEl.classList.remove('invalid'); }
    localStorage.setItem('cp_user', JSON.stringify({name,username,regno,email}));
    msg('Account created. Welcome, ' + (username || name) + '!', 'success');
    showMain({name,username,regno,email});
  });

  // logout
  if (logout) logout.addEventListener('click', ()=>{ localStorage.removeItem('cp_user'); showAuth(); });

  // initial state
  try{
    const u = JSON.parse(localStorage.getItem('cp_user')||'null');
    if (u && u.email) showMain(u); else showAuth();
  }catch{ showAuth(); }
}

function setupChat() {
  async function send() {
    const input = document.getElementById('chat-text');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    appendChat('user', text);
    state.chatHistory.push({ role: 'user', content: text });
    // typing indicator
    const area = document.getElementById('chat-area');
    const typing = document.createElement('div');
    typing.className = 'msg ai typing';
    typing.textContent = 'AI is typing…';
    area.appendChild(typing); area.scrollTop = area.scrollHeight;

    const res = await callCerebras(state.chatHistory, state.model);
    if (res.mode === 'AI' && res.text) {
      setMode(`Mode: AI • ${state.model}`);
      area.removeChild(typing);
      appendChat('assistant', res.text);
      state.chatHistory.push({ role: 'assistant', content: res.text });
    } else {
      setMode('Mode: Local — set CEREBRAS_API_KEY to enable general AI answers');
      area.removeChild(typing);
      const fallback = localSearch(text);
      appendChat('assistant', fallback);
      state.chatHistory.push({ role: 'assistant', content: fallback });
    }
  }
  document.getElementById('chat-send').addEventListener('click', send);
  document.getElementById('chat-text').addEventListener('keydown', (e)=>{ if(e.key==='Enter') send(); });

  // quick chips
  const chips = document.getElementById('quick-chips');
  if (chips) chips.addEventListener('click', (e)=>{
    if (e.target.classList.contains('chip')) {
      document.getElementById('chat-text').value = e.target.textContent;
      send();
    }
  });

  // model select
  const ms = document.getElementById('model-select');
  if (ms) { ms.value = state.model; ms.addEventListener('change', ()=>{ state.model = ms.value; }); }
}

async function init() {
  setupPhotoPreview();
  setupListingForm();
  setupChat();
  setupAuth();
  setupCamera();
  await loadSampleData();
}

init();
