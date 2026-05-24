/* ============================================================
   reveal.js — fade in elements as they enter the viewport, plus
   per-character stagger on section titles for the "pages of an
   album" feel.
   ============================================================ */

/**
 * Walk a title element's DOM, splitting every text node into per-character
 * <span class="title-char" style="--ci: N"> wrappers. Element children
 * (e.g. <em>) are preserved — chars inside them inherit italic.
 * Spaces become non-breaking so the inline-block letters don't collapse.
 */
function splitTitleChars(title) {
  if (!title || title.dataset.charsSplit === '1') return;
  let ci = 0;
  function walk(node) {
    const children = [...node.childNodes];
    for (const child of children) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent;
        const frag = document.createDocumentFragment();
        for (const ch of text) {
          const span = document.createElement('span');
          span.className = 'title-char';
          span.style.setProperty('--ci', String(ci));
          span.textContent = ch === ' ' ? ' ' : ch;
          frag.appendChild(span);
          ci++;
        }
        node.replaceChild(frag, child);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child);
      }
    }
  }
  walk(title);
  title.dataset.charsSplit = '1';
}

/**
 * Observe every element with the `.reveal` class and add `.is-visible`
 * the first time it crosses the viewport threshold. CSS handles the
 * actual transition. Also splits any nested `.section__title` into
 * per-character spans so they can stagger in like a turning page.
 *
 * If IntersectionObserver is unavailable (very old browsers) or the
 * user prefers reduced motion, mark everything visible immediately
 * AND skip the character split (chars stay as plain text).
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

  // Pre-split every section title once on boot — cheaper than splitting
  // on intersect, no flash of unstyled text, lets CSS handle the rest.
  for (const t of document.querySelectorAll('.section__title')) splitTitleChars(t);

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          // Trigger botanical flourish stroke-on inside revealed sections.
          for (const f of entry.target.querySelectorAll('.flourish')) {
            f.classList.add('drawn');
          }
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
  );

  items.forEach((el) => observer.observe(el));
}
