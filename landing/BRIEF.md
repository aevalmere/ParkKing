# ParkKing Launch Film — Design & Build Brief

> This is the user's request, re-sent as a disciplined prompt (role → deliverable → content →
> system → constraints → acceptance). It is the contract this branch was built against.

---

## ROLE

You are a design engineer building a **product-launch landing page** for ParkKing — an
intelligent parking platform (phone · web · in-car). You orchestrate sub-agents for parallel
shards (film rendering) and keep a single authorial voice for the page itself.

## DELIVERABLE

One page. One link. Zero footprint on the original site.

1. **The original site stays byte-identical and fully accessible.** The launch page lives in
   `landing/` as a self-contained subproject and is mounted as a **subsection at its own URL,
   `/parkking/`** (built into `public/parkking/`, served verbatim by the existing deploy — the
   same pattern as the site's `/crucible/` subsection). Both run independently, at the same
   time; deleting `landing/` + `public/parkking/` removes the subsection without a trace.
2. A **single-page React 19 + Tailwind v4 landing** (Vite, single-file build, relative asset
   paths) with **no routes, no tabs, no nav menus**. Every call-to-action resolves to exactly
   one URL: `https://parkkingdemo.netlify.app/`
3. A **full-viewport background film that plays as the user scrolls** (scroll-scrubbed
   `currentTime`, eased), with the pitch-deck story overlaid chapter by chapter.
4. A **placeholder film rendered programmatically** (deterministic canvas storyboard → headless
   Chromium frames → ffmpeg, 15 s · 24 fps · scrub-friendly GOP) that follows the 4-shot
   commercial script below, so the real AI-generated commercial can be dropped in as a
   one-file swap (`landing/public/media/parkking-hero.mp4`).

## FILM SCRIPT (4 shots · 15 s · the scroll spine)

| Shot | Time | Scene |
|---|---|---|
| 1 | 0–4 s | ParkKing phone floats on a white-to-gray studio gradient; rim-light flash, grain flicker, slow push-in |
| 2 | 4–9 s | Phone stretches like liquid metal into a laptop; screen content reflows in sync; slow orbit |
| 3 | 9–12 s | Fast push into the screen → white flash → in-car console running ParkKing, warm cabin light |
| 4 | 12–15 s | Camera glides out through the windshield; the car eases into an open space and stops, centered, calm |

Negative: no legible text, captions, watermarks, tearing, ghosting, flicker, clutter.

## CONTENT MAP (from `Team_6__Park_KING.pptx` → scroll chapters)

| # | Progress | Deck source | Overlay |
|---|---|---|---|
| 0 | 0–.16 | Slide 1 | Hero: "Park like a king." + one-line promise |
| 1 | .17–.29 | Slides 2, 4 | The problem + stats: 17 hrs/yr · $billions wasted · #1 driving frustration |
| 2 | .30–.44 | Slides 3, 5 | Adam vs Sarah persona cards; "no other app decides for you" |
| 3 | .45–.59 | Slides 6, 7 | One search: preferences, Find Closest / Find Cheapest / Best Match |
| 4 | .61–.75 | Slide 6 | In-car: voice search, smart recs, seamless nav handoff |
| 5 | .77–.87 | Slides 8, 9 | Plans: $1.49/wk · $3.99/mo · $29.99/yr + $30/car OEM; research-shaped |
| 6 | .89–1.0 | Slide 10 | Finale: "Stop circling. Start arriving." + the one CTA |

## DESIGN SYSTEM — "Midnight Concierge" (luxury/refined archetype)

- **Type**: Fraunces Variable (display serif, optical sizing, gold italic accents) +
  Archivo Variable (body/UI, expanded-width eyebrows). Never Inter/Roboto/system-ui.
- **Color tokens** (CSS custom properties): ink `#05091A` · abyss `#020610` · panel `#0A1430`
  · paper `#EDF2FF` · haze `#93A4C7` · royal `#2E6BFF` · sky `#45C4FF` · crown `#E8A33D`
  · crown-soft `#F2C979`. Gold speaks luxury (numerals, rules, King); blue speaks product
  (chips, modes). Dominant ink, sharp gold.
- **Depth**: layered radial gradients + fixed film-grain overlay + scrims for legibility.
  No flat backgrounds anywhere.
- **Layout**: asymmetric editorial. Ghost chapter numerals bleed off-grid; stats stack ragged;
  persona cards offset; right-edge progress rail. Nothing centered by default.
- **Motion** (Skiper/Vengeance-grade, Emil rules): scroll-driven transforms + opacity only;
  custom `cubic-bezier` (lux `0.23,1,0.32,1`, morph `0.77,0,0.175,1`); staggered line reveals
  ≤ 60 ms apart; CTA press `scale(0.97)`; video time eased toward scroll target
  (exponential smoothing) — never snapped.
- **Accessibility**: `prefers-reduced-motion` → static stacked page, poster instead of scrub;
  focus-visible rings; semantic headings; touch-safe hover gating.

## HARD CONSTRAINTS

- Single page. No routing, no tabs, no menu, no footer link farm.
- Exactly **one external destination** (`https://parkkingdemo.netlify.app/`) — every CTA points there.
- Only `transform`/`opacity` animate. All easing curves custom.
- The film is muted, `playsinline`, poster-backed, and degrades gracefully (missing video →
  layered gradient stage; reduced motion → static article).
- The isolated tree must build standalone: `npm i && npm run build` → `dist/index.html`
  (+ `/media`), deployable to any static host.

## ACCEPTANCE CHECKS

1. `npm run build` passes; output is a single HTML file + media.
2. Playwright sweep (desktop 1440×900, mobile 390×844) at 9 scroll depths: video
   `currentTime` tracks scroll, each chapter legible, zero console errors.
3. Content parity with the deck story (problem → drivers → product → in-car → plans → vision).
4. Anti-slop checklist passes: distinctive type, token palette, asymmetric composition,
   textured depth, custom easing, custom focus/hover/active states.
5. `main` untouched; all work isolated on `claude/parkking-landing-scroll-video-fcx9z3`.

## ORCHESTRATION (swarm-orchestration skill)

- **Gate 0**: page = single-voice artifact → orchestrator authors it sequentially.
  Film = independent shard → dispatched to one contracted sub-agent (canvas storyboard →
  frame render → encode → JSON report), validated at the door (duration, size, stills art-check).
- **Synthesis**: integrate film, run the verify sweep, QA against this brief line by line.
