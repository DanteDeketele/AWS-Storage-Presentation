// ───────────────────────── geluidseffecten (Web Audio, geen bestanden) ─────────────────────────
// Klein en zacht. Faalt stil: geluid mag de presentatie nooit breken.
(function () {
  let enabled = true;
  try { enabled = localStorage.getItem('sound') !== 'off'; } catch { /* privé-venster */ }
  const ctxs = new WeakMap();

  // Browsers laten geluid pas toe na een klik in dát venster. Klik je in het presentatorvenster,
  // dan spelen we het geluid daar af (zelfde geluidsuitgang van de laptop).
  function ctx() {
    const w = (typeof presenterWin !== 'undefined' && presenterWin && !presenterWin.closed) ? presenterWin : window;
    let c = ctxs.get(w);
    if (!c) { const AC = w.AudioContext || w.webkitAudioContext; if (!AC) return null; c = new AC(); ctxs.set(w, c); }
    if (c.state === 'suspended') c.resume();
    return c;
  }

  // één toon: frequentie (of glijdend van f1 naar f2), duur, type, volume, vertraging
  function tone({ f1, f2 = f1, dur = 0.12, type = 'sine', vol = 0.08, delay = 0 }) {
    const c = ctx(); if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // ruis (voor swoosh en doorspoelen): gefilterde witte ruis met een glijdend filter
  function noise({ dur = 0.35, f1 = 400, f2 = 3000, q = 1.2, vol = 0.12, delay = 0, type = 'bandpass' }) {
    const c = ctx(); if (!c) return;
    const t = c.currentTime + delay;
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f1, t); f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t); src.stop(t + dur + 0.02);
  }
  const notes = (list, opts = {}) => list.forEach(([f, d, dl]) => tone({ f1: f, dur: d, delay: dl, type: 'square', vol: 0.035, ...opts }));

  const SFX = {
    // swoosh naar de volgende slide
    slide: () => noise({ dur: 0.32, f1: 300, f2: 4000, vol: 0.10 }),
    // bubbel-plopje voor een nieuw punt
    fragment: () => tone({ f1: 280, f2: 900, dur: 0.08, type: 'sine', vol: 0.09 }),
    // "boing" voor uitleg bij een woord
    pop: () => { tone({ f1: 320, f2: 700, dur: 0.12, type: 'triangle', vol: 0.08 }); tone({ f1: 700, f2: 520, dur: 0.1, type: 'triangle', vol: 0.05, delay: 0.11 }); },
    // magisch oplopend arpeggio voor vensters
    open: () => [523, 659, 784, 1047].forEach((f, i) => tone({ f1: f, dur: 0.12, type: 'triangle', vol: 0.05, delay: i * 0.05 })),
    // munt bij Run (klassiek "coin")
    run: () => notes([[988, 0.07, 0], [1319, 0.22, 0.07]]),
    // klein fanfaretje bij succes
    ok: () => notes([[523, 0.09, 0], [659, 0.09, 0.09], [784, 0.09, 0.18], [1047, 0.28, 0.27]], { vol: 0.03 }),
    // "wah-wah-wah-waaah" bij een fout
    err: () => [[392, 0], [370, 0.22], [349, 0.44]].forEach(([f, dl]) => tone({ f1: f, f2: f * 0.97, dur: 0.2, type: 'sawtooth', vol: 0.035, delay: dl }))
      || tone({ f1: 330, f2: 250, dur: 0.6, type: 'sawtooth', vol: 0.035, delay: 0.66 }),
    // doorspoelen + "ta-da" bij het opruimen
    cleanup: () => { noise({ dur: 0.9, f1: 2500, f2: 150, q: 0.8, vol: 0.14, type: 'lowpass' });
      notes([[784, 0.1, 0.95], [1047, 0.3, 1.05]], { vol: 0.03 }); },
  };
  function play(name) { if (!enabled) return; try { SFX[name](); } catch { /* stil */ } }
  window.sfx = play;

  // ── knop in de balk
  const btn = document.getElementById('btn-sound');
  const label = () => { btn.textContent = enabled ? 'Geluid aan' : 'Geluid uit'; btn.classList.toggle('on', enabled); };
  btn.addEventListener('click', () => {
    enabled = !enabled; label();
    try { localStorage.setItem('sound', enabled ? 'on' : 'off'); } catch { /* */ }
    if (enabled) play('ok');
  });
  label();

  // ── koppelingen
  document.addEventListener('slidechange', e => { if (e.detail.from !== e.detail.to) play('slide'); });

  // nieuwe opsommingspunten, popups en vensters
  new MutationObserver(muts => {
    for (const m of muts) {
      const el = m.target;
      const was = (m.oldValue || '').split(' ');
      const isOn = el.classList.contains('on');
      if (!isOn || was.includes('on')) continue;
      if (el.classList.contains('fade')) { play('fragment'); return; }
      if (el.id === 'gloss-pop') { play('pop'); return; }
      if (el.id === 'gloss-deep' || el.id === 'arch') { play('open'); return; }
    }
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });

  // Run-knoppen en hun resultaat
  document.querySelectorAll('[data-run]').forEach(b => b.addEventListener('click', () => play('run')));
  // de terminal wordt telkens volledig herschreven → enkel reageren als er een nieuw resultaat bijkomt
  document.querySelectorAll('.term').forEach(t => {
    let seen = 0;
    new MutationObserver(() => {
      const res = t.querySelectorAll('.ok, .err');
      if (res.length <= seen) { seen = res.length; return; }
      seen = res.length;
      const last = res[res.length - 1];
      if (last.classList.contains('err')) play('err');
      else play(t.closest('.slide').querySelector('[data-run="cleanup"]') ? 'cleanup' : 'ok');
    }).observe(t, { childList: true });
  });
})();
