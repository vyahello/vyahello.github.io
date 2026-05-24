/* ============================================================
   reveal.js — fade in elements as they enter the viewport, plus
   per-character stagger on section titles for the "pages of an
   album" feel.
   ============================================================ */

/* Section-divider SVG — small botanical "leaf on a vine" that draws
   itself on intersect. Inserted before each non-hero section's eyebrow
   so the layout reads like turning pages of a wedding album. */
const DIVIDER_SVG_HTML =
  '<svg class="flourish flourish-divider" viewBox="0 0 240 18" aria-hidden="true">' +
    '<path d="M0 9 C 60 9, 90 5, 110 5 Q 122 5, 124 9 Q 126 13, 138 13 C 160 13, 190 9, 240 9"/>' +
    '<circle class="leaf" cx="122" cy="9" r="1.8"/>' +
  '</svg>';

function insertSectionDividers() {
  for (const section of document.querySelectorAll('.section')) {
    if (section.id === 'hero') continue;
    // Skip if section already has any flourish (Invitation already has one).
    const inner = section.querySelector('.section__inner');
    if (!inner) continue;
    if (inner.querySelector('.flourish')) continue;
    inner.insertAdjacentHTML('afterbegin', DIVIDER_SVG_HTML);
  }
  // Calibrate stroke-dasharray for newly-inserted paths (invitation.js
  // already calibrated its own flourish before we ran).
  for (const p of document.querySelectorAll('.flourish-divider path')) {
    try {
      const len = p.getTotalLength();
      p.style.strokeDasharray  = String(len);
      p.style.strokeDashoffset = String(len);
      p.parentElement.style.setProperty('--len', String(len));
    } catch { /* hidden / detached SVGs — ignore */ }
  }
}

/**
 * Walk a title element's DOM and split every text node into:
 *   <span class="title-word">          ← unbreakable group
 *     <span class="title-char" --ci=N>Н</span>
 *     <span class="title-char" --ci=N>е</span>
 *     ...
 *   </span>
 *   ' '  ← raw whitespace text node (the only place a line-break is allowed)
 *   <span class="title-word">...</span>
 *
 * Word grouping is the critical bit — without it, the browser treats
 * every inline-block .title-char as a separate inline atom and is free
 * to wrap a line INSIDE a word (e.g. "небаг|ато" on iPhone 14).
 * The wrapper `.title-word { display: inline-block; white-space: nowrap }`
 * makes the whole word atomic for line-breaking; chars still get the
 * per-letter stagger animation.
 *
 * Nested element children (e.g. <em>) are preserved — chars inside them
 * still get split and grouped per word; italic styling inherits.
 */
function splitTitleChars(title) {
  if (!title || title.dataset.charsSplit === '1') return;
  let ci = 0;

  function processTextNode(text) {
    const frag = document.createDocumentFragment();
    const tokens = text.split(/(\s+)/);   // alternating word / whitespace
    for (const tok of tokens) {
      if (!tok) continue;
      if (/^\s+$/.test(tok)) {
        // Keep whitespace as plain text so the browser can wrap ONLY at
        // word boundaries — never inside a word.
        frag.appendChild(document.createTextNode(tok));
        continue;
      }
      const wordEl = document.createElement('span');
      wordEl.className = 'title-word';
      for (const ch of tok) {
        const charEl = document.createElement('span');
        charEl.className = 'title-char';
        charEl.style.setProperty('--ci', String(ci));
        charEl.textContent = ch;
        wordEl.appendChild(charEl);
        ci++;
      }
      frag.appendChild(wordEl);
    }
    return frag;
  }

  function walk(node) {
    const children = [...node.childNodes];
    for (const child of children) {
      if (child.nodeType === Node.TEXT_NODE) {
        node.replaceChild(processTextNode(child.textContent), child);
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
 * per-character spans (grouped by word) so they can stagger in like
 * a turning page.
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

  // Insert botanical dividers above each (non-hero) section.
  insertSectionDividers();

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
