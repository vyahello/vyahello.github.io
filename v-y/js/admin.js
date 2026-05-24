/* ============================================================
   admin.js — статистика для організаторів
     · /admin.html?token=... → GET stats endpoint у Apps Script
     · якщо токен валідний → рендер дашборду
     · якщо немає/невірний → форма "Введіть токен"
   ============================================================ */

import { initTheme } from './theme.js';

const $ = (id) => document.getElementById(id);

const ATTEND_LABEL = {
  'так': 'Так',
  'мабуть': 'Можемо',
  'ні': 'Ні',
};
const ATTEND_CLASS = {
  'так': 'is-yes',
  'мабуть': 'is-maybe',
  'ні': 'is-no',
};
const ATTEND_ORDER = ['так', 'мабуть', 'ні'];

// Ukrainian plural: 1 родина / 2 родини / 5 родин
function pluralUa(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} ${few}`;
  return `${n} ${many}`;
}
const familiesText = (n) => pluralUa(n, 'родина', 'родини', 'родин');
const peopleText   = (n) => pluralUa(n, 'людина', 'людей', 'людей');

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
  const res = await fetch('data/event.json', { cache: 'no-store' });
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
  const s = stats.summary || {};
  $('statInvited').textContent   = s.total_invited ?? '—';
  $('statResponded').textContent = s.responded ?? '—';
  $('statPending').textContent   = s.not_responded ?? '—';
  $('statRate').textContent      = (s.response_rate != null)
    ? Math.round(s.response_rate * 100) + '%'
    : '—';

  const a = stats.attending || {};
  $('cntYes').textContent   = a.yes ?? '—';
  $('cntMaybe').textContent = a.maybe ?? '—';
  $('cntNo').textContent    = a.no ?? '—';

  const h = stats.headcount || {};
  $('hcConfirmed').textContent = h.confirmed ?? '—';
  $('hcMaybe').textContent     = h.maybe ?? '—';
  $('hcTotal').textContent     = h.total_expected ?? '—';

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
    const groups = { 'так': [], 'мабуть': [], 'ні': [] };
    for (const r of responders) {
      if (groups[r.attending]) groups[r.attending].push(r);
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
        const name = document.createElement('span');
        name.className = 'admin-list-name';
        name.textContent = r.display_name || r.slug;
        const persons = document.createElement('span');
        persons.className = 'admin-resp-persons';
        persons.textContent = r.persons > 0 ? `${r.persons} ос.` : '—';
        li.appendChild(name);
        li.appendChild(persons);
        respondersList.appendChild(li);
      }
    }
  }

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
      meta.textContent = ts + (names.length ? ' · ' + names.length + ' ос.' : '');
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
  setSub('Картина по гостях. Дані з Google Sheet через Apps Script.');
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
