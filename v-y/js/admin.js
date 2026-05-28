/* ============================================================
   admin.js — статистика для організаторів
     · /admin/?token=... → GET stats endpoint
     · якщо токен валідний → рендер дашборду
     · якщо немає/невірний → форма "Введіть токен"
   ============================================================ */

import { initTheme } from './theme.js';

const $ = (id) => document.getElementById(id);

const ATTEND_LABEL = {
  'так': 'Так',
  'ні': 'Ні',
};
const ATTEND_CLASS = {
  'так': 'is-yes',
  'ні': 'is-no',
};
const ATTEND_ORDER = ['так', 'ні'];

// Public site URL — used to build per-guest invitation links shown in the
// pending list copy/open action buttons. Hardcoded since the site lives at
// a stable URL; local dev (localhost:8123) will still copy the production
// link which is what organizer wants to share anyway.
const SITE_URL = 'https://vyahello.pro/v-y/';

// Ukrainian plural: 1 родина / 2 родини / 5 родин
function pluralUa(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} ${few}`;
  return `${n} ${many}`;
}

// Returns true when n agrees with a singular verb in UA — covers 1, 21, 31,
// 101 etc. but NOT 11 (which takes plural). Used for hero verb conjugation.
function isUaSingular(n) {
  return n % 10 === 1 && n % 100 !== 11;
}

// Compute the best human-readable name for a record. Priority order:
//   1. guest_names (full names with surnames — what guest typed in RSVP)
//   2. expected_guests (manually entered in Гості C — for «Ні» / pending)
//   3. display_name (short, no surname — last resort)
//   4. slug (technical fallback when nothing else)
// Display always favors surnames so organizer can identify guests for hotel
// bookings, contact lookups etc — short «Олег» is too ambiguous.
function bestName(r) {
  const names = Array.isArray(r?.guest_names) ? r.guest_names.filter(Boolean) : [];
  if (names.length) return names.join(', ');
  const expected = Array.isArray(r?.expected_guests) ? r.expected_guests.filter(Boolean) : [];
  if (expected.length) return expected.join(', ');
  return r?.display_name || r?.slug || '—';
}
const familiesText = (n) => pluralUa(n, 'родина', 'родини', 'родин');
// Fixed: 2/3/4 → "людини" (not "людей" — that's genitive plural for 5+).
const peopleText   = (n) => pluralUa(n, 'людина', 'людини', 'людей');
// «особа/особи/осіб» — used for overnight count (matches the email & form copy).
const osibText     = (n) => pluralUa(n, 'особа', 'особи', 'осіб');

// Word-only variants (no leading number) — useful when the number is
// already rendered in a separate, differently-styled element (e.g. hero).
const familiesWord = (n) => familiesText(n).replace(/^\d+\s+/, '');
const peopleWord   = (n) => peopleText(n).replace(/^\d+\s+/, '');
const osibWord     = (n) => osibText(n).replace(/^\d+\s+/, '');

function setTokenInUrl(token) {
  const url = new URL(window.location.href);
  if (token) url.searchParams.set('token', token);
  else url.searchParams.delete('token');
  window.history.replaceState({}, '', url);
}

function getTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return (params.get('token') || '').trim();
}

async function fetchEventConfig() {
  // resolve relative to the module URL so it works from both
  // /v-y/admin/ and any other folder depth without hard-coding.
  const url = new URL('../data/event.json', import.meta.url);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('event-config-failed');
  return res.json();
}

async function fetchStats(appsScriptUrl, token) {
  const url = `${appsScriptUrl}?stats=1&token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { method: 'GET', cache: 'no-store' });
  if (!res.ok) throw new Error('http-' + res.status);
  return res.json();
}

// POST a delete-reply request. Uses text/plain body so the Apps Script Web App
// runtime treats it as a simple request without CORS-preflight overhead, matching
// the existing RSVP-submit pattern (see guest.js).
async function postDeleteReply(appsScriptUrl, token, slug) {
  const res = await fetch(appsScriptUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body:    JSON.stringify({ action: 'delete-reply', token, slug }),
  });
  if (!res.ok) throw new Error('http-' + res.status);
  return res.json();
}

function showOnly(id) {
  for (const which of ['adminLocked', 'adminDash', 'adminError']) {
    const el = $(which);
    if (el) el.hidden = (which !== id);
  }
}

function setSub(text) {
  const el = $('adminSub');
  if (el) el.textContent = text;
}

function renderLocked(message) {
  $('adminLockedText').textContent = message || 'Введіть токен доступу.';
  showOnly('adminLocked');
  setSub('');
}

function renderError(message) {
  $('adminErrText').textContent = message || 'Не вдалось завантажити статистику.';
  showOnly('adminError');
  setSub('');
}

function renderStats(stats) {
  const s = stats.summary  || {};
  const a = stats.attending || {};
  const h = stats.headcount || {};

  const totalInvited = s.total_invited ?? 0;
  const responded    = s.responded ?? 0;
  const notResponded = s.not_responded ?? 0;
  const yesFam       = a.yes ?? 0;
  const noFam        = a.no  ?? 0;
  const yesPeople    = h.confirmed ?? 0;

  // HERO — the headline number organizer cares about most.
  // Hero verb conjugates with people count: «Прийде 1 людина» (singular)
  // vs «Прийдуть 6 людей» (plural). Same rule on subject side for the
  // sub-line — «1 родина · «Так»» vs «2 родини · «Так»» — handled by
  // pluralUa returning the right nominative form for each count.
  $('heroVerb').textContent            = isUaSingular(yesPeople) ? 'Прийде' : 'Прийдуть';
  $('heroPeople').textContent          = yesPeople;
  $('heroPeopleUnit').textContent      = peopleWord(yesPeople);
  $('heroYesFamilies').textContent     = yesFam;
  $('heroYesFamiliesUnit').textContent = familiesWord(yesFam);

  // BREAKDOWN — counts per status, plus people count for "yes".
  $('brkYesFam').textContent     = familiesText(yesFam);
  $('brkYesPpl').textContent     = peopleText(yesPeople);
  $('brkNoFam').textContent      = familiesText(noFam);
  $('brkPendingFam').textContent = familiesText(notResponded);

  // PROGRESS bar — % of families that have responded (any answer).
  const pct = totalInvited > 0 ? Math.round((responded / totalInvited) * 100) : 0;
  const bar = $('progressBar');
  const wrap = $('progressBarWrap');
  if (bar)  bar.style.width = pct + '%';
  if (wrap) wrap.setAttribute('aria-valuenow', String(pct));
  $('progressText').textContent = totalInvited > 0
    ? `Відгукнулися ${responded} з ${totalInvited} родин · ${pct}%`
    : 'Ще немає гостей у списку';

  // Who responded — grouped by attending, with persons count per row
  const respondersList = $('respondersList');
  respondersList.innerHTML = '';
  const responders = Array.isArray(stats.responders) ? stats.responders : [];
  if (responders.length === 0) {
    const li = document.createElement('li');
    li.className = 'admin-list-empty';
    li.textContent = 'Ще немає відповідей';
    respondersList.appendChild(li);
  } else {
    const groups = { 'так': [], 'ні': [] };
    for (const r of responders) {
      // Backstop: tolerate any legacy 'мабуть' value that slipped past
      // server-side normalization by grouping it with 'так'.
      const key = r.attending === 'мабуть' ? 'так' : r.attending;
      if (groups[key]) groups[key].push(r);
    }
    for (const key of ATTEND_ORDER) {
      const list = groups[key];
      if (!list || list.length === 0) continue;
      const persons = list.reduce((s, r) => s + (r.persons || 0), 0);
      const header = document.createElement('li');
      header.className = 'admin-list-group ' + (ATTEND_CLASS[key] || '');
      const left = document.createElement('span');
      left.textContent = ATTEND_LABEL[key];
      const right = document.createElement('span');
      right.className = 'admin-list-group-sub';
      right.textContent = key === 'ні'
        ? familiesText(list.length)
        : `${familiesText(list.length)} · ${peopleText(persons)}`;
      header.appendChild(left);
      header.appendChild(right);
      respondersList.appendChild(header);

      for (const r of list) {
        const li = document.createElement('li');
        li.className = 'admin-list-item admin-resp-item';

        const main = document.createElement('div');
        main.className = 'admin-resp-main';
        const name = document.createElement('span');
        name.className = 'admin-list-name';
        name.textContent = bestName(r);
        main.appendChild(name);

        const persons = document.createElement('span');
        persons.className = 'admin-resp-persons';
        persons.textContent = r.persons > 0 ? `${r.persons} ос.` : '—';

        li.appendChild(main);
        li.appendChild(persons);
        respondersList.appendChild(li);
      }
    }
  }

  // Overnight stays
  renderOvernight(stats.overnight);

  // Pending list
  const pendingList = $('pendingList');
  pendingList.innerHTML = '';
  const pending = Array.isArray(stats.pending) ? stats.pending : [];
  if (pending.length === 0) {
    const li = document.createElement('li');
    li.className = 'admin-list-empty';
    li.textContent = 'Усі відповіли';
    pendingList.appendChild(li);
  } else {
    for (const g of pending) {
      const li = document.createElement('li');
      li.className = 'admin-list-item admin-pending-item';
      const name = document.createElement('span');
      name.className = 'admin-list-name';
      name.textContent = bestName(g);

      // Fixed-width action group on the right — replaces the slug text
      // that was previously here. Two icon buttons: copy the personal
      // invitation link (most common — paste into Telegram/Viber) and
      // open it in a new tab (preview that the personalized page works).
      // Title shows the slug as a fallback identifier for hover.
      const actions = document.createElement('div');
      actions.className = 'admin-row-actions';
      actions.appendChild(makeRowActionBtn('copy', g.slug));
      actions.appendChild(makeRowActionBtn('open', g.slug));

      li.appendChild(name);
      li.appendChild(actions);
      pendingList.appendChild(li);
    }
  }

  // Recent list
  const recentList = $('recentList');
  recentList.innerHTML = '';
  const recent = Array.isArray(stats.recent) ? stats.recent : [];
  if (recent.length === 0) {
    const li = document.createElement('li');
    li.className = 'admin-list-empty';
    li.textContent = 'Ще немає відповідей';
    recentList.appendChild(li);
  } else {
    for (const r of recent) {
      const li = document.createElement('li');
      li.className = 'admin-list-item admin-list-recent-item ' + (ATTEND_CLASS[r.attending] || '');
      const row1 = document.createElement('div');
      row1.className = 'admin-recent-row';
      const name = document.createElement('span');
      name.className = 'admin-list-name';
      name.textContent = bestName(r);
      const badge = document.createElement('span');
      badge.className = 'admin-attend-badge ' + (ATTEND_CLASS[r.attending] || '');
      badge.textContent = ATTEND_LABEL[r.attending] || r.attending;

      // Per-row delete button — dataset carries the modal payload
      // (no separate lookup needed when click fires).
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'admin-row-delete';
      delBtn.setAttribute('aria-label', 'Видалити цю відповідь');
      delBtn.dataset.slug    = r.slug || '';
      delBtn.dataset.name    = r.display_name || r.slug || '';
      delBtn.dataset.persons = String((r.guest_names || []).filter(Boolean).length);
      delBtn.dataset.attend  = r.attending || '';
      delBtn.dataset.ts      = r.updated_at || r.submitted_at || '';
      delBtn.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M4 7 L20 7 M 9 7 L 9 4 L 15 4 L 15 7"/>' +
          '<path d="M6 7 L7 20 Q 7 21 8 21 L16 21 Q 17 21 17 20 L 18 7"/>' +
          '<path d="M10 11 L10 17 M14 11 L14 17"/>' +
        '</svg>';

      row1.appendChild(name);
      row1.appendChild(badge);
      row1.appendChild(delBtn);
      li.appendChild(row1);

      const meta = document.createElement('div');
      meta.className = 'admin-list-meta';
      const ts = r.updated_at || r.submitted_at || '';
      const names = Array.isArray(r.guest_names) ? r.guest_names.filter(Boolean) : [];
      // Overnight (🛏️ + count) inline у meta — strong signal for organizer
      // («хтось щойно попросив бронь у готелі»). Persons count from real
      // confirmed names only — never inflate with expected.
      const ovStr = r.overnight && r.overnight_count > 0
        ? ' · 🛏️ ' + r.overnight_count
        : '';
      meta.textContent = ts + (names.length ? ' · ' + names.length + ' ос.' : '') + ovStr;
      li.appendChild(meta);
      // Secondary .admin-recent-names line removed — main name now already
      // shows full names via bestName(), so a second pass would duplicate.

      if (r.wishes) {
        const wishes = document.createElement('div');
        wishes.className = 'admin-recent-wishes';
        wishes.textContent = '«' + r.wishes + '»';
        li.appendChild(wishes);
      }
      recentList.appendChild(li);
    }
  }

  const meta = $('adminMeta');
  if (meta) {
    const now = new Date().toLocaleString('uk-UA', { hour12: false });
    meta.textContent = 'Оновлено: ' + now;
  }

  showOnly('adminDash');
  setSub('Свіжа картина по гостях.');
}

/**
 * Render the «Залишаються на ніч» card.
 *   · headline: total people + families count з UA-plurals
 *   · list: одна рядок на родину з display_name + count
 *   · empty state — friendly placeholder коли ніхто ще не позначив
 */
function renderOvernight(overnight) {
  const o = overnight || {};
  const totalPeople = o.total_people ?? 0;
  const families = Array.isArray(o.families) ? o.families : [];

  $('overnightPeople').textContent  = totalPeople;
  $('overnightUnit').textContent    = osibWord(totalPeople);
  $('overnightFamCount').textContent = families.length;
  $('overnightFamUnit').textContent  = familiesWord(families.length);

  const list = $('overnightList');
  list.innerHTML = '';
  if (families.length === 0) {
    const li = document.createElement('li');
    li.className = 'admin-list-empty';
    li.textContent = 'Поки ніхто не позначив бронь.';
    list.appendChild(li);
    return;
  }
  for (const fam of families) {
    const li = document.createElement('li');
    li.className = 'admin-list-item';
    const name = document.createElement('span');
    name.className = 'admin-list-name';
    // Unified naming via bestName — full names with surnames for hotel
    // bookings. Same priority order as everywhere else in admin.
    name.textContent = bestName(fam);
    const persons = document.createElement('span');
    persons.className = 'admin-resp-persons';
    persons.textContent = (fam.count || 0) + ' ' + osibWord(fam.count || 0);
    li.appendChild(name);
    li.appendChild(persons);
    list.appendChild(li);
  }
}

async function loadStats(token) {
  setSub('Завантаження…');
  let cfg;
  try {
    cfg = await fetchEventConfig();
  } catch (err) {
    renderError('Не вдалось прочитати конфіг (data/event.json).');
    return;
  }
  if (!cfg.appsScriptUrl) {
    renderError('У data/event.json не задано appsScriptUrl.');
    return;
  }
  // Cache config + token so the delete-modal confirm handler can re-POST
  // without re-running this whole bootstrap flow.
  lastConfig = cfg;
  lastToken  = token;

  let data;
  try {
    data = await fetchStats(cfg.appsScriptUrl, token);
  } catch (err) {
    renderError('Не вдалось зʼєднатись з сервером.');
    return;
  }

  if (data && data.ok && data.stats) {
    setTokenInUrl(token);
    try { sessionStorage.setItem('v-y:admin-token', token); } catch { /* ignore */ }
    renderStats(data.stats);
    return;
  }

  if (data && data.error === 'unauthorized') {
    setTokenInUrl('');
    try { sessionStorage.removeItem('v-y:admin-token'); } catch { /* ignore */ }
    renderLocked('Невірний токен. Спробуйте ще раз.');
    return;
  }

  renderError('Сервер повернув помилку.');
}

function wireTokenForm() {
  const form = $('adminTokenForm');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('adminTokenInput');
    const token = (input && input.value || '').trim();
    if (!token) return;
    loadStats(token);
  });
}

function wireRetry() {
  const btn = $('adminRetry');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const token = getTokenFromUrl();
    if (token) loadStats(token);
    else renderLocked();
  });
}

/* ============================================================
   Delete-reply modal — state machine + toast.

   Flow:
     · Click × on a recent-list row     → openDeleteModal(payload)
     · Cancel / backdrop / ESC          → closeDeleteModal()
     · Confirm                          → POST → close + toast + reload
     · Backend error                    → inline modal error, modal stays open
   ============================================================ */

let lastConfig = null; // {appsScriptUrl} cached so confirm can re-POST
let lastToken  = '';

function showToast(message) {
  const el = $('adminToast');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { el.hidden = true; }, 2500);
}

// Build a 32×32 icon button for per-row actions in pending list.
// type = 'copy' (clipboard) or 'open' (external link).
function makeRowActionBtn(type, slug) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'admin-row-action admin-row-action-' + type;
  btn.dataset.slug = slug;
  btn.dataset.action = type;
  const label = type === 'copy'
    ? 'Скопіювати лінк для ' + slug
    : 'Відкрити лінк ' + slug + ' у новій вкладці';
  btn.setAttribute('aria-label', label);
  btn.title = label;
  btn.innerHTML = type === 'copy'
    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<rect x="8" y="8" width="12" height="12" rx="2"/>' +
        '<path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>' +
      '</svg>'
    : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M14 4h6v6"/>' +
        '<path d="M10 14L20 4"/>' +
        '<path d="M20 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6"/>' +
      '</svg>';
  return btn;
}

// Delegated click handler for row-action buttons. Wired once in boot();
// works for any future card that uses .admin-row-action buttons.
function handleRowActionClick(e) {
  const btn = e.target.closest('.admin-row-action');
  if (!btn) return;
  const slug = btn.dataset.slug;
  if (!slug) return;
  const url = SITE_URL + '?g=' + encodeURIComponent(slug);
  if (btn.dataset.action === 'copy') {
    (navigator.clipboard?.writeText(url) || Promise.reject())
      .then(() => showToast('Лінк скопійовано'))
      .catch(() => {
        // Older browsers / non-HTTPS contexts — fallback via temp textarea.
        try {
          const ta = document.createElement('textarea');
          ta.value = url;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          showToast('Лінк скопійовано');
        } catch {
          showToast('Не вдалось скопіювати');
        }
      });
  } else if (btn.dataset.action === 'open') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

function openDeleteModal(payload) {
  const modal = $('deleteModal');
  if (!modal) return;
  $('deleteModalMeta').textContent = formatDeleteMeta(payload);
  $('deleteConfirmBtn').dataset.slug = payload.slug;
  $('deleteConfirmBtn').disabled = false;
  $('deleteConfirmBtn').textContent = 'Так, видалити';
  const errEl = $('deleteModalError');
  if (errEl) { errEl.hidden = true; errEl.textContent = ''; }
  modal.hidden = false;
  // Defer focus so the modal is paint-stable before the cancel-button grabs
  // it — instant focus on a hidden-then-shown element occasionally jumps
  // scroll position in WebKit.
  requestAnimationFrame(() => $('deleteCancelBtn')?.focus());
}

function closeDeleteModal() {
  const modal = $('deleteModal');
  if (!modal) return;
  modal.hidden = true;
}

function formatDeleteMeta({ name, persons, attend, ts }) {
  const bits = [name || '—'];
  const n = parseInt(persons, 10);
  if (Number.isFinite(n) && n > 0) bits.push(`${n} ${osibWord(n)}`);
  if (attend) bits.push(ATTEND_LABEL[attend] || attend);
  if (ts) bits.push(ts);
  return bits.join(' · ');
}

async function performDelete(slug) {
  if (!lastConfig?.appsScriptUrl || !lastToken) {
    return { ok: false, error: 'no-config' };
  }
  try {
    return await postDeleteReply(lastConfig.appsScriptUrl, lastToken, slug);
  } catch (err) {
    return { ok: false, error: 'network' };
  }
}

function wireDeleteFlow() {
  // Delegated click on recent-list: any row's × triggers the modal.
  const recentList = $('recentList');
  if (recentList) {
    recentList.addEventListener('click', (e) => {
      const btn = e.target.closest('.admin-row-delete');
      if (!btn) return;
      e.preventDefault();
      openDeleteModal({
        slug:    btn.dataset.slug,
        name:    btn.dataset.name,
        persons: btn.dataset.persons,
        attend:  btn.dataset.attend,
        ts:      btn.dataset.ts,
      });
    });
  }

  // Modal close handlers — backdrop, Cancel, ESC.
  const modal = $('deleteModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target.closest('[data-modal-close]')) closeDeleteModal();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('deleteModal')?.hidden) closeDeleteModal();
  });

  // Confirm click — fires the POST + handles success/error states.
  const confirmBtn = $('deleteConfirmBtn');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      const slug = confirmBtn.dataset.slug;
      if (!slug) return;
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Видаляємо…';
      const errEl = $('deleteModalError');
      if (errEl) { errEl.hidden = true; errEl.textContent = ''; }

      const result = await performDelete(slug);

      if (result.ok) {
        closeDeleteModal();
        showToast(result.deleted === false
          ? 'Запис уже відсутній — оновлюю дані.'
          : 'Відповідь видалено.');
        // Reload stats so the row disappears from the dashboard.
        loadStats(lastToken);
        return;
      }

      // Inline error inside the modal — keep it open so user can retry.
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Так, видалити';
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = result.error === 'unauthorized'
          ? 'Сесія минула — оновіть сторінку і введіть токен ще раз.'
          : 'Не вдалось видалити. Перевірте з\'єднання й спробуйте ще раз.';
      }
    });
  }
}

function boot() {
  initTheme();
  wireTokenForm();
  wireRetry();
  wireDeleteFlow();
  // Delegated row-action handler on document — picks up copy/open clicks
  // from any card. Currently only pending list uses these, but the handler
  // is generic if other cards add action buttons later.
  document.addEventListener('click', handleRowActionClick);

  let token = getTokenFromUrl();
  if (!token) {
    try { token = sessionStorage.getItem('v-y:admin-token') || ''; } catch { /* ignore */ }
  }
  if (token) {
    loadStats(token);
  } else {
    renderLocked();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
