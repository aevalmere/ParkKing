# ParkKing

The ParkKing go-to-market demo: a scroll-driven launch-film pitch site and a working smart-parking
demo app. Built for the practice, not the market. The write-up behind it is
[The customer is the spec](https://ethan-zhang.lightsdarke.workers.dev/blog/building-parkking).

Live on GitHub Pages:

- **Pitch site**: https://aevalmere.github.io/ParkKing/
- **Demo app**: https://aevalmere.github.io/ParkKing/parkkingdemo/

Both used to live on [ethan-zhang.lightsdarke.workers.dev](https://ethan-zhang.lightsdarke.workers.dev)
at `/parkking/` and `/parkkingdemo/`. Those paths now redirect (301) here.

## Layout

```
├── index.html            built pitch site (single file: JS, CSS and fonts inlined)
├── favicon.svg           copied from landing/public/ on build
├── media/                parkking-hero.mp4 (the scroll-scrubbed film) · poster.jpg
├── parkkingdemo/         the demo app: plain HTML/CSS/JS + vendored Leaflet, no build step
├── landing/              source of the pitch site (Vite + React 19 + Tailwind v4)
├── docs/                 parkking-video-prompt.md: prompt + swap guide for the real hero film
└── .nojekyll             tells GitHub Pages to serve these files exactly as committed
```

The repository root is the site root. Serve GitHub Pages from the `main` branch, folder `/ (root)`.

## Rebuilding the pitch site

```bash
cd landing
npm install
npm run dev        # local dev server for the landing alone
npm run build      # → ../index.html, ../favicon.svg, ../media/  (overwritten in place)
npm run verify     # build + headless-Chromium scroll sweep
```

`parkkingdemo/` is edited in place and needs no build.

Every link from the pitch site to the demo is relative, so the page works under the `/ParkKing/`
project-site prefix as well as at any other mount. Links back to the main site are absolute.
