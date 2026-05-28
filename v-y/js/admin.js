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
        name.textContent = r.display_name || r.slug;
        main.appendChild(name);

        const names = Array.isArray(r.guest_names) ? r.guest_names.filter(Boolean) : [];
        if (names.length) {
          const namesEl = document.createElement('div');
          namesEl.className = 'admin-resp-names';
          namesEl.textContent = names.join(', ');
          main.appendChild(namesEl);
        }

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
      li.className = 'admin-list-item';
      const name = document.createElement('span');
      name.className = 'admin-list-name';
      name.textContent = g.display_name || g.slug;
      const slug = document.createElement('span');
      slug.className = 'admin-list-meta';
      slug.textContent = g.slug;
      li.appendChild(name);
      li.appendChild(slug);
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
      name.textContent = r.display_name || r.slug;
      const badge = document.createElement('span');
      badge.className = 'admin-attend-badge ' + (ATTEND_CLASS[r.attending] || '');
      badge.textContent = ATTEND_LABEL[r.attending] || r.attending;
      row1.appendChild(name);
      row1.appendChild(badge);
      li.appendChild(row1);

      const meta = document.createElement('div');
      meta.className = 'admin-list-meta';
      const ts = r.updated_at || r.submitted_at || '';
      const names = Array.isArray(r.guest_names) ? r.guest_names.filter(Boolean) : [];
      // Include overnight (🛏️ + count) inline у meta — це сильний сигнал
      // для організатора («хтось щойно попросив бронь у готелі»).
      const ovStr = r.overnight && r.overnight_count > 0
        ? ' · 🛏️ ' + r.overnight_count
        : '';
      meta.textContent = ts + (names.length ? ' · ' + names.length + ' ос.' : '') + ovStr;
      li.appendChild(meta);

      if (names.length) {
        const guestList = document.createElement('div');
        guestList.className = 'admin-recent-names';
        guestList.textContent = names.join(', ');
        li.appendChild(guestList);
      }

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
    // Prefer full names (with surnames) from guest_names array — organizer
    // needs surnames to book hotel rooms. Fall back to short display_name
    // if guest_names is empty (legacy rows / edge cases).
    const fullNames = Array.isArray(fam.guest_names)
      ? fam.guest_names.filter(Boolean)
      : [];
    name.textContent = fullNames.length
      ? fullNames.join(', ')
      : (fam.display_name || fam.slug);
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

function boot() {
  initTheme();
  wireTokenForm();
  wireRetry();

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
