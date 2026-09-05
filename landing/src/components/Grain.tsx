/** Fixed film-grain overlay — static texture, zero repaint cost. */
export function Grain() {
  return (
    <div
      aria-hidden="true"
      className="grain-tex pointer-events-none fixed inset-0 z-[70] opacity-[0.04] mix-blend-overlay"
    />
  )
}
