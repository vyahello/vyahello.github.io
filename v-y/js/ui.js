/* ============================================================
   ui.js — scroll-progress bar + scroll-to-top button
   ============================================================ */

/**
 * Initialise both overlay UI pieces. Expects the markup
 *   <div class="scroll-progress"></div>
 *   <button class="scroll-top" aria-label="Догори">↑</button>
 * to exist in the DOM (added in index.html in Task 12).
 */
export function initUI() {
  const bar = document.querySelector('.scroll-progress');
  const top = document.querySelector('.scroll-top');

  function onScroll() {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
    if (bar) bar.style.width = `${pct}%`;
    if (top) top.classList.toggle('is-visible', window.scrollY > window.innerHeight * 0.8);
  }

  if (top) {
    top.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Run once on load to set initial state, then on every scroll.
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
}
