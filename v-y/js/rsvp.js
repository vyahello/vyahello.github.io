/* ============================================================
   rsvp.js — single-screen RSVP form
     · 2 attendance pills (yes / no)
     · dynamic guest-name list (1..MAX_GUESTS rows)
     · wishes textarea
     · wax-seal submit button (magnetic hover, idle pulse)
     · heart-burst on submit (24 hearts/sparkles)
     · confirmation card with "Змінити відповідь" cycle
     · listens for `guest:loaded` to pre-fill household + restore
       previously-submitted RSVP, then shows the confirmation card
       in "you already replied — you can edit" mode
     · submit POSTs to the Apps Script URL via guest.submitRsvp
   ============================================================ */

import { submitRsvp, getGuestSlug } from './guest.js';

/* ============================================================
   PURE HELPERS — exported for unit tests
   ============================================================ */

export const MAX_GUESTS  = 9;
const VALID_ATTENDANCE   = ['yes', 'no'];

/** Sanitize free-form attendance input. Returns 'yes'|'no'|null. */
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
 * Build the submission payload from form state. Apps Script writes
 * one row per `slug`; supplying the same slug again triggers an
 * upsert (edit) instead of a new row.
 */
export function buildPayload(state = {}) {
  const attending = parseAttendance(state.attending);
  const names = sanitizeGuestNames(state.guestNames);
  const wishes = typeof state.wishes === 'string' ? state.wishes.trim() : '';
  return {
    slug:         state.slug         ?? null,
    display_name: state.displayName  ?? null,
    attending,
    guest_names:  attending === 'no' ? [] : names,
    wishes,
    submitted_at: state.submittedAt || new Date().toISOString(),
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

function addGuestRow(list, addBtn, { focus = true, value = '' } = {}) {
  const rows = list.querySelectorAll('.guest-row');
  if (rows.length >= MAX_GUESTS) return null;
  const idx = rows.length;
  const row = document.createElement('div');
  row.className = 'guest-row entering';
  row.innerHTML = `
    <span class="guest-num">${padNum(idx)}</span>
    <input type="text" class="guest-name" placeholder="${SAMPLE_NAMES[idx] || 'Імʼя та прізвище'}" autocomplete="off" />
    <button type="button" class="guest-remove" aria-label="Прибрати цього гостя">
      <span class="minus" aria-hidden="true">
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M2 6 L10 6"/></svg>
      </span>
    </button>
  `;
  list.appendChild(row);
  if (value) row.querySelector('.guest-name').value = value;
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

/* ---- Two-tap remove confirm ----
   Touch devices skip :hover entirely, so the hover-preview strikethrough
   never gets a chance to teach the consequence. Instead we use a uniform
   two-tap pattern: first tap arms the row (visible "прибрати?" pill +
   strikethrough + warm tint), second tap removes. Cancel paths: tap
   outside the row, tap another row's "−", or 5-second silent timeout. */

const ARM_TIMEOUT_MS = 5000;
let armedRow = null;
let armedTimer = null;

function armRow(row) {
  if (armedRow && armedRow !== row) disarmRow();
  row.classList.add('armed');
  armedRow = row;
  clearTimeout(armedTimer);
  armedTimer = setTimeout(disarmRow, ARM_TIMEOUT_MS);
}

function disarmRow() {
  if (armedRow) armedRow.classList.remove('armed');
  armedRow = null;
  clearTimeout(armedTimer);
  armedTimer = null;
}

function shakeButton(btn) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  btn.animate(
    [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-4px)' },
      { transform: 'translateX(4px)' },
      { transform: 'translateX(-2px)' },
      { transform: 'translateX(0)' },
    ],
    { duration: 320, easing: 'ease-out' }
  );
}

function readGuestNames(list) {
  return [...list.querySelectorAll('.guest-name')]
    .map((i) => i.value.trim())
    .filter(Boolean);
}

/** Replace all rows in the guest list with the provided names (used to
    restore a previously-saved RSVP). */
function setHousehold(list, addBtn, names) {
  list.innerHTML = '';
  if (Array.isArray(names) && names.length) {
    for (const name of names) addGuestRow(list, addBtn, { focus: false, value: name });
  }
  // Always keep at least one input row so the user can type.
  if (list.querySelectorAll('.guest-row').length === 0) {
    addGuestRow(list, addBtn, { focus: false });
  }
  renumberGuestRows(list, addBtn);
}

/** Returns true when `s` looks like "Ім'я Прізвище" (≥ 2 whitespace-separated
    tokens). Used to enforce surname entry — guests were submitting just first
    names which made the Sheet ambiguous. */
function hasFullName(s) {
  return String(s || '').trim().split(/\s+/).filter(Boolean).length >= 2;
}

/** Surface a friendly hint when the user tried to submit without picking
    «Так» or «На жаль». Shake the choices to draw the eye, drop an
    inline message under them, scroll into view, auto-clear after ~4s. */
function flagMissingAttendance(root) {
  const choiceRow = root.querySelector('.choice-row');
  if (!choiceRow) return;

  let hint = choiceRow.parentElement.querySelector('.choice-error');
  if (!hint) {
    hint = document.createElement('p');
    hint.className = 'choice-error';
    choiceRow.parentElement.insertBefore(hint, choiceRow.nextSibling);
  }
  hint.textContent = 'Будь ласка, спочатку оберіть відповідь.';

  choiceRow.classList.add('shake');
  setTimeout(() => choiceRow.classList.remove('shake'), 500);

  // If pills are off-screen (user scrolled to seal), bring them into view.
  choiceRow.scrollIntoView({ behavior: 'smooth', block: 'center' });

  clearTimeout(flagMissingAttendance._t);
  flagMissingAttendance._t = setTimeout(() => hint.remove(), 4000);
}

/** Focus + briefly tint an invalid name input, and surface a small inline
    hint underneath the guest list. Auto-clears after ~3.5s. */
function flagInvalidGuestInput(input, message) {
  if (!input) return;
  input.focus();
  input.classList.add('is-invalid');
  setTimeout(() => input.classList.remove('is-invalid'), 1400);

  const list = input.closest('#guestList') || input.closest('.guest-list');
  if (list) {
    let hint = list.parentElement.querySelector('.guest-list-error');
    if (!hint) {
      hint = document.createElement('p');
      hint.className = 'guest-list-error';
      list.parentElement.insertBefore(hint, list.nextSibling);
    }
    hint.textContent = message;
    clearTimeout(flagInvalidGuestInput._t);
    flagInvalidGuestInput._t = setTimeout(() => hint.remove(), 3500);
  }
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

// VS15 (︎) forces iOS Safari to render these as monochrome text glyphs
// (taking the parent's CSS color) rather than colored system emoji.
const HEART_SYMBOLS = ['♥︎', '♡︎', '✦︎', '✧︎'];

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

function showConfirmation(form, confirm, attending, { isExisting = false } = {}) {
  const title = confirm.querySelector('[data-confirm-title]');
  const body  = confirm.querySelector('[data-confirm-text]');
  if (isExisting) {
    title.textContent = 'Ви вже відповіли';
    body.textContent  = 'Дякуємо! Якщо щось зміниться — натисніть нижче, щоб оновити відповідь.';
  } else if (attending === 'yes') {
    title.textContent = 'Дякуємо!';
    body.textContent  = 'Вашу відповідь збережено. Чекаємо на Вас 17 липня.';
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

/** Backend stores attending in Ukrainian (так/ні) but the radio
    inputs in the form use the English codes (yes/no) that the
    submit handler expects. Normalize both directions when restoring.
    Legacy 'мабуть' rows (from a previous 3-option variant) are
    treated as 'yes' so the form still restores instead of going blank. */
const UA_TO_EN_ATTENDING = { 'так': 'yes', 'мабуть': 'yes', 'ні': 'no' };

/** Restore form values from a previously-saved RSVP. */
function restoreFormFromRsvp(form, list, addBtn, rsvp) {
  // Attendance radio
  if (rsvp.attending) {
    const code = UA_TO_EN_ATTENDING[rsvp.attending] || rsvp.attending;
    const radio = form.querySelector(`input[name="attend"][value="${code}"]`);
    if (radio) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  // Guest names — restore from previous submission.
  if (Array.isArray(rsvp.guest_names) && rsvp.guest_names.length) {
    setHousehold(list, addBtn, rsvp.guest_names);
  }
  // Wishes
  if (rsvp.wishes) {
    const ta = form.querySelector('#wishesField');
    if (ta) ta.value = rsvp.wishes;
  }
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

  // RSVP is gated on a personal ?g=slug link. Without one, swap the form +
  // confirm card for a friendly "this invitation is personal" notice and
  // bail before wiring submit handlers — there's nothing to submit.
  if (!getGuestSlug()) {
    root.classList.add('rsvp-locked');
    return;
  }

  // Mutable per-instance state that the submit handler reads. Slug + name
  // come from `guest:loaded`; `submittedAt` is preserved across edits so
  // we don't lose the original submission timestamp.
  const state = {
    slug:        null,
    displayName: null,
    submittedAt: null,
  };

  renumberGuestRows(list, addBtn);
  attachMagneticSeal(seal);

  // Add-guest button
  addBtn.addEventListener('click', () => addGuestRow(list, addBtn, { focus: true }));

  // Delegated remove (two-tap: arm → confirm) + Enter-to-add
  list.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.guest-remove');
    if (!removeBtn) return;
    const row = removeBtn.closest('.guest-row');
    // Last person standing — can't have an empty household. Shake the
    // button to acknowledge the tap without arming a dead-end state.
    if (list.querySelectorAll('.guest-row').length <= 1) {
      shakeButton(removeBtn);
      return;
    }
    if (row.classList.contains('armed')) {
      disarmRow();
      removeGuestRow(row, list, addBtn);
    } else {
      armRow(row);
    }
  });

  // Cancel armed state on any tap outside the armed row. Capture phase
  // so we run before the list's own click handler — guarantees that
  // tapping a DIFFERENT row's "−" disarms the prior row first, then
  // arms the new one (instead of confirming the wrong row).
  document.addEventListener('pointerdown', (e) => {
    if (!armedRow) return;
    if (!armedRow.contains(e.target)) disarmRow();
  }, true);
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

  // Listen for backend data — patches state + UI.
  document.addEventListener('guest:loaded', (e) => {
    const { slug, guest, rsvp } = e.detail || {};
    state.slug = slug || null;
    state.displayName = guest?.display_name || null;

    // Always prefill expected_guests as the BASELINE list — even when a
    // previous rsvp exists. Two reasons:
    //   1. If user previously said «Так» with custom names, restoreFromRsvp
    //      below overlays their saved names on top (overwrites baseline).
    //   2. If user previously said «На жаль» (guest_names is []), the
    //      restore skips the list update — so baseline stays. When they
    //      click «Змінити» → «Так» the list is already populated and
    //      they don't have to retype every guest from scratch.
    if (Array.isArray(guest?.expected_guests) && guest.expected_guests.length) {
      setHousehold(list, addBtn, guest.expected_guests);
    }

    if (rsvp) {
      state.submittedAt = rsvp.submitted_at || null;
      // Restoring previous answer fills values — that's the guest's own
      // data from a prior submit. Only overlays the list when there were
      // actually saved names; otherwise the expected baseline above wins.
      restoreFormFromRsvp(form, list, addBtn, rsvp);
      // Show "already replied" confirmation — user can hit «Змінити» to edit.
      showConfirmation(form, confirm, rsvp.attending, { isExisting: true });
    }
  });

  // Submit handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fd = new FormData(form);
    const attending = parseAttendance(fd.get('attend'));

    // Guard: attendance must be picked. The form has prefilled names from
    // the sheet, so a naive submit before choosing yes/no used to POST
    // attending=null → backend "bad-attending" → generic network-style
    // error. Catch it client-side with a friendly inline message instead.
    if (!attending) {
      flagMissingAttendance(root);
      return;
    }

    // Guard: 'yes' requires at least one named guest.
    const rawNames = readGuestNames(list);
    const needsNames = attending === 'yes';

    if (needsNames && rawNames.length === 0) {
      const first = list.querySelector('.guest-name');
      flagInvalidGuestInput(first, 'Будь ласка, вкажіть повне імʼя — разом з прізвищем.');
      return;
    }

    // Each filled row must contain BOTH name and surname (2+ words) so the
    // sheet doesn't get half-identified guests like "Ірина".
    if (needsNames) {
      const invalidInput = [...list.querySelectorAll('.guest-name')]
        .find((i) => i.value.trim() && !hasFullName(i.value));
      if (invalidInput) {
        flagInvalidGuestInput(invalidInput, 'Будь ласка, вкажіть повне імʼя — разом з прізвищем.');
        return;
      }
    }

    const payload = buildPayload({
      slug:        state.slug,
      displayName: state.displayName,
      attending,
      guestNames:  rawNames,
      wishes:      fd.get('wishes') || '',
      submittedAt: state.submittedAt,
    });

    // Heart burst originating at the seal's center.
    const sealRect = seal.getBoundingClientRect();
    burstHearts(sealRect.left + sealRect.width / 2, sealRect.top + sealRect.height / 2);

    // Disable seal during request; restore label on completion.
    const sealLabel = seal.querySelector('span');
    const originalLabel = sealLabel?.innerHTML;
    seal.disabled = true;
    if (sealLabel) sealLabel.textContent = 'Відправляємо…';

    const result = await submitRsvp(payload);

    seal.disabled = false;
    if (sealLabel && originalLabel) sealLabel.innerHTML = originalLabel;

    if (result?.ok) {
      // Preserve the original submission timestamp for subsequent edits.
      if (!state.submittedAt) state.submittedAt = payload.submitted_at;
      showConfirmation(form, confirm, payload.attending);
    } else {
      // Subtle error inline near the seal — minimal noise for the user.
      let err = root.querySelector('.rsvp-error');
      if (!err) {
        err = document.createElement('p');
        err.className = 'rsvp-error';
        seal.parentElement.appendChild(err);
      }
      err.textContent = 'Не вдалось зберегти. Перевірте з\'єднання і спробуйте ще раз.';
      setTimeout(() => { err.remove(); }, 6000);
    }
  });
}
