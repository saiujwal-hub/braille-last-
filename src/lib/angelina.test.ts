import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { decode } from 'jpeg-js'
import { runScan } from './cv/pipeline'
import { translateMasks } from '../domain/tables'
import { type DotMask } from '../domain/cell'

// Ground-truth validation against the Angelina Braille Dataset
// (https://github.com/IlyaOvodov/AngelinaDataset). Each image has a .csv with
// rows `left;top;right;bottom;mask` (normalized coords, mask = 6-bit braille
// dot encoding). We reconstruct the expected cell-mask sequence in reading
// order and compare it with the pipeline's per-cell masks.
const DIR = process.env.ANGELINA_DIR ?? 'C:/Users/meesa/AppData/Local/Temp/opencode/angelina/uploaded/test2'

interface Ann {
  x: number
  y: number
  mask: number
}

function readAnns(csvPath: string): Ann[] {
  const lines = readFileSync(csvPath, 'utf8').split(/\r?\n/).filter(Boolean)
  return lines.map((l) => {
    const [l0, t0, , , m] = l.split(';')
    return { x: parseFloat(l0), y: parseFloat(t0), mask: parseInt(m, 10) }
  })
}

/** Sort annotations into reading order (group lines by y, sort by x). */
function readingOrder(anns: Ann[]): { masks: number[]; lines: number } {
  const sorted = anns.slice().sort((a, b) => a.y - b.y)
  const lines: Ann[][] = []
  for (const a of sorted) {
    const last = lines[lines.length - 1]
    if (last && a.y - last[0].y < 0.045) last.push(a)
    else lines.push([a])
  }
  const masks: number[] = []
  for (const line of lines) {
    line.sort((a, b) => a.x - b.x)
    for (const a of line) masks.push(a.mask)
  }
  return { masks, lines: lines.length }
}

function toText(masks: number[]): string {
  return translateMasks(masks as DotMask[], 'en').text.replace(/\s+$/, '')
}

describe('Angelina dataset validation', () => {
  const images = existsSync(DIR) ? readdirSync(DIR).filter((f) => /\.jpg$/i.test(f)) : []
  if (!images.length) {
    it('no dataset — clone https://github.com/IlyaOvodov/AngelinaDataset', () => {})
    return
  }

  let total = 0
  let matched = 0
  let scanOk = 0
  const results: { file: string; expected: string; got: string; acc: number }[] = []

  for (const file of images) {
    const base = file.replace(/\.jpg$/i, '')
    const csvPath = join(DIR, `${base}.csv`)
    if (!existsSync(csvPath)) continue
    const { masks: expectedMasks, lines: expLines } = readingOrder(readAnns(csvPath))
    const expectedText = toText(expectedMasks)

    const jpeg = decode(readFileSync(join(DIR, file)), { useTArray: true })
    const rgba = new Uint8ClampedArray(jpeg.data.length)
    rgba.set(jpeg.data)
    const out = runScan(1, rgba, jpeg.width, jpeg.height, 'en')

    if (out.ok) {
      scanOk++
      const gotMasks = out.cells
        .slice()
        .sort((a, b) => a.row - b.row || a.col - b.col)
        .map((c) => c.mask)
      const flip = (m: number) => ((m & 0b111000) >> 3) | ((m & 0b000111) << 3)
      const mirror = gotMasks.map(flip)
      const count = (seq: number[]) => {
        let m = 0
        for (let i = 0; i < Math.min(seq.length, expectedMasks.length); i++) if (seq[i] === expectedMasks[i]) m++
        return m
      }
      const direct = count(gotMasks)
      const mirrored = count(mirror)
      let match = Math.max(direct, mirrored)
      total += expectedMasks.length
      matched += match
      results.push({
        file,
        expected: expectedText,
        got: toText(gotMasks),
        acc: gotMasks.length ? match / expectedMasks.length : 0,
      })
      if (results.length <= 6) {
        const gotLines = out.cells.length ? Math.max(...out.cells.map((c) => c.row)) + 1 : 0
        console.log(`  DBG ${file}: expCells=${expectedMasks.length} expLines=${expLines} gotCells=${gotMasks.length} gotLines=${gotLines} img=${jpeg.width}x${jpeg.height}`)
      }
    } else {
      results.push({ file, expected: expectedText, got: `FAIL(${out.error})`, acc: 0 })
    }
  }

  it('overall cell accuracy', () => {
    console.log(`\n=== Angelina validation: ${results.length} images, ${total} cells ===`)
    const sorted = results.slice().sort((a, b) => a.acc - b.acc)
    for (const r of sorted.slice(0, 12)) {
      console.log(`  [${(r.acc * 100).toFixed(0)}%] ${r.file}\n    exp: ${r.expected}\n    got: ${r.got}`)
    }
    const okCount = results.filter((r) => !r.got.startsWith('FAIL')).length
    console.log(`  scan-ok: ${scanOk}/${results.length}  avg cell acc: ${(matched / Math.max(1, total) * 100).toFixed(1)}%`)
    expect(okCount).toBeGreaterThan(0)
  })
})
