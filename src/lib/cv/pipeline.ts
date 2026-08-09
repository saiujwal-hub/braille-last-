// Full on-device pipeline: decode -> preprocess -> Reader A (geometric CV)
// -> Reader B (template) -> orientation auto-fix -> consensus (Reader C
// tie-break) -> translation. Runs inside a Web Worker.

import { toGray, sharpnessScore, boxBlur, localContrast, flattenIllumination } from './preprocess'
import { detectDots } from './readerA'
import { buildGrid } from './grid'
import { readerBRead } from './readerB'
import { runConsensus, autoOrient, type CellInput, type CellResult } from '../../domain/consensus'
import { CONTROL, translateMasks, type BrailleLang } from '../../domain/tables'
import { mirrorMask, repairUnknownEnglishWords } from '../../domain/lang'
import { type DotMask } from '../../domain/cell'

export type PipelineErrorCode = 'blurry' | 'not-braille' | 'decode' | 'timeout' | 'too-few-dots'

export interface ScanStats {
  dots: number
  cells: number
  readerA: number
  readerB: number
  tieBroken: number
  uncertain: number
}

export interface ScanOk {
  ok: true
  id: number
  text: string
  cells: CellResult[]
  overall: number
  language: BrailleLang
  flipped: boolean
  polarity: 'dark' | 'light'
  stats: ScanStats
  display: Uint8ClampedArray
  displayWidth: number
  displayHeight: number
}

export interface ScanFail {
  ok: false
  id: number
  error: PipelineErrorCode
  message: string
}

export type ScanOutcome = ScanOk | ScanFail

const MAX_DIM = 1400
const MAX_PROCESSING_PIXELS = 2_000_000
const DISPLAY_MAX_DIM = 900

export function runScan(id: number, rgba: Uint8ClampedArray, w: number, h: number, language: BrailleLang): ScanOutcome {
  try {
    // ---- Downscale to a bounded processing size ----------------------------
    // A close horizontal crop can be wider than MAX_DIM while containing far
    // fewer pixels than a normal phone photo. Resizing it changes the small
    // Braille dot geometry enough to corrupt line reconstruction, so bound by
    // total work as well as the longest edge.
    const source = w * h <= MAX_PROCESSING_PIXELS ? { data: rgba, width: w, height: h } : downscale(rgba, w, h, MAX_DIM)
    const { data, width, height } = source
    if (width < 60 || height < 60) {
      return fail(id, 'decode', 'This image is too small. Please use a higher-resolution photo.')
    }

    // ---- Grayscale + sharpness guard ---------------------------------------
    const grayRaw = toGray(data, width, height)
    const gray = flattenIllumination(grayRaw, Math.max(12, Math.min(width, height) * 0.08))
    const sharp = sharpnessScore(gray)
    const reblur = sharpnessScore(boxBlur(gray, 2))
    const blurRatio = sharp / Math.max(1e-6, reblur)
    // A close crop of embossed Braille has a deliberately smooth paper
    // background, so a ratio-only Laplacian gate mistakes it for a blurred
    // photo. Reject only images that are genuinely featureless on both
    // measures; the dot readers below still reject non-Braille images.
    if (sharp < 0.45 && blurRatio < 1.25) {
      return fail(id, 'blurry', 'This photo looks blurry. Hold the camera steady and try again.')
    }

    // ---- Local contrast + dot detection ------------------------------------
    // The illumination window must be wider than a dot.  Phone close-ups can
    // have 25-35px embossed dots, where the old 4.5% window split a single
    // dot into a bright rim and dark shadow.  A 12% window preserves the
    // complete relief signature while still removing page-level lighting.
    const bgRadius = Math.max(12, Math.min(width, height) * 0.12)
    const lc = localContrast(gray, bgRadius)
    const minDim = Math.min(width, height)
    const dotsOut = detectDots(gray, lc, minDim)
    if (dotsOut.dots.length < 1) {
      return fail(id, 'not-braille', "We couldn't find enough raised or indented dots. Make sure the Braille fills the frame.")
    }

    // ---- Grid construction --------------------------------------------------
    const grid = buildGrid(dotsOut.dots)
    if (!grid || grid.cells.length === 0) {
      return fail(id, 'not-braille', 'No Braille grid pattern was detected. Align the page and retake the photo.')
    }
    if (grid.totalDots > 0 && grid.unassigned / grid.totalDots > 0.6) {
      return fail(id, 'not-braille', "We couldn't fit a regular Braille grid to the dots. Make sure the page is flat and well-lit.")
    }

    // ---- Reader A masks ------------------------------------------------------
    const aMasks: DotMask[] = grid.cells.map((c) => {
      let m = 0
      for (let p = 0; p < 6; p++) if (c.dots[p].length > 0) m |= 1 << p
      return m
    })

    // ---- Reader B masks ------------------------------------------------------
    const bOut = readerBRead(gray, lc, grid, dotsOut.polarity)

    // ---- Orientation auto-fix (mirroring) -----------------------------------
    const orient = autoOrient(bOut.masks, language)
    const flip = orient.flipped
    const aFinal = flip ? aMasks.map(mirrorMask) : aMasks
    const bFinal = flip ? bOut.masks.map(mirrorMask) : bOut.masks
    const widthF = width

    const cellsIn: CellInput[] = grid.cells.map((c, i) => {
      const box = flip
        ? { x: widthF - c.box.x - c.box.w, y: c.box.y, w: c.box.w, h: c.box.h }
        : { ...c.box }
      return {
        row: c.line,
        col: c.colPair,
        box,
        readerA: aFinal[i],
        readerB: bFinal[i],
      }
    })

    // ---- Consensus engine (Readers A + B + C) -------------------------------
    const consensus = runConsensus(cellsIn, language, {
      aQuality: dotsOut.quality,
      bQuality: bOut.quality,
    })

    // ---- Translation ---------------------------------------------------------
    const text = buildText(consensus.results, language)
    const overall =
      consensus.results.length > 0
        ? consensus.results.reduce((s, r) => s + r.confidence, 0) / consensus.results.length
        : 0

    // ---- Display image (dots highlighted) ------------------------------------
    const display = buildDisplay(lc, width, height, dotsOut.polarity)
    const disp = downscaleRgbaFromGray(display, width, height, DISPLAY_MAX_DIM)

    const readerA = aFinal.reduce((s, m) => s + bitCount(m), 0)
    const readerB = bFinal.reduce((s, m) => s + bitCount(m), 0)

    return {
      ok: true,
      id,
      text,
      cells: consensus.results,
      overall,
      language,
      flipped: flip,
      polarity: dotsOut.polarity,
      stats: {
        dots: dotsOut.dots.length,
        cells: grid.cells.length,
        readerA,
        readerB,
        tieBroken: consensus.tieBroken,
        uncertain: consensus.uncertain,
      },
      display: disp.data,
      displayWidth: disp.width,
      displayHeight: disp.height,
    }
  } catch (e) {
    return fail(id, 'timeout', `Processing failed unexpectedly (${(e as Error).message}). Please try again.`)
  }
}

// ---------------------------------------------------------------------------

function fail(id: number, error: PipelineErrorCode, message: string): ScanFail {
  return { ok: false, id, error, message }
}

/** Assemble text line-by-line so Braille lines become newline-separated. */
function buildText(results: CellResult[], lang: BrailleLang): string {
  const lines: DotMask[][] = []
  let cur: DotMask[] = []
  let curRow = -1
  for (const r of results) {
    if (r.row !== curRow) {
      if (cur.length) lines.push(cur)
      cur = []
      curRow = r.row
    }
    cur.push(r.mask)
  }
  if (cur.length) lines.push(cur)
  return lines
    .map((masks) => {
      // A lattice is intentionally reconstructed one cell beyond sparse dot
      // evidence. At a cropped image edge that can create an empty cell which
      // is not a real word space. Keep genuine internal spaces, but discard
      // only these extrapolated edge cells before translating.
      let first = 0
      let last = masks.length
      const hadLeadingEmpty = masks[first] === 0
      while (first < last && masks[first] === 0) first++
      // A cropped fragment can leave one isolated dot-6 cell before the
      // actual word. It looks like a capital sign, but is not attached to the
      // word when an extrapolated empty cell precedes it. Ignore only that
      // edge artefact; a genuine capital sign at the beginning is preserved.
      if (hadLeadingEmpty && masks[first] === CONTROL.CAPITAL_SIGN) first++
      while (last > first && masks[last - 1] === 0) last--
      const translated = translateMasks(masks.slice(first, last), lang).text.replace(/[\s]+$/, '')
      return lang === 'en' ? repairUnknownEnglishWords(translated) : translated
    })
    .join('\n')
}

function bitCount(n: number): number {
  let c = 0
  while (n) {
    n &= n - 1
    c++
  }
  return c
}

/** Box-average downscale preserving RGBA. */
export function downscale(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  maxDim: number,
): { data: Uint8ClampedArray; width: number; height: number } {
  const scale = Math.min(1, maxDim / Math.max(w, h))
  if (scale >= 1) return { data: rgba, width: w, height: h }
  const nw = Math.max(1, Math.round(w * scale))
  const nh = Math.max(1, Math.round(h * scale))
  const out = new Uint8ClampedArray(nw * nh * 4)
  for (let y = 0; y < nh; y++) {
    const sy = (y * h) / nh
    const y0 = Math.floor(sy)
    const y1 = Math.min(h - 1, y0 + 1)
    const fy = sy - y0
    for (let x = 0; x < nw; x++) {
      const sx = (x * w) / nw
      const x0 = Math.floor(sx)
      const x1 = Math.min(w - 1, x0 + 1)
      const fx = sx - x0
      for (let c = 0; c < 4; c++) {
        const p00 = rgba[(y0 * w + x0) * 4 + c]
        const p10 = rgba[(y0 * w + x1) * 4 + c]
        const p01 = rgba[(y1 * w + x0) * 4 + c]
        const p11 = rgba[(y1 * w + x1) * 4 + c]
        const top = p00 + (p10 - p00) * fx
        const bottom = p01 + (p11 - p01) * fx
        out[(y * nw + x) * 4 + c] = top + (bottom - top) * fy
      }
    }
  }
  return { data: out, width: nw, height: nh }
}

/**
 * Render the local-contrast image into a high-visibility RGBA display where
 * dots stand out against mid-gray.
 */
function buildDisplay(lc: Float32Array, w: number, h: number, polarity: 'dark' | 'light'): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4)
  const sign = polarity === 'dark' ? -1 : 1
  for (let i = 0; i < lc.length; i++) {
    const v = 128 + sign * lc[i] * 2.5
    const p = Math.min(255, Math.max(0, Math.round(v)))
    out[i * 4] = p
    out[i * 4 + 1] = p
    out[i * 4 + 2] = p
    out[i * 4 + 3] = 255
  }
  return out
}

function downscaleRgbaFromGray(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  maxDim: number,
): { data: Uint8ClampedArray; width: number; height: number } {
  const scale = Math.min(1, maxDim / Math.max(w, h))
  if (scale >= 1) return { data: rgba, width: w, height: h }
  const nw = Math.max(1, Math.round(w * scale))
  const nh = Math.max(1, Math.round(h * scale))
  const out = new Uint8ClampedArray(nw * nh * 4)
  for (let y = 0; y < nh; y++) {
    const sy = Math.min(h - 1, Math.round((y * h) / nh))
    for (let x = 0; x < nw; x++) {
      const sx = Math.min(w - 1, Math.round((x * w) / nw))
      const p = rgba[(sy * w + sx) * 4]
      const o = (y * nw + x) * 4
      out[o] = p
      out[o + 1] = p
      out[o + 2] = p
      out[o + 3] = 255
    }
  }
  return { data: out, width: nw, height: nh }
}
