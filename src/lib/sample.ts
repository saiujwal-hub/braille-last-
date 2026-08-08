// Synthetic slate-and-stylus Braille image generator.
// Renders a known text string as a photo-like image so the demo never depends
// on WiFi or hardware, and so tests can assert end-to-end accuracy.

import { CONTROL, TABLES, type BrailleLang } from '../domain/tables'
import type { DotMask } from '../domain/cell'

export interface RenderedBraille {
  rgba: Uint8ClampedArray
  width: number
  height: number
  masks: DotMask[]
}

export function textToMasks(text: string, lang: BrailleLang): DotMask[] {
  const table = TABLES[lang]
  const masks: DotMask[] = []
  for (const ch of text) {
    if (ch === ' ') {
      masks.push(0)
      continue
    }
    if (ch >= 'a' && ch <= 'z') {
      const m = table.reverse[ch]
      if (m !== undefined) masks.push(m)
      continue
    }
    if (ch >= 'A' && ch <= 'Z') {
      const m = table.reverse[ch.toLowerCase()]
      if (m !== undefined) {
        masks.push(CONTROL.CAPITAL_SIGN)
        masks.push(m)
      }
      continue
    }
    if (ch >= '0' && ch <= '9') {
      const letter = 'abcdefghij'[ch.charCodeAt(0) - 48]
      const m = table.reverse[letter]
      if (m !== undefined) {
        masks.push(CONTROL.NUMBER_SIGN)
        masks.push(m)
      }
      continue
    }
    const m = table.reverse[ch]
    if (m !== undefined) masks.push(m)
  }
  return masks
}

/**
 * Render masks to an RGBA image of a slate page. Dots are rendered as
 * indented (shadowed) depressions — what slate-and-stylus actually looks like.
 */
export function renderBrailleMasks(
  masks: readonly DotMask[],
  opts: { g?: number; lineWidth?: number; seed?: number } = {},
): RenderedBraille {
  const g = opts.g ?? 16
  const maxCellsPerLine = opts.lineWidth ?? 40
  const seed = opts.seed ?? 42
  const rand = mulberry32(seed)

  const nLines = Math.max(1, Math.ceil(masks.length / maxCellsPerLine))
  const nPerLine = Math.min(masks.length, maxCellsPerLine)
  const margin = Math.round(3 * g)
  const width = Math.round(margin * 2 + (nPerLine - 1) * 2.44 * g + 2 * g)
  const height = Math.round(margin * 2 + (nLines - 1) * 4.08 * g + 2 * g)

  const rgba = new Uint8ClampedArray(width * height * 4)

  // Paper
  for (let i = 0; i < width * height; i++) {
    const noise = (rand() - 0.5) * 14
    const p = clamp(208 + noise, 0, 255)
    rgba[i * 4] = p
    rgba[i * 4 + 1] = p - 2
    rgba[i * 4 + 2] = p - 4
    rgba[i * 4 + 3] = 255
  }

  const dotR = g * 0.42
  const r2 = dotR * dotR

  const paintDot = (cx: number, cy: number, jitter: number) => {
    const x0 = Math.max(0, Math.floor(cx - dotR))
    const x1 = Math.min(width - 1, Math.ceil(cx + dotR))
    const y0 = Math.max(0, Math.floor(cy - dotR))
    const y1 = Math.min(height - 1, Math.ceil(cy + dotR))
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx
        const dy = y - cy
        const d2 = dx * dx + dy * dy
        if (d2 > r2) continue
        const d = Math.sqrt(d2) / dotR
        // Indented depression: darkest at center, shadow ring at the rim.
        const depth = Math.pow(1 - d, 0.85) * 95
        const ring = d > 0.72 && d < 0.98 ? 25 : 0
        const fade = 1 - jitter * 0.25
        const shade = (depth + ring) * fade
        const o = (y * width + x) * 4
        rgba[o] -= shade
        rgba[o + 1] -= shade * 0.92
        rgba[o + 2] -= shade * 0.86
      }
    }
  }

  for (let i = 0; i < masks.length; i++) {
    const mask = masks[i]
    const line = Math.floor(i / maxCellsPerLine)
    const col = i % maxCellsPerLine
    const cellX = margin + col * 2.44 * g
    const cellY = margin + line * 4.08 * g
    if (mask === 0) continue
    for (let p = 0; p < 6; p++) {
      if (!(mask & (1 << p))) continue
      const colPos = p >= 3 ? 1 : 0
      const rowPos = p % 3
      const cx = cellX + colPos * g
      const cy = cellY + rowPos * g
      paintDot(cx, cy, rand())
    }
  }

  return { rgba, width, height, masks: masks.slice() }
}

export function renderBrailleText(
  text: string,
  lang: BrailleLang,
  opts?: { g?: number; seed?: number; lineWidth?: number },
): RenderedBraille {
  // Convert each physical line separately and pad with spaces so that fixed
  // cell wrapping keeps lines aligned to their true breaks.
  const lines = text.split('\n').map((l) => textToMasks(l, lang))
  const width = Math.max(1, ...lines.map((l) => l.length))
  const flat: DotMask[] = []
  for (const line of lines) {
    flat.push(...line)
    for (let i = line.length; i < width; i++) flat.push(0)
  }
  const lineWidth = Math.max(width, opts?.lineWidth ?? width)
  return renderBrailleMasks(flat, { ...opts, lineWidth })
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

export { CONTROL }
