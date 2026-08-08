import { describe, expect, it } from 'vitest'
import { renderBrailleText } from './sample'
import { runScan } from './cv/pipeline'

function scan(text: string, opts: { g?: number; lineWidth?: number; seed?: number } = {}) {
  const { rgba, width, height } = renderBrailleText(text, 'en', { g: opts.g ?? 26, lineWidth: opts.lineWidth, seed: opts.seed })
  const out = runScan(1, rgba, width, height, 'en')
  return out
}

describe('end-to-end golden tests (synthetic slate images)', () => {
  it('round-trips a single word', () => {
    const out = scan('cat')
    if (!out.ok) throw new Error(`scan failed: ${out.error} — ${out.message}`)
    expect(out.text.trim()).toBe('cat')
  })

  it('round-trips a sentence with spaces', () => {
    const out = scan('the cat sat')
    if (!out.ok) throw new Error(`scan failed: ${out.error} — ${out.message}`)
    expect(out.text.trim()).toBe('the cat sat')
  })

  it('round-trips two lines', () => {
    const out = scan('the cat sat\nlook and see', { lineWidth: 11 })
    if (!out.ok) throw new Error(`scan failed: ${out.error} — ${out.message}`)
    expect(out.text.trim()).toBe('the cat sat\nlook and see')
  })

  it('round-trips with a different dot pitch and noise seed', () => {
    const out = scan('a brave cat', { g: 20, seed: 7 })
    if (!out.ok) throw new Error(`scan failed: ${out.error} — ${out.message}`)
    expect(out.text.trim()).toBe('a brave cat')
  })

  it('reports high overall confidence on clean input', () => {
    const out = scan('the cat sat')
    if (!out.ok) throw new Error(`scan failed: ${out.error}`)
    expect(out.overall).toBeGreaterThan(0.7)
    expect(out.stats.cells).toBeGreaterThan(5)
  })
})
