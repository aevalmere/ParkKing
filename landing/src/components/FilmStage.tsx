import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { DEMO_URL } from '../lib/config'
import { Reveal } from './Reveal'

/* ============================================================
   FilmStage — the opening act.

   A pinned, full-viewport film that SCRUBS with scroll (never
   autoplays). Five copy beats are overlaid on windows that match
   the film's beat contract. When the browser can't decode the film
   (no VP9 — notably iOS Safari) or the user prefers reduced motion,
   the same five beats render as stacked dark sections over a static
   poster. Only transform/opacity animate; scrub time is eased.
   ============================================================ */

/* One delivery file. It is VP9-in-MP4 (`vp09.00.41.08`) served under the generic
   `video/mp4` type so every engine that can decode it selects it; the ones that
   can't take the static fork below. There used to be a second, byte-identical
   `parkking-hero-vp9.mp4` <source> listed after this one — it was unreachable
   (a generic `video/mp4` source is never skipped in favour of a later one) and
   shipped a duplicate 12.9 MB file, so it is gone. */
const SRC_PRIMARY = 'media/parkking-hero.mp4' // canonical film (`npm run video:render` rewrites it)
const POSTER = 'media/poster.jpg'

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)

/* Beat windows as fractions of scroll progress. Small overlaps at the
   boundaries give crossfades. Beat 1 is present from the very top; beat 5
   holds to the end. inStart..inEnd = fade-in span, outStart..outEnd = fade-out. */
type Beat = {
  key: string
  inStart: number
  inEnd: number
  outStart: number
  outEnd: number
  Copy: () => ReactNode
}

function Beat1() {
  return (
    <>
      <p className="eyebrow eyebrow--onDark">Smart parking, everywhere you drive</p>
      <h1 className="display mt-5 text-[clamp(2.9rem,8.4vw,6rem)] text-white">
        Park like <span className="text-crown">a king.</span>
      </h1>
      <p className="mt-6 max-w-[34rem] text-[1.06rem] leading-relaxed text-haze sm:text-[1.19rem]">
        One search finds the space that fits how you drive — closest, cheapest, or the best all-round
        match — then routes you straight to it.
      </p>
      <div className="mt-9 flex flex-col items-start gap-3.5 sm:flex-row sm:items-center">
        <a href={DEMO_URL} className="cta cta--lg">
          Try the demo — it&rsquo;s free →
        </a>
        <a href="#problem" className="ghostbtn ghostbtn--onDark">
          See how it works
        </a>
      </div>
      <p className="mt-5 text-sm text-haze/80">No account. No credit card. Just park.</p>
    </>
  )
}

function BeatLine({ children }: { children: ReactNode }) {
  return (
    <>
      <span className="film-beat-rule" aria-hidden="true" />
      <p className="display max-w-[20ch] text-[clamp(1.95rem,4.8vw,3.35rem)] leading-[1.06] text-white">
        {children}
      </p>
    </>
  )
}

const Beat2 = () => (
  <BeatLine>
    One search. <span className="text-crown">Every screen you own.</span>
  </BeatLine>
)
const Beat3 = () => (
  <BeatLine>
    And it rides along <span className="text-crown">in your car.</span>
  </BeatLine>
)
const Beat4 = () => (
  <BeatLine>
    So arriving is <span className="text-crown">already handled.</span>
  </BeatLine>
)

function Beat5() {
  return (
    <>
      <p className="eyebrow eyebrow--onDark">Your spot is waiting</p>
      <h2 className="display mt-5 max-w-[16ch] text-[clamp(2.4rem,6vw,4.4rem)] text-white">
        This is where the <span className="text-crown">circling stops.</span>
      </h2>
      <div className="mt-8 flex flex-col items-start gap-3.5">
        <a href={DEMO_URL} className="cta cta--gold cta--lg">
          Enter the demo →
        </a>
        <p className="text-sm text-haze/80">Free to try · no account, no card.</p>
      </div>
    </>
  )
}

const BEATS: Beat[] = [
  { key: 'phone', inStart: -1, inEnd: -1, outStart: 0.145, outEnd: 0.178, Copy: Beat1 },
  { key: 'laptop', inStart: 0.16, inEnd: 0.192, outStart: 0.345, outEnd: 0.378, Copy: Beat2 },
  { key: 'car', inStart: 0.36, inEnd: 0.392, outStart: 0.525, outEnd: 0.558, Copy: Beat3 },
  { key: 'pullback', inStart: 0.54, inEnd: 0.572, outStart: 0.745, outEnd: 0.778, Copy: Beat4 },
  { key: 'spot', inStart: 0.76, inEnd: 0.792, outStart: 2, outEnd: 2, Copy: Beat5 },
]

function beatOpacity(p: number, b: Beat) {
  const rise = b.inEnd <= b.inStart ? (p >= b.inEnd ? 1 : 0) : clamp01((p - b.inStart) / (b.inEnd - b.inStart))
  const fall = b.outEnd <= b.outStart ? 1 : clamp01((b.outEnd - p) / (b.outEnd - b.outStart))
  return Math.min(rise, fall)
}
function beatShift(p: number, b: Beat) {
  const enter = b.inEnd <= b.inStart ? 1 : clamp01((p - b.inStart) / (b.inEnd - b.inStart))
  const exit = b.outEnd <= b.outStart ? 0 : 1 - clamp01((b.outEnd - p) / (b.outEnd - b.outStart))
  return (1 - enter) * 16 + exit * -12
}

/* Can this browser decode the shipping (VP9-in-MP4) film upfront? */
function filmDecodable() {
  if (typeof document === 'undefined') return false
  const can = document.createElement('video').canPlayType('video/mp4; codecs="vp09.00.41.08"')
  return can === 'probably' || can === 'maybe'
}
function reducedMotion() {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/* ---------------- scrubbed (cinematic) mode ---------------- */

function FilmScrub({ onFail }: { onFail: () => void }) {
  const wrapRef = useRef<HTMLElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const beatRefs = useRef<(HTMLDivElement | null)[]>([])
  const tickRefs = useRef<(HTMLSpanElement | null)[]>([])
  const railRef = useRef<HTMLDivElement>(null)
  const hintRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const video = videoRef.current
    if (!wrap) return

    let raf = 0
    let running = false
    let displayed = 0
    let duration = 0
    let range = Math.max(1, wrap.offsetHeight - window.innerHeight)

    const measure = () => {
      range = Math.max(1, wrap.offsetHeight - window.innerHeight)
    }

    const onMeta = () => {
      if (video && video.duration && isFinite(video.duration)) {
        duration = video.duration
        try {
          video.pause()
          video.currentTime = 0
        } catch {
          /* seek may not be ready yet; the loop will drive it */
        }
      }
    }
    const onError = () => {
      // Only fires once every <source> candidate has failed — go static.
      cancelAnimationFrame(raf)
      running = false
      onFail()
    }

    const frame = () => {
      if (!running) return
      const top = -wrap.getBoundingClientRect().top
      const p = clamp01(top / range)
      // As the sticky unpins past p=1, fade the overlay out so the finale is
      // whole at the end of the scrub but never collides with the fixed nav.
      const fade = 1 - clamp01((top - range) / (window.innerHeight * 0.5))

      if (video && duration > 0) {
        const target = p * duration
        displayed += (target - displayed) * 0.14
        if (!video.seeking && Math.abs(displayed - video.currentTime) > 0.015) {
          try {
            video.currentTime = displayed
          } catch {
            /* transient seek race — retried next frame */
          }
        }
      }

      let best = 0
      let bestI = 0
      for (let i = 0; i < BEATS.length; i++) {
        const el = beatRefs.current[i]
        if (!el) continue
        const o = beatOpacity(p, BEATS[i]) * fade
        el.style.opacity = o.toFixed(3)
        el.style.transform = `translateY(${beatShift(p, BEATS[i]).toFixed(2)}px)`
        el.style.pointerEvents = o > 0.6 ? 'auto' : 'none'
        if (o > best) {
          best = o
          bestI = i
        }
      }
      for (let i = 0; i < tickRefs.current.length; i++) {
        tickRefs.current[i]?.setAttribute('data-on', String(i === bestI))
      }
      if (railRef.current) railRef.current.style.opacity = fade.toFixed(3)
      if (hintRef.current) hintRef.current.style.opacity = (clamp01(1 - p / 0.05) * fade).toFixed(3)

      raf = requestAnimationFrame(frame)
    }

    const start = () => {
      if (running) return
      running = true
      displayed = clamp01(-wrap.getBoundingClientRect().top / range) * (duration || 0)
      raf = requestAnimationFrame(frame)
    }
    const stop = () => {
      running = false
      cancelAnimationFrame(raf)
    }

    if (video) {
      video.addEventListener('loadedmetadata', onMeta)
      video.addEventListener('durationchange', onMeta)
      video.addEventListener('error', onError)
      // <source>-level failures don't bubble to the video; the final one does.
      onMeta()
      video.load()
    }

    const io = new IntersectionObserver(
      ([e]) => (e.isIntersecting ? start() : stop()),
      { threshold: 0 },
    )
    io.observe(wrap)
    window.addEventListener('resize', measure)

    return () => {
      stop()
      io.disconnect()
      window.removeEventListener('resize', measure)
      if (video) {
        video.removeEventListener('loadedmetadata', onMeta)
        video.removeEventListener('durationchange', onMeta)
        video.removeEventListener('error', onError)
      }
    }
  }, [onFail])

  return (
    <section ref={wrapRef} id="top" style={{ height: '520vh' }}>
      <div className="film-sticky">
        <video
          ref={videoRef}
          className="film-video"
          muted
          playsInline
          /* `metadata`, not `auto`: this is a 12.9 MB decorative backdrop and
             `auto` makes the browser pull the whole file up front, competing
             with first paint for bandwidth. The poster covers the frame until
             the first seek lands, the file is +faststart (moov first) so the
             duration arrives in the opening bytes, and the scrub loop only ever
             needs `loadedmetadata`/`durationchange` — both of which still fire
             under `metadata` — plus range requests as `currentTime` moves. */
          preload="auto"
          poster={POSTER}
          aria-hidden="true"
          tabIndex={-1}
        >
          <source src={SRC_PRIMARY} type="video/mp4" />
        </video>

        <div className="film-scrim film-scrim--top" aria-hidden="true" />
        <div className="film-scrim film-scrim--left" aria-hidden="true" />
        <div className="film-scrim film-scrim--bottom" aria-hidden="true" />

        {BEATS.map((b, i) => (
          <div
            key={b.key}
            ref={(el) => {
              beatRefs.current[i] = el
            }}
            className="film-beat"
            style={i === 0 ? { opacity: 1 } : undefined}
          >
            <div className="film-beat-inner">
              <div className="film-beat-col">
                <b.Copy />
              </div>
            </div>
          </div>
        ))}

        <div ref={railRef} className="film-rail" aria-hidden="true">
          {BEATS.map((b, i) => (
            <span
              key={b.key}
              ref={(el) => {
                tickRefs.current[i] = el
              }}
              className="film-tick"
              data-on={i === 0 ? 'true' : 'false'}
            />
          ))}
        </div>

        <div ref={hintRef} className="film-hint" aria-hidden="true">
          <span />
        </div>
      </div>
    </section>
  )
}

/* ---------------- static / reduced-motion mode ---------------- */

function FilmStatic() {
  return (
    <section id="top">
      <div className="film-static-bg" aria-hidden="true">
        <img className="film-static-poster" src={POSTER} alt="" />
        <div className="film-scrim film-scrim--top" />
        <div className="film-scrim film-scrim--left" />
        <div className="film-scrim film-scrim--bottom" />
      </div>
      <div className="relative -mt-[100vh]">
        {BEATS.map((b) => (
          <div key={b.key} className="film-static-beat">
            <div className="film-beat-inner">
              <div className="film-beat-col">
                <Reveal>
                  <b.Copy />
                </Reveal>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export function FilmStage() {
  const [mode, setMode] = useState<'scrub' | 'static'>(() =>
    filmDecodable() && !reducedMotion() ? 'scrub' : 'static',
  )

  return (
    <>
      {mode === 'scrub' ? <FilmScrub onFail={() => setMode('static')} /> : <FilmStatic />}
      <div className="film-to-light" aria-hidden="true" />
      <div id="film-act-end" aria-hidden="true" />
    </>
  )
}
