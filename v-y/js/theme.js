/* ============================================================
   theme.js — 2-theme switcher (cream | dark)

   Resolution order on first paint:
     1. ?theme= URL param (if valid)
     2. localStorage "v-y:theme" (if valid)
     3. default "cream"

   Persists selection to localStorage when the user clicks a dot.
   Legacy "gold" values (in storage / URL) are silently mapped to cream.
   ============================================================ */

const THEMES = ['cream', 'dark'];
const STORAGE_KEY = 'v-y:theme';
const DEFAULT_THEME = 'cream';

/* Browser-chrome tint per theme — mirrors the --bg tokens in theme.css.
   The static <meta name="theme-color"> tags key off prefers-color-scheme,
   which is independent of the user-picked site theme; JS must sync them
   or Safari paints a cream toolbar around the dark page (and vice versa). */
const THEME_COLORS = { cream: '#f0e8d8', dark: '#15110c' };

function isValidTheme(t) {
  return typeof t === 'string' && THEMES.includes(t);
}

/** Pure: pick the initial theme from URL > localStorage > default. */
export function resolveInitialTheme({ search = window.location.search, storage = window.localStorage } = {}) {
  const params = new URLSearchParams(search);
  const fromUrl = params.get('theme');
  if (isValidTheme(fromUrl)) return fromUrl;
  try {
    const stored = storage && storage.getItem(STORAGE_KEY);
    if (isValidTheme(stored)) return stored;
  } catch { /* storage may be unavailable; fall through */ }
  return DEFAULT_THEME;
}

/** Apply a theme: set data-theme on <body>, sync dot UI, persist, broadcast. */
export function applyTheme(theme) {
  const t = isValidTheme(theme) ? theme : DEFAULT_THEME;
  document.body.setAttribute('data-theme', t);
  for (const dot of document.querySelectorAll('[data-theme-dot]')) {
    const isActive = dot.dataset.themeDot === t;
    dot.classList.toggle('is-active', isActive);
    dot.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  }
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.setAttribute('content', THEME_COLORS[t]);
    // One value now rules — the prefers-color-scheme split no longer applies.
    meta.removeAttribute('media');
  }
  try { window.localStorage.setItem(STORAGE_KEY, t); } catch { /* ignore */ }
  document.dispatchEvent(new CustomEvent('theme:changed', { detail: { theme: t } }));
}

/** Browser entry — read initial theme, render it, wire dot clicks. */
export function initTheme() {
  applyTheme(resolveInitialTheme());

  document.addEventListener('click', (e) => {
    const dot = e.target.closest('[data-theme-dot]');
    if (!dot) return;
    applyTheme(dot.dataset.themeDot);
  });
}
