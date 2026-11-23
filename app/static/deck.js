// ───────────────────────── slide deck engine ─────────────────────────
const stage = document.getElementById('stage');
const slides = [...document.querySelectorAll('.slide')];
const counter = document.getElementById('counter');
const progress = document.getElementById('progress');
let idx = 0;

function fit() {
  const s = Math.min(innerWidth / 1600, innerHeight / 900);
  stage.style.transform = `translate(-50%,-50%) scale(${s})`;
}
addEventListener('resize', fit); fit();

function show(i, { fromBack = false } = {}) {
  const prev = idx;
  idx = Math.max(0, Math.min(slides.length - 1, i));
  slides.forEach((s, n) => {
    s.classList.toggle('active', n === idx);
    s.classList.toggle('past', n < idx);
  });
  // fragments: bij terugkeren alles tonen, anders alles verbergen
  slides[idx].querySelectorAll('.fade').forEach(f => f.classList.toggle('on', fromBack));
  counter.textContent = `${idx + 1} / ${slides.length}`;
  document.getElementById('nav-prev').disabled = idx === 0 && !slides[0].querySelector('.fade.on');
  document.getElementById('nav-next').disabled = idx === slides.length - 1 && !slides[idx].querySelector('.fade:not(.on)');
  progress.style.width = `${((idx + 1) / slides.length) * 100}%`;
  history.replaceState(null, '', `#${idx + 1}`);
  document.dispatchEvent(new CustomEvent('slidechange', { detail: { from: prev, to: idx, slide: slides[idx] } }));
}

function next() {
  const hidden = slides[idx].querySelector('.fade:not(.on)');
  if (hidden) hidden.classList.add('on');
  else show(idx + 1);
}
function prev() {
  const shown = [...slides[idx].querySelectorAll('.fade.on')].pop();
  if (shown) shown.classList.remove('on');
  else show(idx - 1, { fromBack: true });
}

document.addEventListener('keydown', e => {
  if (e.target.closest('input, #keydlg') || document.querySelector('#arch.on, #gloss-deep.on')) return;
  if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); next(); }
  else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); prev(); }
  else if (e.key === 'Home') show(0);
  else if (e.key === 'End') show(slides.length - 1);
  else if (e.key.toLowerCase() === 'f') fullscreen();
  else if (e.key.toLowerCase() === 'p') window.print();
});

// swipe op touch
let tx = null;
addEventListener('touchstart', e => { tx = e.touches[0].clientX; });
addEventListener('touchend', e => {
  if (tx === null) return;
  const dx = e.changedTouches[0].clientX - tx; tx = null;
  if (Math.abs(dx) > 50) dx < 0 ? next() : prev();
});

show((parseInt(location.hash.slice(1), 10) || 1) - 1, { fromBack: true });

// ───────────────────────── slide 3: storage-kaarten ─────────────────────────
const KINDS = {
  block: `<h3>Block storage</h3><p>Data wordt opgeknipt in <b>blokken van vaste grootte</b>, elk met een adres.
    Het OS ziet een ruwe schijf en zet er zelf een filesystem op (xfs, ext4, NTFS).
    Een wijziging herschrijft enkel de <b>gewijzigde blokken</b> → laagste latency.</p>
    <p class="muted">Databases · boot-schijven · ERP · stateful containers → <b>Amazon EBS</b></p>`,
  file: `<h3>File storage</h3><p>Bestanden in een <b>hiërarchie van mappen</b>, gedeeld via NFS of SMB.
    Meerdere servers en gebruikers kunnen <b>tegelijk</b> aan dezelfde bestanden.</p>
    <p class="muted">Gedeelde schijven · webservers met gedeelde uploads · legacy apps → <b>Amazon EFS / FSx</b></p>`,
  object: `<h3>Object storage</h3><p>Elk bestand is een <b>object</b>: data + unieke key + uitgebreide metadata, in een platte bucket.
    Toegang via een <b>HTTPS API</b>, vrijwel onbeperkt schaalbaar en goedkoop.</p>
    <p class="muted">Back-ups · media · data lakes · archief → <b>Amazon S3</b></p>`,
};
const kindDetail = document.getElementById('kind-detail');
document.querySelectorAll('.pick').forEach(c => c.addEventListener('click', () => {
  document.querySelectorAll('.pick').forEach(x => x.classList.toggle('sel', x === c));
  kindDetail.innerHTML = KINDS[c.dataset.kind];
}));
kindDetail.innerHTML = KINDS.block;

// ───────────────────────── slide 5: diagram in stappen ─────────────────────────
const DTEXT_DEFAULT = 'Een EBS-volume is een netwerkschijf in <b>één AZ</b>. Een snapshot is regionaal: zo verhuis je data naar een andere AZ of regio.';
const DTEXT = [
  'Een EBS-volume is een netwerkschijf in <b>één AZ</b>. Een snapshot is regionaal: zo verhuis je data naar een andere AZ of regio.',
  'Het volume hangt via het netwerk aan de EC2-instance en kan enkel gekoppeld worden aan een instance in <b>dezelfde AZ</b>.',
  'Instance store zit <b>fysiek in de host</b>. Supersnel, maar de data is weg bij stop, hibernate of terminate.',
  'Een snapshot kopieert de blokken naar S3 en is daarna beschikbaar in <b>de hele regio</b>. Volgende snapshots zijn incrementeel.',
  'Uit de snapshot maak je een <b>nieuw volume in een andere AZ</b>, of je kopieert hem naar een andere regio.',
];
document.querySelectorAll('[data-d]').forEach(b => b.addEventListener('click', () => {
  const d = b.dataset.d;
  document.querySelectorAll('[data-d]').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('#diagram-slide .box').forEach(g => {
    g.classList.toggle('dim', d !== '0' && !g.dataset.g.split(' ').includes(d));
  });
  document.getElementById('diagram-text').innerHTML = DTEXT[d];
}));

// ───────────────────────── slide 7: gp2 vs gp3 calculator ─────────────────────────
// Prijzen eu-central-1 (AWS Price List API, 23/11/2026)
const P = { gp2: 0.119, gp3: 0.0952, gp3Iops: 0.006 };
const eur = n => '$' + n.toFixed(2).replace('.', ',');
function calc() {
  const size = +document.getElementById('c-size').value;
  const iops = +document.getElementById('c-iops').value;
  // gp2: 3 IOPS per GiB, min 100, max 16.000 -> grootte opdrijven tot de IOPS gehaald worden
  const gp2Size = Math.max(size, Math.ceil(iops / 3));
  const gp2 = gp2Size * P.gp2;
  // gp3: max. 500 IOPS per GiB -> eventueel groter volume nodig
  const gp3Size = Math.max(size, Math.ceil(iops / 500));
  const gp3 = gp3Size * P.gp3 + Math.max(0, iops - 3000) * P.gp3Iops;
  document.getElementById('c-size-v').textContent = `${size} GiB`;
  document.getElementById('c-iops-v').textContent = iops.toLocaleString('nl-BE');
  document.getElementById('c-gp2').textContent = eur(gp2) + '/mnd';
  document.getElementById('c-gp3').textContent = eur(gp3) + '/mnd';
  document.getElementById('c-gp2-d').textContent = gp2Size > size
    ? `je moet ${gp2Size} GiB kopen om ${iops} IOPS te halen` : `${gp2Size} GiB × $0,119`;
  document.getElementById('c-gp3-d').textContent = `${gp3Size} GiB × $0,0952` + (iops > 3000 ? ` + ${iops - 3000} IOPS × $0,006` : ' · 3.000 IOPS inbegrepen')
    + (gp3Size > size ? ` (min. ${gp3Size} GiB voor ${iops} IOPS)` : '');
  const max = Math.max(gp2, gp3);
  document.getElementById('c-gp2-b').style.width = (gp2 / max * 100) + '%';
  document.getElementById('c-gp3-b').style.width = (gp3 / max * 100) + '%';
  const save = (1 - gp3 / gp2) * 100;
  document.getElementById('c-save').innerHTML = save > 0
    ? `gp3 is <b class="acc">${save.toFixed(0)}% goedkoper</b>` : `gp2 is hier ${(-save).toFixed(0)}% goedkoper`;
}
['c-size', 'c-iops'].forEach(id => document.getElementById(id).addEventListener('input', calc));
calc();

// ───────────────────────── slide 11: instance-store simulator ─────────────────────────
const SIM = {
  reboot: [true, true, 'Reboot: de instance blijft op dezelfde host → instance store blijft bewaard.'],
  stop: [true, false, 'Stop/start: de instance start op een andere host → instance store is gewist.'],
  hibernate: [true, false, 'Hibernate: RAM gaat naar het EBS-root-volume, instance-store-data gaat verloren.'],
  terminate: [false, false, 'Terminate: instance store weg. EBS-volumes met DeleteOnTermination=true ook (standaard voor root).'],
  fail: [true, false, 'Defecte schijf in de host: instance store heeft geen replicatie. EBS is gerepliceerd binnen de AZ.'],
};
function setDisk(el, ok, txt) {
  el.classList.toggle('lost', !ok); el.classList.toggle('kept', ok);
  el.querySelector('.state').textContent = txt ?? (ok ? 'data OK' : 'data WEG');
}
document.querySelectorAll('[data-sim]').forEach(b => b.addEventListener('click', () => {
  const ebs = document.getElementById('sim-ebs'), is = document.getElementById('sim-is');
  if (b.dataset.sim === 'reset') { setDisk(ebs, true); setDisk(is, true); document.getElementById('sim-text').textContent = ''; return; }
  const [e, i, t] = SIM[b.dataset.sim];
  setDisk(ebs, e, e ? 'data OK' : 'verwijderd*'); setDisk(is, i);
  document.getElementById('sim-text').textContent = t;
}));
document.getElementById('diagram-text').innerHTML = DTEXT_DEFAULT;

// sneltoetsen-hint na 6 s verbergen (overlapt anders met de footer)
setTimeout(() => document.getElementById('keybar').style.display = 'none', 6000);

// ───────────────────────── bediening met de muis ─────────────────────────
const fullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
document.getElementById('nav-prev').addEventListener('click', prev);
document.getElementById('nav-next').addEventListener('click', next);
document.getElementById('nav-full').addEventListener('click', fullscreen);
document.addEventListener('fullscreenchange', () => {
  document.getElementById('nav-full').textContent = document.fullscreenElement ? 'Venster' : 'Volledig scherm';
});

// ───────────────────────── architectuur-overlay ─────────────────────────
const arch = document.getElementById('arch');
function toggleArch(open = !arch.classList.contains('on')) {
  arch.classList.toggle('on', open);
  arch.setAttribute('aria-hidden', String(!open));
  document.dispatchEvent(new CustomEvent('archtoggle', { detail: { open } }));
}
document.getElementById('btn-arch').addEventListener('click', () => toggleArch());
document.getElementById('arch-close').addEventListener('click', () => toggleArch(false));
arch.addEventListener('click', e => { if (e.target === arch) toggleArch(false); });
document.querySelectorAll('.arch-tabs button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.arch-tabs button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('.arch-tab').forEach(t => t.classList.toggle('on', t.dataset.tab === b.dataset.tab));
}));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && arch.classList.contains('on')) toggleArch(false);
  else if (e.key.toLowerCase() === 'a' && !e.target.closest('input')) toggleArch();
}, true);

// ───────────────────────── muis stil → knoppen en onderlijning verbergen ─────────────────────────
let idleTimer = null;
function wake() {
  document.body.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => document.body.classList.add('idle'), 3000);
}
['mousemove', 'mousedown', 'touchstart', 'wheel'].forEach(ev => addEventListener(ev, wake, { passive: true }));
wake();
