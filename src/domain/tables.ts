import { maskFromDots, type DotMask, EMPTY_MASK } from './cell'

export type BrailleLang = 'en' | 'hi'

export interface BrailleTable {
  id: BrailleLang
  label: string
  /** mask -> character (lowercase base letter or punctuation) */
  forward: Readonly<Record<DotMask, string>>
  /** character -> mask (for sample generation) */
  reverse: Readonly<Record<string, DotMask>>
}

// ---------------------------------------------------------------------------
// Grade 1 English braille (complete standard mapping)
// ---------------------------------------------------------------------------

const enEntries: Array<[number[], string]> = [
  [[1], 'a'],
  [[1, 2], 'b'],
  [[1, 4], 'c'],
  [[1, 4, 5], 'd'],
  [[1, 5], 'e'],
  [[1, 2, 4], 'f'],
  [[1, 2, 4, 5], 'g'],
  [[1, 2, 5], 'h'],
  [[2, 4], 'i'],
  [[2, 4, 5], 'j'],
  [[1, 3], 'k'],
  [[1, 2, 3], 'l'],
  [[1, 3, 4], 'm'],
  [[1, 3, 4, 5], 'n'],
  [[1, 3, 5], 'o'],
  [[1, 2, 3, 4], 'p'],
  [[1, 2, 3, 4, 5], 'q'],
  [[1, 2, 3, 5], 'r'],
  [[2, 3, 4], 's'],
  [[2, 3, 4, 5], 't'],
  [[1, 3, 6], 'u'],
  [[1, 2, 3, 6], 'v'],
  [[2, 4, 5, 6], 'w'],
  [[1, 3, 4, 6], 'x'],
  [[1, 3, 4, 5, 6], 'y'],
  [[1, 3, 5, 6], 'z'],
  [[2], ','],
  [[2, 3], ';'],
  [[2, 5], ':'],
  [[2, 5, 6], '.'],
  [[2, 3, 5], '!'],
  [[2, 3, 6], '?'],
  [[2, 3, 6], '"'],
  [[3], "'"],
  [[3, 6], '-'],
  [[1, 2, 3, 5, 6], '('],
  [[2, 3, 5, 6], ')'],
  [[3, 4, 5, 6], '#'],
  [[6], '^'], // capital sign (treated as a marker, mapped to ^ in raw mode)
]

function buildTable(id: BrailleLang, label: string, entries: Array<[number[], string]>): BrailleTable {
  const forward: Record<DotMask, string> = {}
  const reverse: Record<string, DotMask> = {}
  for (const [dots, ch] of entries) {
    const m = maskFromDots(dots)
    // Later entries win for reverse (e.g. quote doubles for open/close)
    if (!(ch in reverse)) reverse[ch] = m
    if (!(m in forward)) forward[m] = ch
  }
  return { id, label, forward, reverse }
}

export const ENGLISH_TABLE: BrailleTable = buildTable('en', 'English (Grade 1)', enEntries)

// ---------------------------------------------------------------------------
// Bharati braille (Indian regional scripts) — experimental first pass.
// Community-sourced table; provided as a starting point to be validated.
// ---------------------------------------------------------------------------

const bharatiEntries: Array<[number[], string]> = [
  [[1], 'अ'],
  [[1, 3, 4, 5, 6], 'आ'],
  [[2, 4], 'इ'],
  [[2, 4, 6], 'ई'],
  [[1, 3, 6], 'उ'],
  [[1, 3, 4, 6], 'ऊ'],
  [[1, 5], 'ए'],
  [[1, 5, 6], 'ऐ'],
  [[1, 3, 5], 'ओ'],
  [[1, 3, 5, 6], 'औ'],
  [[1, 3], 'क'],
  [[1, 2, 3], 'ख'],
  [[1, 2, 4, 5, 6], 'ग'],
  [[1, 4], 'च'],
  [[1, 4, 6], 'छ'],
  [[2, 4, 5], 'ज'],
  [[2, 4, 5, 6], 'झ'],
  [[2, 3, 4, 5, 6], 'ट'],
  [[1, 2, 3, 4, 5, 6], 'ड'],
  [[1, 3, 4, 5], 'ण'],
  [[2, 3, 4, 5], 'त'],
  [[1, 4, 5], 'द'],
  [[1, 4, 5, 6], 'ध'],
  [[1, 3, 4, 5], 'न'],
  [[1, 2, 3, 4], 'प'],
  [[1, 2, 3, 4, 6], 'फ'],
  [[1, 2], 'ब'],
  [[1, 2, 6], 'भ'],
  [[1, 3, 4], 'म'],
  [[1, 3, 4, 5, 6], 'य'],
  [[1, 2, 3, 5], 'र'],
  [[1, 2, 3], 'ल'],
  [[1, 2, 3, 6], 'व'],
  [[1, 4, 6], 'श'],
  [[2, 3, 4, 6], 'ष'],
  [[2, 3, 4], 'स'],
  [[1, 2, 5], 'ह'],
]

export const BHARATI_TABLE: BrailleTable = buildTable('hi', 'Bharati (Hindi, experimental)', bharatiEntries)

export const TABLES: Record<BrailleLang, BrailleTable> = {
  en: ENGLISH_TABLE,
  hi: BHARATI_TABLE,
}

/** Special masks that control translation state. */
export const CONTROL = {
  NUMBER_SIGN: maskFromDots([3, 4, 5, 6]),
  CAPITAL_SIGN: maskFromDots([6]),
} as const

/**
 * Translate a sequence of masks into text, applying number mode and capital
 * sign state. Returns the final text plus the per-cell display character.
 */
export function translateMasks(masks: readonly DotMask[], lang: BrailleLang): { text: string; cells: string[] } {
  const table = TABLES[lang]
  let numberMode = false
  const cells: string[] = []
  let text = ''

  for (let i = 0; i < masks.length; i++) {
    const m = masks[i]
    if (m === EMPTY_MASK) {
      text += ' '
      cells.push(' ')
      numberMode = false
      continue
    }
    if (m === CONTROL.NUMBER_SIGN) {
      numberMode = true
      cells.push('#')
      continue
    }
    if (m === CONTROL.CAPITAL_SIGN) {
      const next = masks[i + 1]
      const nch = next !== undefined ? table.forward[next] : undefined
      if (nch) {
        cells.push('^')
        text += nch.toUpperCase()
        cells.push(nch)
        i++
      } else {
        cells.push('^')
      }
      continue
    }
    const raw = table.forward[m]
    if (raw === undefined) {
      cells.push('?')
      text += '?'
      numberMode = false
      continue
    }
    if (numberMode) {
      const digit = digitFor(raw)
      const out = digit !== null ? digit : raw
      cells.push(out)
      text += out
    } else {
      cells.push(raw)
      text += raw
    }
  }
  return { text, cells }
}

function digitFor(raw: string): string | null {
  const map: Record<string, string> = {
    a: '1', b: '2', c: '3', d: '4', e: '5',
    f: '6', g: '7', h: '8', i: '9', j: '0',
  }
  return map[raw] ?? null
}

/** True when the mask exists in the requested language table (not "invented"). */
export function isKnownMask(mask: DotMask, lang: BrailleLang): boolean {
  if (mask === EMPTY_MASK) return true
  if (mask === CONTROL.NUMBER_SIGN || mask === CONTROL.CAPITAL_SIGN) return true
  return TABLES[lang].forward[mask] !== undefined
}
