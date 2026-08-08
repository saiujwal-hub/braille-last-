import { type DotMask } from './cell'
import { TABLES, isKnownMask, type BrailleLang } from './tables'
import { mirrorMask, readingFor, tieBreak } from './lang'

export type CellStatus = 'high' | 'tie' | 'uncertain'

export interface CellBox {
  x: number
  y: number
  w: number
  h: number
}

export interface CellInput {
  row: number
  col: number
  box: CellBox
  /** mask voted by Reader A (geometric CV), null if reader abstained */
  readerA: DotMask | null
  /** mask voted by Reader B (template), null if reader abstained */
  readerB: DotMask | null
}

export interface Alternative {
  mask: DotMask
  char: string | null
  reader: string
}

export interface CellResult {
  row: number
  col: number
  box: CellBox
  mask: DotMask
  char: string | null
  status: CellStatus
  confidence: number
  invented: boolean
  readerA: DotMask | null
  readerB: DotMask | null
  alternatives: Alternative[]
}

export interface ConsensusOutcome {
  results: CellResult[]
  masks: DotMask[]
  tieBroken: number
  uncertain: number
  inverted: number
}

export interface ConsensusOptions {
  aQuality?: number
  bQuality?: number
}

/**
 * The consensus engine. Mirrors the original Gemini/Claude/GPT design but with
 * three independent ON-DEVICE readers:
 *   A (geometric CV) and B (template) read each cell; when they disagree,
 *   C (the English language model) breaks the tie. If still undecided, the
 *   cell is marked uncertain and shown side-by-side for teacher review.
 */
export function runConsensus(cells: CellInput[], lang: BrailleLang, opts: ConsensusOptions = {}): ConsensusOutcome {
  const aQuality = opts.aQuality ?? 0.8
  const bQuality = opts.bQuality ?? 0.8

  // --- Pass 1: per-cell agreement -------------------------------------------
  const decisions = new Array<DotMask>(cells.length)
  const statuses = new Array<CellStatus>(cells.length)
  const conflicts = new Set<number>()

  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]
    const a = c.readerA ?? c.readerB
    const b = c.readerB ?? c.readerA
    if (c.readerA !== null && c.readerB !== null && c.readerA !== c.readerB) {
      conflicts.add(i)
      decisions[i] = c.readerA // provisional; tie-break below
      statuses[i] = 'tie'
    } else {
      decisions[i] = a ?? 0
      statuses[i] = 'high'
    }
    if (a === null && b === null) statuses[i] = 'uncertain'
  }

  // --- Pass 2: Reader C tie-break (global English plausibility) -------------
  const readWith = (maskAt: number, mask: DotMask): number =>
    readingFor(decisions.map((m, idx) => (idx === maskAt ? mask : m)), lang).score

  let inverted = 0

  for (let pass = 0; pass < 2; pass++) {
    for (const i of conflicts) {
      const c = cells[i]
      const a = c.readerA as DotMask
      const b = c.readerB as DotMask
      const current = decisions[i]
      const scoreA = readWith(i, a)
      const scoreB = readWith(i, b)
      const useA = scoreA >= scoreB
      const chosen = useA ? a : b
      if (chosen !== current) {
        decisions[i] = chosen
        inverted++
      }
      // If language model can't clearly separate and both are known, stay
      // marked as a tie; the UI will show both interpretations.
    }
  }

  for (const i of conflicts) {
    const c = cells[i]
    const a = c.readerA as DotMask
    const b = c.readerB as DotMask
    const sa = readWith(i, a)
    const sb = readWith(i, b)
    const t = tieBreak({ text: '', cells: [], score: sa }, { text: '', cells: [], score: sb })
    if (t.confident) {
      statuses[i] = 'tie'
    } else {
      statuses[i] = 'uncertain'
    }
  }

  // --- Assemble results ------------------------------------------------------
  const results: CellResult[] = cells.map((c, i) => {
    const mask = decisions[i]
    const a = c.readerA
    const b = c.readerB
    const known = isKnownMask(mask, lang)
    const status = statuses[i]

    const confidence =
      status === 'high'
        ? clamp(0.82 + 0.18 * Math.sqrt(aQuality * bQuality), 0.82, 1)
        : status === 'tie'
          ? 0.55 + 0.18 * Math.sqrt(aQuality * bQuality)
          : 0.22 + 0.18 * Math.sqrt(aQuality * bQuality)

    const alternatives: Alternative[] = []
    if (status !== 'high' && a !== null && b !== null && a !== b) {
      if (a !== mask) alternatives.push({ mask: a, char: charFor(a, lang), reader: 'A' })
      if (b !== mask) alternatives.push({ mask: b, char: charFor(b, lang), reader: 'B' })
    }

    return {
      row: c.row,
      col: c.col,
      box: c.box,
      mask,
      char: charFor(mask, lang),
      status,
      confidence,
      invented: !known && mask !== 0,
      readerA: a,
      readerB: b,
      alternatives,
    }
  })

  const tieBrokenFinal = results.filter((r) => r.status === 'tie').length
  const uncertainFinal = results.filter((r) => r.status === 'uncertain').length
  return { results, masks: decisions, tieBroken: tieBrokenFinal, uncertain: uncertainFinal, inverted }
}

/** Orientation auto-fix using Reader C. Returns flipped masks if mirrored. */
export function autoOrient(masks: readonly DotMask[], lang: BrailleLang): { masks: DotMask[]; flipped: boolean } {
  if (masks.length < 3) {
    return { masks: masks.slice(), flipped: false }
  }
  const normal = readingFor(masks as DotMask[], lang)
  const flipped = readingFor(masks.map(mirrorMask), lang)
  if (flipped.score > normal.score + 1.5) {
    return { masks: masks.map(mirrorMask), flipped: true }
  }
  return { masks: masks.slice(), flipped: false }
}

function charFor(mask: DotMask, lang: BrailleLang): string | null {
  if (mask === 0) return ' '
  return TABLES[lang].forward[mask] ?? null
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}
