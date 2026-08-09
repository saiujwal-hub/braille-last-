import { describe, expect, it } from 'vitest'
import { CONTROL, ENGLISH_TABLE, TABLES, translateMasks, isKnownMask } from './tables'
import { buildText } from '../lib/cv/pipeline'
import { repairUnknownEnglishWords } from './lang'
import { maskFromDots, dotsFromMask } from './cell'

describe('braille cell math', () => {
  it('maskFromDots/dotsFromMask round-trip', () => {
    expect(maskFromDots([1, 4])).toBe(9)
    expect(dotsFromMask(9)).toEqual([1, 4])
    expect(maskFromDots([2, 4, 5, 6])).toBe(58) // w
  })
})

describe('Grade 1 English table', () => {
  it('maps all 26 letters', () => {
    const letters = 'abcdefghijklmnopqrstuvwxyz'
    for (const ch of letters) {
      expect(ENGLISH_TABLE.reverse[ch]).toBeDefined()
      expect(ENGLISH_TABLE.forward[ENGLISH_TABLE.reverse[ch]]).toBe(ch)
    }
  })

  it('known mask detection flags invented shortcuts', () => {
    // maskFor '?' not defined -> dot 2 alone isn't a letter (it's a comma)
    expect(isKnownMask(maskFromDots([2]), 'en')).toBe(true) // comma
    expect(isKnownMask(maskFromDots([1, 6]), 'en')).toBe(false) // not standard grade 1
  })
})

describe('translation', () => {
  it('translates a simple word', () => {
    const word = 'cat'
    const masks = word.split('').map((c) => ENGLISH_TABLE.reverse[c])
    expect(translateMasks(masks, 'en').text).toBe('cat')
  })

  it('handles spaces', () => {
    const masks = 'the cat'.split('').map((c) => (c === ' ' ? 0 : ENGLISH_TABLE.reverse[c]))
    expect(translateMasks(masks, 'en').text).toBe('the cat')
  })

  it('handles numbers with the number sign', () => {
    const masks = [CONTROL.NUMBER_SIGN, ENGLISH_TABLE.reverse['a'], ENGLISH_TABLE.reverse['j']]
    expect(translateMasks(masks, 'en').text).toBe('10')
  })

  it('handles capital signs for multi-word phrases like List View', () => {
    const masks = [
      CONTROL.CAPITAL_SIGN, ENGLISH_TABLE.reverse['l'], ENGLISH_TABLE.reverse['i'], ENGLISH_TABLE.reverse['s'], ENGLISH_TABLE.reverse['t'],
      0,
      CONTROL.CAPITAL_SIGN, ENGLISH_TABLE.reverse['v'], ENGLISH_TABLE.reverse['i'], ENGLISH_TABLE.reverse['e'], ENGLISH_TABLE.reverse['w'],
    ]
    expect(translateMasks(masks, 'en').text).toBe('List View')
  })

  it('Bharati Hindi round-trips a known letter', () => {
    const t = TABLES['hi']
    expect(t.reverse['क']).toBeDefined()
    expect(t.forward[t.reverse['क']]).toBe('क')
  })
})

describe('buildText edge cleaning', () => {
  it('correctly cleans edge noise cell while preserving capital signs in List View', () => {
    const masks = [
      0, // leading empty cell from grid lattice
      CONTROL.CAPITAL_SIGN, ENGLISH_TABLE.reverse['l'], ENGLISH_TABLE.reverse['i'], ENGLISH_TABLE.reverse['s'], ENGLISH_TABLE.reverse['t'],
      0,
      CONTROL.CAPITAL_SIGN, ENGLISH_TABLE.reverse['v'], ENGLISH_TABLE.reverse['i'], ENGLISH_TABLE.reverse['e'], ENGLISH_TABLE.reverse['w'],
      0,
      ENGLISH_TABLE.reverse['g'], // trailing edge noise artifact cell
    ]
    const results = masks.map((mask, col) => ({
      row: 0,
      col,
      box: { x: 0, y: 0, w: 10, h: 10 },
      mask,
      status: 'high' as const,
      confidence: 1,
      readerA: mask,
      readerB: mask,
      char: '?',
      alternatives: [],
      invented: false,
    }))
    expect(buildText(results, 'en')).toBe('List View')
  })

  it('repairs OCR misreads like Ope e pinned programs to Open and pinned programs', () => {
    expect(repairUnknownEnglishWords('Ope e pinned programs')).toBe('Open and pinned programs')
  })
})
