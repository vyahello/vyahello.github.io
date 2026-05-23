/* ============================================================
   main.js — entry; orchestrates per-section module init
   ============================================================ */

import { initHero } from './hero.js';

function boot() {
  initHero();
  // Stage 3+ adds: initReveal, initCountdown, initRSVP, …
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
