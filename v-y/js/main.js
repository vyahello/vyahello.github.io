/* ============================================================
   main.js — entry; orchestrates per-section module init
   ============================================================ */

import { initTheme }       from './theme.js';
import { initCurtain }     from './curtain.js';
import { initHero }        from './hero.js';
import { initReveal }      from './reveal.js';
import { initUI }          from './ui.js';
import { initCountdown }   from './countdown.js';
import { initCalligraphy } from './calligraphy.js';
import { initRSVP }        from './rsvp.js';

function boot() {
  initTheme();        // must run first — paints data-theme on body
  initCurtain();      // auto-lifts after 3s or on click; first paint after theme
  initHero();
  initReveal();
  initUI();
  initCountdown();    // async, fetches data/event.json
  initCalligraphy();
  initRSVP();
  // Stage 6+ replaces RSVP submit with Apps Script POST.
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
