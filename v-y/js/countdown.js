/* ============================================================
   countdown.js — flip-clock ticker driven by event.json
   ============================================================ */

const TICK_CLASS = 'tick';
const TICK_DURATION_MS = 400;  // must match @keyframes flip in animations.css

/** Pad a non-negative integer to 2 digits ("3" -> "03"). */
function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

/**
 * Compute the breakdown of milliseconds into days/hours/minutes/seconds.
 * Always non-negative; if target is in the past, returns all zeros.
 */
export function computeDelta(targetMs, nowMs) {
  let diff = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
  const days = Math.floor(diff / 86400);
  diff -= days * 86400;
  const hours = Math.floor(diff / 3600);
  diff -= hours * 3600;
  const minutes = Math.floor(diff / 60);
  diff -= minutes * 60;
  const seconds = diff;
  return { days, hours, minutes, seconds };
}

/** Apply a {days, hours, minutes, seconds} object to the four cells. */
function render(cells, delta) {
  for (const [key, el] of Object.entries(cells)) {
    if (!el) continue;
    const next = pad2(delta[key]);
    if (el.textContent !== next) {
      el.textContent = next;
      el.classList.remove(TICK_CLASS);
      // Force reflow so the animation restarts even if the class was just removed.
      void el.offsetWidth;
      el.classList.add(TICK_CLASS);
      setTimeout(() => el.classList.remove(TICK_CLASS), TICK_DURATION_MS);
    }
  }
}

/** Self-check: simple math smoke test. Runs once if URL has ?debug=countdown. */
function debugSelfCheck() {
  if (!new URLSearchParams(location.search).has('debug')) return;
  const t = new Date('2026-07-17T14:00:00+03:00').getTime();
  const n = new Date('2026-07-10T14:00:00+03:00').getTime();
  const d = computeDelta(t, n);
  console.assert(d.days === 7 && d.hours === 0 && d.minutes === 0 && d.seconds === 0,
                 'countdown computeDelta math is wrong', d);
}

/**
 * Boot the ticker. Reads `data/event.json` to find target date, then
 * updates every second. Safe to call if cells are missing — does nothing.
 */
export async function initCountdown() {
  const cells = {
    days:    document.querySelector('[data-cd="days"]'),
    hours:   document.querySelector('[data-cd="hours"]'),
    minutes: document.querySelector('[data-cd="minutes"]'),
    seconds: document.querySelector('[data-cd="seconds"]'),
  };
  if (!cells.days) return;  // no countdown markup on this page

  debugSelfCheck();

  let targetMs;
  try {
    const res = await fetch('data/event.json');
    const json = await res.json();
    targetMs = new Date(json.date).getTime();
    if (isNaN(targetMs)) throw new Error('bad date');
  } catch (err) {
    console.warn('countdown: failed to load event.json', err);
    return;
  }

  function tick() {
    render(cells, computeDelta(targetMs, Date.now()));
  }
  tick();
  setInterval(tick, 1000);
}
