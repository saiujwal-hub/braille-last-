// Grayscale image helpers + preprocessing. Pure typed-array math (no DOM),
// safe to run inside a Web Worker.

export interface GrayImage {
  w: number
  h: number
  /** h*w bytes, row-major, 0..255 */
  data: Uint8ClampedArray
}

export interface ImageInfo {
  w: number
  h: number
}

export function toGray(rgba: Uint8ClampedArray, w: number, h: number): GrayImage {
  const data = new Uint8ClampedArray(w * h)
  for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
    data[p] = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000
  }
  return { w, h, data }
}

/** Simple 1D box blur along x then y (separable). */
export function boxBlur(g: GrayImage, radius: number): GrayImage {
  const { w, h, data } = g
  const out = new Uint8ClampedArray(w * h)
  const tmp = new Float32Array(w * h)
  const r = Math.max(1, Math.round(radius))
  const win = 2 * r + 1

  for (let y = 0; y < h; y++) {
    let acc = 0
    for (let x = -r; x <= r; x++) acc += data[y * w + clamp(x, 0, w - 1)]
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / win
      const add = data[y * w + clamp(x + r + 1, 0, w - 1)]
      const sub = data[y * w + clamp(x - r, 0, w - 1)]
      acc += add - sub
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0
    for (let y = -r; y <= r; y++) acc += tmp[clamp(y, 0, h - 1) * w + x]
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / win
      const add = tmp[clamp(y + r + 1, 0, h - 1) * w + x]
      const sub = tmp[clamp(y - r, 0, h - 1) * w + x]
      acc += add - sub
    }
  }
  return { w, h, data: out }
}

/**
 * Illumination flattening: divide the image by its smooth background so a
 * brightness gradient (shadow, uneven flash) becomes a constant factor that
 * the adaptive thresholds then ignore. Dot contrast is preserved because the
 * background blur is much larger than a dot.
 */
export function flattenIllumination(g: GrayImage, bgRadius: number): GrayImage {
  const { w, h, data } = g
  const bg = boxBlur(g, bgRadius)
  const out = new Uint8ClampedArray(w * h)
  for (let i = 0; i < out.length; i++) {
    const b = bg.data[i]
    const v = b > 8 ? (data[i] * 255) / b : data[i]
    out[i] = clamp(Math.round(v), 0, 255)
  }
  return { w, h, data: out }
}

/**
 * Local-contrast image: gray minus large-scale background. Indented slate dots
 * appear as strong negative values; embossed dots as strong positive values.
 * Polarity is preserved so both cases are handled.
 */
export function localContrast(g: GrayImage, backgroundRadius: number): Float32Array {
  const bg = boxBlur(g, backgroundRadius)
  const out = new Float32Array(g.w * g.h)
  for (let i = 0; i < out.length; i++) out[i] = g.data[i] - bg.data[i]
  return out
}

/** Robust standard deviation (MAD-based, scaled to sigma). */
export function robustSigma(vals: Float32Array): number {
  const n = vals.length
  const med = medianOf(vals)
  const abs = new Float32Array(n)
  for (let i = 0; i < n; i++) abs[i] = Math.abs(vals[i] - med)
  const mad = medianOf(abs)
  return mad * 1.4826
}

export function medianOf(vals: Float32Array): number {
  if (vals.length === 0) return 0
  const sorted = Float32Array.from(vals).sort()
  const mid = sorted.length >> 1
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Variance-of-Laplacian sharpness score (higher = sharper). */
export function sharpnessScore(g: GrayImage): number {
  const { w, h, data } = g
  let sum = 0
  let sumSq = 0
  let n = 0
  for (let y = 1; y < h - 1; y++) {
    const row = y * w
    for (let x = 1; x < w - 1; x++) {
      const i = row + x
      const lap =
        data[i] * 4 - data[i - 1] - data[i + 1] - data[i - w] - data[i + w]
      sum += lap
      sumSq += lap * lap
      n++
    }
  }
  const mean = sum / n
  const variance = sumSq / n - mean * mean
  return Math.sqrt(Math.max(0, variance))
}

export interface BinMap {
  w: number
  h: number
  /** 1 where foreground (dot-like) */
  data: Uint8Array
  polarity: 'dark' | 'light'
}

/**
 * Adaptive threshold on the local-contrast image. Returns a binary map for the
 * requested polarity. Threshold is derived from robust image sigma so it adapts
 * to contrast across lighting conditions.
 */
export function thresholdPolarity(lc: Float32Array, w: number, h: number, polarity: 'dark' | 'light'): BinMap {
  const sigma = robustSigma(lc)
  const t = Math.max(3, sigma * 0.5)
  const data = new Uint8Array(w * h)
  if (polarity === 'dark') {
    for (let i = 0; i < data.length; i++) data[i] = lc[i] < -t ? 1 : 0
  } else {
    for (let i = 0; i < data.length; i++) data[i] = lc[i] > t ? 1 : 0
  }
  return { w, h, data, polarity }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
