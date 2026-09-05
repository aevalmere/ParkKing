import { useState } from 'react'
import { DEMO_URL } from '../lib/config'
import { CrownMark } from './Nav'
import { Check, Dash } from './icons'
import { Reveal } from './Reveal'

function Features({ items, tone = 'royal' }: { items: string[]; tone?: 'royal' | 'gold' }) {
  return (
    <ul className="mt-6 space-y-3">
      {items.map((t) => (
        <li key={t} className="flex items-start gap-2.5 text-[0.95rem] leading-snug text-body">
          <Check tone={tone} className="mt-0.5 h-[18px] w-[18px] shrink-0" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  )
}

/* ---------- comparison matrix ---------- */

type Cell = 'check' | 'dash' | { text: string; kind?: 'mute' | 'pos' | 'gold' }
type Row = { label: string; note?: string; free: Cell; pro: Cell; auto: Cell }

const ROWS: Row[] = [
  { label: 'Closest & Cheapest search', free: 'check', pro: 'check', auto: 'check' },
  { label: 'Best Match', free: 'check', pro: 'check', auto: 'check' },
  { label: 'Voice search', free: 'check', pro: 'check', auto: 'check' },
  {
    label: 'Ads',
    free: { text: 'Ad-supported', kind: 'mute' },
    pro: { text: 'Ad-free', kind: 'pos' },
    auto: { text: 'Ad-free', kind: 'pos' },
  },
  { label: 'Live space availability', free: 'dash', pro: 'check', auto: 'check' },
  { label: 'Space alerts', free: 'dash', pro: 'check', auto: 'check' },
  { label: 'AI recommendations', free: 'dash', pro: 'check', auto: 'check' },
  {
    label: 'Advanced personalization',
    note: 'weights what matters to you',
    free: 'dash',
    pro: 'check',
    auto: 'check',
  },
  { label: 'Saved places', free: 'dash', pro: 'check', auto: 'check' },
  { label: 'In-car mode', free: 'dash', pro: 'check', auto: { text: 'Built in', kind: 'gold' } },
  { label: 'Dashboard integration', free: 'dash', pro: 'dash', auto: 'check' },
  { label: 'Fleet analytics', free: 'dash', pro: 'dash', auto: 'check' },
]

function CompareCell({ value, pro = false }: { value: Cell; pro?: boolean }) {
  if (value === 'check') return <Check tone={pro ? 'gold' : 'royal'} className="compare-glyph mx-auto" />
  if (value === 'dash') return <Dash className="compare-glyph compare-dash mx-auto" />
  const cls =
    value.kind === 'pos'
      ? 'compare-text compare-text--pos'
      : value.kind === 'gold'
        ? 'compare-text compare-text--gold'
        : value.kind === 'mute'
          ? 'compare-text compare-text--mute'
          : 'compare-text'
  return <span className={cls}>{value.text}</span>
}

function CompareTable() {
  return (
    <div className="mt-20">
      <Reveal>
        <div className="mx-auto max-w-[38rem] text-center">
          <p className="eyebrow eyebrow--center justify-center">Compare plans</p>
          <h3 className="display mt-4 text-[clamp(1.7rem,4vw,2.6rem)]">
            Every feature, <span className="text-crown-deep">side by side.</span>
          </h3>
        </div>
      </Reveal>
      <Reveal delay={80}>
        <div className="card mt-9 overflow-hidden p-0">
          <div className="compare-scroll">
            <table className="compare">
              <thead>
                <tr>
                  <th scope="col" className="compare-feat">
                    <span className="compare-tier">What you get</span>
                  </th>
                  <th scope="col" className="compare-col">
                    <span className="compare-tier">Free</span>
                  </th>
                  <th scope="col" className="compare-col compare-col--pro">
                    <span className="compare-pop">
                      <CrownMark className="h-3 w-3" /> Most popular
                    </span>
                    <span className="compare-tier block">Pro</span>
                  </th>
                  <th scope="col" className="compare-col">
                    <span className="compare-tier">Automakers</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.label}>
                    <th scope="row" className="compare-feat">
                      <div className="compare-feat-label">{r.label}</div>
                      {r.note && <div className="compare-feat-note">{r.note}</div>}
                    </th>
                    <td>
                      <CompareCell value={r.free} />
                    </td>
                    <td className="compare-col--pro">
                      <CompareCell value={r.pro} pro />
                    </td>
                    <td>
                      <CompareCell value={r.auto} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>
    </div>
  )
}

export function Pricing() {
  const [annual, setAnnual] = useState(true)

  return (
    <section id="plans" className="relative mx-auto w-full max-w-[1200px] px-5 py-24 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-[42rem] text-center">
        <Reveal>
          <p className="eyebrow eyebrow--center justify-center">Plans</p>
        </Reveal>
        <Reveal delay={60}>
          <h2 className="display mt-5 text-[clamp(2.1rem,5.2vw,3.6rem)]">
            Start free. <span className="text-crown-deep">Upgrade when you’re ready.</span>
          </h2>
        </Reveal>
        <Reveal delay={120}>
          <p className="mt-5 text-lg leading-relaxed text-body">
            Everything you need to find a spot is free, forever. Go further whenever it’s worth it.
          </p>
        </Reveal>
      </div>

      {/* billing toggle */}
      <Reveal delay={160}>
        <div className="mt-9 flex items-center justify-center gap-3">
          <div className="inline-flex items-center gap-1 rounded-full border border-line bg-white p-1 shadow-[0_10px_28px_-20px_rgba(12,24,56,0.5)]">
            <button
              type="button"
              className="segbtn"
              data-on={!annual}
              style={{
                background: !annual ? 'var(--color-royal)' : 'transparent',
                boxShadow: !annual ? '0 8px 18px -10px rgba(37,99,235,0.8)' : 'none',
              }}
              onClick={() => setAnnual(false)}
            >
              Monthly
            </button>
            <button
              type="button"
              className="segbtn"
              data-on={annual}
              style={{
                background: annual ? 'var(--color-royal)' : 'transparent',
                boxShadow: annual ? '0 8px 18px -10px rgba(37,99,235,0.8)' : 'none',
              }}
              onClick={() => setAnnual(true)}
            >
              Annual
            </button>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-b from-crown-soft to-crown px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide text-[#201401] shadow-[0_10px_24px_-12px_rgba(185,121,31,0.9)]">
            Save 37%
          </span>
        </div>
      </Reveal>

      <div className="mt-12 grid items-stretch gap-6 lg:grid-cols-3">
        {/* FREE */}
        <Reveal className="h-full">
          <div className="card flex h-full flex-col p-7">
            <div className="text-sm font-bold uppercase tracking-wide text-mute">Free</div>
            <div className="mt-4 flex items-end gap-1">
              <span className="display text-[3.2rem] leading-none">$0</span>
              <span className="mb-2 text-sm font-semibold text-mute">forever</span>
            </div>
            <p className="mt-3 text-[0.97rem] leading-relaxed text-body">Everything you need to find a spot and go.</p>
            <Features
              items={[
                'Closest, Cheapest & Best Match',
                'Voice search on every platform',
                'Distance, price & turn-by-turn routing',
              ]}
            />
            <p className="mt-4 text-xs font-medium text-mute">Ad-supported</p>
            <a href={DEMO_URL} className="cta mt-8 w-full">
              Start free →
            </a>
          </div>
        </Reveal>

        {/* PRO — featured */}
        <Reveal delay={90} className="h-full">
          <div className="relative flex h-full flex-col rounded-[1.35rem] border-2 border-crown/70 bg-white p-7 shadow-[0_30px_70px_-34px_rgba(232,163,61,0.6)] lg:-mt-3 lg:mb-3">
            {annual && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.2rem]" aria-hidden="true">
                <span className="absolute -right-[54px] top-[30px] block rotate-45 bg-gradient-to-b from-crown-soft to-crown px-14 py-1 text-center text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-[#201401] shadow-[0_8px_18px_-8px_rgba(185,121,31,0.9)]">
                  Save 37%
                </span>
              </div>
            )}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-b from-crown-soft to-crown px-3.5 py-1.5 text-xs font-bold text-[#201401] shadow">
                <CrownMark className="h-3.5 w-3.5" /> Most popular
              </span>
            </div>
            <div className="text-sm font-bold uppercase tracking-wide text-crown-deep">Pro</div>
            <div className="mt-4 flex items-end gap-1.5">
              <span className="display text-[3.2rem] leading-none">{annual ? '$3.12' : '$4.99'}</span>
              <span className="mb-2 text-sm font-semibold text-mute">/ mo</span>
            </div>
            <p className="mt-2 text-[0.9rem] font-semibold text-body">
              {annual ? (
                <>
                  Billed <span className="text-ink">$37.49</span>/year{' '}
                  <span className="text-mute line-through decoration-mute/70">$59.88</span>
                </>
              ) : (
                <>Billed monthly · cancel anytime</>
              )}
            </p>
            <Features
              tone="gold"
              items={[
                'Everything in Free, ad-free',
                'AI recommendations, tuned to you',
                'Advanced personalization',
                'Live availability & space alerts',
                'Saved places & in-car voice',
              ]}
            />
            <a href={DEMO_URL} className="cta cta--gold mt-8 w-full">
              Try Pro free →
            </a>
          </div>
        </Reveal>

        {/* AUTOMAKERS */}
        <Reveal delay={180} className="h-full">
          <div className="card flex h-full flex-col p-7">
            <div className="text-sm font-bold uppercase tracking-wide text-mute">Automakers</div>
            <div className="mt-4 flex items-end gap-1.5">
              <span className="display text-[3.2rem] leading-none">$79</span>
              <span className="mb-2 text-sm font-semibold text-mute">/ vehicle</span>
            </div>
            <p className="mt-3 text-[0.97rem] leading-relaxed text-body">
              One-time license, embedded at the factory — ParkKing on every dashboard.
            </p>
            <p className="mt-2 text-xs font-medium text-mute">Volume pricing from $49/vehicle at scale</p>
            <Features
              items={[
                'Native in-dash experience',
                'Dashboard integration & voice',
                'Fleet analytics & OEM licensing',
                'Co-branded, built to spec',
              ]}
            />
            <a href={DEMO_URL} className="ghostbtn mt-8 w-full justify-center">
              See the in-car demo →
            </a>
          </div>
        </Reveal>
      </div>

      <CompareTable />

      <Reveal delay={120}>
        <p className="mx-auto mt-12 max-w-[46rem] text-center text-sm leading-relaxed text-mute">
          No credit card to start · cancel anytime. Best Match was shaped by real driver interviews — we began
          with “closest wins,” learned every driver ranks differently, and built it to decide the way you would.
        </p>
      </Reveal>
    </section>
  )
}
