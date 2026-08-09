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
})
