# Wedding Invite

Static single-page digital wedding invitation. Vanilla HTML/CSS + ES modules. Personalised per-guest RSVP backed by Google Apps Script and Google Sheets. Deployed on GitHub Pages.

## Tech stack

- **Frontend** — HTML5 + CSS (custom-property design tokens) + Vanilla ES Modules. No build step, no bundler, no Node required to serve.
- **Hosting** — GitHub Pages from `master`.
- **Fonts** — Cormorant Garamond, Italiana, Inter (Google Fonts CDN).
- **Map** — Leaflet 1.9 with CARTO basemap.
- **Audio** — HTMLAudioElement + Web Audio `AnalyserNode` for music-reactive UI hooks.
- **Backend** — Google Apps Script Web App; Google Sheets as data store.
- **Tests** — `node:test` against pure helpers (no DOM).

## Local development

```bash
# Serve over HTTP so ES modules + JSON fetch work
python3 -m http.server 8000
# then open http://localhost:8000
```

Useful URL params:

- `?skipIntro=1` — skip the curtain intro
- `?theme=cream|dark` — override default theme
- `?g=<slug>` — personalised invitation (requires backend + matching row in `Гості` tab)

## Architecture

```
┌─────────────────────────┐         ┌──────────────────────────┐
│  Static site (GH Pages) │         │  Google Apps Script Web  │
│  index.html             │ ──GET── │  App                     │
│  admin/index.html       │ ──POST──│  doGet  / doPost         │
│  css/, js/, data/       │         │  computeStats            │
└─────────────────────────┘         └──────────────┬───────────┘
        ▲                                          │
        │            renders                       │ read / write
        │                                          ▼
        │                                ┌─────────────────────┐
        └──────── personal link ─────────│  Google Sheet       │
                  ?g=<slug>              │  Гості / Відповіді  │
                                         │  Errors (auto)      │
                                         └─────────────────────┘
```

- **`index.html`** — invitation page. Reads `?g=<slug>` from URL, fetches guest data + any existing reply from Apps Script, renders personalised greeting + RSVP form.
- **`admin/`** — organiser dashboard. Token-gated (`?token=`). Calls Apps Script `?stats=1` endpoint, renders summary + responders + pending list with Ukrainian pluralisation. Shares all design tokens with the invitation.
- **Apps Script** — single Web App with three endpoints discriminated by query/body:
  - `GET ?slug=<slug>` → guest + reply lookup
  - `GET ?stats=1&token=<TOKEN>` → aggregated stats JSON
  - `POST` with JSON body → upsert reply, send notification email (best-effort)

## File layout

```
.
├── index.html              # invitation entry
├── admin/index.html        # organiser dashboard (token-gated)
├── favicon.svg             # SVG favicon (scales 16×16 → 180×180)
├── data/event.json         # event date + Apps Script URL
├── css/                    # ~14 stylesheets, one per section/concern
├── js/                     # ~14 ES modules
└── test/                   # node:test unit tests for pure helpers
```

## CSS architecture

- **`theme.css`** — 2 themes (cream/dark) as data-attribute scoped custom properties (`[data-theme="..."]`). All other stylesheets reference tokens only — never hard-code colors.
- **`globals.css`** — page chrome (floating particles, cursor glow, monogram badge).
- **`sections.css`** — `.reveal` intersection-driven fade, `.title-word`/`.title-char` per-character stagger animation primitives.
- **Per-section stylesheets** — `hero.css`, `invitation.css`, `countdown.css`, `location.css`, `dresscode.css`, `rsvp.css`, `polish.css` (timeline + gifts + faq + closing).

## JS architecture

Pure modules with named exports. `js/main.js` orchestrates boot order. Each module owns one concern:

| Module | Responsibility |
|---|---|
| `theme.js` | Resolve initial theme (URL > localStorage > default), wire dot picker |
| `curtain.js` | Intro overlay lift (auto/click/escape), dispatch `curtain:lifted` |
| `hero.js` | Letter-split reveal, mouse parallax, `.ics` calendar download |
| `invitation.js` | Greeting personalisation, `normalizeForm()` for grammatical form |
| `location.js` | Leaflet map + theme-aware CARTO basemap swap |
| `countdown.js` | Calendar widget + countdown rollup with easing |
| `rsvp.js` | Form state machine, name+surname validation, edit-mode restore |
| `globals.js` | 3-layer parallax particles + scroll listener + cursor glow + floating monogram |
| `chrome.js` | Music player (with muted-autoplay fallback) + `AnalyserNode` → CSS variable bridge + share popover |
| `reveal.js` | `IntersectionObserver`, per-character title split (word-grouped to avoid mid-word line-breaks), auto-inserted botanical section dividers |
| `guest.js` | URL slug parsing, fetch from Apps Script, dispatch `guest:loaded` |
| `admin.js` | Token-gated stats fetch + render, Ukrainian plural helpers |

## Accessibility

- All interactive elements have `aria-label` / `aria-pressed` / `aria-haspopup` where appropriate.
- Decorative elements (`.particles`, `.cursor-glow`, `.flourish`) are `aria-hidden="true"`.
- Full `@media (prefers-reduced-motion: reduce)` coverage: heartbeat animations, parallax scroll, char-stagger, breathing, ring rotation — all collapse to static fades.
- Mobile-safe: titles wrap only at whitespace (`.title-word { white-space: nowrap }`), iOS notch/Dynamic Island handled via `env(safe-area-inset-*)`.
- Theme picker, music toggle, share popover all keyboard-navigable.

## Tests

```bash
node test/rsvp.test.mjs    # 14 tests on parseAttendance / sanitizeGuestNames / buildPayload
node test/guest.test.mjs   #  5 tests on getGuestSlug
```

Avoid `node --test test/` on Node 22.22.2 (glob bug).

## Deploy

GitHub Pages auto-deploys from `master`:

```bash
git push origin master
# wait ~30-90s, then check the live URL
```

The repo root contains `.nojekyll` so files are served as-is (no Jekyll processing).

## License

Private, personal project. Not for redistribution.
