import { BLOG_URL, DEMO_URL } from '../lib/config'

/* The honest label, sat between the film act and the editorial body.
   ParkKing is a pitch for a product that does not exist — the site and the
   deck are finished, the app behind them is a demo. Saying that here, in the
   page's own voice and before any of the marketing copy, is what separates a
   student project from a page pretending to be a company. It is also simply
   more interesting: the thing on offer is the craft, not the parking. */
export function StatusStrip() {
  return (
    <div className="status">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-5 py-5 sm:flex-row sm:items-baseline sm:gap-6 sm:px-8">
        <p className="status-key">Where this stands</p>
        <p className="max-w-[64ch] text-[0.94rem] leading-relaxed text-body">
          Everything past this line is a <strong className="font-bold text-ink">skeleton</strong> — a
          pitch for a product that was never built to sell. The numbers are illustrative and the
          pricing is an exercise.{' '}
          <a href={DEMO_URL} className="underline decoration-crown decoration-2 underline-offset-4 hover:text-ink">
            The demo, though, genuinely works
          </a>{' '}
          — search it, filter it, navigate it. That was the part worth building.
        </p>
        <a
          href={BLOG_URL}
          className="shrink-0 whitespace-nowrap border-b-2 border-crown pb-0.5 text-[0.82rem] font-bold uppercase tracking-[0.14em] text-ink transition-colors hover:text-royal-deep sm:ml-auto"
        >
          Why I built it →
        </a>
      </div>
    </div>
  )
}
