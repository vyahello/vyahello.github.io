/* ============================================================
   location.js — §5 Локація — Leaflet map + theme-aware tiles

   · Tile basemap: CARTO `light_all` for cream/gold themes,
     `dark_all` for the dark theme. Swaps live on `theme:changed`.
   · Custom golden divIcon marker with pulse ring.
   · "Відкрити в Google Maps" button gets href injected with VENUE coords.
   · Map fallback (text + icon) when Leaflet failed to load.
   ============================================================ */

const VENUE = {
  lat:  49.7676623,
  lng:  24.0866213,
  name: 'Soprano Inn',
};

function showMapFallback(mapEl) {
  if (!mapEl) return;
  mapEl.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;padding:24px;gap:14px;background:var(--bg-grain);">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.2" aria-hidden="true">
        <path d="M12 21s-7-7.5-7-12a7 7 0 1 1 14 0c0 4.5-7 12-7 12z"/>
        <circle cx="12" cy="9" r="2.5"/>
      </svg>
      <div style="font-family:var(--font-mono);font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:var(--ink-mute);">Натисніть кнопку нижче</div>
      <div style="font-family:var(--font-display);font-size:18px;color:var(--ink);line-height:1.3;">щоб відкрити локацію<br>у Google Maps</div>
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

export function initLocation() {
  const mapEl = document.getElementById('map');
  if (!mapEl) return;

  // Wire route button immediately — works even if Leaflet failed to load.
  const routeBtn = document.getElementById('routeBtn');
  if (routeBtn) {
    routeBtn.href   = `https://www.google.com/maps/search/?api=1&query=${VENUE.lat},${VENUE.lng}`;
    routeBtn.target = '_blank';
    routeBtn.rel    = 'noopener';
  }

  if (typeof L === 'undefined') {
    showMapFallback(mapEl);
    return;
  }

  const map = L.map(mapEl, {
    center: [VENUE.lat, VENUE.lng],
    zoom:   16,
    zoomControl:     false,
    scrollWheelZoom: false,
    attributionControl: true,
  });

  let currentTheme = document.body.getAttribute('data-theme') || 'cream';
  let tileLayer = buildTileLayer(currentTheme).addTo(map);

  // If tiles 404 a few times in a row, gracefully fall back.
  let tileErrors = 0;
  tileLayer.on('tileerror', () => {
    tileErrors++;
    if (tileErrors > 3) showMapFallback(mapEl);
  });

  // Custom golden marker
  const icon = L.divIcon({
    className: '',
    html: '<div class="custom-marker" aria-hidden="true"></div>',
    iconSize:   [28, 28],
    iconAnchor: [14, 14],
  });
  L.marker([VENUE.lat, VENUE.lng], { icon, title: VENUE.name }).addTo(map);

  // Swap tile layer when the theme changes (dark ↔ light basemap variant).
  document.addEventListener('theme:changed', (e) => {
    const next = e.detail?.theme;
    if (!next || next === currentTheme) return;
    const sameVariant =
      (currentTheme === 'dark') === (next === 'dark');
    currentTheme = next;
    if (sameVariant) return;             // light_all serves both cream + gold
    map.removeLayer(tileLayer);
    tileErrors = 0;
    tileLayer = buildTileLayer(next).addTo(map);
    tileLayer.on('tileerror', () => {
      tileErrors++;
      if (tileErrors > 3) showMapFallback(mapEl);
    });
  });
}
