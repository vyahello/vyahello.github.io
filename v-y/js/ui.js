/* ============================================================
   ui.js — top-edge scroll-progress bar.
   Markup: <div class="scroll-progress"></div>
   ============================================================ */

export function initUI() {
  const bar = document.querySelector('.scroll-progress');
  if (!bar) return;

  // rAF-coalesced; writes transform (compositor-only) instead of width
  // so scrolling never dirties layout for a 2px chrome bar.
  let pending = false;

  function update() {
    pending = false;
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const pct = max > 0 ? window.scrollY / max : 0;
    bar.style.transform = `scaleX(${Math.min(Math.max(pct, 0), 1)})`;
  }

  function onScroll() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(update);
  }

  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
}
