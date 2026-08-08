// Reader B — template / local-contrast reader. Independent of Reader A's blob
// detection: it tests each of the six expected dot positions in every cell by
// comparing a small disc against the surrounding annulus in local-contrast
// space. Produces a per-cell mask independently from A.

import type { DotMask } from '../../domain/cell'
import type { GrayImage } from './preprocess'
import { robustSigma } from './preprocess'
import type { Grid } from './types'

export interface ReaderBOutput {
  masks: DotMask[]
  quality: number
}

export function readerBRead(
  g: GrayImage,
  lc: Float32Array,
  grid: Grid,
  polarity: 'dark' | 'light' = 'dark',
): ReaderBOutput {
  const { w, h } = g
  const sigma = robustSigma(lc)
  const threshold = Math.max(2.5, sigma * 0.4)
  const r = grid.g * 0.36
  const annulusOuter = grid.g * 0.75
  // Enforce the dot polarity: for dark (indented) dots the disc must be darker
  // than the annulus; for light (raised) dots the reverse.
  const sign = polarity === 'dark' ? 1 : -1

  const masks: DotMask[] = []
  let qualitySum = 0
  let n = 0

  for (const cell of grid.cells) {
    let mask = 0
    let cellQuality = 0
    const strengths = new Float32Array(6)
    for (let p = 0; p < 6; p++) {
      // Sample at the exact rotated dot positions computed by the grid, so
      // tilted photos still align disc/annulus with the true dot centres.
      const pos = cell.dotPos[p]
      const cx = pos.x
      const cy = pos.y
      const disc = discMean(lc, w, h, cx, cy, r)
      const annulus = annulusMean(lc, w, h, cx, cy, r, annulusOuter)
      strengths[p] = sign * (annulus - disc)
    }
    const cellMax = Math.max(...strengths)
    const relFloor = cellMax * 0.4
    for (let p = 0; p < 6; p++) {
      const s = strengths[p]
      if (s > threshold && s >= relFloor) {
        mask |= 1 << p
        cellQuality += Math.min(1, s / (threshold * 2.2))
      }
    }
    masks.push(mask)
    qualitySum += cellQuality
    n++
  }

  const quality = n > 0 ? qualitySum / n : 0
  return { masks, quality }
}

function discMean(lc: Float32Array, w: number, h: number, cx: number, cy: number, r: number): number {
  let sum = 0
  let count = 0
  const x0 = Math.max(0, Math.floor(cx - r))
  const x1 = Math.min(w - 1, Math.ceil(cx + r))
  const y0 = Math.max(0, Math.floor(cy - r))
  const y1 = Math.min(h - 1, Math.ceil(cy + r))
  const r2 = r * r
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy <= r2) {
        sum += lc[y * w + x]
        count++
      }
    }
  }
  return count > 0 ? sum / count : 0
}

function annulusMean(lc: Float32Array, w: number, h: number, cx: number, cy: number, inner: number, outer: number): number {
  let sum = 0
  let count = 0
  const x0 = Math.max(0, Math.floor(cx - outer))
  const x1 = Math.min(w - 1, Math.ceil(cx + outer))
  const y0 = Math.max(0, Math.floor(cy - outer))
  const y1 = Math.min(h - 1, Math.ceil(cy + outer))
  const inner2 = inner * inner
  const outer2 = outer * outer
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx
      const dy = y - cy
      const d2 = dx * dx + dy * dy
      if (d2 > inner2 && d2 <= outer2) {
        sum += lc[y * w + x]
        count++
      }
    }
  }
  return count > 0 ? sum / count : 0
}
