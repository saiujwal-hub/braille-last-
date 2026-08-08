import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../store'
import { historyAvailable, type HistoryEntry } from '../lib/db'

export function HistoryScreen() {
  const navigate = useNavigate()
  const { history, deleteScan, dbOk } = useApp()
  const [confirmId, setConfirmId] = useState<string | null>(null)

  if (!dbOk || !historyAvailable()) {
    return (
      <main className="screen">
        <h1 className="page-title">History</h1>
        <p>History is stored locally on this device. It is not available in this browser.</p>
      </main>
    )
  }

  return (
    <main className="screen">
      <h1 className="page-title">Student scan history</h1>
      <p className="page-sub">Track a student&apos;s Braille homework over time. Stored privately on this device.</p>

      {history.length === 0 ? (
        <div className="empty">
          <p>No scans saved yet.</p>
          <button type="button" className="btn btn--primary" onClick={() => navigate('/scan')}>
            Scan your first Braille page
          </button>
        </div>
      ) : (
        <ul className="history-list">
          {history.map((h) => (
            <li key={h.id} className={`history-row ${confirmId === h.id ? 'is-confirm' : ''}`}>
              {h.thumb && <img src={h.thumb} alt="" className="history-row__thumb" />}
              <div className="history-row__body">
                <p className="history-row__text">“{h.text || '·'}”</p>
                <p className="history-row__meta">
                  {new Date(h.createdAt).toLocaleString()} · {h.cellCount} cells ·{' '}
                  <span className={h.overall > 0.75 ? 'score--ok' : h.overall > 0.5 ? 'score--warn' : 'score--danger'}>
                    {Math.round(h.overall * 100)}%
                  </span>
                  {h.uncertainCount > 0 && ` · ${h.uncertainCount} uncertain`}
                </p>
              </div>
              <button
                type="button"
                className={`btn btn--sm ${confirmId === h.id ? 'btn--danger' : 'btn--ghost'}`}
                onClick={async () => {
                  if (confirmId === h.id) {
                    await deleteScan(h.id)
                    setConfirmId(null)
                  } else {
                    setConfirmId(h.id)
                  }
                }}
              >
                {confirmId === h.id ? 'Confirm delete' : 'Delete'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

export type { HistoryEntry }
