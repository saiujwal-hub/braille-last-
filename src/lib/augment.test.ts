import { describe, expect, it } from 'vitest'
import { renderBrailleText } from './sample'
import { augmentRgba, type AugmentOpts } from './augment'
import { runScan } from './cv/pipeline'

function scan(text: string, g: number, aug: AugmentOpts) {
  const { rgba, width, height } = renderBrailleText(text, 'en', { g, lineWidth: 40 })
  const a = augmentRgba(rgba, width, height, aug)
  return runScan(1, a.data, a.width, a.height, 'en')
}

const TEXTS = ['the cat sat', 'a quick brown fox', 'look and see']

describe('rotation robustness', () => {
  it.each([5, 8, 12, -6, 20, 30])('rotates by %d deg', (deg) => {
    for (const text of TEXTS) {
      const out = scan(text, 26, { rotateDeg: deg })
      if (!out.ok) throw new Error(`"${text}" @${deg}: ${out.error} — ${out.message}`)
      expect(out.text.trim()).toBe(text)
    }
  })
})

describe('shadow robustness', () => {
  it.each([0.2, 0.4, 0.6])('shadow %.1f', (shadow) => {
    for (const text of TEXTS) {
      const out = scan(text, 26, { shadow })
      if (!out.ok) throw new Error(`"${text}" shadow ${shadow}: ${out.error} — ${out.message}`)
      expect(out.text.trim()).toBe(text)
    }
  })
})

describe('blur + noise robustness', () => {
  it('blur 2 + noise 10', () => {
    for (const text of TEXTS) {
      const out = scan(text, 26, { blur: 2, noise: 10 })
      if (!out.ok) throw new Error(`"${text}": ${out.error} — ${out.message}`)
      expect(out.text.trim()).toBe(text)
    }
  })
})

describe('perspective robustness', () => {
  it.each([0.03, 0.04])('perspective %.2f', (perspective) => {
    for (const text of TEXTS) {
      const out = scan(text, 26, { perspective })
      if (!out.ok) throw new Error(`"${text}" perspective ${perspective}: ${out.error} — ${out.message}`)
      expect(out.text.trim()).toBe(text)
    }
  })
})

describe('scale robustness', () => {
  it.each([0.5, 0.7, 1.4])('scale %.1f', (scale) => {
    for (const text of TEXTS) {
      const out = scan(text, 26, { scale })
      if (!out.ok) throw new Error(`"${text}" scale ${scale}: ${out.error} — ${out.message}`)
      expect(out.text.trim()).toBe(text)
    }
  })
})

describe('combined degradation (realistic handheld photo)', () => {
  it('rotate 8 + shadow 0.2 + blur 2 + noise 4', () => {
    for (const text of TEXTS) {
      const out = scan(text, 26, { rotateDeg: 8, shadow: 0.2, blur: 2, noise: 4 })
      if (!out.ok) throw new Error(`"${text}": ${out.error} — ${out.message}`)
      expect(out.text.trim()).toBe(text)
    }
  })
  it('scale 0.6 + rotate 5 + shadow 0.2', () => {
    for (const text of TEXTS) {
      const out = scan(text, 26, { scale: 0.6, rotateDeg: 5, shadow: 0.2 })
      if (!out.ok) throw new Error(`"${text}": ${out.error} — ${out.message}`)
      expect(out.text.trim()).toBe(text)
    }
  })
})
