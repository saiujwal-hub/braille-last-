import { describe, expect, it } from 'vitest'
import { repairUnknownEnglishWords, readingFor } from './lang'

describe('offline sentence repair', () => {
  it('repairs a uniquely matched damaged word while retaining capitalization', () => {
    expect(repairUnknownEnglishWords('common Icons of the A;kbar')).toBe('common Icons of the Taskbar')
  })

  it('keeps normal sentence punctuation unchanged', () => {
    expect(repairUnknownEnglishWords('hello, world')).toBe('hello, world')
  })

  it('repairs leading quote to capital letter and trims trailing isolated a/i', () => {
    expect(repairUnknownEnglishWords("'type here to search a")).toBe('Type here to search')
  })

  it('merges spurious space inside a known word (are a -> area)', () => {
    expect(repairUnknownEnglishWords('Notification are a')).toBe('Notification area')
  })

  it('does not collapse are and a when not at word boundary forming a known word', () => {
    expect(repairUnknownEnglishWords('they are a team')).toBe('they are a team')
  })

  it('repairs damaged assistive UI terms like Dialog and Webpage', () => {
    expect(repairUnknownEnglishWords('Find and Replace Di?log Box')).toBe('Find and Replace Dialog Box')
    expect(repairUnknownEnglishWords('Webpa?e Ope?ed in Chrome')).toBe('Webpage Opened in Chrome')
    expect(repairUnknownEnglishWords('Jeafage Opened in Chrome')).toBe('Webpage Opened in Chrome')
  })

  it('repairs Windows taskbar terms: search, cortana, button', () => {
    // Per-token path: '??ertana' = real OCR output when braille cells for 'Co'
    // are unrecognised (capital-sign + c both become unknown-cell glyphs).
    // Distance from '?ertana' (after slicing one ?) to 'cortana' is 1; unique match.
    expect(repairUnknownEnglishWords('start button, seaoch and talk to ??ertana button'))
      .toBe('start button, search and talk to Cortana button')
  })

  it('repairs words with internal punctuation errors and dictionary UI words', () => {
    expect(repairUnknownEnglishWords('after in?,rtibd')).toBe('after inserting')
  })

  it('repairs navigation and keyboard words', () => {
    expect(repairUnknownEnglishWords('after u?ing le?t arr?w')).toBe('after using left arrow')
  })

  it('readingFor automatically recovers from a 1-row vertical grid shift', () => {
    // Correct dots for "after using backspace"
    const correctDots = [
      [1], // a
      [1, 2, 4], // f
      [2, 3, 4, 5], // t
      [1, 5], // e
      [1, 2, 3, 5], // r
      [], // space
      [1, 3, 6], // u
      [2, 3, 4], // s
      [2, 4], // i
      [1, 3, 4, 5], // n
      [1, 2, 4, 5], // g
      [], // space
      [1, 2], // b
      [1], // a
      [1, 4], // c
      [1, 3], // k
      [2, 3, 4], // s
      [1, 2, 3, 4], // p
      [1], // a
      [1, 4], // c
      [1, 5] // e
    ]
    const correctMasks = correctDots.map(dots => {
      let m = 0
      for (const d of dots) m |= 1 << (d - 1)
      return m
    })

    // Simulate 1-row downward shift:
    // dot 1 -> 2, dot 2 -> 3, dot 4 -> 5, dot 5 -> 6, dot 3 & 6 lost
    const shiftedDownMasks = correctMasks.map(m => {
      let shifted = 0
      if (m & (1 << 0)) shifted |= 1 << 1
      if (m & (1 << 1)) shifted |= 1 << 2
      if (m & (1 << 3)) shifted |= 1 << 4
      if (m & (1 << 4)) shifted |= 1 << 5
      return shifted
    })

    const result = readingFor(shiftedDownMasks, 'en')
    expect(result.text.toLowerCase()).toBe('after using backspace')
  })

  it('repairs delete UI terms', () => {
    expect(repairUnknownEnglishWords('after using delec')).toBe('after using delete')
  })

  it('preserves and repairs Dollar currency terms', () => {
    expect(repairUnknownEnglishWords('Dollar')).toBe('Dollar')
    expect(repairUnknownEnglishWords('Dolla?')).toBe('Dollar')
  })

  it('preserves and repairs Rupee currency terms', () => {
    expect(repairUnknownEnglishWords('Rupee')).toBe('Rupee')
    expect(repairUnknownEnglishWords('Rupe?')).toBe('Rupee')
  })

  it('preserves and repairs Euro currency terms', () => {
    expect(repairUnknownEnglishWords('Euro')).toBe('Euro')
    expect(repairUnknownEnglishWords('Eur?')).toBe('Euro')
  })

  it('preserves and repairs Caret symbol terms', () => {
    expect(repairUnknownEnglishWords('Caret symbol')).toBe('Caret symbol')
    expect(repairUnknownEnglishWords('Care? symbol')).toBe('Caret symbol')
  })

  it('preserves and repairs Backslash terms', () => {
    expect(repairUnknownEnglishWords('Backslash')).toBe('Backslash')
    expect(repairUnknownEnglishWords('Backslas?')).toBe('Backslash')
    expect(repairUnknownEnglishWords('Backsla??')).toBe('Backslash')
  })

  it('splits invalid apostrophe-merged words', () => {
    expect(repairUnknownEnglishWords("again'enter")).toBe('again enter')
    expect(repairUnknownEnglishWords("don't they're")).toBe("don't they're")
  })

  it('scores digits favorably and recovers numeric shift', () => {
    // Correct masks for "#1"
    const correct = [60, 1]
    // Shifted down:
    const shiftedDown = correct.map(m => {
      let shifted = 0
      if (m & (1 << 0)) shifted |= 1 << 1
      if (m & (1 << 1)) shifted |= 1 << 2
      if (m & (1 << 3)) shifted |= 1 << 4
      if (m & (1 << 4)) shifted |= 1 << 5
      return shifted
    })
    const result = readingFor(shiftedDown, 'en')
    // Should prefer the shifted-up version (translates to ":1") over the shifted-down "?,"
    expect(result.text).toContain('1')
  })

  it('repairs grave accent UI terms', () => {
    expect(repairUnknownEnglishWords('Grave accen')).toBe('Grave accent')
  })

  it('repairs vertical bar UI terms', () => {
    expect(repairUnknownEnglishWords('verticla bar')).toBe('vertical bar')
  })

  it('repairs special symbols UI terms', () => {
    expect(repairUnknownEnglishWords('specail symbol')).toBe('special symbol')
  })

  it('repairs double quote UI terms', () => {
    expect(repairUnknownEnglishWords('doubl quote')).toBe('double quote')
    expect(repairUnknownEnglishWords('Double quot')).toBe('Double quote')
  })
})
