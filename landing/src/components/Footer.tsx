import { BLOG_URL, DEMO_URL, HOME_URL } from '../lib/config'
import { Wordmark } from './Nav'

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-navy text-haze">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          background:
            'radial-gradient(60% 80% at 80% 0%, rgba(232,163,61,0.6), transparent 60%), radial-gradient(50% 60% at 10% 100%, rgba(37,99,235,0.7), transparent 60%)',
        }}
      />
      <div className="relative mx-auto max-w-[1200px] px-5 py-16 sm:px-8">
        <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
          <div>
            <Wordmark size="footer" onDark />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-haze">
              One search finds the spot that fits you — closest, cheapest, or the best match. On your phone, your
              laptop, and the screen in your dash.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 md:items-end">
            <a href={DEMO_URL} className="cta cta--gold">
              Try the demo — free →
            </a>
            <p className="text-xs text-haze/80">No account. No card. Just park.</p>
          </div>
        </div>
        <hr className="my-10 border-white/10" />
        <div className="flex flex-col gap-2 text-xs text-haze/70 sm:flex-row sm:items-center sm:justify-between">
          <p>ParkKing — a Team 6 project · Dev, Ken, Ethan &amp; Noah</p>
          <p>Skeleton pitch · illustrative pricing · the demo is real</p>
        </div>
        {/* Credit back to the write-up. This page is a practice piece and the
            post is where the reasoning lives, so it gets a real line rather
            than being buried in the small print above. */}
        <p className="mt-6 text-sm text-haze">
          Built by{' '}
          <a href={HOME_URL} className="font-semibold text-white underline decoration-crown decoration-2 underline-offset-4 hover:text-crown-soft">
            Ethan Zhang
          </a>{' '}
          as a go-to-market exercise. The full write-up —{' '}
          <a href={BLOG_URL} className="font-semibold text-white underline decoration-crown decoration-2 underline-offset-4 hover:text-crown-soft">
            The customer is the spec
          </a>{' '}
          — covers what it taught me and what I&rsquo;d keep.
        </p>
      </div>
    </footer>
  )
}
