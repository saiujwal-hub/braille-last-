import { describe, expect, it } from 'vitest'
import { repairUnknownEnglishWords } from './lang'

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
})
