/* ============================================================
   location.js — §5 Дві локації — Leaflet maps + theme-aware tiles

   Тепер ініціалізує ДВІ мапи паралельно:
     · #mapChurch  → Домініканський собор (15:00, Шлюб)
     · #mapBanquet → Soprano Inn          (17:30, Бенкет)

   · Tile basemap: CARTO `light_all` для cream / `dark_all` для dark,
     обидві мапи слухають один спільний `theme:changed` event.
   · Custom golden divIcon маркер на обох мапах (CSS .custom-marker).
   · Кожна картка має свій маршрут-link з персональним maps URL.
   · Lazy-init через IntersectionObserver — мапи стартують лише коли
     секція location потрапляє в viewport (економить мобайл-трафік;
     до того часу — порожній контейнер з theme-aware фоном).
   · Fallback (text + icon) у тому ж контейнері якщо Leaflet not loaded.
   ============================================================ */

const CHURCH = {
  id:       'mapChurch',
  linkId:   'routeChurch',
  lat:      49.8427498,
  lng:      24.0338232,
  name:     'Домініканський собор',
  // maps.app shortlink — короткий, гарно відкривається в нативному
  // Maps app на iOS/Android, тому залишаємо як є.
  url:      'https://maps.app.goo.gl/raL1iWuaL2DRXqRh6',
  zoom:     16,
};

const BANQUET = {
  id:       'mapBanquet',
  linkId:   'routeBanquet',
  lat:      49.7676623,
  lng:      24.0866213,
  name:     'Soprano Inn',
  // Officially-documented Google Maps URL form: `?api=1&query=<text>` плюс
  // `query_place_id=<id>` — гарантовано відкриває цей конкретний заклад
  // (не випадковий "Soprano" у світі). place_id виловлено з Google Maps
  // search для «Soprano Inn Кільцева 8 Пасіки-Зубрицькі». Раніше URL мав
  // формат `query=lat,lng(label)` — Google інтерпретував дужки літерально
  // як текстовий пошук і повертав «no result».
  url:      'https://www.google.com/maps/search/?api=1&query=Soprano+Inn&query_place_id=ChIJu2qmJ2DpOkcR3Yh2ExtpQU8',
  zoom:     16,
};

function showMapFallback(mapEl, label) {
  if (!mapEl) return;
  mapEl.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;padding:18px;gap:10px;background:var(--bg-grain);">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.2" aria-hidden="true">
        <path d="M12 21s-7-7.5-7-12a7 7 0 1 1 14 0c0 4.5-7 12-7 12z"/>
        <circle cx="12" cy="9" r="2.5"/>
      </svg>
      <div style="font-family:var(--font-mono);font-size:9px;letter-spacing:.3em;text-transform:uppercase;color:var(--ink-mute);">Натисніть нижче</div>
      <div style="font-family:var(--font-display);font-size:15px;color:var(--ink);line-height:1.3;">щоб відкрити <br>${label} <br>у Google Maps</div>
    </div>`;
}

function cartoStyleFor(theme) {
  return theme === 'dark' ? 'dark_all' : 'light_all';
}

function buildTileLayer(theme) {
  // L is global from CDN script.
  return L.tileLayer(
    `https://{s}.basemaps.cartocdn.com/${cartoStyleFor(theme)}/{z}/{x}/{y}{r}.png`,
    { attribution: '© OpenStreetMap, © CARTO', subdomains: 'abcd', maxZoom: 19 },
  );
}

/**
 * Wire the route-button immediately (works without Leaflet).
 * Залишаємо `href` як є, якщо вже стоїть в HTML — інакше підставляємо.
 */
function wireRouteLink(venue) {
  const link = document.getElementById(venue.linkId);
  if (!link) return;
  if (!link.getAttribute('href')) link.href = venue.url;
  link.target = '_blank';
  link.rel    = 'noopener noreferrer';
}

/**
 * Initialise a single Leaflet map. Returns the map instance (so the
 * theme-swap listener can iterate them) or null on failure.
 */
function createVenueMap(venue) {
  const el = document.getElementById(venue.id);
  if (!el) return null;
  if (typeof L === 'undefined') {
    showMapFallback(el, venue.name);
    return null;
  }

  // Touch-primary devices get a static map: with dragging on, a vertical
  // swipe that starts on either full-width map pans the map instead of
  // scrolling the page — guests got 'stuck' twice inside §location.
  // Desktop keeps drag (scroll wheel zoom is already off — same parity).
  const touchPrimary = window.matchMedia('(hover: none)').matches;

  const map = L.map(el, {
    center: [venue.lat, venue.lng],
    zoom:   venue.zoom,
    zoomControl:        false,
    scrollWheelZoom:    false,
    dragging:           !touchPrimary,
    touchZoom:          false,
    tap:                false,
    doubleClickZoom:    false,
    attributionControl: true,
    keyboard:           false,
  });

  const currentTheme = document.body.getAttribute('data-theme') || 'cream';
  let tileLayer = buildTileLayer(currentTheme).addTo(map);

  let tileErrors = 0;
  const attachErrorWatcher = (layer) => {
    layer.on('tileerror', () => {
      tileErrors++;
      if (tileErrors > 3) showMapFallback(el, venue.name);
    });
  };
  attachErrorWatcher(tileLayer);

  const icon = L.divIcon({
    className:  '',
    html:       '<div class="custom-marker" aria-hidden="true"></div>',
    iconSize:   [24, 24],
    iconAnchor: [12, 12],
  });
  L.marker([venue.lat, venue.lng], { icon, title: venue.name }).addTo(map);

  // Експоузимо метод заміни шару тайлів — викликається з зовнішнього
  // слухача `theme:changed`, який знає поточний → next theme.
  map.__swapTiles = (nextTheme) => {
    map.removeLayer(tileLayer);
    tileErrors = 0;
    tileLayer = buildTileLayer(nextTheme).addTo(map);
    attachErrorWatcher(tileLayer);
  };

  return map;
}

export function initLocation() {
  const venues = [CHURCH, BANQUET];

  // Лінки прив'язуємо одразу — працює навіть якщо Leaflet впав.
  venues.forEach(wireRouteLink);

  // Збираємо посилання на map-контейнери; якщо жодного немає, виходимо.
  const containers = venues
    .map((v) => ({ venue: v, el: document.getElementById(v.id) }))
    .filter((x) => x.el);
  if (containers.length === 0) return;

  const maps = [];
  let started = false;

  function startAllMaps() {
    if (started) return;
    started = true;
    for (const v of venues) {
      const m = createVenueMap(v);
      if (m) maps.push(m);
    }
  }

  // Theme-swap слухач один на обидві мапи — спрацьовує тільки коли
  // змінюється варіант базового шару (cream ↔ dark), бо CARTO має
  // окремі тайли для кожного.
  let currentTheme = document.body.getAttribute('data-theme') || 'cream';
  document.addEventListener('theme:changed', (e) => {
    const next = e.detail?.theme;
    if (!next || next === currentTheme) return;
    const sameVariant = (currentTheme === 'dark') === (next === 'dark');
    currentTheme = next;
    if (sameVariant) return;
    for (const m of maps) m.__swapTiles?.(next);
  });

  // Lazy-init через IntersectionObserver — мапа стартує тоді, коли
  // секція locations входить у viewport. Це економить мобайл-трафік
  // (Leaflet + 4-12 тайлів × 2 мапи) для гостей, які можуть закрити
  // запрошення ще до секції локацій.
  const sentinel = containers[0].el.closest('#location') || containers[0].el;
  if (typeof IntersectionObserver === 'undefined') {
    startAllMaps();
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        startAllMaps();
        io.disconnect();
        break;
      }
    }
  }, { rootMargin: '200px 0px' });
  io.observe(sentinel);
}
