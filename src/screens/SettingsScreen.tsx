import { useState } from 'react'
import { useApp } from '../store'
import { TABLES, type BrailleLang } from '../domain/tables'
import { speak } from '../lib/tts'

export function SettingsScreen() {
  const { language, setLanguage } = useApp()
  const [rate, setRate] = useState(0.95)

  return (
    <main className="screen">
      <h1 className="page-title">Settings</h1>

      <section className="settings-group">
        <h2 className="section-title">Braille table</h2>
        <p className="hint">Which Braille letter set to use when translating.</p>
        <div className="segmented">
          {(Object.keys(TABLES) as BrailleLang[]).map((id) => (
            <button
              key={id}
              type="button"
              className={`segmented__item ${language === id ? 'is-active' : ''}`}
              onClick={() => setLanguage(id)}
            >
              {TABLES[id].label}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-group">
        <h2 className="section-title">Read-aloud speed</h2>
        <input
          type="range"
          min={0.5}
          max={1.5}
          step={0.05}
          value={rate}
          aria-label="Read-aloud speed"
          onChange={(e) => setRate(parseFloat(e.target.value))}
        />
        <div className="settings-row">
          <button type="button" className="btn btn--ghost" onClick={() => speak('Braille Bridge', { rate })}>
            Preview voice
          </button>
          <span>{Math.round(rate * 100)}%</span>
        </div>
      </section>

      <section className="settings-group">
        <h2 className="section-title">About</h2>
        <p className="hint">
          Braille Bridge translates handwritten slate-and-stylus Braille into plain text using three on-device readers
          and a consensus engine. Everything runs locally — no API keys, no cloud, no data leaving this device.
        </p>
        <p className="hint">
          Bharati Braille is an experimental first pass. The English Grade 1 table is the primary target.
        </p>
      </section>
    </main>
  )
}
