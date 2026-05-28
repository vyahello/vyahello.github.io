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
/** Coerce raw overnight count into safe integer (1..MAX_GUESTS) or 0.
    Used both at submit-time and when restoring from server response.
    Returns 0 when overnight flag is false — so backend never gets a
    nonzero count without a true flag. */
export function sanitizeOvernightCount(raw, overnight) {
  if (!overnight) return 0;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  if (n > MAX_GUESTS) return MAX_GUESTS;
  return n;
}

export function buildPayload(state = {}) {
  const attending = parseAttendance(state.attending);
  const names = sanitizeGuestNames(state.guestNames);
  const wishes = typeof state.wishes === 'string' ? state.wishes.trim() : '';
  // «На жаль» — overnight is moot; force it off regardless of UI state.
  const overnight = attending === 'yes' && !!state.overnight;
  const overnight_count = overnight ? sanitizeOvernightCount(state.overnightCount, true) : 0;
  return {
    slug:            state.slug         ?? null,
    display_name:    state.displayName  ?? null,
    attending,
    guest_names:     attending === 'no' ? [] : names,
    wishes,
    overnight,
    overnight_count,
    submitted_at:    state.submittedAt || new Date().toISOString(),
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
      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M2 4 L12 4 M 5.5 4 L 5.5 2 L 8.5 2 L 8.5 4"/>
        <path d="M3.5 4 L4 12 Q 4 12.5 4.5 12.5 L9.5 12.5 Q 10 12.5 10 12 L 10.5 4"/>
      </svg>
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

/** Returns every guest-name input that is filled-but-incomplete
    (single-token value — no surname). Empty rows pass; user can have
    blank slots without being nagged. */
function findInvalidGuestInputs(list) {
  return [...list.querySelectorAll('.guest-name')]
    .filter((i) => i.value.trim() && !hasFullName(i.value));
}

/** Mark the overnight-count input as invalid: red tint + shake + inline
    hint right under the count row. Same pattern as guest-name validation
    so error voice is consistent across the form. Tint clears live via
    the input listener wired in initRSVP. */
function flagInvalidOvernightCount(input, message) {
  if (!input) return;
  // Force reflow so re-adding class retriggers shake on repeat submits.
  input.classList.remove('is-invalid');
  void input.offsetWidth;
  input.classList.add('is-invalid');
  input.focus();
  // Find/create inline hint inside the .overnight-count wrap.
  const wrap = input.closest('.overnight-count');
  if (!wrap) return;
  let hint = wrap.querySelector('.overnight-error');
  if (!hint) {
    hint = document.createElement('p');
    hint.className = 'overnight-error';
    // Place AFTER the count row but BEFORE the soft .ov-hint so error
    // visually wins focus over the payment-disclaimer text.
    const countRow = wrap.querySelector('.ov-count-row');
    if (countRow) countRow.insertAdjacentElement('afterend', hint);
    else wrap.appendChild(hint);
  }
  hint.textContent = message;
  clearTimeout(flagInvalidOvernightCount._t);
  flagInvalidOvernightCount._t = setTimeout(() => hint.remove(), 4000);
}

/** Mark a batch of guest-name inputs as invalid: red tint + shake on
    EACH, focus the first, surface a single inline hint under the list.
    Tint persists until the user fixes the field (live-clear via the
    input listener wired in initRSVP) — re-submitting retriggers the
    shake via the offsetWidth reflow trick. */
function flagInvalidGuestInputs(inputs, message, list) {
  if (!inputs?.length || !list) return;
  // Drop prior is-invalid across the whole list so stale red doesn't
  // linger on rows that the new validation pass considers fine.
  list.querySelectorAll('.guest-name.is-invalid').forEach((i) => i.classList.remove('is-invalid'));
  // Force reflow so re-adding the class on the same input retriggers
  // the shake CSS animation (otherwise it only plays on first add).
  void list.offsetWidth;
  inputs.forEach((i) => i.classList.add('is-invalid'));
  inputs[0].focus();

  let hint = list.parentElement.querySelector('.guest-list-error');
  if (!hint) {
    hint = document.createElement('p');
    hint.className = 'guest-list-error';
    list.parentElement.insertBefore(hint, list.nextSibling);
  }
  hint.textContent = message;
  clearTimeout(flagInvalidGuestInputs._t);
  flagInvalidGuestInputs._t = setTimeout(() => hint.remove(), 3500);
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

  // Fresh submit: the form (tall, at the section's bottom) collapses and
  // the confirm card takes its place — but viewport scroll stays put, so
  // the sticker + «Дякуємо!» often end up above the fold. Pull them into
  // view. Skipped on isExisting (page load) — would jolt every revisit.
  // rAF waits for the form-hide reflow before measuring.
  if (!isExisting) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(() => {
      confirm.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    });
  }
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
  // Overnight stay — restore checkbox + count. Backend stores overnight as
  // boolean or UA string ('так'/'ні') — accept both.
  const ovToggle = form.querySelector('#overnightToggle');
  const ovCount  = form.querySelector('#overnightCount');
  const ovWrap   = form.querySelector('#overnightCountWrap');
  if (ovToggle) {
    const wantsOvernight = rsvp.overnight === true ||
                           rsvp.overnight === 'так' ||
                           rsvp.overnight === 'true';
    ovToggle.checked = wantsOvernight;
    if (wantsOvernight && ovCount) {
      const n = parseInt(rsvp.overnight_count, 10);
      ovCount.value = (Number.isFinite(n) && n >= 1) ? String(Math.min(n, MAX_GUESTS)) : '1';
    }
    if (ovWrap) ovWrap.dataset.revealed = wantsOvernight ? 'true' : 'false';
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

  // Validate any incomplete rows BEFORE adding a new one — same check
  // as the submit handler, just earlier. Catches typos at the moment
  // they happen instead of surprising the user at submit time.
  function tryAddRow() {
    const invalids = findInvalidGuestInputs(list);
    if (invalids.length) {
      flagInvalidGuestInputs(invalids, 'Будь ласка, вкажіть повне імʼя — разом з прізвищем.', list);
      return;
    }
    addGuestRow(list, addBtn, { focus: true });
  }

  // Add-guest button — validates filled rows first.
  addBtn.addEventListener('click', tryAddRow);

  // Delegated remove — single tap. The trash icon makes the intent
  // unambiguous; removeGuestRow already guards against deleting the
  // only remaining row so accidental empty-household is impossible.
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
      // Enter on the LAST row mimics the "+" button → same validation path.
      if (idx === rows.length - 1) tryAddRow();
      else rows[idx + 1].querySelector('.guest-name').focus();
    }
  });

  // Live-clear: drop the red .is-invalid the moment the user types a
  // valid full name (or empties the field). Gives instant "I fixed it"
  // feedback without making them re-submit to learn the tint is gone.
  list.addEventListener('input', (e) => {
    const input = e.target.closest('.guest-name');
    if (!input || !input.classList.contains('is-invalid')) return;
    const v = input.value.trim();
    if (!v || hasFullName(v)) input.classList.remove('is-invalid');
  });

  // Hide the guest list + overnight block if attendance flips to 'no'.
  // Overnight is meaningless for declines, so we hide AND uncheck it.
  const guestWrap     = root.querySelector('#guestCountWrap');
  const overnightWrap = root.querySelector('#overnightWrap');
  const ovToggle      = root.querySelector('#overnightToggle');
  const ovCountWrap   = root.querySelector('#overnightCountWrap');
  for (const r of root.querySelectorAll('input[name="attend"]')) {
    r.addEventListener('change', () => {
      const isNo = r.checked && r.value === 'no';
      if (guestWrap)     guestWrap.style.display     = isNo ? 'none' : '';
      if (overnightWrap) overnightWrap.style.display = isNo ? 'none' : '';
      // When user declines, force-uncheck overnight (don't keep ghost state
      // that would be sent on a later flip-back to «yes»).
      if (isNo && ovToggle && ovToggle.checked) {
        ovToggle.checked = false;
        if (ovCountWrap) ovCountWrap.dataset.revealed = 'false';
      }
    });
  }

  // Overnight checkbox → reveal/hide count input via data-revealed flag
  // (CSS handles max-height + opacity transition). Auto-focus the count
  // when first revealed so user can immediately type.
  const ovCountInput = root.querySelector('#overnightCount');
  if (ovToggle && ovCountWrap) {
    ovToggle.addEventListener('change', () => {
      ovCountWrap.dataset.revealed = ovToggle.checked ? 'true' : 'false';
      if (ovToggle.checked) {
        // Default to total filled guests (or 1 if empty/not picked yet).
        if (ovCountInput && ovCountInput.value === '1') {
          const filledGuests = readGuestNames(list).length;
          if (filledGuests >= 2) ovCountInput.value = String(Math.min(filledGuests, MAX_GUESTS));
        }
      } else {
        // Unchecking — clear any stale validation state.
        ovCountInput?.classList.remove('is-invalid');
        ovCountWrap.querySelector('.overnight-error')?.remove();
      }
    });
  }

  // Live-clear: drop red .is-invalid коли користувач вводить валідне
  // число (≥1). Same UX as guest-name live-clear — instant «I fixed
  // it» feedback без потреби resubmit'ити щоб побачити що тінт зник.
  if (ovCountInput) {
    ovCountInput.addEventListener('input', () => {
      if (!ovCountInput.classList.contains('is-invalid')) return;
      const n = parseInt(ovCountInput.value, 10);
      if (Number.isFinite(n) && n >= 1) {
        ovCountInput.classList.remove('is-invalid');
        ovCountWrap?.querySelector('.overnight-error')?.remove();
      }
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
      flagInvalidGuestInputs([first], 'Будь ласка, вкажіть повне імʼя — разом з прізвищем.', list);
      return;
    }

    // Each filled row must contain BOTH name and surname (2+ words) so the
    // sheet doesn't get half-identified guests like "Ірина". Flag ALL
    // offenders at once — partial flagging confused users who fixed one,
    // re-submitted, then got bounced again for the next invalid row.
    if (needsNames) {
      const invalids = findInvalidGuestInputs(list);
      if (invalids.length) {
        flagInvalidGuestInputs(invalids, 'Будь ласка, вкажіть повне імʼя — разом з прізвищем.', list);
        return;
      }
    }

    // Overnight guard: якщо гість позначив «залишимось», але стер
    // дефолтну «1», ми силоміць писали 1 — гість думав «не вибрав»,
    // а в Sheet їх ставили на 1 особу. Тепер блокуємо submit і
    // просимо вказати кількість явно.
    const ovChecked = fd.get('overnight') === 'on';
    const ovCountRaw = fd.get('overnight_count');
    if (needsNames && ovChecked) {
      const n = parseInt(ovCountRaw, 10);
      if (!Number.isFinite(n) || n < 1) {
        flagInvalidOvernightCount(
          ovCountInput,
          'Будь ласка, вкажіть кількість осіб (1–9).'
        );
        return;
      }
    }

    const payload = buildPayload({
      slug:           state.slug,
      displayName:    state.displayName,
      attending,
      guestNames:     rawNames,
      wishes:         fd.get('wishes') || '',
      overnight:      fd.get('overnight') === 'on',
      overnightCount: fd.get('overnight_count'),
      submittedAt:    state.submittedAt,
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
