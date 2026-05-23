# Wedding Invite

Static single-page digital wedding invitation. Built as plain HTML/CSS with vanilla ES modules, deployed via GitHub Pages.

## Tech stack

- HTML5 + CSS3 + Vanilla ES Modules (no build tools, no Node required)
- Google Fonts CDN (Cormorant Garamond, Inter)
- Google Apps Script + Google Sheets for RSVP submissions (added in a later stage)
- GitHub Pages (hosting)

## Local development

No install step. Open the file directly, or serve over HTTP for proper relative-path behaviour:

```bash
# Option 1 — open the file
xdg-open index.html

# Option 2 — local HTTP server
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploy

GitHub Pages auto-deploys from `main`:

```bash
git push origin main
# wait ~30s, then check the live URL
```

The repo root contains `.nojekyll` so GitHub Pages serves files as-is without Jekyll processing.

## Project layout

```
.
├── index.html        single-page entry
├── css/              design tokens + styles
├── js/               ES modules (per wow-effect)         # added in later stages
├── assets/           audio, textures, icons              # added in later stages
├── data/             event + guest data                  # added in later stages
└── apps-script/      Google Apps Script for RSVP         # added in later stages
```

## Status

Early scaffolding. The live page currently renders only a typography & palette smoke test. Real content arrives in upcoming iterations.
