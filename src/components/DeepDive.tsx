import type { CellResult } from '../domain/consensus'
import { maskToPattern } from '../domain/cell'
import { CellDiagram } from './CellDiagram'
import { ConfidencePill } from './ConfidencePill'

export function DeepDive({ cells }: { cells: CellResult[] }) {
  const problemCells = cells.filter((c) => c.status !== 'high')
  return (
    <section className="deep-dive" aria-label="Explainability deep dive">
      <h3 className="section-title">Deep dive — every cell, explained</h3>
      {problemCells.length > 0 && (
        <p className="hint">
          {problemCells.length} cell{problemCells.length > 1 ? 's' : ''} need{problemCells.length === 1 ? 's' : ''} a
          second look. Toggle dots on the image to correct them.
        </p>
      )}
      <div className="cell-grid">
        {cells.map((c, i) => (
          <div key={i} className="cell-card">
            <div className="cell-card__top">
              <CellDiagram mask={c.mask} size={40} highlight={c.status} showLabels />
              <div className="cell-card__meta">
                <div className="cell-card__char">{c.char ?? '?'}</div>
                <div className="cell-card__pattern">{maskToPattern(c.mask) || '·'}</div>
                <ConfidencePill status={c.status} confidence={c.confidence} />
              </div>
            </div>
            {c.invented && (
              <div className="invented-note">
                ⚠ This pattern isn't a standard Grade 1 letter — it may be a child's invented shortcut. Teachers should
                verify.
              </div>
            )}
            {c.status !== 'high' && c.alternatives.length > 0 && (
              <div className="alternatives" aria-label="Disagreement interpretations">
                {c.alternatives.map((alt) => (
                  <div key={alt.reader} className="alt-row">
                    <span className="alt-reader">Reader {alt.reader}</span>
                    <CellDiagram mask={alt.mask} size={26} />
                    <span className="alt-char">{alt.char ?? '?'}</span>
                    <span className="alt-pattern">{maskToPattern(alt.mask)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
