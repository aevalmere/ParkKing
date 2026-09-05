import { useEffect, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'

/* One shared IntersectionObserver drives every reveal on the page: each element
   fades + rises once as it enters view (transform/opacity only). Reduced motion
   shows everything immediately. */

let io: IntersectionObserver | null = null
const cbs = new WeakMap<Element, () => void>()

function ensure(): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') return null
  if (io) return io
  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          cbs.get(e.target)?.()
          io!.unobserve(e.target)
          cbs.delete(e.target)
        }
      }
    },
    { threshold: 0.15, rootMargin: '0px 0px -6% 0px' },
  )
  return io
}

export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('in')
      return
    }
    const obs = ensure()
    if (!obs) {
      el.classList.add('in')
      return
    }
    cbs.set(el, () => el.classList.add('in'))
    obs.observe(el)
    return () => {
      obs.unobserve(el)
      cbs.delete(el)
    }
  }, [])
  return ref
}

export function Reveal({
  delay = 0,
  className = '',
  children,
  style,
}: {
  delay?: number
  className?: string
  children: ReactNode
  style?: CSSProperties
}) {
  const ref = useReveal<HTMLDivElement>()
  return (
    <div
      ref={ref}
      className={`reveal ${className}`}
      style={{ ...(style || {}), ['--reveal-delay' as string]: `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  )
}
