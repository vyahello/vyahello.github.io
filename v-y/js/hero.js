/* ============================================================
   hero.js — letter reveal + mouse parallax + add-to-calendar

   Letter reveal: each .names .n element is split into per-char
   <span class="ch" style="--i: N"> so CSS can stagger the reveal.
   Animation only runs once .hero gains `.intro-done` (curtain.js
   adds this when lifted; we also force it after a fallback delay
   in case curtain is skipped via ?skipIntro=1).

   Parallax: every [data-depth] inside #parallaxNames follows the
   cursor by a depth-weighted offset. Desktop-only (matchMedia).

   Add-to-calendar: clicking #addCalBtn navigates to the static
   media/event.ics file. The blob+<a download> approach used to
   silently fail in in-app WebViews (Telegram, FB, Instagram, even
   iMessage's link preview opener) — direct URL navigation hands the
   text/calendar MIME to the OS, which then offers Calendar import.
   Fixed event metadata for 17.07.2026 15:00 Kyiv (= 12:00 UTC).
   ============================================================ */

// Pre-rendered .ics file lives at media/event.ics (linked by index.html's
// <a id="addCalBtn" href="media/event.ics" download>). EVENT object + buildICS
// are kept so the static file is regenerable if event metadata ever changes.
const EVENT = {
  uid:       'wedding-vandyu-17072026',
  dtStart:   '20260717T120000Z',
  dtEnd:     '20260717T210000Z',
  summary:   'Весілля Володимира та Юстини',
  desc:      'Запрошуємо на наше весілля. Збір гостей з 14:30, церемонія о 15:00.',
  location:  'Soprano Inn, вул. Кільцева 8, Пасіки-Зубрицькі, Львів',
  geo:       '49.7676623;24.0866213',
};

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

/* ---- .ics generator ----
   Synthesizes a valid VCALENDAR/VEVENT and triggers a download.
   Returns the URL so callers can clean up if needed (here we revoke
   asynchronously). */
export function buildICS({ uid, dtStart, dtEnd, summary, desc, location, geo } = EVENT) {
  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  // Escape commas + semicolons in LOCATION per RFC 5545
  const safeLocation = location.replace(/([,;])/g, '\\$1');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VandY//Wedding//UK',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}-${Date.now()}@vandyu.wedding`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${desc}`,
    `LOCATION:${safeLocation}`,
    `GEO:${geo}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function attachAddToCal(btn) {
  if (!btn) return;
  // The button is now an <a href="media/event.ics" download> — the browser
  // (or in-app WebView) handles the .ics navigation natively, which is what
  // makes Calendar import work in Telegram / iMessage preview / WhatsApp
  // contexts where the old blob+<a download> trick used to silently fail.

  // iOS-specific upgrade: webcal:// triggers the system Calendar app
  // directly (one-tap import) instead of forcing a download-then-open
  // round trip. Safe to swap — webcal handler is built into iOS, and
  // the URL still resolves to the same .ics over HTTPS under the hood.
  // URL is derived from window.location so this still works on local
  // dev / staging without rewriting hostnames.
  const isIOS = /iP(ad|hone|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS && btn.tagName === 'A' && window.location.protocol.startsWith('http')) {
    const absHttp = new URL('media/event.ics', window.location.href).href;
    btn.setAttribute('href', absHttp.replace(/^https?:/, 'webcal:'));
    btn.removeAttribute('download');   // download attr is meaningless for webcal:
  }

  // Flash a "✓ збережено" confirmation on tap.
  btn.addEventListener('click', () => {
    const label = btn.querySelector('span');
    if (!label) return;
    const original = label.textContent;
    label.textContent = '✓ збережено';
    setTimeout(() => { label.textContent = original; }, 2000);
  });
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

  // 3. Wire add-to-calendar.
  attachAddToCal(document.getElementById('addCalBtn'));

  // 4. Make sure intro animation fires even if curtain was skipped.
  ensureIntroDone(hero);
}
