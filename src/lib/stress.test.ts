import { describe, expect, it } from 'vitest'
import { renderBrailleText } from './sample'
import { runScan } from './cv/pipeline'

const SAMPLES: string[] = [
  'a quick brown fox jumps over the lazy dog',
  'the five boxing wizards jump quickly',
  'pack my box with five dozen liquor jugs',
  'abc def ghi jkl mno pqr stu vwx yz',
  'how vexingly quick daft zebras jump',
  'bright vixens jump; dozy fowl quack',
  'my girl wove six dozen plaid jackets before she quit',
  'cat',
  'the cat sat',
  'a brave cat',
]

describe('alphabet stress tests (every letter round-trips)', () => {
  it.each(SAMPLES)('round-trips "%s"', (s) => {
    const { rgba, width, height } = renderBrailleText(s, 'en', { g: 26, lineWidth: 40 })
    const out = runScan(1, rgba, width, height, 'en')
    if (!out.ok) throw new Error(`scan failed: ${out.error} — ${out.message}`)
    expect(out.text.trim()).toBe(s)
  })
})

