import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp, useScan } from '../store'
import { renderBrailleText } from '../lib/sample'

const SAMPLE_LINES = ['the cat sat', 'look and see']

export function HomeScreen() {
  const navigate = useNavigate()
  const { language, dbOk, history } = useApp()
  const { startScan, phase } = useScan()
  const [offline, setOffline] = useState(!navigator.onLine)
  const [demoBusy, setDemoBusy] = useState(false)

  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  async function runDemo() {
    setDemoBusy(true)
    try {
      const phrase = SAMPLE_LINES.join('\n')
      const { rgba, width, height } = renderBrailleText(phrase, language, { g: 24, lineWidth: 11 })
      await startScan(rgba, width, height, language)
    } finally {
      setDemoBusy(false)
    }
  }

  return (
    <main className="screen home">
      <header className="hero">
        <h1 className="hero__title">Braille <span>Bridge</span></h1>
        <p className="hero__tag">
          Turn handwritten slate-and-stylus Braille into text your eyes can read — on-device, offline, and fully
          explainable.
        </p>
      </header>

      <div className="home__actions">
        <button
          type="button"
          className="btn btn--primary btn--xl"
          onClick={() => navigate('/scan')}
          disabled={phase === 'scanning'}
        >
          <span className="btn__big">Scan Braille</span>
          <span className="btn__sub">camera or photo</span>
        </button>

        <button
          type="button"
          className="btn btn--accent btn--xl"
          onClick={runDemo}
          disabled={demoBusy || phase === 'scanning'}
        >
          <span className="btn__big">Try a sample</span>
          <span className="btn__sub">no WiFi needed · works offline</span>
        </button>

        <div className="home__row">
          <button type="button" className="btn btn--ghost" onClick={() => navigate('/history')} disabled={!dbOk}>
            History · {history.length}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => navigate('/settings')}>
            Settings
          </button>
        </div>
      </div>

      {offline && (
        <div className="chip chip--warn" role="status">
          Offline mode — everything still works, photos never leave your device.
        </div>
      )}

      <div className="home__feature">
        <h2>How it works</h2>
        <ul className="feature-list">
          <li>
            <strong>3 independent readers</strong> read every cell in parallel (geometric CV, template match, and a
            language tie-breaker).
          </li>
          <li>
            <strong>Consensus, not guessing.</strong> When readers disagree, you see both interpretations side-by-side.
          </li>
          <li>
            <strong>Private by design.</strong> No cloud, no API keys, no photo uploads. Your student&apos;s work stays
            on your device.
          </li>
        </ul>
      </div>

      <footer className="built-with">
        <p>Built with <strong>IBM Bob</strong> — an agentic AI coding partner.</p>
      </footer>
    </main>
  )
}
