import { useEffect, useState } from 'react'
import { DEMO_URL } from '../lib/config'

/** The crown mark — amber on transparent, mirrors the app icon + favicon. */
export function CrownMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path d="M13 44 L13 25 L23.5 33.5 L32 19 L40.5 33.5 L51 25 L51 44 Z" fill="#E8A33D" />
      <rect x="13" y="47" width="38" height="4.5" rx="2.25" fill="#E8A33D" />
      <circle cx="13" cy="22" r="3" fill="#F2C979" />
      <circle cx="32" cy="16" r="3" fill="#F2C979" />
      <circle cx="51" cy="22" r="3" fill="#F2C979" />
    </svg>
  )
}

/** ParkKing lockup — "Park" in ink/white, "King" in royal blue, the gold
    crown floating centered above the "King" segment (overlapping the caps). */
export function Wordmark({ size = 'nav', onDark = false }: { size?: 'nav' | 'footer'; onDark?: boolean }) {
  return (
    <span className="wordmark" style={{ fontSize: size === 'footer' ? 'clamp(1.55rem, 3.4vw, 1.95rem)' : '1.2rem' }}>
      <span className={onDark ? 'text-white' : 'text-ink'}>Park</span>
      <span className="wm-king">
        <CrownMark className="wm-crown" />
        <span className={onDark ? 'text-royal-bright' : 'text-royal'}>King</span>
      </span>
    </span>
  )
}

export function Nav() {
  const [solid, setSolid] = useState(false)

  useEffect(() => {
    // Stay transparent/onDark for the whole film act; go solid only once the
    // act's end marker reaches the bar (one cheap rect read per scroll).
    const onScroll = () => {
      const marker = document.getElementById('film-act-end')
      const next = marker ? marker.getBoundingClientRect().top <= 64 : window.scrollY > 24
      setSolid((prev) => (prev === next ? prev : next))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  const linkCls = `hidden text-[0.92rem] font-semibold transition-colors md:inline ${
    solid ? 'text-body hover:text-ink' : 'text-white/85 hover:text-white'
  }`
  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        solid ? 'border-b border-line bg-paper/85 backdrop-blur-md' : 'border-b border-transparent'
      }`}
    >
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-3 sm:px-8">
        <a href="#top" aria-label="ParkKing — top">
          <Wordmark onDark={!solid} />
        </a>
        <nav className="flex items-center gap-1.5 sm:gap-6">
          <a href="#how" className={linkCls}>
            How it works
          </a>
          <a href="#plans" className={linkCls}>
            Plans
          </a>
          <a href={DEMO_URL} className="pill">
            <span className="hidden sm:inline">Try the demo — free</span>
            <span className="sm:hidden">Try free</span>
          </a>
        </nav>
      </div>
    </header>
  )
}
