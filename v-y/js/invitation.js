/* ============================================================
   invitation.js — §2 Invitation letter
     1. Compute SVG flourish stroke length and feed it back as
        --len so the CSS stroke-dash animation has the right scale.
     2. Personalise the greeting from ?guest=&form= URL params
        (legacy / preview) — then OVERRIDE from `guest:loaded`
        event fired by guest.js once backend data arrives.
   ============================================================ */

const VALID_FORMS = new Set(['m', 'f', 'pl']);

/** Detect grammatical form from a raw name string. Pure. */
export function detectGreetingForm(rawName) {
  const name = String(rawName ?? '').trim();
  if (!name) return 'pl';                                   // empty → "Дорогі гості"
  if (/(,|\s+(та|і|й|&)\s+)/i.test(name)) return 'pl';      // multiple names
  if (/(а|я|ія|ея)$/i.test(name)) return 'f';
  return 'm';
}

/** Map form → Ukrainian salutation prefix. Pure. */
export function greetingPrefix(form, hasName) {
  if (!hasName) return 'Дорогі гості';
  switch (form) {
    case 'pl': return 'Дорогі';
    case 'f':  return 'Дорога';
    default:   return 'Дорогий';
  }
}

/** Tiny HTML escape — only the chars we actually inject. */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** Read ?guest=…&form=… from the URL. Returns `{ guest, form }`. */
function readGuestFromUrl(search = window.location.search) {
  const params = new URLSearchParams(search);
  const guest = (params.get('guest') || '').trim();
  const formRaw = (params.get('form') || '').trim().toLowerCase();
  const form = VALID_FORMS.has(formRaw) ? formRaw : null;
  return { guest, form };
}

/** Render the greeting line. Accepts `{ name, form }` — both optional. */
function renderGreeting(el, name, form) {
  if (!el) return;
  const hasName = Boolean(name);
  const effective = (form && VALID_FORMS.has(form)) ? form : detectGreetingForm(name);
  const prefix = greetingPrefix(effective, hasName);
  el.innerHTML = hasName
    ? `${prefix} <span class="gname">${escapeHtml(name)}</span>,`
    : `${prefix},`;
}

/**
 * For each <path> inside a .flourish SVG, measure its rendered length
 * and feed it back as stroke-dasharray/offset and the parent's --len
 * CSS variable, so the draw-on-reveal animation matches the path.
 */
function calibrateFlourish(root = document) {
  for (const p of root.querySelectorAll('.flourish path')) {
    try {
      const len = p.getTotalLength();
      p.style.strokeDasharray  = String(len);
      p.style.strokeDashoffset = String(len);
      p.parentElement.style.setProperty('--len', String(len));
    } catch { /* SVGs without geometry — ignore */ }
  }
}

export function initInvitation() {
  const el = document.getElementById('greeting');
  if (!el) return;

  // 1. First paint from URL params (works offline / for previews).
  const { guest, form } = readGuestFromUrl();
  renderGreeting(el, guest, form);

  // 2. Override once backend data arrives — sheet wins over URL params.
  document.addEventListener('guest:loaded', (e) => {
    const g = e.detail?.guest;
    if (g?.display_name) renderGreeting(el, g.display_name, g.form);
  });

  calibrateFlourish();
}
