/* ============================================================
   rsvp.js — multi-step RSVP form
   ============================================================ */

const MIN_SEATS = 1;
const MAX_SEATS = 10;
const DEFAULT_SEATS = 2;   // Stage 7 will override per guest

/** Step indices kept as constants so the table below stays readable. */
const STEP_ATTEND  = 0;
const STEP_SEATS   = 1;
const STEP_FOOD    = 2;
const STEP_WISHES  = 3;
const STEP_SUCCESS = 4;

/**
 * Compute the ordered list of steps a user with given state should walk through.
 * - Attending=null: only the first step (haven't chosen).
 * - Attending=true: 0 → 1 → 2 → 3 → 4
 * - Attending=false: 0 → 3 → 4 (skip seats + food)
 * @returns {number[]}
 */
export function computeStepFlow(attending) {
  if (attending === true)  return [STEP_ATTEND, STEP_SEATS, STEP_FOOD, STEP_WISHES, STEP_SUCCESS];
  if (attending === false) return [STEP_ATTEND,                         STEP_WISHES, STEP_SUCCESS];
  return [STEP_ATTEND];
}

/** Clamp the seats number to [MIN_SEATS, MAX_SEATS]. Non-numbers fall to DEFAULT_SEATS. */
export function clampSeats(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return DEFAULT_SEATS;
  return Math.max(MIN_SEATS, Math.min(MAX_SEATS, Math.round(num)));
}

/** Build the submission payload from form state. Stage 6 sends this to Apps Script. */
export function buildPayload(state) {
  return {
    guest_id:     state.guestId || null,
    name:         state.name || null,
    attending:    state.attending === true,
    seats:        state.attending === true ? clampSeats(state.seats) : 0,
    food:         state.attending === true ? [...state.food] : [],
    allergies:    state.attending === true ? (state.allergies || '') : '',
    wishes:       state.wishes || '',
    submitted_at: new Date().toISOString(),
  };
}

/** Compute progress 0..1 given the index of the currently-visible step in the flow. */
function progressFraction(flow, currentStep) {
  const i = flow.indexOf(currentStep);
  if (i < 0) return 0;
  return (i + 1) / flow.length;
}

/**
 * Browser entry. Wires up the §8 RSVP DOM. Safe to call when the form is missing
 * — does nothing.
 *
 * The submit handler currently logs to console; Stage 6 will replace it with an
 * Apps Script fetch.
 */
export function initRSVP() {
  const root = document.getElementById('rsvp');
  if (!root) return;
  const form = root.querySelector('.rsvp__form');
  if (!form) return;

  // ----- state -----
  const state = {
    guestId:   null,                  // Stage 7 fills
    name:      null,                  // Stage 7 fills
    attending: null,                  // true | false
    seats:     DEFAULT_SEATS,         // Stage 7 may pre-fill from guest.seats
    food:      [],                    // ["meat", "fish", ...]
    allergies: '',
    wishes:    '',
  };

  // ----- DOM refs -----
  const stepEls = form.querySelectorAll('[data-step]');
  const barEl   = form.querySelector('[data-rsvp-bar]');
  const seatsEl = form.querySelector('[data-rsvp-seats]');

  // ----- step navigation -----
  let currentStep = STEP_ATTEND;

  function updateProgress() {
    const flow = computeStepFlow(state.attending);
    const pct  = Math.round(progressFraction(flow, currentStep) * 100);
    if (barEl) barEl.style.width = `${pct}%`;
  }

  function showStep(step) {
    currentStep = step;
    for (const el of stepEls) {
      el.classList.toggle('is-active', Number(el.dataset.step) === step);
    }
    updateProgress();
  }

  function nextStep() {
    const flow = computeStepFlow(state.attending);
    const i = flow.indexOf(currentStep);
    if (i < 0 || i === flow.length - 1) return;
    showStep(flow[i + 1]);
  }

  function prevStep() {
    const flow = computeStepFlow(state.attending);
    const i = flow.indexOf(currentStep);
    if (i <= 0) return;
    showStep(flow[i - 1]);
  }

  // ----- handlers -----
  form.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;

    // Attendance
    if (t.dataset.attending !== undefined) {
      state.attending = t.dataset.attending === 'true';
      nextStep();
      return;
    }

    // Seats stepper
    if (t.dataset.stepper !== undefined) {
      const delta = Number(t.dataset.stepper);
      state.seats = clampSeats(state.seats + delta);
      if (seatsEl) seatsEl.textContent = String(state.seats);
      return;
    }

    // Food chips (multi-select)
    if (t.dataset.food !== undefined) {
      const v = t.dataset.food;
      const isOn = state.food.includes(v);
      state.food = isOn ? state.food.filter((x) => x !== v) : [...state.food, v];
      t.classList.toggle('is-active', !isOn);
      return;
    }

    // Navigation
    if ('rsvpNext' in t.dataset) { nextStep(); return; }
    if ('rsvpPrev' in t.dataset) { prevStep(); return; }

    // Submit
    if ('rsvpSubmit' in t.dataset) {
      // Pull text-field state from DOM at submit time so we don't echo on every keystroke.
      const allergiesEl = form.querySelector('[data-rsvp-allergies]');
      const wishesEl    = form.querySelector('[data-rsvp-wishes]');
      state.allergies = allergiesEl ? allergiesEl.value.trim() : '';
      state.wishes    = wishesEl    ? wishesEl.value.trim()    : '';

      const payload = buildPayload(state);
      // Stage 6 replaces this with: await fetch(eventData.appsScriptUrl, { method:'POST', body:JSON.stringify(payload) })
      console.log('[rsvp] payload (would POST in Stage 6):', payload);
      showStep(STEP_SUCCESS);
      return;
    }
  });

  // ----- init -----
  if (seatsEl) seatsEl.textContent = String(state.seats);
  showStep(STEP_ATTEND);
}
