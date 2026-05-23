/* ============================================================
   calligraphy.js — schedule the swap from letter-reveal to SVG
   ============================================================ */

const ACTIVATE_DELAY_MS = 3000;  // wait until Stage 2 letter reveal is done

/**
 * Add `.calli-active` to the .hero element after the letter-by-letter
 * reveal finishes. CSS then fades out the h1 names and triggers the SVG
 * stroke-draw + fill animations (see sections.css §Calligraphy).
 *
 * Respects prefers-reduced-motion by activating immediately (no delay,
 * no fades — just final state).
 */
export function initCalligraphy() {
  const hero = document.getElementById('hero');
  if (!hero) return;

  // If there's no calligraphy SVG in the DOM (e.g. pre-Stage-4 build),
  // do nothing — letter reveal stays visible.
  if (!hero.querySelector('.name-calli')) return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) {
    hero.classList.add('calli-active');
    return;
  }
  setTimeout(() => hero.classList.add('calli-active'), ACTIVATE_DELAY_MS);
}
