// ───────────────────────── live demo: Run-knoppen, status, auto-opruimen ─────────────────────────
const IDLE_MIN = 10;   // client: na 10 min zonder interactie op een demo-slide → opruimen
const POLL_MS = 4000;

// demo-sleutel: via ?key=... (presenter-link) of via de knop "Sleutel". Lokaal onthouden.
const store = {
  get() { try { return localStorage.getItem('demoKey') || ''; } catch { return ''; } },
  set(v) { try { localStorage.setItem('demoKey', v); } catch { /* privé-venster */ } },
};
let KEY = store.get();
const qs = new URLSearchParams(location.search);
if (qs.get('key')) {
  KEY = qs.get('key'); store.set(KEY);
  history.replaceState(null, '', location.pathname + location.hash); // sleutel uit de adresbalk
}

const dlg = document.getElementById('keydlg');
const keyInput = document.getElementById('keyinput');
document.getElementById('btn-key').addEventListener('click', () => { keyInput.value = KEY; dlg.classList.add('on'); keyInput.focus(); });
document.getElementById('keycancel').addEventListener('click', () => dlg.classList.remove('on'));
dlg.querySelector('form').addEventListener('submit', e => {
  e.preventDefault(); KEY = keyInput.value.trim(); store.set(KEY); dlg.classList.remove('on'); refresh();
});

async function api(action, body = {}) {
  const r = await fetch(`/api/${action}`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-demo-key': KEY }, body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}

const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const isDemo = s => !!s && s.hasAttribute('data-demo');

function log(slide, html) {
  const t = slide.querySelector('.term');
  t.innerHTML += html + '\n';
  t.scrollTop = t.scrollHeight;
}

// ───── kopieerknop op elk codeblok
document.querySelectorAll('pre.code').forEach(pre => {
  const b = document.createElement('button');
  b.className = 'copy'; b.textContent = 'Kopieer';
  b.addEventListener('click', async () => {
    const text = pre.firstChild.textContent;
    try { await navigator.clipboard.writeText(text); b.textContent = 'Gekopieerd'; } catch { b.textContent = 'Niet gelukt'; }
    setTimeout(() => { b.textContent = 'Kopieer'; }, 1500);
  });
  pre.appendChild(b);
});

// ───── Run-knoppen
document.querySelectorAll('[data-run]').forEach(btn => btn.addEventListener('click', async () => {
  const slide = btn.closest('.slide');
  const box = btn.closest('.actions');
  if (!KEY) { log(slide, '<span class="err">Geen demo-sleutel. Klik rechtsonder op "Sleutel".</span>'); return; }
  const action = btn.dataset.run;
  // bevestigen in de pagina zelf (browser-pop-ups zijn onzichtbaar in volledig scherm)
  if (action === 'cleanup' && !btn.dataset.armed) {
    const label = btn.textContent;
    btn.dataset.armed = '1'; btn.textContent = 'Zeker? Klik nogmaals om te verwijderen';
    btn.classList.add('armed');
    setTimeout(() => { delete btn.dataset.armed; btn.textContent = label; btn.classList.remove('armed'); }, 4000);
    return;
  }
  if (action === 'cleanup') { delete btn.dataset.armed; btn.classList.remove('armed'); btn.textContent = 'Alles verwijderen'; }
  btn.disabled = true; box.classList.add('busy');
  touch();
  const t0 = performance.now();
  try {
    const res = await api(action, { step: btn.dataset.step });
    log(slide, `<span class="cmd">$ ${esc(res.cmd)}</span>`);
    let out = res.output, ok = true;
    if (res.commandId) {                       // SSM: wachten op de uitvoer van de instance
      let st;
      do {
        await sleep(1200);
        st = await api('output', { commandId: res.commandId, instanceId: res.instanceId });
      } while (['Pending', 'InProgress', 'Delayed'].includes(st.status));
      ok = st.status === 'Success';
      out = st.output + (ok ? '' : `\n[${st.status}]`);
    }
    if (out) log(slide, esc(out));
    log(slide, `<span class="${ok ? 'ok' : 'err'} timing">${ok ? '✓' : '✗'} ${((performance.now() - t0) / 1000).toFixed(1)} s</span>\n`);
  } catch (e) {
    log(slide, `<span class="err">✗ ${esc(e.message)}</span>\n`);
  } finally {
    btn.disabled = false; box.classList.remove('busy');
    refresh();
  }
}));

// ───── live statusbalk (ook zichtbaar in kijkmodus)
let state = null;
const PRICE = { t3micro: 0.012 + 0.005, gp3GbHour: 0.0952 / 730 };   // $/uur eu-central-1 (t3.micro + publiek IPv4)
const age = t => (state ? (new Date(state.now) - new Date(t)) / 60000 : 0);
const pill = (icon, html, cls = '') => `<span class="pill ${cls}"><img src="icons/${icon}.svg" alt="">${html}</span>`;

function render() {
  const bars = document.querySelectorAll('.live');
  if (!state) return;
  const { instance: i, volume: v, snapshots: snaps } = state;
  let cost = 0, oldest = 0;
  const parts = [];
  if (i) {
    const a = age(i.launched); oldest = Math.max(oldest, a);
    cost += a / 60 * (PRICE.t3micro + 8 * PRICE.gp3GbHour);
    parts.push(pill('res-instance', `<b>${i.id}</b> ${i.state} · ${i.az}${i.ssm ? ' · SSM ' + i.ssm : ''}`));
  } else parts.push(pill('res-instance', 'geen instance', 'none'));
  if (v) {
    const a = age(v.created); oldest = Math.max(oldest, a);
    cost += a / 60 * v.size * PRICE.gp3GbHour;
    const m = v.modification && v.state !== 'deleting' ? ` · ${v.modification.state}${v.modification.progress != null ? ' ' + v.modification.progress + '%' : ''}` : '';
    parts.push(pill('res-gp3', `<b>${v.id}</b> ${v.size} GiB · ${v.iops} IOPS · ${v.state}${m}`));
  } else parts.push(pill('res-gp3', 'geen volume', 'none'));
  snaps.forEach(s => parts.push(pill('res-snapshot', `<b>${s.id}</b> ${s.state} ${s.progress || ''}`)));
  if (i || v || snaps.length) {
    const left = Math.max(0, state.maxAgeMin - oldest);
    parts.push(`<span class="pill cost">auto-delete over ${left.toFixed(0)} min · ≈ $${cost.toFixed(4)}</span>`);
  }
  if (!KEY) parts.push('<span class="pill none">kijkmodus</span>');
  bars.forEach(b => { b.innerHTML = parts.join(''); });
  renderArch(cost, oldest);
}

// ───── architectuurschema met echte data
const setF = (name, text) => document.querySelectorAll(`#arch [data-f="${name}"]`).forEach(el => { el.textContent = text ?? ''; });
const hhmm = t => new Date(t).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
function renderArch(cost, oldest) {
  if (!state) return;
  const { instance: i, volume: v, root: r, snapshots: snaps, infra = {} } = state;
  const exists = { instance: !!i, volume: !!v, snapshot: snaps.length > 0 };
  document.querySelectorAll('#arch .res').forEach(g => {
    const on = exists[g.dataset.res];
    g.classList.toggle('live', on); g.classList.toggle('off', !on);
  });
  setF('fn', infra.function ? `${infra.function} · ${infra.region}` : '');
  setF('subnet', infra.subnet ? `Public subnet · ${infra.subnet}` : 'Public subnet (default)');
  setF('sg', infra.sg ? `Security group ${infra.sg} · geen inbound` : 'Security group · geen inbound');
  if (i) {
    setF('inst1', i.id);
    setF('inst2', `${i.state}${i.ssm ? ' · SSM ' + i.ssm : ''}`);
    setF('inst3', `${i.az}${i.ip ? ' · ' + i.ip : ''}`);
  } else { setF('inst1', 'niet actief'); setF('inst2', infra.ami ? `AMI ${infra.ami}` : ''); setF('inst3', ''); }
  setF('root0', r ? `root · ${r.type} ${r.size} GiB` : 'root · gp3 8 GB');
  setF('root1', r ? `${r.id} · ${r.state}` : '');
  if (v) {
    const m = v.state === 'deleting' ? null : v.modification;
    setF('vol0', `data · ${v.type} ${v.size} GiB`);
    setF('vol1', v.id);
    setF('vol2', `${v.iops} IOPS · ${v.throughput} MiB/s`);
    setF('vol3', `${v.state}${v.encrypted ? ' · versleuteld' : ' · niet versleuteld'}`);
    setF('vol4', m ? `wijziging: ${m.state}${m.progress != null ? ' ' + m.progress + '%' : ''}` : '');
  } else { setF('vol0', 'data · gp3 5→10 GB'); setF('vol1', 'niet aangemaakt'); ['vol2', 'vol3', 'vol4'].forEach(f => setF(f, '')); }
  setF('snap', snaps.length
    ? snaps.map(s => `${s.id} · ${s.state}${s.progress ? ' ' + s.progress : ''}`).join('   ')
    : 'nog geen snapshot');
  const live = document.getElementById('arch-live');
  if (live) {
    const any = i || v || snaps.length;
    live.innerHTML = `<b>Live</b> · bijgewerkt ${hhmm(state.now)}`
      + (any ? ` · demo-resources: ${[i && 'instance', v && 'volume', snaps.length && `${snaps.length} snapshot`].filter(Boolean).join(', ')}`
        + ` · auto-delete over ${Math.max(0, state.maxAgeMin - oldest).toFixed(0)} min · kost tot nu ≈ $${cost.toFixed(4)}`
        : ' · geen demo-resources actief (enkel de serverless website draait)');
  }
}

async function refresh() {
  try { state = await api('status'); } catch (e) {
    document.querySelectorAll('.live').forEach(b => { b.innerHTML = `<span class="pill none">status: ${esc(e.message)}</span>`; });
    return;
  }
  render();
}

const hasResources = () => !!state && !!(state.instance || state.volume || state.snapshots.length);

let poll = null;
function startPoll() { if (!poll) { refresh(); poll = setInterval(refresh, POLL_MS); } }
function stopPoll() { clearInterval(poll); poll = null; }

// ───── auto-opruimen (enkel de presentator heeft een sleutel)
async function autoCleanup(reason) {
  if (!KEY) return;
  if (!state) await refresh();
  if (!hasResources()) return;
  const demoSlide = document.querySelector('.slide[data-demo]');
  log(demoSlide, `<span class="info">automatisch opruimen (${reason})…</span>`);
  try { const r = await api('cleanup'); log(demoSlide, esc(r.output || 'niets te doen')); } catch { /* reaper vangt het op */ }
  state = null;
}

// demo verlaten → alles weg
document.addEventListener('slidechange', e => {
  const { from, to, slide } = e.detail;
  const all = document.querySelectorAll('.slide');
  if (isDemo(slide)) startPoll();
  else { stopPoll(); if (isDemo(all[from]) && !isDemo(all[to])) autoCleanup('demo verlaten'); }
});
if (isDemo(document.querySelector('.slide.active'))) startPoll();

// architectuurschema open → ook buiten de demo-slides live status ophalen
document.addEventListener('archtoggle', e => {
  if (e.detail.open) startPoll();
  else if (!isDemo(document.querySelector('.slide.active'))) stopPoll();
});

// inactief op een demo-slide → alles weg
let lastTouch = Date.now();
function touch() { lastTouch = Date.now(); }
['keydown', 'click', 'mousemove'].forEach(ev => addEventListener(ev, touch, { passive: true }));
setInterval(() => {
  if (poll && Date.now() - lastTouch > IDLE_MIN * 60000) { touch(); autoCleanup(`${IDLE_MIN} min inactief`); }
}, 30000);

// tab sluiten → beacon (de server-reaper is het laatste vangnet)
addEventListener('pagehide', () => {
  if (KEY && hasResources()) {
    navigator.sendBeacon('/api/cleanup', new Blob([JSON.stringify({ key: KEY })], { type: 'application/json' }));
  }
});

// ───── demo-log als tekst (commando's + uitvoer als tekstbestand)
document.getElementById('btn-log').addEventListener('click', () => {
  const parts = [...document.querySelectorAll('.slide[data-demo]')].map(sl => {
    const h = sl.querySelector('h2').cloneNode(true); h.querySelectorAll('small').forEach(x => x.remove());
    const step = sl.querySelector('h2 small')?.textContent || '';
    const t = sl.querySelector('.term').cloneNode(true);
    t.querySelectorAll('.err, .timing, .info').forEach(x => x.remove());
    const out = t.textContent.replace(/\n{3,}/g, '\n\n').trim();
    return `===== ${step} · ${h.textContent.trim()} =====\n${out || '(niet uitgevoerd)'}\n`;
  });
  const head = `EBS-demo · eu-central-1 · ${new Date().toLocaleString('nl-BE')}\n`
    + `De aws-regels zijn de equivalente AWS CLI-commando's, uitgevoerd via een Lambda-functie met de AWS SDK (boto3).\n`
    + `De commando's op de instance liepen via SSM Run Command.\n\n`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([head + parts.join('\n')], { type: 'text/plain' }));
  a.download = 'ebs-demo-log.txt';
  a.click();
  URL.revokeObjectURL(a.href);
});
