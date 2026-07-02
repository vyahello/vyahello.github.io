/* ============================================================
   countdown.js — calendar + 4-cell ticker
     1. On first viewport entry, roll up 0 → target over 1.5s
        (cubic ease-out) for all four cells.
     2. After rollup, drop to 1s tick refreshes.
     3. Day-17 in the calendar is wired to trigger the hero's
        add-to-calendar button (download .ics).
   ============================================================ */

import { loadConfig } from './guest.js';

const ROLLUP_DURATION_MS = 1500;

/** Pad a non-negative integer to 2 digits ("3" → "03"). */
function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Compute days/hours/minutes/seconds remaining. Pure; clamps to ≥0. */
export function computeDelta(targetMs, nowMs) {
  let diff = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
  const days = Math.floor(diff / 86400);
  diff -= days * 86400;
  const hours = Math.floor(diff / 3600);
  diff -= hours * 3600;
  const minutes = Math.floor(diff / 60);
  diff -= minutes * 60;
  return { days, hours, minutes, seconds: diff };
}

/** easeOutCubic on [0,1] */
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

/**
 * Animate the four cells from 0 → target over ROLLUP_DURATION_MS.
 * Returns a Promise that resolves when the rollup is done.
 */
function rollup(cells, target) {
  return new Promise((resolve) => {
    const start = performance.now();
    function step(now) {
      const t = Math.min(1, (now - start) / ROLLUP_DURATION_MS);
      const k = easeOutCubic(t);
      cells.days.textContent    = pad2(Math.round(target.days    * k));
      cells.hours.textContent   = pad2(Math.round(target.hours   * k));
      cells.minutes.textContent = pad2(Math.round(target.minutes * k));
      cells.seconds.textContent = pad2(Math.round(target.seconds * k));
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    }
    requestAnimationFrame(step);
  });
}

/** Plain per-second render (no animation, just text swap). */
function render(cells, delta) {
  cells.days.textContent    = pad2(delta.days);
  cells.hours.textContent   = pad2(delta.hours);
  cells.minutes.textContent = pad2(delta.minutes);
  cells.seconds.textContent = pad2(delta.seconds);
}

/** Wire the highlighted day-17 to fire the add-to-cal flow. */
function wireKeyDay() {
  const keyDay = document.querySelector('.cal-day.key');
  const addBtn = document.getElementById('addCalBtn');
  if (!keyDay || !addBtn) return;
  keyDay.addEventListener('click', () => addBtn.click());
  // role="button" on a div gets no synthetic click — wire the keys the
  // aria contract promises.
  keyDay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      addBtn.click();
    }
  });
}

export async function initCountdown() {
  const cells = {
    days:    document.getElementById('cdDays'),
    hours:   document.getElementById('cdHours'),
    minutes: document.getElementById('cdMins'),
    seconds: document.getElementById('cdSecs'),
  };
  if (!cells.days) return;

  // Load target date via the shared config loader (one request per page —
  // guest.js needs the same file at the same boot moment). Bail quietly.
  let targetMs;
  try {
    const json = await loadConfig();
    targetMs = new Date(json.date).getTime();
    if (Number.isNaN(targetMs)) throw new Error('bad date');
  } catch (err) {
    console.warn('countdown: failed to load event.json', err);
    return;
  }

  wireKeyDay();

  let started = false;
  const startCountdown = async () => {
    if (started) return;
    started = true;
    await rollup(cells, computeDelta(targetMs, Date.now()));
    // Self-scheduling timeout aligned to the wall-clock second — a fixed
    // setInterval drifts across second boundaries and visibly skips a
    // digit now and then. Stops once the big day arrives.
    const loop = () => {
      const delta = computeDelta(targetMs, Date.now());
      render(cells, delta);
      if (targetMs - Date.now() <= 0) return;
      setTimeout(loop, 1000 - (Date.now() % 1000));
    };
    loop();
  };

  // Fire when the countdown row scrolls into view (≥30% visible).
  const root = document.getElementById('countdown');
  if (root && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          startCountdown();
          io.disconnect();
          break;
        }
      }
    }, { threshold: 0.3 });
    io.observe(root);
  } else {
    // No IO support → just start immediately.
    startCountdown();
  }
}
