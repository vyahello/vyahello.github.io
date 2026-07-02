/* ============================================================
   curtain.js — cinematic intro lifecycle

   First view: curtain visible, auto-lifts after 3s or on click.
   Subsequent loads in same session: curtain skipped (sessionStorage).
   ?skipIntro=1 URL param: also skip.

   Side-effects on lift:
     · add .lift class → CSS transition slides it up + fades
     · add .intro-done to #hero → triggers letter-reveal (Step 3 wires)
     · remove curtain from layout after 1500ms (matches CSS transition)
     · dispatch CustomEvent 'curtain:lifted' on document
   ============================================================ */

const SESSION_KEY = 'v-y:curtain-seen';
const LIFT_DELAY_MS    = 3000;
const REMOVE_DELAY_MS  = 1500;

function shouldSkip({ search = window.location.search, storage = window.sessionStorage } = {}) {
  const params = new URLSearchParams(search);
  if (params.get('skipIntro') === '1') return true;
  try {
    if (storage && storage.getItem(SESSION_KEY) === '1') return true;
  } catch { /* storage may be unavailable */ }
  return false;
}

function markSeen() {
  try { window.sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* ignore */ }
}

function hideImmediately(curtain, hero) {
  curtain.style.display = 'none';
  curtain.setAttribute('aria-hidden', 'true');
  if (hero) hero.classList.add('intro-done');
  // Same semantic as a real lift — downstream consumers (music auto-start,
  // hero reveal) should fire whether the curtain was shown or skipped.
  document.dispatchEvent(new CustomEvent('curtain:lifted'));
}

function liftCurtain(curtain, hero) {
  if (!curtain || curtain.classList.contains('lift')) return;
  curtain.classList.add('lift');
  // Leave the accessibility tree immediately — the visual slide-up takes
  // another 1.5s but the overlay is already inert.
  curtain.setAttribute('aria-hidden', 'true');
  if (hero) hero.classList.add('intro-done');
  markSeen();
  document.dispatchEvent(new CustomEvent('curtain:lifted'));
  setTimeout(() => { curtain.style.display = 'none'; }, REMOVE_DELAY_MS);
}

export function initCurtain() {
  const curtain = document.getElementById('curtain');
  if (!curtain) return;
  const hero = document.getElementById('hero');

  if (shouldSkip()) {
    hideImmediately(curtain, hero);
    return;
  }

  const autoLift = setTimeout(() => liftCurtain(curtain, hero), LIFT_DELAY_MS);

  // Tap-to-skip. Cancel the auto-lift so the timeout doesn't fire after we've
  // already removed the curtain.
  curtain.addEventListener('click', () => {
    clearTimeout(autoLift);
    liftCurtain(curtain, hero);
  }, { once: true });

  // Esc also lifts (keyboard accessibility).
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape' && !curtain.classList.contains('lift')) {
      clearTimeout(autoLift);
      liftCurtain(curtain, hero);
      document.removeEventListener('keydown', onKey);
    }
  });
}

// Exposed for unit testing.
export const __test = { shouldSkip };
