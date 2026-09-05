# ParkKing Landing — aevalmere.github.io/ParkKing

This directory is a **self-contained subproject**: the ParkKing launch page, the root of this
repository's GitHub Pages site. It builds into `../` (the repo root), which GitHub Pages serves
verbatim at **`https://aevalmere.github.io/ParkKing/`**. The demo app the page links to sits
beside it at `../parkkingdemo/` and has no build step; the two share nothing else.

**Never touch `../parkkingdemo/` from here.** The only files this project writes outside
`landing/` are its build outputs at the repo root — `../index.html`, `../favicon.svg` and
`../media/` — overwritten in place on every build (`emptyOutDir` is off, so the rest of the
root survives).

## Stack
- Vite + React 19 + TypeScript, Tailwind CSS v4 (`@theme` tokens in `src/styles/global.css`)
- Single-file build via `vite-plugin-singlefile` → `../index.html` + `media/` (the repo root, which GitHub Pages serves)
- All asset references are **relative** (no leading `/`) so the page works at any mount path

## Commands (run inside `landing/`)
- `npm run dev` — Vite dev server (can run alongside the root Astro dev server)
- `npm run build` — build into `../` (the repo root)
- `npm run verify` — build + headless-Chromium scroll sweep, desktop + mobile
- `npm run video:render` — re-render the placeholder film

## Non-negotiables
- **Single page, single link.** No routes, no tabs, no menus. Every CTA points to the one
  destination exported from `src/lib/config.ts` (`DEMO_URL = 'parkkingdemo/index.html'`, the free
  demo shipped beside this page — a RELATIVE path, so it resolves under the `/ParkKing/`
  project-site prefix) and nowhere else. Import `DEMO_URL`; never hardcode a URL. Links back to
  the main site (`HOME_URL`, `BLOG_URL`) are absolute for the same reason.
- **Motion**: `transform`/`opacity` only, custom `cubic-bezier` curves (tokens `--ease-lux`,
  `--ease-morph`, `--ease-out`), scroll-scrubbed video time is eased, never snapped. Respect
  `prefers-reduced-motion` (static fork lives in `FilmStage.tsx`, not `App.tsx`).
- **Type**: Fraunces Variable (display) + Archivo Variable (body). Never Inter/Roboto/system-ui.
- **Color**: token-based only (ink/panel/paper/haze/royal/sky/crown). Gold = luxury voice,
  blue = product voice. No flat untextured backgrounds.
- **Layout**: keep the asymmetric editorial composition (ghost numerals, ragged stats,
  offset cards, right progress rail).

## The film act (`src/components/FilmStage.tsx`)
The page **opens on a pinned, scroll-scrubbed film** (the marquee feature) — not an autoplaying
hero. A ~520vh wrapper (`#top`) holds a `position: sticky` full-viewport `<video>` that is
**never played**: one rAF loop reads scroll progress `p = clamp(scrollTop / (wrapperH − vh), 0, 1)`,
lerps a displayed time toward `p × duration` (factor 0.14), and writes `video.currentTime` only
when `|Δ| > 0.015 s` and the element isn't already seeking — eased, never snapped.

Five copy beats are overlaid (transform/opacity only) on windows that match the film's beat
contract — fractions of duration, so they survive a film swap:

| Beat | Window | Scene | Line |
|---|---|---|---|
| 1 | 0–0.16 | phone | Hero: "Park like a king." + CTA |
| 2 | 0.16–0.36 | laptop | "One search. Every screen you own." |
| 3 | 0.36–0.54 | car dashboard | "And it rides along in your car." |
| 4 | 0.54–0.76 | pull-back | "So arriving is already handled." |
| 5 | 0.76–1.0 | parking spot | "This is where the circling stops." + CTA |

A persistent dark scrim (bottom + top + left, **darken-only**) keeps copy and the transparent
nav legible over the film's bright studio/daylight frames. A right-edge progress rail (5 ticks,
active gold, hidden on mobile) tracks the beats. As the sticky unpins past `p=1` the overlay
fades out so the finale never collides with the fixed nav, then a `.film-to-light` band hands off
into the light sections. The `Nav` stays transparent/onDark for the whole act and goes solid only
once the `#film-act-end` marker reaches the bar.

**Codec + fallback.** The shipping film is **VP9-in-MP4** — one file, `parkking-hero.mp4`,
declared as a single `<source type="video/mp4">` so no engine skips it. (There was a second
`parkking-hero-vp9.mp4` `<source>` listed after it; the two files were byte-identical, and a
generic `video/mp4` source is never passed over in favour of a later one, so it was dead weight —
12.9 MB of it. Both are gone.) `FilmStage` probes
`canPlayType('video/mp4; codecs="vp09.00.41.08"')` upfront and listens for the `error` event; if
the film can't decode (notably older iOS Safari) **or** `prefers-reduced-motion` is set, it renders
the **static fork**: the poster as a sticky backdrop with the five beats as stacked full-screen dark
sections. Both branches are exercised by `npm run verify`.

The `<video>` is `preload="auto"`, deliberately. `metadata` was tried and reverted: this is a
**scrub** surface, not a playback one — the loop writes `currentTime` continuously as you scroll,
and with nothing buffered every write becomes a range request that stalls, which reads as a laggy
page. Buffering the film up front is the cost of a smooth scrub, and it is affordable here because
this page is its own site, reached from the main site only by an ordinary external link, so
nothing downloads until a visitor deliberately enters it. If the film is
ever re-encoded much larger, fix it by shrinking the file, not by starving the scrub.

## The film file
`public/media/parkking-hero.mp4` (one file, copied into the build) is a
placeholder rendered from `tools/video/scene.html` (`npm run video:render`). The real commercial
swaps in as one file — keep 24 fps and re-encode with the short-GOP ffmpeg commands in
`public/media/VIDEO_PROMPT.md`, then rebuild so it lands in `../media/`. Beat
windows are fractions, so no code changes are needed on swap.
