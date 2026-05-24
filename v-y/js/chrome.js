/* ============================================================
   chrome.js — top-right floating chrome:
     · Music toggle — HTMLAudioElement playing another-love.mp3
       with auto-start on curtain:lifted (subject to browser
       autoplay policy). Toggle off pauses + rewinds to 0; toggle
       on plays from start each time (per user spec).
     · Share button: custom popover with direct messenger links
       (Telegram / Viber / WhatsApp / Email / Copy) + optional
       system share. Same UX on iOS, Android, and desktop.
   Both buttons mount inside .float-controls; theme dots live next.
   ============================================================ */

const MUSIC_SRC      = 'another-love.mp3';
const MUSIC_VOLUME   = 0.42;
const MUSIC_FADE_IN_MS  = 1400;
const MUSIC_FADE_OUT_MS = 500;

const SHARE_TITLE = 'Володимир та Юстина · 17.07.2026';
const SHARE_TEXT  = 'Запрошуємо на весілля Володимира та Юстини';
const COPIED_MS   = 2000;

/**
 * URL the user actually wants to forward — strip personal params so the
 * recipient doesn't see someone else's greeting ("Дорога Олена") or
 * theme/intro overrides baked in. Keeps the base path + origin.
 */
function shareableUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

/* ============================================================
   MUSIC — another-love.mp3 (looped, gentle fade in/out)
   ============================================================ */

let musicEl    = null;       // HTMLAudioElement (lazy-created on first need)
let musicBtnEl = null;       // The .music-btn DOM node (set on init)
let fadeTimer  = null;       // setInterval handle for the active fade ramp

function ensureMusicEl() {
  if (musicEl) return musicEl;
  musicEl = new Audio(MUSIC_SRC);
  musicEl.loop        = true;
  musicEl.preload     = 'auto';
  musicEl.volume      = 0;
  musicEl.crossOrigin = 'anonymous';

  // Reflect underlying audio state to the button — covers cases where
  // playback stops outside our toggle (tab discard, media-session pause,
  // OS controls).
  musicEl.addEventListener('play',  syncBtnFromAudio);
  musicEl.addEventListener('pause', syncBtnFromAudio);
  return musicEl;
}

function syncBtnFromAudio() {
  if (!musicBtnEl || !musicEl) return;
  const playing = !musicEl.paused;
  musicBtnEl.classList.toggle('playing', playing);
  musicBtnEl.setAttribute('aria-pressed', playing ? 'true' : 'false');
}

/** Smoothly ramp audio.volume to `to` over `durationMs`. Cancels any
    in-flight fade. Calls `onDone` when the target is reached. */
function fadeVolume(audio, to, durationMs, onDone) {
  if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
  const from  = audio.volume;
  const steps = Math.max(8, Math.round(durationMs / 35));
  const tickMs = durationMs / steps;
  let i = 0;
  fadeTimer = setInterval(() => {
    i++;
    const t = i / steps;
    audio.volume = Math.max(0, Math.min(1, from + (to - from) * t));
    if (i >= steps) {
      clearInterval(fadeTimer);
      fadeTimer = null;
      onDone?.();
    }
  }, tickMs);
}

async function startMusic() {
  const a = ensureMusicEl();
  try {
    a.currentTime = 0;             // restart from beginning, per spec
    a.volume      = 0;
    await a.play();                // may reject if autoplay is blocked
    fadeVolume(a, MUSIC_VOLUME, MUSIC_FADE_IN_MS);
    return true;
  } catch {
    // Autoplay denied (no user gesture yet) — leave button in paused state.
    syncBtnFromAudio();
    return false;
  }
}

function stopMusic() {
  if (!musicEl || musicEl.paused) return;
  const a = musicEl;
  fadeVolume(a, 0, MUSIC_FADE_OUT_MS, () => {
    a.pause();
    a.currentTime = 0;
  });
}

function attachMusicToggle(btn) {
  if (!btn) return;
  musicBtnEl = btn;
  btn.setAttribute('aria-pressed', 'false');
  btn.addEventListener('click', () => {
    if (!musicEl || musicEl.paused) startMusic();
    else                            stopMusic();
  });
}

/* ============================================================
   SHARE — popover with direct messenger links
   ============================================================ */

const ICON = {
  telegram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 3 L2 11 L9 13 L18 7 L11 15 L13 22 Z"/></svg>',
  viber:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 18 L4 22 L8 21 L13 21 C 17 21 19 18 19 13 V 9 C 19 5 17 3 13 3 H 10 C 6 3 5 5 5 9 V 18 Z"/><path d="M9 9 C 9 11 11 13 13 13"/><path d="M11 7 C 14 7 15 8 15 11"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21 L4.5 16 C 3.5 14.5 3 12.8 3 11 C 3 6 7 2 12 2 C 17 2 21 6 21 11 C 21 16 17 20 12 20 C 10.2 20 8.5 19.5 7 18.5 L 3 21 Z"/><path d="M9 9 C 9 11 11 14 13 14 L 14 14 L 15 13 C 15.5 12.5 16 13 16 13 C 16 14 14.5 15.5 13 15 C 10.5 14 9 12 8 9.5 C 8 8 9 7 9.5 7 C 10 7 10.5 8 10 8.5 L 9 9 Z"/></svg>',
  email:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 7 L12 13 L21 7"/></svg>',
  copy:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="1"/><path d="M5 15 H 4 V 4 H 15 V 5"/></svg>',
  system:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5"  r="3"/><circle cx="6"  cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5 L15.4 17.5 M15.4 6.5 L8.6 10.5"/></svg>',
  check:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12 10 18 20 6"/></svg>',
};

const enc = encodeURIComponent;

function shareLinks(url) {
  // Compose the messenger-share intent URLs. Each function returns a string
  // suitable as <a href="">. Mobile schemes (viber://) only render on
  // a device that registered the handler.
  return {
    telegram: `https://t.me/share/url?url=${enc(url)}&text=${enc(SHARE_TEXT)}`,
    viber:    `viber://forward?text=${enc(SHARE_TEXT + ' ' + url)}`,
    whatsapp: `https://wa.me/?text=${enc(SHARE_TEXT + ' ' + url)}`,
    email:    `mailto:?subject=${enc(SHARE_TITLE)}&body=${enc(SHARE_TEXT + '\n\n' + url)}`,
  };
}

/** Copy `text` to clipboard. Tries the async Clipboard API first,
    then a legacy execCommand fallback (non-secure contexts). */
async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch { /* fall through */ }
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { /* unsupported */ }
  document.body.removeChild(ta);
  return ok;
}

function isMobile() {
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}
function hasNativeShare() {
  return typeof navigator.share === 'function';
}

function buildSharePopover(btn) {
  const links = shareLinks(shareableUrl());
  const mobile = isMobile();
  const native = hasNativeShare();

  // Visible options: messengers + email always; viber + system-share only on
  // mobile (the only places those handlers actually resolve to something).
  const opts = [
    { id: 'telegram',  label: 'Telegram',           kind: 'link',   href: links.telegram, icon: ICON.telegram },
    ...(mobile ? [{ id: 'viber', label: 'Viber',    kind: 'link',   href: links.viber,    icon: ICON.viber }] : []),
    { id: 'whatsapp',  label: 'WhatsApp',           kind: 'link',   href: links.whatsapp, icon: ICON.whatsapp },
    { id: 'email',     label: 'Email',              kind: 'link',   href: links.email,    icon: ICON.email },
    { id: 'copy',      label: 'Копіювати посилання', kind: 'action', action: 'copy',       icon: ICON.copy },
    ...(native ? [{ id: 'system', label: 'Інші способи…', kind: 'action', action: 'system', icon: ICON.system }] : []),
  ];

  const pop = document.createElement('div');
  pop.className = 'share-popover';
  pop.setAttribute('role', 'menu');
  pop.setAttribute('aria-label', 'Поділитися запрошенням');
  pop.innerHTML = opts.map((o) => {
    const inner = `<span class="ic" aria-hidden="true">${o.icon}</span><span class="lbl">${o.label}</span>`;
    if (o.kind === 'link') {
      const target = o.href.startsWith('mailto:') || o.href.startsWith('viber:') ? '' : 'target="_blank" rel="noopener noreferrer"';
      return `<a class="opt" role="menuitem" href="${o.href}" ${target} data-share-id="${o.id}">${inner}</a>`;
    }
    return `<button type="button" class="opt" role="menuitem" data-share-action="${o.action}">${inner}</button>`;
  }).join('');

  // Action wiring — clipboard copy + system share both run in JS.
  pop.addEventListener('click', async (e) => {
    const action = e.target.closest('[data-share-action]')?.dataset.shareAction;
    if (!action) return;
    e.preventDefault();
    const optEl = e.target.closest('.opt');

    if (action === 'copy') {
      const ok = await copyToClipboard(shareableUrl());
      if (ok) flashCopiedFeedback(optEl);
    } else if (action === 'system') {
      try {
        await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url: shareableUrl() });
        closePopover(btn);
      } catch { /* user cancelled OS sheet — ignore */ }
    }
  });

  // Clicking any link option also closes the popover, after a short delay so
  // the browser has time to follow the navigation.
  pop.addEventListener('click', (e) => {
    const link = e.target.closest('a.opt');
    if (link) setTimeout(() => closePopover(btn), 200);
  });

  return pop;
}

function flashCopiedFeedback(optEl) {
  if (!optEl) return;
  const lbl = optEl.querySelector('.lbl');
  const ic  = optEl.querySelector('.ic');
  if (!lbl || !ic) return;
  const orig = { lbl: lbl.textContent, ic: ic.innerHTML };
  lbl.textContent = 'Скопійовано!';
  ic.innerHTML    = ICON.check;
  optEl.classList.add('is-copied');
  setTimeout(() => {
    lbl.textContent = orig.lbl;
    ic.innerHTML    = orig.ic;
    optEl.classList.remove('is-copied');
  }, COPIED_MS);
}

let openPopoverEl = null;
let outsideHandler = null;
let escHandler = null;

function openPopover(btn) {
  if (openPopoverEl) return;
  openPopoverEl = buildSharePopover(btn);
  document.body.appendChild(openPopoverEl);

  // Open animation on next frame so transition runs.
  requestAnimationFrame(() => openPopoverEl.classList.add('open'));
  btn.setAttribute('aria-expanded', 'true');

  outsideHandler = (e) => {
    if (!openPopoverEl) return;
    if (openPopoverEl.contains(e.target) || btn.contains(e.target)) return;
    closePopover(btn);
  };
  escHandler = (e) => { if (e.key === 'Escape') closePopover(btn); };

  // Defer attach so the opening click itself doesn't immediately close it.
  setTimeout(() => {
    document.addEventListener('click',   outsideHandler);
    document.addEventListener('keydown', escHandler);
  }, 0);
}

function closePopover(btn) {
  if (!openPopoverEl) return;
  openPopoverEl.classList.remove('open');
  btn.setAttribute('aria-expanded', 'false');
  document.removeEventListener('click',   outsideHandler);
  document.removeEventListener('keydown', escHandler);
  const stale = openPopoverEl;
  openPopoverEl = null;
  outsideHandler = null;
  escHandler = null;
  setTimeout(() => stale.remove(), 280);   // matches CSS transition
}

function attachShareButton(btn) {
  if (!btn) return;
  btn.setAttribute('aria-haspopup', 'menu');
  btn.setAttribute('aria-expanded', 'false');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (openPopoverEl) closePopover(btn);
    else               openPopover(btn);
  });
}

/* ============================================================
   Boot
   ============================================================ */

export function initChrome() {
  attachMusicToggle(document.getElementById('musicBtn'));
  attachShareButton(document.getElementById('shareBtn'));

  // Auto-start music once the intro curtain lifts. If the browser blocks
  // autoplay (no prior user gesture), startMusic() catches the rejection
  // and the button stays in the "paused" state.
  document.addEventListener('curtain:lifted', () => startMusic(), { once: true });

  // Fallback for autoplay-blocked sessions (curtain auto-lifted without a
  // user click). On the next real interaction anywhere on the page, try
  // again — by then the browser counts it as a user gesture. Skipped if
  // music is already playing or the user clicks the music button (which
  // has its own handler).
  const firstGesture = (e) => {
    if (e.target && e.target.closest && e.target.closest('.music-btn')) return;
    if (musicEl && !musicEl.paused) return;
    startMusic();
  };
  document.addEventListener('click',     firstGesture, { once: true, capture: true });
  document.addEventListener('keydown',   firstGesture, { once: true, capture: true });
  document.addEventListener('touchend',  firstGesture, { once: true, capture: true });
}
