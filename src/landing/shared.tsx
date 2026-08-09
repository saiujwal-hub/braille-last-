import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ENGLISH_TABLE } from '../domain/tables'
import './base.css'

/** Give a prototype full control of the document background + CSS vars. */
export function usePageTheme(vars: Record<string, string>, bodyBg: string) {
  useEffect(() => {
    const root = document.documentElement
    const prev: Record<string, string | null> = {}
    for (const [k, v] of Object.entries(vars)) {
      prev[k] = root.style.getPropertyValue(k) || null
      root.style.setProperty(k, v)
    }
    const prevBg = document.body.style.background
    document.body.style.background = bodyBg
    return () => {
      for (const [k, v] of Object.entries(prev)) {
        if (v === null) root.style.removeProperty(k)
        else root.style.setProperty(k, v)
      }
      document.body.style.background = prevBg
    }
  }, [vars, bodyBg])
}

export type ThemeVars = Record<string, string>

/** Simple clamp helper for consistent responsive type scale. */
export const cl = (min: number, vw: number, max: number) =>
  `clamp(${min}px, ${vw}vw, ${max}px)`

/**
 * Render a word as authentic 6-dot braille cells, using the project's own
 * English grade-1 table so the dot patterns are the real thing. Dot colours
 * are driven by the page's own CSS via `--bb-dot-on` / `--bb-dot-off`.
 */
export function Braille({
  text,
  className = '',
  cellWidth,
}: {
  text: string
  className?: string
  cellWidth?: number
}) {
  const cells = [...text.toLowerCase()].map((ch) => ENGLISH_TABLE.reverse[ch] ?? 0)
  return (
    <span className={`bb-row ${className}`} style={cellWidth ? { '--bb-cell': `${cellWidth}px` } as CSSProperties : undefined} aria-hidden>
      {cells.map((mask, ci) => (
        <span className="bb-cell" key={`${text}-${ci}`} aria-label={mask ? `braille pattern ${ci + 1}` : 'space'}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <i key={i} className={mask & (1 << i) ? 'bb-dot on' : 'bb-dot'} />
          ))}
        </span>
      ))}
    </span>
  )
}

/** Scroll-reveal wrapper. Turns `.rev-in` on once at least `rootMargin` visible. */
export function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setInView(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.12 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`rev ${className} ${inView ? 'is' : ''}`}
      style={delay && inView ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}

/** Standard keyboard-focus ring shared by all prototypes. */
export function focusCss(page: string) {
  return `${page} :is(a, button, summary, [tabindex]):focus-visible {
  outline: 3px solid var(--bb-focus);
  outline-offset: 3px;
  border-radius: 4px;
}`
}