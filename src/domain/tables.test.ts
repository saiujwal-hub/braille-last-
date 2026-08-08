import { describe, expect, it } from 'vitest'
import { CONTROL, ENGLISH_TABLE, TABLES, translateMasks, isKnownMask } from './tables'
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

  it('handles capital signs', () => {
    const masks = [CONTROL.CAPITAL_SIGN, ENGLISH_TABLE.reverse['c'], ENGLISH_TABLE.reverse['a']]
    expect(translateMasks(masks, 'en').text).toBe('Ca')
  })

  it('Bharati Hindi round-trips a known letter', () => {
    const t = TABLES['hi']
    expect(t.reverse['क']).toBeDefined()
    expect(t.forward[t.reverse['क']]).toBe('क')
  })
})
