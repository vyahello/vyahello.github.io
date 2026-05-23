/* ============================================================
   reveal.js — fade in elements as they enter the viewport
   ============================================================ */

/**
 * Observe every element with the `.reveal` class and add `.is-visible`
 * the first time it crosses the viewport threshold. CSS handles the
 * actual transition.
 *
 * If IntersectionObserver is unavailable (very old browsers) or the
 * user prefers reduced motion, mark everything visible immediately.
 */
export function initReveal() {
  const items = document.querySelectorAll('.reveal');
  if (items.length === 0) return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const noObserver = typeof IntersectionObserver === 'undefined';

  if (prefersReduced || noObserver) {
    items.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
  );

  items.forEach((el) => observer.observe(el));
}
