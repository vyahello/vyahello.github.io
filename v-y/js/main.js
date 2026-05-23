/* ============================================================
   main.js — entry; orchestrates per-section module init
   ============================================================ */

import { initHero }   from './hero.js';
import { initReveal } from './reveal.js';
import { initUI }     from './ui.js';

function boot() {
  initHero();
  initReveal();
  initUI();
  // Stage 4+ adds: initCountdown, initRSVP, …
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
