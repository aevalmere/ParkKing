import type { ReactNode } from 'react'
import { DEMO_URL } from '../lib/config'
import { CrownMark } from './Nav'
import { Check } from './icons'
import { Reveal } from './Reveal'

/* ---------- shared shell ---------- */

function Section({ id, children, className = '' }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`relative mx-auto w-full max-w-[1200px] px-5 py-24 sm:px-8 sm:py-28 ${className}`}>
      {children}
    </section>
  )
}

function GhostNum({ children }: { children: ReactNode }) {
  return (
    <span className="ghost-num absolute -top-2 right-1 hidden select-none md:block" aria-hidden="true">
      {children}
    </span>
  )
}

/* ---------- shared fragments ---------- */

function Stat({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <div>
      <div className="display text-[clamp(2.7rem,6vw,4.1rem)] text-royal-deep">
        {value}
        {unit && <span className="ml-1.5 align-baseline text-[0.42em] font-bold uppercase tracking-wide text-crown-deep">{unit}</span>}
      </div>
      <p className="mt-3 max-w-[16rem] text-[0.97rem] leading-snug text-body">{label}</p>
    </div>
  )
}

function Mode({ title, sub, gold = false }: { title: string; sub: string; gold?: boolean }) {
  return (
    <div className={`card flex items-center gap-3.5 px-5 py-4 ${gold ? 'ring-1 ring-crown/45' : ''}`}>
      {gold ? (
        <CrownMark className="h-6 w-6 shrink-0" />
      ) : (
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-royal" aria-hidden="true" />
      )}
      <div className="min-w-0">
        <div className="font-body font-bold text-ink">{title}</div>
        <div className="text-sm text-mute">{sub}</div>
      </div>
      {gold && <span className="chip chip--gold ml-auto shrink-0">Best match</span>}
    </div>
  )
}

function Persona({
  name,
  meta,
  quote,
  tags,
  goldTag = -1,
}: {
  name: string
  meta: string
  quote: string
  tags: string[]
  goldTag?: number
}) {
  return (
    <div className="card p-6 sm:p-7">
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-body text-lg font-bold text-ink">{name}</div>
        <div className="text-sm text-mute">{meta}</div>
      </div>
      <blockquote className="display-quiet mt-4 text-[1.32rem] leading-snug text-royal-ink">“{quote}”</blockquote>
      <div className="mt-5 flex flex-wrap gap-2">
        {tags.map((t, i) => (
          <span key={t} className={`chip ${goldTag === i ? 'chip--gold' : ''}`}>
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ---------- 01 · problem ---------- */

export function Problem() {
  return (
    <Section id="problem">
      <GhostNum>01</GhostNum>
      <Reveal>
        <div className="rule-open mb-10" aria-hidden="true" />
      </Reveal>
      {/* Spec layout: the label hangs in a narrow sticky column on the left
          while the argument runs in the wide column. It breaks the single
          centred measure every section used to share, which is most of what
          made the page read as one repeated template. */}
      <div className="spec">
        <div className="spec-label">
          <Reveal>
            <p className="eyebrow">The problem</p>
          </Reveal>
        </div>
        <div>
          <Reveal delay={60}>
            <h2 className="display max-w-[20ch] text-[clamp(2.1rem,5.4vw,3.7rem)]">
              Finding parking shouldn’t cost you <span className="text-crown-deep">your whole day.</span>
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-6 max-w-[42rem] text-lg leading-relaxed text-body">
              Prices hidden across a dozen apps. Walking distances you discover too late. A meter that never stops
              ticking. So everyone just… keeps circling.
            </p>
          </Reveal>
          {/* Ragged, not equal thirds — these are three different weights of
              claim and shouldn't be dressed as an even row of three. */}
          <div className="mt-14 grid gap-10 sm:grid-cols-[1.1fr_1.3fr_1fr]">
            <Reveal>
              <Stat value="17" unit="hrs / yr" label="lost per driver, every year, just hunting for a space" />
            </Reveal>
            <Reveal delay={90}>
              <Stat value="Billions" label="burned each year in wasted fuel, time and missed plans" />
            </Reveal>
            <Reveal delay={180}>
              <Stat value="#1" label="named the most stressful part of driving, in our driver interviews" />
            </Reveal>
          </div>
        </div>
      </div>
    </Section>
  )
}

/* ---------- 02 · one search ---------- */

export function Solution() {
  return (
    <div className="relative bg-white/55">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-line" />
      <Section id="how">
        <GhostNum>02</GhostNum>
        <div className="grid gap-14 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <Reveal>
              <p className="eyebrow">One search</p>
            </Reveal>
            <Reveal delay={60}>
              <h2 className="display mt-5 text-[clamp(2rem,4.8vw,3.4rem)]">
                Set your priorities once. <span className="text-crown-deep">It does the deciding.</span>
              </h2>
            </Reveal>
            <Reveal delay={120}>
              <p className="mt-6 max-w-[38rem] text-lg leading-relaxed text-body">
                Tell ParkKing what matters — how far you’ll walk, covered or open, free or paid — and it ranks
                every option nearby in real time, then routes you straight there.
              </p>
            </Reveal>
            <Reveal delay={180}>
              <div className="mt-8 flex flex-wrap gap-2.5">
                <span className="chip">500 m max walk</span>
                <span className="chip">Covered</span>
                <span className="chip">Accessible</span>
                <span className="chip chip--free">Free · Paid</span>
                <span className="chip chip--ghost">Live availability</span>
              </div>
            </Reveal>
          </div>
          <div className="flex flex-col gap-3.5">
            <Reveal>
              <Mode title="Find Closest" sub="Shortest walk to your door" />
            </Reveal>
            <Reveal delay={90}>
              <Mode title="Find Cheapest" sub="Lowest price near you" />
            </Reveal>
            <Reveal delay={180}>
              <Mode title="Best Match" sub="Ranked around your priorities" gold />
            </Reveal>
          </div>
        </div>
      </Section>
    </div>
  )
}

/* ---------- 03 · personas ---------- */

export function Personas() {
  return (
    <Section id="drivers">
      <GhostNum>03</GhostNum>
      <Reveal>
        <div className="rule-open mb-10" aria-hidden="true" />
      </Reveal>
      <Reveal>
        <p className="eyebrow">Every driver’s different</p>
      </Reveal>
      <Reveal delay={60}>
        {/* Pulled wider than the body measure and hung left of the container,
            so this heading sits at a different optical margin from the ones
            above and below it rather than stacking on the same axis. */}
        <h2 className="display mt-5 max-w-[24ch] text-[clamp(2rem,4.8vw,3.4rem)] lg:-ml-[clamp(0rem,4vw,4rem)]">
          The best spot depends on <span className="text-crown-deep">who’s driving.</span>
        </h2>
      </Reveal>
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <Reveal>
          <Persona
            name="Adam"
            meta="41 · busy parent"
            quote="I’d rather pay a little more if it saves me ten minutes."
            tags={['Closest spot', 'Fastest route', 'Minimal walking']}
          />
        </Reveal>
        <Reveal delay={110}>
          <Persona
            name="Sarah"
            meta="22 · university student"
            quote="I don’t mind walking farther if it means I save money."
            tags={['Lowest price', 'Longer walk is fine', 'Value for money']}
            goldTag={0}
          />
        </Reveal>
      </div>
      <Reveal delay={160}>
        <p className="mt-10 max-w-[40rem] text-lg leading-relaxed text-body">
          Other apps hand you a list and leave the rest to you. ParkKing weighs it against{' '}
          <span className="font-semibold text-ink">your</span> priorities and hands you the answer.
        </p>
      </Reveal>
    </Section>
  )
}

/* ---------- 04 · product showcase (mirrors the app) ---------- */

function FauxMap() {
  return (
    <div className="relative h-44 w-full overflow-hidden" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg,#eaf1fb,#e6eefb), radial-gradient(60% 80% at 30% 20%, rgba(37,99,235,0.08), transparent 60%)',
        }}
      />
      {/* roads */}
      <div className="absolute left-0 right-0 top-[38%] h-2 -rotate-3 bg-white/90" />
      <div className="absolute left-0 right-0 top-[64%] h-2 rotate-2 bg-white/90" />
      <div className="absolute bottom-0 left-[26%] top-0 w-2 rotate-3 bg-white/90" />
      <div className="absolute bottom-0 left-[68%] top-0 w-1.5 -rotate-2 bg-white/80" />
      {/* pins */}
      <span className="absolute left-[26%] top-[38%] h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-royal shadow" />
      <span className="absolute left-[62%] top-[52%] grid h-6 w-6 -translate-x-1/2 -translate-y-full place-items-center rounded-full rounded-bl-none border-2 border-white bg-crown shadow-lg">
        <span className="text-[9px] font-black text-[#201401]">P</span>
      </span>
    </div>
  )
}

function AppMock() {
  return (
    <div className="card overflow-hidden p-0">
      <FauxMap />
      <div className="border-t border-line p-3.5">
        <div className="appcard" style={{ ['--avail' as string]: 'var(--color-crown)' } as React.CSSProperties}>
          <div className="flex items-start justify-between gap-3">
            <div className="font-body font-bold leading-tight text-ink">Crown Court Garage</div>
            <div className="whitespace-nowrap text-sm font-bold text-crown-deep">
              176<span className="text-mute">/480</span>
            </div>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1.5 text-[0.8rem] font-semibold text-body">
            <span>0.2 km</span>
            <span>3 min walk</span>
            <span>Garage</span>
            <span className="text-crown-deep">$6/hr</span>
            <span className="text-ink">★ 4.8</span>
            <span className="text-royal-deep">Very safe</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="chip chip--ghost">Covered</span>
            <span className="chip chip--ghost">Accessible</span>
            <span className="chip chip--ghost">Open 24 h</span>
          </div>
          <div className="mt-3.5 flex gap-2">
            <span className="inline-flex flex-1 items-center justify-center gap-1.5 bg-royal px-3 py-2 text-sm font-bold text-white">
              Navigate
            </span>
            <span className="inline-flex items-center justify-center border border-line px-3 py-2 text-sm font-bold text-body">
              Details
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex gap-3.5">
      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-crown" aria-hidden="true" />
      <div>
        <div className="font-body font-bold text-ink">{title}</div>
        <p className="mt-0.5 text-[0.97rem] leading-relaxed text-body">{body}</p>
      </div>
    </div>
  )
}

export function Showcase() {
  return (
    <Section id="product">
      <GhostNum>04</GhostNum>
      <div className="grid gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <Reveal>
            <p className="eyebrow">See it in action</p>
          </Reveal>
          <Reveal delay={60}>
            <h2 className="display mt-5 text-[clamp(2rem,4.8vw,3.4rem)]">
              The whole search, in <span className="text-crown-deep">one clean view.</span>
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-6 max-w-[38rem] text-lg leading-relaxed text-body">
              Every spot ranked on the map and in the list — with the details that actually decide it.
            </p>
          </Reveal>
          <div className="mt-9 grid gap-6 sm:grid-cols-2">
            <Reveal>
              <Feature title="Live availability" body="Spaces free right now, not last week — colour-coded at a glance." />
            </Reveal>
            <Reveal delay={80}>
              <Feature title="Ratings & reviews" body="Real experiences from other drivers, per spot." />
            </Reveal>
            <Reveal delay={160}>
              <Feature title="Filters that matter" body="Covered, accessible, price and safety — dialled to you." />
            </Reveal>
            <Reveal delay={240}>
              <Feature title="One-tap navigation" body="The fastest road route, handed straight to you." />
            </Reveal>
          </div>
        </div>
        <Reveal delay={80}>
          <div className="mx-auto w-full max-w-[380px] lg:ml-auto">
            <AppMock />
            <p className="mt-3 text-center text-xs text-mute">A live spot from the demo — every feature, one card.</p>
          </div>
        </Reveal>
      </div>
    </Section>
  )
}

/* ---------- 05 · platforms (dark band) ---------- */

function Tick({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      <Check tone="current" className="mt-0.5 h-5 w-5 shrink-0 text-crown-soft" />
      <span className="text-[1.02rem] leading-relaxed text-haze">{children}</span>
    </li>
  )
}

function Platform({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="border border-white/12 border-l-2 border-l-crown bg-white/[0.04] px-5 py-5">
      <div className="font-body text-lg font-bold text-white">{title}</div>
      <div className="mt-1 text-sm text-haze">{sub}</div>
    </div>
  )
}

export function Platforms() {
  return (
    <div className="relative overflow-hidden bg-navy">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{ background: 'radial-gradient(70% 90% at 85% 10%, rgba(37,99,235,0.22), transparent 55%)' }}
      />
      <Section id="platforms" className="text-haze">
        <div className="grid gap-14 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <Reveal>
              <p className="eyebrow eyebrow--onDark">Everywhere you drive</p>
            </Reveal>
            <Reveal delay={60}>
              <h2 className="display mt-5 text-[clamp(2rem,4.8vw,3.4rem)] text-white">
                From your pocket to <span className="text-crown">your dashboard.</span>
              </h2>
            </Reveal>
            <Reveal delay={120}>
              <p className="mt-6 max-w-[36rem] text-lg leading-relaxed text-haze">
                The same brain, wherever you are — a mobile app, the web, and software built right into the car.
              </p>
            </Reveal>
            <div className="mt-8 grid grid-cols-3 gap-3">
              <Reveal>
                <Platform title="Phone" sub="On the go" />
              </Reveal>
              <Reveal delay={80}>
                <Platform title="Web" sub="Plan ahead" />
              </Reveal>
              <Reveal delay={160}>
                <Platform title="In-car" sub="Built in" />
              </Reveal>
            </div>
          </div>
          <Reveal delay={120}>
            <ul className="lg:pl-6">
              <Tick>Hands-free voice search while you keep your eyes on the road</Tick>
              <Tick>Recommendations that read the road ahead as you drive</Tick>
              <Tick>Hands the route to your car’s own maps when you arrive</Tick>
            </ul>
          </Reveal>
        </div>
      </Section>
    </div>
  )
}

/* ---------- finale ---------- */

export function Finale() {
  return (
    <div className="relative overflow-hidden bg-navy">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{ background: 'radial-gradient(60% 80% at 50% 120%, rgba(232,163,61,0.18), transparent 60%)' }}
      />
      <Section className="text-center">
        <Reveal>
          <p className="eyebrow eyebrow--onDark eyebrow--center justify-center">Your spot is waiting</p>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="display mx-auto mt-6 max-w-[16ch] text-[clamp(2.6rem,7vw,5rem)] text-white">
            Stop circling. <span className="text-crown">Start arriving.</span>
          </h2>
        </Reveal>
        <Reveal delay={160}>
          <div className="mt-10 flex flex-col items-center gap-4">
            <a href={DEMO_URL} className="cta cta--gold cta--lg">
              Enter the demo →
            </a>
            <p className="text-sm text-haze/80">Free to try · no account, no card.</p>
          </div>
        </Reveal>
      </Section>
    </div>
  )
}
