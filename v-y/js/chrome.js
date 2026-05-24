/* ============================================================
   chrome.js — top-right floating chrome:
     · Music toggle (Web Audio ambient pad — 4 oscillators with
       LFO modulation through a delay feedback loop)
     · Share button (Web Share API + clipboard fallback)
   Both buttons are mounted inside .float-controls; theme dots
   live next to them.
   ============================================================ */

const MUSIC_NOTES   = [220, 277.18, 329.63, 440];          // A3 / C#4 / E4 / A4
const MASTER_FADE_S = 3;                                    // start ramp
const STOP_FADE_S   = 0.8;                                  // exit ramp
const STOP_KILL_MS  = 900;                                  // when to disconnect

const SHARE_DATA = {
  title: 'Володимир та Юстина · 17.07.2026',
  text:  'Запрошуємо Вас на наше весілля',
};

/* ============================================================
   MUSIC — ambient pad
   ============================================================ */

let audioCtx    = null;
let musicNodes  = null;
let musicPlaying = false;

function startMusic(btn) {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const ctx = audioCtx;

  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  master.gain.linearRampToValueAtTime(0.08, ctx.currentTime + MASTER_FADE_S);

  const oscs = MUSIC_NOTES.map((freq, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = freq;
    o.type            = i === 0 ? 'sine' : 'triangle';
    g.gain.value      = 0.25 - i * 0.05;

    // Slow LFO on the oscillator's frequency for a breathing detune.
    const lfo     = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.1 + i * 0.04;
    lfoGain.gain.value  = 0.5 + i * 0.3;
    lfo.connect(lfoGain).connect(o.frequency);
    lfo.start();

    o.connect(g).connect(master);
    o.start();
    return { o, g, lfo };
  });

  // Feedback delay tap for ambient halo.
  const delay     = ctx.createDelay();
  const feedback  = ctx.createGain();
  const delayGain = ctx.createGain();
  delay.delayTime.value = 0.4;
  feedback.gain.value   = 0.3;
  delayGain.gain.value  = 0.3;
  master.connect(delay);
  delay.connect(feedback).connect(delay);
  delay.connect(delayGain).connect(ctx.destination);

  musicNodes   = { master, oscs };
  musicPlaying = true;
  btn?.classList.add('playing');
  btn?.setAttribute('aria-pressed', 'true');
}

function stopMusic(btn) {
  if (!musicNodes) return;
  const { master, oscs } = musicNodes;
  master.gain.cancelScheduledValues(audioCtx.currentTime);
  master.gain.linearRampToValueAtTime(0, audioCtx.currentTime + STOP_FADE_S);
  setTimeout(() => {
    for (const { o, lfo } of oscs) {
      try { o.stop(); } catch { /* already stopped */ }
      try { lfo.stop(); } catch { /* already stopped */ }
    }
    try { master.disconnect(); } catch { /* ignore */ }
    musicNodes = null;
  }, STOP_KILL_MS);
  musicPlaying = false;
  btn?.classList.remove('playing');
  btn?.setAttribute('aria-pressed', 'false');
}

function attachMusicToggle(btn) {
  if (!btn) return;
  btn.setAttribute('aria-pressed', 'false');
  btn.addEventListener('click', () => {
    if (musicPlaying) stopMusic(btn);
    else              startMusic(btn);
  });
}

/* ============================================================
   SHARE — native Web Share API + clipboard fallback
   ============================================================ */

const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="4 12 10 18 20 6"/></svg>';

function attachShareButton(btn) {
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const url  = window.location.href;
    const data = { ...SHARE_DATA, url };

    if (navigator.share) {
      try { await navigator.share(data); } catch { /* user cancelled — fine */ }
      return;
    }

    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        const original = btn.innerHTML;
        btn.innerHTML = CHECK_SVG;
        setTimeout(() => { btn.innerHTML = original; }, 1500);
      } catch { /* clipboard denied — silent */ }
    }
  });
}

/* ============================================================
   Boot
   ============================================================ */

export function initChrome() {
  attachMusicToggle(document.getElementById('musicBtn'));
  attachShareButton(document.getElementById('shareBtn'));
}
