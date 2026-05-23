/* ============================================================
   main.js — entry; orchestrates per-section module init
   ============================================================ */

import { initHero }   from './hero.js';
import { initReveal } from './reveal.js';

function boot() {
  initHero();
  initReveal();
  // Stage 3+ adds: initUI (scroll progress + scroll-to-top), initCountdown, initRSVP, …
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
