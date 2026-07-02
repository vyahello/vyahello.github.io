/* ============================================================
   guest.js — per-guest personalisation via Google Apps Script

   On boot, reads ?g=<slug> from URL, fetches GET to the backend,
   then dispatches `guest:loaded` once we know the guest + any
   existing RSVP. invitation.js & rsvp.js listen for that event
   and patch their own DOM.

   Submit path: rsvp.js calls submitRsvp(payload) which POSTs to
   the same Apps Script URL. Returns the parsed response so the
   caller can update UI on success / failure.

   Backend URL lives in data/event.json so it stays out of source
   files and can be rotated without touching code.
   ============================================================ */

const EVENT_NAME = 'guest:loaded';
const SLUG_RE    = /^[a-z0-9-]+$/i;

/** Pure: extract a sanitised slug from a URL search string. */
export function getGuestSlug(search = window.location.search) {
  const params = new URLSearchParams(search);
  const g = (params.get('g') || '').trim();
  return SLUG_RE.test(g) ? g.toLowerCase() : null;
}

/* Promise-cached so parallel callers (countdown.js + initGuest at boot)
   share ONE network request instead of racing two. Exported for reuse. */
let configPromise = null;
export function loadConfig() {
  if (!configPromise) {
    configPromise = fetch('data/event.json')
      .then((res) => res.json())
      .catch((err) => {
        console.warn('event.json load failed', err);
        return {};
      });
  }
  return configPromise;
}

/* AbortController + setTimeout (NOT AbortSignal.timeout — that throws on
   Safari < 15.4, i.e. iPhones stuck on iOS 15.3 and older). A hung Apps
   Script response otherwise pins the UI in its pending state for minutes. */
function timeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

/** Fetch guest + any existing RSVP. Returns null on any failure. */
async function fetchGuest(slug, appsScriptUrl) {
  const t = timeoutSignal(15000);
  try {
    const url = `${appsScriptUrl}?slug=${encodeURIComponent(slug)}`;
    const res = await fetch(url, { method: 'GET', signal: t.signal });
    const data = await res.json();
    return data?.ok ? data : null;
  } catch (err) {
    console.warn('Guest fetch failed', err);
    return null;
  } finally {
    t.cancel();
  }
}

/**
 * Submit an RSVP payload to the backend. Returns the parsed JSON
 * response: { ok: true } on success, { ok: false, error } on
 * known failure, or { ok: false, error: 'network' } on connection
 * issues. Falls back to console.log if no appsScriptUrl is wired
 * yet (so local dev keeps working).
 */
export async function submitRsvp(payload) {
  const cfg = await loadConfig();
  if (!cfg.appsScriptUrl) {
    console.log('[rsvp] no appsScriptUrl — payload (offline):', payload);
    return { ok: true, offline: true };
  }
  const t = timeoutSignal(20000);
  try {
    const res = await fetch(cfg.appsScriptUrl, {
      method:  'POST',
      // text/plain avoids the CORS preflight that application/json would
      // trigger — Apps Script can't respond to OPTIONS requests.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body:    JSON.stringify(payload),
      redirect: 'follow',
      signal:   t.signal,
    });
    return await res.json();
  } catch (err) {
    console.warn('RSVP submit failed', err);
    return { ok: false, error: 'network' };
  } finally {
    t.cancel();
  }
}

export async function initGuest() {
  const slug = getGuestSlug();
  if (!slug) return;
  const cfg = await loadConfig();
  if (!cfg.appsScriptUrl) return;
  const data = await fetchGuest(slug, cfg.appsScriptUrl);
  if (!data) return;
  document.dispatchEvent(new CustomEvent(EVENT_NAME, {
    detail: { slug, guest: data.guest, rsvp: data.reply || data.rsvp || null },
  }));
}
