import { describe, expect, it } from 'vitest'
import { runConsensus, type CellInput } from './consensus'
import { maskFromDots } from './cell'

const BOX = { x: 0, y: 0, w: 10, h: 10 }

function cell(a: number | null, b: number | null, row = 0, col = 0): CellInput {
  return { row, col, box: BOX, readerA: a, readerB: b }
}

describe('consensus engine', () => {
  it('marks high confidence when readers agree', () => {
    const m = maskFromDots([1, 2, 3]) // l
    const out = runConsensus([cell(m, m)], 'en', { aQuality: 0.9, bQuality: 0.9 })
    expect(out.results[0].status).toBe('high')
    expect(out.results[0].mask).toBe(m)
    expect(out.results[0].confidence).toBeGreaterThan(0.8)
  })

  it('marks uncertain when both readers abstain', () => {
    const out = runConsensus([cell(null, null)], 'en')
    expect(out.results[0].status).toBe('uncertain')
    expect(out.uncertain).toBe(1)
  })

  it('uses Reader C to break ties by language plausibility', () => {
    // Word context "thA" vs "thE" — dictionary should prefer e (dots 1,5)
    // cell 0: t, cell 1: h, cell 2: conflict a(1) vs e(17), cell 3: space
    const t = maskFromDots([2, 3, 4, 5])
    const h = maskFromDots([1, 2, 5])
    const a = maskFromDots([1])
    const e = maskFromDots([1, 5])
    const out = runConsensus(
      [cell(t, t), cell(h, h), cell(a, e), cell(0, 0)],
      'en',
      { aQuality: 0.8, bQuality: 0.8 },
    )
    expect(out.results[2].mask).toBe(e)
    expect(out.results[2].char).toBe('e')
  })

  it('breaks the tie when the language model prefers a valid letter', () => {
    const a = maskFromDots([1]) // 'a' (a real word)
    const b = maskFromDots([1, 6]) // invalid grade-1 pattern
    const out = runConsensus([cell(a, b)], 'en')
    const r = out.results[0]
    expect(r.status).toBe('tie')
    expect(r.mask).toBe(a)
    expect(r.alternatives.length).toBeGreaterThan(0)
  })

  it('marks uncertain when the tie-breaker cannot separate the readings', () => {
    const x = maskFromDots([1, 3, 4, 6]) // 'x'
    const z = maskFromDots([1, 3, 5, 6]) // 'z'
    const out = runConsensus([cell(x, z)], 'en')
    expect(out.results[0].status).toBe('uncertain')
    expect(out.results[0].alternatives.length).toBeGreaterThan(0)
  })
})
