/* ============================================================
   ui.js — top-edge scroll-progress bar.
   Markup: <div class="scroll-progress"></div>
   ============================================================ */

export function initUI() {
  const bar = document.querySelector('.scroll-progress');
  if (!bar) return;

  function onScroll() {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
    bar.style.width = `${pct}%`;
  }

  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
}
