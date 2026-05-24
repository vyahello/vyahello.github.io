/* ============================================================
   theme.js — 3-theme switcher (cream | gold | dark)

   Resolution order on first paint:
     1. ?theme= URL param (if valid)
     2. localStorage "v-y:theme" (if valid)
     3. default "cream"

   Persists selection to localStorage when the user clicks a dot.
   ============================================================ */

const THEMES = ['cream', 'gold', 'dark'];
const STORAGE_KEY = 'v-y:theme';
const DEFAULT_THEME = 'cream';

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

/** Apply a theme: set data-theme on <body>, sync dot UI, persist. */
export function applyTheme(theme) {
  const t = isValidTheme(theme) ? theme : DEFAULT_THEME;
  document.body.setAttribute('data-theme', t);
  for (const dot of document.querySelectorAll('[data-theme-dot]')) {
    const isActive = dot.dataset.themeDot === t;
    dot.classList.toggle('is-active', isActive);
    dot.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  }
  try { window.localStorage.setItem(STORAGE_KEY, t); } catch { /* ignore */ }
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
