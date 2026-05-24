/* ============================================================
   chrome.js — top-right floating chrome:
     · Music toggle (Web Audio ambient pad — 4 oscillators + LFO
       modulation through a delay feedback loop)
     · Share button: custom popover with direct messenger links
       (Telegram / Viber / WhatsApp / Email / Copy) + optional
       system share. Same UX on iOS, Android, and desktop.
   Both buttons mount inside .float-controls; theme dots live next.
   ============================================================ */

const MUSIC_NOTES   = [220, 277.18, 329.63, 440];          // A3 / C#4 / E4 / A4
const MASTER_FADE_S = 3;
const STOP_FADE_S   = 0.8;
const STOP_KILL_MS  = 900;

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
   MUSIC — ambient pad
   ============================================================ */

let audioCtx     = null;
let musicNodes   = null;
let musicPlaying = false;

function startMusic(btn) {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const ctx = audioCtx;

  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  master.gain.linearRampToValueAtTime(0.08, ctx.currentTime + MASTER_FADE_S);

  const oscs = MUSIC_NOTES.map((freq, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = freq;
    o.type            = i === 0 ? 'sine' : 'triangle';
    g.gain.value      = 0.25 - i * 0.05;

    const lfo     = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.1 + i * 0.04;
    lfoGain.gain.value  = 0.5 + i * 0.3;
    lfo.connect(lfoGain).connect(o.frequency);
    lfo.start();

    o.connect(g).connect(master);
    o.start();
    return { o, g, lfo };
  });

  const delay     = ctx.createDelay();
  const feedback  = ctx.createGain();
  const delayGain = ctx.createGain();
  delay.delayTime.value = 0.4;
  feedback.gain.value   = 0.3;
  delayGain.gain.value  = 0.3;
  master.connect(delay);
  delay.connect(feedback).connect(delay);
  delay.connect(delayGain).connect(ctx.destination);

  musicNodes   = { master, oscs };
  musicPlaying = true;
  btn?.classList.add('playing');
  btn?.setAttribute('aria-pressed', 'true');
}

function stopMusic(btn) {
  if (!musicNodes) return;
  const { master, oscs } = musicNodes;
  master.gain.cancelScheduledValues(audioCtx.currentTime);
  master.gain.linearRampToValueAtTime(0, audioCtx.currentTime + STOP_FADE_S);
  setTimeout(() => {
    for (const { o, lfo } of oscs) {
      try { o.stop(); } catch { /* already stopped */ }
      try { lfo.stop(); } catch { /* already stopped */ }
    }
    try { master.disconnect(); } catch { /* ignore */ }
    musicNodes = null;
  }, STOP_KILL_MS);
  musicPlaying = false;
  btn?.classList.remove('playing');
  btn?.setAttribute('aria-pressed', 'false');
}

function attachMusicToggle(btn) {
  if (!btn) return;
  btn.setAttribute('aria-pressed', 'false');
  btn.addEventListener('click', () => {
    if (musicPlaying) stopMusic(btn);
    else              startMusic(btn);
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
}
