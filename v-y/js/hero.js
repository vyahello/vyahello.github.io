/* ============================================================
   hero.js — letter reveal + mouse parallax + add-to-calendar

   Letter reveal: each .names .n element is split into per-char
   <span class="ch" style="--i: N"> so CSS can stagger the reveal.
   Animation only runs once .hero gains `.intro-done` (curtain.js
   adds this when lifted; we also force it after a fallback delay
   in case curtain is skipped via ?skipIntro=1).

   Parallax: every [data-depth] inside #parallaxNames follows the
   cursor by a depth-weighted offset. Desktop-only (matchMedia).

   Add-to-calendar: clicking #addCalBtn synthesizes an .ics blob
   and triggers a download. Fixed event metadata for 17.07.2026
   15:00 Kyiv (= 12:00 UTC).
   ============================================================ */

const EVENT = {
  uid:       'wedding-vandyu-17072026',
  dtStart:   '20260717T120000Z',
  dtEnd:     '20260717T210000Z',
  summary:   'Весілля Володимира та Юстини',
  desc:      'Запрошуємо на наше весілля. Збір гостей з 14:30, церемонія о 15:00.',
  location:  'Soprano Inn, вул. Кільцева 8, Пасіки-Зубрицькі, Львів',
  geo:       '49.7676623;24.0866213',
  filename:  'wedding-volodymyr-yustyna-17-07-2026.ics',
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

function downloadICS() {
  const blob = new Blob([buildICS()], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = EVENT.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function attachAddToCal(btn) {
  if (!btn) return;
  btn.addEventListener('click', () => {
    downloadICS();
    // Brief visual confirmation
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
