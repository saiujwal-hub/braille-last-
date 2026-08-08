// Connected-component (blob) detection on binary maps, with dot classification.

import type { BinMap } from './preprocess'

export interface Blob {
  cx: number
  cy: number
  area: number
  radius: number
  circularity: number
  /** mean normalized local-contrast strength (0..1) */
  strength: number
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

export interface Component {
  id: number
  pixels: number[]
}

/**
 * Flood-fill connected components (4-connectivity). Returns components that
 * fall within [minArea, maxArea]. Uses an iterative stack to avoid recursion.
 */
export function connectedComponents(bin: BinMap, minArea: number, maxArea: number): Component[] {
  const { w, h, data } = bin
  const visited = new Uint8Array(w * h)
  const comps: Component[] = []
  let stack = new Int32Array(4096)
  const pixels: number[] = []

  for (let start = 0; start < data.length; start++) {
    if (data[start] !== 1 || visited[start]) continue
    let sp = 0
    stack[sp++] = start
    visited[start] = 1
    pixels.length = 0
    while (sp > 0) {
      const p = stack[--sp]
      pixels.push(p)
      const x = p % w
      const y = (p / w) | 0
      if (x > 0 && !visited[p - 1] && data[p - 1] === 1) { visited[p - 1] = 1; stack[sp++] = p - 1 }
      if (x < w - 1 && !visited[p + 1] && data[p + 1] === 1) { visited[p + 1] = 1; stack[sp++] = p + 1 }
      if (y > 0 && !visited[p - w] && data[p - w] === 1) { visited[p - w] = 1; stack[sp++] = p - w }
      if (y < h - 1 && !visited[p + w] && data[p + w] === 1) { visited[p + w] = 1; stack[sp++] = p + w }
      if (sp + 4 >= stack.length) {
        const bigger = new Int32Array(stack.length * 2)
        bigger.set(stack.subarray(0, sp))
        stack = bigger
      }
    }
    const area = pixels.length
    if (area >= minArea && area <= maxArea) {
      comps.push({ id: comps.length, pixels: pixels.slice() })
    }
  }
  return comps
}

export function blobFromComponent(c: Component, w: number, h: number, lc: Float32Array | null): Blob {
  let sumX = 0
  let sumY = 0
  let strength = 0
  let x0 = w
  let y0 = h
  let x1 = 0
  let y1 = 0
  for (let k = 0; k < c.pixels.length; k++) {
    const p = c.pixels[k]
    const x = p % w
    const y = (p / w) | 0
    sumX += x
    sumY += y
    if (lc) strength += Math.abs(lc[p])
    if (x < x0) x0 = x
    if (y < y0) y0 = y
    if (x > x1) x1 = x
    if (y > y1) y1 = y
  }
  const area = c.pixels.length
  const cx = sumX / area
  const cy = sumY / area
  const bw = x1 - x0 + 1
  const bh = y1 - y0 + 1
  const radius = Math.sqrt(area / Math.PI)
  const perimeter = 2 * (bw + bh)
  const circularity = perimeter > 0 ? (4 * Math.PI * area) / (perimeter * perimeter) : 0
  return {
    cx,
    cy,
    area,
    radius,
    circularity,
    strength: lc ? strength / area : 1,
    bbox: { x0, y0, x1, y1 },
  }
}

/**
 * Classify blobs as plausible Braille dots. Dots are compact (round) and their
 * radius is within a range relative to image scale.
 */
export function isDotLike(blob: Blob, minDim: number, allowedRatio = 2.6): boolean {
  if (blob.area < 4) return false
  if (blob.circularity < 0.42) return false
  const expected = minDim * 0.012
  const r = blob.radius
  if (r < expected / allowedRatio || r > expected * allowedRatio) return false
  return true
}
