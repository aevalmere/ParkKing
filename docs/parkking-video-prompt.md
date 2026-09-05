# ParkKing Hero Film — Generation Prompt & Swap Guide

The committed `parkking-hero.mp4` is a
programmatically rendered placeholder — a deterministic pseudo-3D canvas film produced by
`tools/video/scene.html` via `npm run video:render`. When a real cinematic is generated with a
production text-to-video generator, use the prompt below, then follow **Swap**.

The film is **scroll-scrubbed** by `src/components/FilmStage.tsx` (never auto-played): scroll
progress maps to `video.currentTime`. Two hard requirements follow from this and must survive any
swap: a **short GOP** (keyframe every ~4 frames) so `currentTime` seeks are instant, and the
**16.0 s / 24 fps** reference length so the five copy beats — pinned to fractions of the duration —
land on the right scenes.

## Look & grade (non-negotiable)

Dark **navy** grade **throughout** — there is **no bright studio, no daylight, no white flash and
no bright transition at any point**. The whole film lives in a deep navy #05091a world lit by a
soft floor glow, gold accents (crown, hero pin), royal/bright blue product accents (route line,
map), and a faint cool haze. White appears only as tiny UI details and thin painted parking-lines —
never as a large area or a flash. A soft vignette is present at all times; optional fine grain
≤ 3 %. Premium, restrained, Apple/Google-launch calm. 24 fps, 1920×1080, no captions, no watermark.

## Prompt

A premium product-launch commercial for the ParkKing parking app, shot as **one continuous camera
move** with **no cuts and no flashes**, graded dark navy end to end. A single object keeps
transforming — phone → laptop → car dashboard → out the back of the car → a painted parking bay —
while the camera flows through it. Dark navy studio, gold and blue accents, cool cinematic grade.

- **Beat 1 — Phone (0.00–0.16, ~0.0–2.6 s):** A modern phone floats center-frame at a slight
  three-quarter angle in a dark navy studio (soft radial floor glow, faint reflection). Its screen
  shows the ParkKing app: dark map UI, gold parking pins, a blue route line, a small gold crown at
  the top. A gentle slow push-in; a small local specular glint may travel an edge — nothing bright,
  nothing full-screen.
- **Beat 2 — Laptop (0.16–0.36, ~2.6–5.8 s):** The phone's chassis smoothly stretches and reshapes
  like liquid metal into a sleek laptop; the screen content reflows from the mobile layout to a
  wider desktop layout of the same app (left panel + map). A slow ~8° orbit during the morph.
- **Beat 3 — Dashboard (0.36–0.54, ~5.8–8.6 s):** The laptop itself morphs into a car dashboard —
  the aluminium body widens and curves into a dashboard cowl, and the screen becomes the car's
  centre-console display running the same app (big map, bottom control bar). The cabin materialises
  around it: dashboard surface, steering-wheel silhouette to the left, windshield hinting soft cool
  light. Do **not** dive through the screen and do **not** flash. By the end, two front seats are
  visible as the camera drifts back into the cabin.
- **Beat 4 — Out the back (0.54–0.76, ~8.6–12.2 s):** One continuous pull-back — between the two
  front seats (headrests pass left and right), past the rear bench, out through the rear-window
  glass (subtle dark tint, a faint streak as we cross the plane, never bright) — emerging **behind**
  the car: a rear three-quarter view of a clean modern car, navy/graphite body, taillights glowing
  warm red-amber, easing slowly forward down a parking-lot lane.
- **Beat 5 — The spot (0.76–1.00, ~12.2–16.0 s):** The car's geometry folds and dissolves down into
  a painted parking bay — body panels flatten into the white outline of a parking space on dark
  asphalt, and a gold crown + “P” glyph paints itself in the centre. The camera drifts slightly
  toward top-down. The final ~1.5 s holds a calm, composed end frame (also the poster/finale).

## Negative

white flash, bright flash, blown-out highlights, full-screen white or bright transition, daylight
blow-out, bright studio background, hard cut, overlaid text, captions, logos, watermarks, warped or
tearing geometry, ghosting, duplicated screens, flicker, jitter, oversaturated colour, low
resolution, pedestrians, cluttered background.

## Swap

1. Produce the film at ≥ 1080p, ideally **exactly 16.0 s at 24 fps**. Keep the five beats on the
   same fractional windows above so the overlaid copy still lands; if the cut is a different length,
   preserve the beat **order and proportions**.
2. Re-encode the **one** delivery file with a short GOP (`-g 4 -bf 0`) so scroll-scrubbing seeks are
   instant, `1920×1080`, 24 fps, faststart. `FilmStage.tsx` lists a single
   `<source src="media/parkking-hero.mp4" type="video/mp4">` and probes
   `codecs="vp09.00.41.08"` to decide between the scrubbed and static forks. Pick **one** encode:

   ```bash
   # preferred where a full ffmpeg exists — H.264, decodes everywhere including old Safari
   ffmpeg -i generated.mov -an -vf "scale=1920:-2,fps=24" \
     -c:v libx264 -preset slow -crf 20 -g 4 -bf 0 -pix_fmt yuv420p \
     -movflags +faststart public/media/parkking-hero.mp4

   # what ships today — VP9-in-MP4 (level 4.1 covers 1080p24)
   ffmpeg -i generated.mov -an -vf "scale=1920:-2,fps=24" \
     -c:v libvpx-vp9 -b:v 0 -crf 30 -g 4 -row-mt 1 -pix_fmt yuv420p \
     -movflags +faststart public/media/parkking-hero.mp4
   ```

   There used to be a second `parkking-hero-vp9.mp4` listed as a fallback `<source>`. A generic
   `video/mp4` source is never skipped in favour of a later one, so it was unreachable, and the two
   files were byte-identical — 12.9 MB shipped for nothing. Do not reintroduce it. If you switch to
   the H.264 encode, also relax the `filmDecodable()` probe in `FilmStage.tsx`, which currently
   gates the scrubbed fork on VP9 support.

   Note: this repo's build environment has no `libx264` (only a minimal vp8/png ffmpeg), which is
   why the **placeholder** pipeline emits VP9-in-MP4 (`vp09.00.41.08`, faststart / moov-first).

   Keep `+faststart`. The `<video>` is `preload="metadata"`, so the browser reads the duration from
   the opening bytes and streams the rest as range requests while scrubbing; a moov-at-the-end file
   would stall the scrub.
3. Regenerate the poster from a Beat-1 frame (~1.5 s):

   ```bash
   ffmpeg -ss 1.5 -i public/media/parkking-hero.mp4 -frames:v 1 -q:v 3 public/media/poster.jpg
   ```
4. `npm run build` (from `landing/`) so the new media lands in `../media/` — the repo root, which
   GitHub Pages serves — then `npm run verify` to exercise both the scrubbed and static
   (reduced-motion / no-VP9) branches. The build overwrites `../index.html`, `../favicon.svg` and
   `../media/` in place and never wipes the root (the demo app lives there too), so a file you
   remove from `public/media/` must also be deleted from `../media/` by hand, and that deletion
   committed.

No code changes are required on swap — the beat windows are fractions of the file's duration.
