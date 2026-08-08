import { useEffect, useState } from 'react'

const STEPS = [
  { key: 'prep', label: 'Enhancing contrast & finding dots' },
  { key: 'grid', label: 'Reader A · geometric grid' },
  { key: 'template', label: 'Reader B · template match' },
  { key: 'consensus', label: 'Consensus · tie-breaking with Reader C' },
] as const

export function ReaderAnimation() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setStep((s) => (s >= STEPS.length - 1 ? STEPS.length - 1 : s + 1))
    }, 650)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="reader-anim" role="status" aria-label="Scanning with three readers">
      <div className="reader-anim__head">
        <span className="spinner" aria-hidden="true" />
        <strong>Reading with 3 on-device readers…</strong>
      </div>
      <ul className="reader-anim__list">
        {STEPS.map((s, i) => (
          <li key={s.key} className={i <= step ? 'is-done' : ''}>
            <span className="reader-anim__mark">{i < step ? '✓' : i === step ? '●' : '○'}</span>
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
