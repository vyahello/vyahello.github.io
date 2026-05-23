/* ============================================================
   hero.js — letter-by-letter reveal + 3D mouse parallax
   ============================================================ */

/**
 * Replace an element's text with per-character <span class="ch">,
 * applying a staggered animation-delay so the letters appear in sequence.
 * @param {HTMLElement} el     The element (must have data-text attribute).
 * @param {number}      base   Base delay in seconds before the first letter.
 * @param {number}      step   Per-letter delay increment in seconds.
 */
function spell(el, base = 0, step = 0.06) {
  const text = el.dataset.text || el.textContent || '';
  el.textContent = '';
  for (let i = 0; i < text.length; i++) {
    const span = document.createElement('span');
    span.className = 'ch';
    span.textContent = text[i] === ' ' ? ' ' : text[i];
    span.style.animationDelay = `${base + i * step}s`;
    el.appendChild(span);
  }
  el.classList.add('spelled');
}

/**
 * Attach 3D mouse parallax: rotate the hero-inner based on cursor position.
 * Smoothly returns to neutral on mouseleave.
 * @param {HTMLElement} hero  The .hero section.
 */
function attachParallax(hero) {
  const inner = hero.querySelector('.hero-inner');
  if (!inner) return;

  hero.addEventListener('mousemove', (e) => {
    const r = hero.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width  - 0.5;
    const y = (e.clientY - r.top)  / r.height - 0.5;
    inner.style.transform =
      `rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateZ(20px)`;
  });

  hero.addEventListener('mouseleave', () => {
    inner.style.transform = 'rotateY(0) rotateX(0) translateZ(0)';
  });
}

/**
 * Bootstrap Hero effects. Safe to call after DOMContentLoaded.
 * If any required element is missing, the corresponding effect is silently skipped.
 */
export function initHero() {
  const hero = document.getElementById('hero');
  if (!hero) return;

  // Spell the two names. Delays mirror spec §2 — names appear after the
  // eyebrow + hearts fade-up (0.2s + 0.5s offsets in CSS).
  const name1 = document.getElementById('hero-name-1');
  const name2 = document.getElementById('hero-name-2');
  if (name1) spell(name1, 0.7);
  if (name2) spell(name2, 1.5);

  // Parallax is a desktop-only enhancement; skip if touch-primary.
  // (Tilt on mobile arrives separately in Stage 9 via DeviceOrientation.)
  const isTouchPrimary = window.matchMedia('(hover: none)').matches;
  if (!isTouchPrimary) attachParallax(hero);
}
