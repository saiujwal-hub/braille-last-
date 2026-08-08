// Reader A — the geometric CV reader. Detects dots via local contrast +
// connected components, picks the best polarity (handles indented AND embossed),
// then filters blobs by radius relative to the estimated dot pitch.

import type { GrayImage } from './preprocess'
import { robustSigma, thresholdPolarity } from './preprocess'
import { connectedComponents, blobFromComponent, type Blob } from './blobs'
import { estimatePitch } from './grid'
import type { Dot } from './types'

export interface ReaderAOutput {
  dots: Dot[]
  polarity: 'dark' | 'light'
  /** average dot quality, 0..1 */
  quality: number
}

export function detectDots(g: GrayImage, lc: Float32Array, minDim: number): ReaderAOutput {
  let bestPolarity: 'dark' | 'light' = 'dark'
  let bestBlobs: Blob[] = []
  let bestScore = -1
  let bestT = 4

  for (const polarity of ['dark', 'light'] as const) {
    const bin = thresholdPolarity(lc, g.w, g.h, polarity)
    const sigma = robustSigma(lc)
    const t = Math.max(4, sigma * 0.8)
    const areaMax = minDim * minDim * 0.03
    const comps = connectedComponents(bin, 5, areaMax)
    const blobs: Blob[] = []
    for (const c of comps) {
      const blob = blobFromComponent(c, g.w, g.h, lc)
      // Dots have strong local contrast relative to the noise floor; paper
      // grain and threshold noise are weak and get filtered out here.
      if (blob.area < 6 || blob.circularity < 0.4 || blob.strength < 2.5 * t) continue
      blobs.push(blob)
    }
    // Judge each polarity by how many of its blobs look like real dots (dot
    // radius is a fixed fraction of the pitch). A noisy polarity can win the
    // raw blob count with a cloud of tiny specks, so the pitch-consistency
    // check must run BEFORE the polarity is chosen.
    const pitch =
      blobs.length >= 3 ? estimatePitch(blobs.map((b) => ({ x: b.cx, y: b.cy, radius: b.radius, quality: 0 } as Dot))) : 0
    const plausible = pitch > 0 ? blobs.filter((b) => b.radius >= 0.14 * pitch && b.radius <= 0.8 * pitch) : blobs
    const score = plausible.reduce((s, b) => s + b.strength * (b.radius * b.radius), 0)
    if (score > bestScore) {
      bestScore = score
      bestBlobs = blobs
      bestPolarity = polarity
      bestT = t
    }
  }

  let blobs = bestBlobs
  // If there are large prominent blobs (r >= 6), filter out tiny specks (r < 0.4 * maxR)
  const maxR = blobs.reduce((m, b) => Math.max(m, b.radius), 0)
  if (maxR >= 6) {
    blobs = blobs.filter((b) => b.radius >= 0.4 * maxR)
  }

  const dots0: Dot[] = blobs.map((b) => ({
    x: b.cx,
    y: b.cy,
    radius: b.radius,
    quality: dotQuality(b, bestT),
  }))

  if (dots0.length < 1) {
    return { dots: [], polarity: bestPolarity, quality: 0 }
  }

  // Estimate dot pitch from nearest-neighbour distances or dot radius
  const pitch = estimatePitch(dots0)
  const dots = pitch > 0 ? dots0.filter((d) => d.radius >= 0.08 * pitch && d.radius <= 0.8 * pitch) : dots0
  const quality = dots.length ? dots.reduce((s, d) => s + d.quality, 0) / dots.length : 0
  return { dots, polarity: bestPolarity, quality }
}

function dotQuality(blob: Blob, t: number): number {
  const circ = Math.min(1, Math.max(0, (blob.circularity - 0.4) / 0.6))
  const strength = t > 0 ? Math.min(1, blob.strength / (t * 8)) : 0.5
  return 0.55 * circ + 0.45 * strength
}
