# ParkKing — Launch Film Landing (`aevalmere.github.io/ParkKing`)

A single-page, scroll-driven cinematic landing for the ParkKing parking platform, served as the
**root of this repository's GitHub Pages site** (`https://aevalmere.github.io/ParkKing/`). The
background is a 15-second product film that
**plays as you scroll** (scrubbed, eased); the pitch-deck story fades through on top, chapter by
chapter. One page, one link: [the live demo](https://parkkingdemo.netlify.app/).

## How it is hosted

- This directory is its own project (own `package.json`, own dependencies, own dev server).
- `npm run build` emits a **single `index.html`** (JS, CSS, fonts inlined) plus `media/` and
  `favicon.svg` into `../` — the repository root. GitHub Pages serves that root verbatim from the
  `main` branch, so the page lives at **`https://aevalmere.github.io/ParkKing/`**.
- The build overwrites its own outputs in place and nothing else (`emptyOutDir` is off): the demo
  app at `../parkkingdemo/`, this source tree and `../docs/` share the same root and survive every
  build.
- The demo the page links to ships beside it at `../parkkingdemo/`, served at
  `https://aevalmere.github.io/ParkKing/parkkingdemo/`. It has no build step of its own.

## Commands (inside `landing/`)

```bash
npm install
npm run dev            # local dev server for the landing alone
npm run build          # → ../ (repo root: single-file index.html + favicon + media/)
npm run verify         # build + headless-Chromium scroll sweep (screenshots + checks)
npm run video:render   # re-render the placeholder film from the canvas storyboard
```

## The film

`public/media/parkking-hero.mp4` — VP9-in-MP4, 1280×720 · 24 fps · 15 s · keyframe every 4 frames
so `currentTime` scrubbing stays smooth. (A second, byte-identical `parkking-hero-vp9.mp4` used to
sit beside it as a `<source>` fallback; the fallback was unreachable and the file was a duplicate,
so both were removed — 12.9 MB off the deploy.) The `<video>` is `preload="metadata"`: the poster
covers the frame until the first seek lands, and the scrub loop only needs metadata plus range
requests. The committed file is a **programmatically rendered placeholder** (deterministic
canvas storyboard in `tools/video/scene.html`, captured frame-by-frame in headless Chromium,
encoded with ffmpeg) following the same 4-shot script as the real commercial:

1. Studio phone reveal → 2. liquid-metal morph into a laptop → 3. dive into the in-car console
→ 4. pull-back as the car parks.

**To swap in the real AI-generated commercial**, see `public/media/VIDEO_PROMPT.md` — generate,
re-encode with the provided ffmpeg command, replace the one file, and `npm run build`. Chapter
timings are fractions of the file's duration, so no code changes are needed.

## Page weight — where the bytes actually are

`vite-plugin-singlefile` inlines everything, so *every* declared font is base64'd into the one
`<style>` block and downloaded on first paint whether or not a glyph selects it. Before this pass
the built `index.html` was 962 KB, **693 KB of which was nine woff2 data-URIs** (Fraunces roman ×3
subsets, Fraunces italic ×3, Archivo roman ×3). The single SVG grain texture is 364 bytes and is
deliberately left inline — see the note above `.grain-tex` in `src/styles/global.css`.

Dropping the never-used Fraunces italic import removed 228 KB (28.8 + 93.1 + 106.2). The remaining
**465 KB is still inline, and still blocks first paint**, which is wrong: with real font files the
browser would fetch only the `latin` subsets it needs (~205 KB of the 465 KB) and cache them across
visits. Fixing it properly means taking the fonts out of the bundle — either an `@font-face` sheet
in `public/` referencing `public/fonts/*.woff2`, or `viteSingleFile({ inlinePattern })` with
`build.assetsDir: ''` so the emitted font URLs stay correct once the CSS is folded into the
root-level `index.html`. Both need a build to verify the URL rewriting under `base: './'`; neither
is a source-only change.

## Structure

```
landing/
  index.html              entry (meta, noscript fallback)
  src/
    main.tsx / App.tsx    assembly + reduced-motion fork
    styles/global.css     tokens, type system, depth, motion primitives
    lib/                  scroll stage engine, easing, chapter windows, the one URL
    components/           Stage/Film, Chapter, chapters, Rail, TopBar, Grain, StaticPage
  public/media/           parkking-hero.mp4 · poster.jpg · VIDEO_PROMPT.md
  tools/video/            storyboard + renderer for the placeholder film
  scripts/verify.mjs      build sweep: screenshots at 9 scroll depths, desktop + mobile
../                       build output (index.html · favicon.svg · media/): the GitHub Pages root
../parkkingdemo/          the working demo app, served beside the page at /ParkKing/parkkingdemo/
```

---

ParkKing — by Dev, Ken, Ethan & Noah (Team 6).
