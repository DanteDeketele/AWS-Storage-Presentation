// ───────────────────────── sprekersnotities ─────────────────────────
// 1) Notities-balk onderaan (knop "Notities" of toets N): handig met één scherm.
// 2) Presentatorvenster (knop "Presentator"): apart venster met notities, volgende slide en timer,
//    voor op je laptop terwijl de slides op de beamer staan.
const notesBar = document.getElementById('notes-bar');
const allSlides = [...document.querySelectorAll('#stage .slide')];
let presenterWin = null;
let timerStart = Date.now();

const titleOf = s => {
  const h = s?.querySelector('h1, h2'); if (!h) return '';
  const c = h.cloneNode(true); c.querySelectorAll('small').forEach(x => x.remove());   // kicker weglaten
  return c.textContent.replace(/\s+/g, ' ').trim();
};
const notesOf = s => s?.querySelector('aside.notes')?.innerHTML || '<p class="muted">Geen notities.</p>';
const curIdx = () => allSlides.findIndex(s => s.classList.contains('active'));

function renderNotes() {
  const i = curIdx(), s = allSlides[i];
  notesBar.querySelector('.nb-body').innerHTML = `<div class="nb-title">${i + 1}. ${titleOf(s)}</div>${notesOf(s)}`;
  renderPresenter();
}

// kopie van een slide in het presentatorvenster (1600x900, geschaald naar het kader)
function previewInto(box, slide, allFragments) {
  box.innerHTML = '';
  if (!slide) { box.innerHTML = '<div class="p-end">Einde van de presentatie</div>'; return; }
  const c = slide.cloneNode(true);
  c.classList.add('active'); c.classList.remove('past');
  c.removeAttribute('id');
  c.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
  if (allFragments) c.querySelectorAll('.fade').forEach(f => f.classList.add('on'));
  c.style.transition = 'none';
  const stageCopy = presenterWin.document.createElement('div');
  stageCopy.className = 'p-stage';
  stageCopy.appendChild(presenterWin.document.importNode(c, true));
  box.appendChild(stageCopy);
  stageCopy.style.transform = `scale(${box.clientWidth / 1600})`;
}

function renderPresenter() {
  if (!presenterWin || presenterWin.closed) return;
  const d = presenterWin.document, i = curIdx(), s = allSlides[i];
  d.getElementById('p-cur').textContent = `${i + 1} / ${allSlides.length} · ${titleOf(s)}`;
  d.getElementById('p-notes').innerHTML = notesOf(s);
  d.getElementById('p-next-title').textContent = allSlides[i + 1] ? `Volgende: ${titleOf(allSlides[i + 1])}` : 'Laatste slide';
  previewInto(d.getElementById('p-now'), s, false);
  previewInto(d.getElementById('p-nxt'), allSlides[i + 1], true);
}

function toggleNotes(open = !notesBar.classList.contains('on')) {
  notesBar.classList.toggle('on', open);
  document.getElementById('btn-notes').classList.toggle('on', open);
  renderNotes();
}

function openPresenter() {
  if (presenterWin && !presenterWin.closed) { presenterWin.focus(); return; }
  presenterWin = window.open('', 'ebs-presenter', 'width=1280,height=800');
  if (!presenterWin) { toggleNotes(true); return; }   // pop-up geblokkeerd → notities-balk
  const base = location.origin + location.pathname.replace(/[^/]*$/, '');
  presenterWin.document.write(`<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Presentator</title>
<base href="${base}"><link rel="stylesheet" href="style.css">
<style>
  html,body{overflow:hidden;height:100%}
  body{margin:0;background:#161e2d;color:#fff;display:grid;grid-template-rows:auto 1fr auto;height:100vh}
  header{display:flex;gap:12px;align-items:center;padding:10px 18px;border-bottom:4px solid #ff9900}
  #p-cur{font-weight:700;font-size:19px;flex:1}
  #p-timer{font:700 26px Consolas,monospace;color:#ff9900}
  #p-reset{font:600 13px Arial;padding:4px 10px;border-radius:12px;border:1px solid #8d99a8;background:none;color:#c6ccd3;cursor:pointer}
  .p-grid{display:grid;grid-template-columns:1.55fr 1fr;gap:16px;padding:16px 18px;min-height:0}
  .p-col{display:flex;flex-direction:column;gap:10px;min-height:0}
  .p-lbl{font:700 13px Arial;letter-spacing:.12em;text-transform:uppercase;color:#8d99a8}
  .p-box{position:relative;width:100%;aspect-ratio:16/9;overflow:hidden;border-radius:6px;background:#fff;box-shadow:0 4px 16px rgba(0,0,0,.4)}
  #p-now{outline:3px solid #ff9900;cursor:pointer}
  .p-stage{position:absolute;left:0;top:0;width:1600px;height:900px;transform-origin:0 0;pointer-events:none}
  .p-stage .slide{opacity:1!important;transform:none!important}
  .p-end{display:grid;place-items:center;height:100%;color:#545b64;font:700 18px Arial}
  #p-notes{flex:1;overflow:auto;background:#fff;color:#16191f;border-radius:6px;padding:14px 18px;font-size:19px;line-height:1.5}
  #p-notes p,#p-notes li{font-size:19px;margin:6px 0}
  #p-notes b{color:#232f3e} #p-notes .t{color:#ec7211;font-weight:700;font-size:16px}
  footer{display:flex;gap:12px;align-items:center;padding:10px 18px;background:#0f1623}
  #p-next-title{flex:1;color:#c6ccd3;font-size:16px}
  footer button{font:700 18px Arial;padding:10px 24px;border-radius:20px;border:2px solid #ff9900;background:#fff;color:#232f3e;cursor:pointer}
  footer button.go{background:#ff9900}
</style></head><body>
<header><span id="p-cur"></span><span id="p-timer">00:00</span><button id="p-reset">reset</button></header>
<div class="p-grid">
  <div class="p-col"><span class="p-lbl">Nu op het scherm · klik hier = klik op de presentatie</span><div class="p-box" id="p-now"></div></div>
  <div class="p-col"><span class="p-lbl">Volgende</span><div class="p-box" id="p-nxt"></div>
    <span class="p-lbl">Notities</span><div id="p-notes"></div></div>
</div>
<footer><span id="p-next-title"></span><button id="p-prev">‹ Vorige</button><button id="p-go" class="go">Volgende ›</button></footer>
</body></html>`);
  presenterWin.document.close();
  const d = presenterWin.document;
  wirePreview(d);
  d.getElementById('p-prev').onclick = () => prev();
  d.getElementById('p-go').onclick = () => next();
  d.getElementById('p-reset').onclick = () => { timerStart = Date.now(); };
  d.addEventListener('keydown', e => {
    if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); next(); }
    if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); prev(); }
  });
  presenterWin.addEventListener('resize', renderPresenter);
  // stylesheet moet geladen zijn voor de schaal klopt
  const link = d.querySelector('link[rel=stylesheet]');
  link.onload = renderPresenter;
  renderPresenter();
}

// fragmenten (.fade) en live-inhoud veranderen zonder slidechange → presentatorvenster volgen
let presTimer = null;
new MutationObserver(() => {
  if (!presenterWin || presenterWin.closed) return;
  clearTimeout(presTimer); presTimer = setTimeout(renderPresenter, 150);
}).observe(document.getElementById('stage'), { subtree: true, attributes: true, attributeFilter: ['class'], childList: true, characterData: true });

setInterval(() => {
  if (presenterWin && !presenterWin.closed) {
    const s = Math.floor((Date.now() - timerStart) / 1000);
    presenterWin.document.getElementById('p-timer').textContent =
      `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }
}, 1000);

document.getElementById('btn-notes').addEventListener('click', () => toggleNotes());
document.getElementById('btn-presenter').addEventListener('click', openPresenter);
notesBar.querySelector('.nb-close').addEventListener('click', () => toggleNotes(false));
document.addEventListener('slidechange', renderNotes);
document.addEventListener('keydown', e => {
  if (e.key.toLowerCase() === 'n' && !e.target.closest('input')) toggleNotes();
});
addEventListener('beforeunload', () => { if (presenterWin && !presenterWin.closed) presenterWin.close(); });

// ───── bediening vanuit het presentatorvenster
// Muis boven de preview → aanwijzer op de presentatie. Klik → zelfde klik op de echte slide.
const laser = document.getElementById('laser');
const stageEl = document.getElementById('stage');

function wirePreview(d) {
  const box = d.getElementById('p-now');
  let dragRange = null;

  // positie in de preview → schermcoördinaten in de presentatie
  const map = e => {
    const r = box.getBoundingClientRect(), sr = stageEl.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    return [sr.left + fx * sr.width, sr.top + fy * sr.height];
  };
  const setRange = (el, x) => {
    const rr = el.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (x - rr.left) / rr.width));
    const min = +el.min || 0, max = +el.max || 100, step = +el.step || 1;
    el.value = Math.round((min + f * (max - min)) / step) * step;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };

  box.addEventListener('mousemove', e => {
    const [x, y] = map(e);
    laser.style.left = x + 'px'; laser.style.top = y + 'px';
    laser.classList.add('on');
    if (dragRange && e.buttons === 1) setRange(dragRange, x);
  });
  box.addEventListener('mouseleave', () => { laser.classList.remove('on'); dragRange = null; });
  box.addEventListener('mousedown', e => {
    const [x, y] = map(e);
    const el = document.elementFromPoint(x, y);
    if (el && el.matches('input[type=range]')) { dragRange = el; setRange(el, x); e.preventDefault(); }
  });
  addEventListener('mouseup', () => { dragRange = null; });
  d.addEventListener('mouseup', () => { dragRange = null; });
  box.addEventListener('click', e => {
    const [x, y] = map(e);
    laser.classList.remove('pulse'); void laser.offsetWidth; laser.classList.add('pulse');
    const el = document.elementFromPoint(x, y);
    if (!el || el.matches('input[type=range]')) return;
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window }));
  });
}
