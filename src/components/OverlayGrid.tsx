import { useMemo } from 'react'
import { dotPresence } from '../domain/cell'
import { imageDataToDataUrl } from '../lib/imageInput'
import type { ScanOk } from '../lib/cv/pipeline'

const DOT_SLOTS = [
  { left: '30%', top: '18%' },
  { left: '30%', top: '50%' },
  { left: '30%', top: '82%' },
  { left: '70%', top: '18%' },
  { left: '70%', top: '50%' },
  { left: '70%', top: '82%' },
] as const

export function OverlayGrid({
  result,
  onToggleDot,
}: {
  result: ScanOk
  onToggleDot: (cellIndex: number, dotIndex: number) => void
}) {
  const src = useMemo(
    () => imageDataToDataUrl(result.display, result.displayWidth, result.displayHeight, 0.85),
    [result],
  )

  return (
    <div className="overlay" style={{ position: 'relative', borderRadius: 12, overflow: 'hidden' }}>
      <img
        src={src}
        alt="Processed scan showing detected Braille cells"
        style={{ width: '100%', display: 'block' }}
        draggable={false}
      />
      {result.cells.map((cell, i) => {
        const pct = (v: number, dim: number) => `${(v / dim) * 100}%`
        const statusCls = cell.status === 'high' ? 'box-ok' : cell.status === 'tie' ? 'box-warn' : 'box-danger'
        const present = dotPresence(cell.mask)
        return (
          <div
            key={i}
            className={`cell-box ${statusCls}`}
            style={{
              position: 'absolute',
              left: pct(cell.box.x, result.displayWidth),
              top: pct(cell.box.y, result.displayHeight),
              width: pct(cell.box.w, result.displayWidth),
              height: pct(cell.box.h, result.displayHeight),
            }}
          >
            {DOT_SLOTS.map((slot, d) => (
              <button
                key={d}
                type="button"
                aria-label={`Toggle dot ${d + 1} in cell ${i + 1}`}
                onClick={() => onToggleDot(i, d)}
                className={`dot-slot ${present[d] ? 'dot-slot--on' : ''}`}
                style={{ left: slot.left, top: slot.top }}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}
