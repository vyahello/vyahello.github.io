/* ============================================================
   main.js — entry; orchestrates per-section module init
   ============================================================ */

import { initTheme }      from './theme.js';
import { initCurtain }    from './curtain.js';
import { initHero }       from './hero.js';
import { initInvitation } from './invitation.js';
import { initLocation }   from './location.js';
import { initReveal }     from './reveal.js';
import { initUI }         from './ui.js';
import { initGlobals }    from './globals.js';
import { initChrome }     from './chrome.js';
import { initCountdown }  from './countdown.js';
import { initRSVP }       from './rsvp.js';
import { initGuest }      from './guest.js';

function boot() {
  initTheme();        // must run first — paints data-theme on body
  initCurtain();      // auto-lifts after 3s or on click
  initHero();         // letter splits + parallax + .ics download
  initInvitation();   // smart greeting + flourish — listens for guest:loaded
  initLocation();     // Leaflet map + CARTO basemap + golden marker
  initReveal();
  initUI();           // scroll-progress bar
  initGlobals();      // particles + cursor-glow + floating monogram + swatches
  initChrome();       // music toggle + share button
  initCountdown();    // async, fetches data/event.json
  initRSVP();         // listens for guest:loaded → pre-fill + edit mode
  initGuest();        // async fetch — dispatches guest:loaded when ready
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
