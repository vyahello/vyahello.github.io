/* ============================================================
   hero.js — letter reveal + mouse parallax

   Letter reveal: each .names .n element is split into per-char
   <span class="ch" style="--i: N"> so CSS can stagger the reveal.
   Animation only runs once .hero gains `.intro-done` (curtain.js
   adds this when lifted; we also force it after a fallback delay
   in case curtain is skipped via ?skipIntro=1).

   Parallax: every [data-depth] inside #parallaxNames follows the
   cursor by a depth-weighted offset. Desktop-only (matchMedia).

   Add-to-calendar: handled entirely by index.html — #addCalBtn is
   an <a> linking straight to a Google Calendar event-edit URL with
   target="_blank". No JS needed. Google Cal works identically in
   every browser/WebView (Telegram, iMessage, WhatsApp, Safari,
   Chrome) — it's just a webpage with the event pre-filled, user
   taps Save. countdown.js still triggers it via .click() on day-17
   of the calendar, which fires the anchor's default navigation.
   ============================================================ */

/* ---- Letter splitting ----
   Wrap each character in `text` in a <span class="ch" style="--i: i">.
   Whitespace becomes a non-breaking space so inline-block letters don't
   collapse. */
function splitIntoLetters(el) {
  const text = el.textContent ?? '';
  el.textContent = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const span = document.createElement('span');
    span.className = 'ch';
    span.style.setProperty('--i', String(i));
    span.textContent = ch === ' ' ? ' ' : ch;
    el.appendChild(span);
  }
}

/* ---- Mouse parallax ----
   Translates every [data-depth] inside `root` by a depth-weighted
   offset relative to viewport center. Coalesces to one update per
   animation frame. */
function attachParallax(root) {
  if (!window.matchMedia('(hover: hover)').matches) return;
  let raf = 0;
  const onMove = (e) => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const cx = window.innerWidth  / 2;
      const cy = window.innerHeight / 2;
      const dx = (e.clientX - cx) / cx;
      const dy = (e.clientY - cy) / cy;
      for (const el of root.querySelectorAll('[data-depth]')) {
        const d = parseFloat(el.dataset.depth) || 0;
        el.style.transform = `translate(${dx * d * 0.5}px, ${dy * d * 0.3}px)`;
      }
    });
  };
  document.addEventListener('mousemove', onMove);
}

/* ---- intro-done choreography ----
   curtain.js adds .intro-done when the curtain lifts. If the curtain
   was skipped (?skipIntro=1 or sessionStorage), curtain.js still adds
   .intro-done synchronously at boot — so on the next frame the class
   is already there. The fallback timer below catches the (rare) case
   where curtain.js failed to load. */
function ensureIntroDone(hero) {
  if (hero.classList.contains('intro-done')) return;
  document.addEventListener('curtain:lifted', () => hero.classList.add('intro-done'), { once: true });
  setTimeout(() => hero.classList.add('intro-done'), 4000);
}

export function initHero() {
  const hero = document.getElementById('hero');
  if (!hero) return;

  // 1. Split each name into per-letter spans.
  for (const el of hero.querySelectorAll('.names .n')) splitIntoLetters(el);

  // 2. Mouse parallax on names + amp.
  const parallaxRoot = document.getElementById('parallaxNames');
  if (parallaxRoot) attachParallax(parallaxRoot);

  // 3. Make sure intro animation fires even if curtain was skipped.
  ensureIntroDone(hero);
}
