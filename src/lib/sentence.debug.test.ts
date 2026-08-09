import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { decode } from 'jpeg-js'
import { runScan } from './cv/pipeline'
import { flattenIllumination, localContrast, toGray } from './cv/preprocess'
import { detectDots } from './cv/readerA'
import { buildGrid, estimateAngle, estimatePitch } from './cv/grid'

describe('user-supplied sentence photograph', () => {
  it('reads the sentence', () => {
    const jpeg = decode(readFileSync('C:/Users/meesa/Downloads/WhatsApp Image 2026-08-09 at 09.29.47 (2).jpeg'), { useTArray: true })
    const raw = toGray(new Uint8ClampedArray(jpeg.data), jpeg.width, jpeg.height)
    const gray = flattenIllumination(raw, Math.max(12, Math.min(jpeg.width, jpeg.height) * 0.08))
    const dots = detectDots(gray, localContrast(gray, Math.max(12, Math.min(jpeg.width, jpeg.height) * 0.12)), Math.min(jpeg.width, jpeg.height))
    const pitch = estimatePitch(dots.dots)
    const grid = buildGrid(dots.dots)
    console.log('geometry', { pitch, angle: estimateAngle(dots.dots, pitch), gridAngle: grid?.angle, gridPitch: grid?.g, cells: grid?.cells.length, lines: grid ? Math.max(...grid.cells.map(c => c.line)) + 1 : 0 })
    const out = runScan(1, new Uint8ClampedArray(jpeg.data), jpeg.width, jpeg.height, 'en')
    console.log(out.ok ? { text: out.text, stats: out.stats, g: out.cells[0] ? Math.round(out.cells[0].box.w) : null, cells: out.cells.length } : out)
    expect(out.ok).toBe(true)
    if (out.ok) expect(out.text.trim()).toBe('common Icons of the Taskbar')
  })
})
