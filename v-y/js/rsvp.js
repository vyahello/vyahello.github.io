/* ============================================================
   rsvp.js — single-screen RSVP form
     · 3 attendance pills (yes / maybe / no)
     · dynamic guest-name list (1..MAX_GUESTS rows)
     · wishes textarea
     · wax-seal submit button (magnetic hover, idle pulse)
     · heart-burst on submit (24 hearts/sparkles)
     · confirmation card with "Змінити відповідь" cycle
   Submit currently console.logs the payload — Stage 6 swaps in
   an Apps Script POST.
   ============================================================ */

/* ============================================================
   PURE HELPERS — exported for unit tests
   ============================================================ */

export const MAX_GUESTS  = 9;
const VALID_ATTENDANCE   = ['yes', 'maybe', 'no'];

/** Sanitize free-form attendance input. Returns 'yes'|'maybe'|'no'|null. */
export function parseAttendance(raw) {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  return VALID_ATTENDANCE.includes(v) ? v : null;
}

/**
 * Clean a list of guest-name strings:
 *   · drop non-string entries
 *   · trim whitespace
 *   · drop now-empty strings
 *   · clamp to MAX_GUESTS
 * Always returns a fresh array (never the caller's reference).
 */
export function sanitizeGuestNames(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const item of input) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    out.push(trimmed);
    if (out.length >= MAX_GUESTS) break;
  }
  return out;
}

/**
 * Build the submission payload from form state.
 * Stage 6 replaces console.log with an Apps Script POST of this object.
 */
export function buildPayload(state = {}) {
  const attending = parseAttendance(state.attending);
  const names = sanitizeGuestNames(state.guestNames);
  const wishes = typeof state.wishes === 'string' ? state.wishes.trim() : '';
  return {
    guest_id:     state.guestId ?? null,
    name:         state.name    ?? null,
    attending,
    guest_names:  attending === 'no' ? [] : names,
    wishes,
    submitted_at: new Date().toISOString(),
  };
}

/* ============================================================
   BROWSER WIRING — initRSVP()
   ============================================================ */

const SAMPLE_NAMES = [
  'Олена Шевченко',
  'Петро Шевченко',
  'Андрій Коваленко',
  'Марія Коваленко',
  'Іван Бондар',
  'Наталія Бондар',
  'Михайло Лисенко',
  'Софія Лисенко',
  'Наталія Шевчук',
];

function padNum(i) {
  return String(i + 1).padStart(2, '0');
}

/* ---- Guest-list helpers ---- */

function renumberGuestRows(list, addBtn) {
  const rows = list.querySelectorAll('.guest-row');
  rows.forEach((row, i) => {
    row.querySelector('.guest-num').textContent = padNum(i);
    const input = row.querySelector('.guest-name');
    if (!input.value) input.placeholder = SAMPLE_NAMES[i] || 'Імʼя та прізвище';
  });
  if (addBtn) addBtn.disabled = rows.length >= MAX_GUESTS;
}

function addGuestRow(list, addBtn, { focus = true } = {}) {
  const rows = list.querySelectorAll('.guest-row');
  if (rows.length >= MAX_GUESTS) return null;
  const idx = rows.length;
  const row = document.createElement('div');
  row.className = 'guest-row entering';
  row.innerHTML = `
    <span class="guest-num">${padNum(idx)}</span>
    <input type="text" class="guest-name" placeholder="${SAMPLE_NAMES[idx] || 'Імʼя та прізвище'}" autocomplete="off" />
    <button type="button" class="guest-remove" aria-label="Видалити" tabindex="-1">×</button>
  `;
  list.appendChild(row);
  renumberGuestRows(list, addBtn);
  if (focus) setTimeout(() => row.querySelector('.guest-name').focus(), 50);
  setTimeout(() => row.classList.remove('entering'), 500);
  return row;
}

function removeGuestRow(row, list, addBtn) {
  if (list.querySelectorAll('.guest-row').length <= 1) return;
  row.classList.add('removing');
  setTimeout(() => { row.remove(); renumberGuestRows(list, addBtn); }, 320);
}

function readGuestNames(list) {
  return [...list.querySelectorAll('.guest-name')]
    .map((i) => i.value.trim())
    .filter(Boolean);
}

/* ---- Magnetic seal (desktop) ---- */

function attachMagneticSeal(seal) {
  if (!seal || !window.matchMedia('(hover: hover)').matches) return;
  seal.addEventListener('mousemove', (e) => {
    const r = seal.getBoundingClientRect();
    const cx = r.left + r.width  / 2;
    const cy = r.top  + r.height / 2;
    const dx = (e.clientX - cx) * 0.18;
    const dy = (e.clientY - cy) * 0.18;
    seal.style.transform = `translate(${dx}px, ${dy}px) scale(1.06) rotate(-4deg)`;
  });
  seal.addEventListener('mouseleave', () => { seal.style.transform = ''; });
}

/* ---- Heart burst (24 hearts/sparkles in physical radial pattern) ---- */

const HEART_SYMBOLS = ['♥', '♡', '✦', '✧'];

function burstHearts(originX, originY, count = 24) {
  for (let i = 0; i < count; i++) {
    const h = document.createElement('div');
    h.className   = 'flying-heart';
    h.textContent = HEART_SYMBOLS[i % HEART_SYMBOLS.length];
    h.style.left  = `${originX}px`;
    h.style.top   = `${originY}px`;

    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const dist  = 120 + Math.random() * 120;
    const dx    = Math.cos(angle) * dist;
    const dy    = Math.sin(angle) * dist - 40;             // slight upward bias
    const scale = 0.6 + Math.random() * 0.9;
    const dur   = 1.1 + Math.random() * 0.8;

    h.style.setProperty('--dx', `${dx}px`);
    h.style.setProperty('--dy', `${dy}px`);
    h.style.setProperty('--scale', String(scale));
    h.style.setProperty('--dur',   `${dur}s`);
    h.style.fontSize = `${16 + Math.random() * 14}px`;

    document.body.appendChild(h);
    setTimeout(() => h.remove(), dur * 1000 + 100);
  }
}

/* ---- Confirmation card ---- */

function showConfirmation(form, confirm, attending) {
  const title = confirm.querySelector('[data-confirm-title]');
  const body  = confirm.querySelector('[data-confirm-text]');
  if (attending === 'yes') {
    title.textContent = 'Дякуємо!';
    body.textContent  = 'Вашу відповідь збережено. Чекаємо на Вас 17 липня.';
  } else if (attending === 'maybe') {
    title.textContent = 'Будемо чекати';
    body.textContent  = 'Будь ласка, підтвердіть Вашу присутність ближче до дати.';
  } else {
    title.textContent = 'Шкода, що не зможете';
    body.textContent  = 'Дякуємо, що повідомили. Будемо думати про Вас.';
  }
  form.style.display = 'none';
  confirm.classList.add('show');
}

function hideConfirmation(form, confirm) {
  form.style.display = '';
  confirm.classList.remove('show');
}

/* ---- Browser entry ---- */

export function initRSVP() {
  const root = document.getElementById('rsvp');
  if (!root) return;
  const form    = root.querySelector('#rsvpForm');
  const confirm = root.querySelector('#rsvpConfirm');
  const list    = root.querySelector('#guestList');
  const addBtn  = root.querySelector('#guestAdd');
  const seal    = root.querySelector('#submitBtn');
  if (!form || !confirm || !list || !addBtn || !seal) return;

  renumberGuestRows(list, addBtn);
  attachMagneticSeal(seal);

  // Add-guest button
  addBtn.addEventListener('click', () => addGuestRow(list, addBtn, { focus: true }));

  // Delegated remove + Enter-to-add
  list.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.guest-remove');
    if (removeBtn) removeGuestRow(removeBtn.closest('.guest-row'), list, addBtn);
  });
  list.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.classList.contains('guest-name')) {
      e.preventDefault();
      const row    = e.target.closest('.guest-row');
      const rows   = [...list.querySelectorAll('.guest-row')];
      const idx    = rows.indexOf(row);
      if (idx === rows.length - 1) addGuestRow(list, addBtn, { focus: true });
      else rows[idx + 1].querySelector('.guest-name').focus();
    }
  });

  // Hide the guest list if attendance flips to 'no'.
  const guestWrap = root.querySelector('#guestCountWrap');
  for (const r of root.querySelectorAll('input[name="attend"]')) {
    r.addEventListener('change', () => {
      if (guestWrap) guestWrap.style.display = (r.checked && r.value === 'no') ? 'none' : '';
    });
  }

  // Edit link cycles back to the form.
  const editLink = confirm.querySelector('#editLink');
  if (editLink) editLink.addEventListener('click', () => hideConfirmation(form, confirm));

  // Submit handler
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const fd = new FormData(form);
    const attending = parseAttendance(fd.get('attend'));

    // Guard: 'yes' or 'maybe' require at least one named guest.
    const rawNames = readGuestNames(list);
    if ((attending === 'yes' || attending === 'maybe') && rawNames.length === 0) {
      const first = list.querySelector('.guest-name');
      first.focus();
      first.style.transition = 'background 0.4s';
      first.style.background = 'color-mix(in oklab, var(--accent) 18%, transparent)';
      setTimeout(() => { first.style.background = ''; }, 1200);
      return;
    }

    const payload = buildPayload({
      attending,
      guestNames: rawNames,
      wishes:     fd.get('wishes') || '',
    });

    // Heart burst originating at the seal's center.
    const sealRect = seal.getBoundingClientRect();
    burstHearts(sealRect.left + sealRect.width / 2, sealRect.top + sealRect.height / 2);

    // Stage 6 replaces console.log with fetch(eventData.appsScriptUrl, { method: 'POST', body: JSON.stringify(payload) })
    console.log('[rsvp] payload (would POST in Stage 6):', payload);
    showConfirmation(form, confirm, payload.attending);
  });
}
