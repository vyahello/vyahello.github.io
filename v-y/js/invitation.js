/* ============================================================
   invitation.js — §2 Invitation letter
     1. Compute SVG flourish stroke length and feed it back as
        --len so the CSS stroke-dash animation has the right scale.
     2. Personalize the greeting from ?guest= and ?form=m|f|pl.
        Heuristic when ?form is absent:
          · multiple names separated by "та" / "і" / "й" / "&" / "," → plural
          · single name ending in а/я/ія/ея → feminine
          · everything else → masculine
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

function applyGreeting(el) {
  if (!el) return;
  const { guest, form } = readGuestFromUrl();
  const effective = form ?? detectGreetingForm(guest);
  const prefix = greetingPrefix(effective, Boolean(guest));
  el.innerHTML = guest
    ? `${prefix} <span class="gname">${escapeHtml(guest)}</span>,`
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
  applyGreeting(document.getElementById('greeting'));
  calibrateFlourish();
}
