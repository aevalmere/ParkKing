/* Thin-stroke glyphs shared across the plan cards, comparison matrix and
   platform list — one consistent line weight, never emoji or unicode ticks. */

export function Check({
  tone = 'royal',
  className = 'compare-glyph',
}: {
  tone?: 'royal' | 'gold' | 'current'
  className?: string
}) {
  const stroke =
    tone === 'gold' ? 'var(--color-crown-deep)' : tone === 'current' ? 'currentColor' : 'var(--color-royal)'
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke={stroke}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 12.6 L9.4 18 L20 6.4" />
    </svg>
  )
}

export function Dash({ className = 'compare-glyph compare-dash' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6.5 12 H17.5" />
    </svg>
  )
}
