import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { OverlayGrid } from '../components/OverlayGrid'
import { DeepDive } from '../components/DeepDive'
import type { CellResult } from '../domain/consensus'
import { TABLES, translateMasks } from '../domain/tables'
import { speak, stopSpeaking, speechAvailable } from '../lib/tts'
import { useApp } from '../store'

export function ResultScreen() {
  const navigate = useNavigate()
  const { lastResult, language, saveScan } = useApp()
  const [showDeep, setShowDeep] = useState(false)
  const [edited, setEdited] = useState<CellResult[] | null>(null)
  const [speechNote, setSpeechNote] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const cells = useMemo(() => edited ?? lastResult?.cells ?? [], [edited, lastResult])
  const text = useMemo(() => {
    if (!lastResult) return ''
    if (!edited) return lastResult.text
    const masks = cells.map((c) => c.mask)
    return translateMasks(masks, lastResult.language).text
  }, [lastResult, edited, cells])

  if (!lastResult) {
    return (
      <main className="screen">
        <h1 className="page-title">No result yet</h1>
        <p>Scan a Braille photo or try a sample first.</p>
        <button type="button" className="btn btn--primary" onClick={() => navigate('/')}>
          Back to home
        </button>
      </main>
    )
  }

  function toggleDot(cellIndex: number, dotIndex: number) {
    setEdited((prev) => {
      const base = prev ?? lastResult!.cells
      const next = base.map((c) => ({ ...c }))
      const cell = next[cellIndex]
      const bit = 1 << dotIndex
      const newMask = (cell.mask & bit) === 0 ? cell.mask | bit : cell.mask & ~bit
      const known = TABLES[lastResult!.language]
      cell.mask = newMask
      cell.char = newMask === 0 ? ' ' : known.forward[newMask] ?? null
      cell.status = 'high'
      cell.confidence = 0.99
      cell.invented = false
      cell.alternatives = []
      return next
    })
  }

  function readAloud() {
    stopSpeaking()
    const ok = speak(text, { rate: 0.95, lang: language })
    setSpeechNote(ok ? null : 'Text-to-speech is unavailable on this browser. The translation is shown above.')
  }

  async function handleSave() {
    const ok = await saveScan()
    setSaved(ok)
  }

  const overall = lastResult.overall

  return (
    <main className="screen">
      <div className="result-head">
        <div>
          <h1 className="page-title">Translation</h1>
          <p className="page-sub">Tap any dot on the image to correct a cell — it re-translates instantly.</p>
        </div>
        <div className={`score ${overall > 0.75 ? 'score--ok' : overall > 0.5 ? 'score--warn' : 'score--danger'}`}>
          {Math.round(overall * 100)}%<span>confidence</span>
        </div>
      </div>

      <section className="transcript" aria-live="polite">
        <p className="transcript__text">{text || '·'}</p>
        <div className="transcript__actions">
          <button type="button" className="btn btn--ghost" onClick={readAloud}>
            {speechNote ? '🔇' : '🔊'} Read aloud
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => setShowDeep((s) => !s)}>
            {showDeep ? 'Hide deep dive' : 'Deep dive'}
          </button>
        </div>
        {speechNote && <p className="hint">{speechNote}</p>}
        {speechAvailable() && !speechNote && <p className="hint">Tap a cell to hear it spoken aloud.</p>}
      </section>

      <section className="visual">
        <OverlayGrid result={lastResult} onToggleDot={toggleDot} />
        <div className="visual__legend">
          <span className="legend-dot legend-dot--ok" /> high · <span className="legend-dot legend-dot--warn" /> tie ·{' '}
          <span className="legend-dot legend-dot--danger" /> uncertain
        </div>
      </section>

      <div className="result-actions">
        <button type="button" className="btn btn--primary" onClick={() => navigate('/scan')}>
          Retake
        </button>
        <button type="button" className="btn btn--accent" onClick={handleSave} disabled={saved}>
          {saved ? 'Saved ✓' : 'Save to history'}
        </button>
      </div>

      {showDeep && <DeepDive cells={cells} />}
    </main>
  )
}
