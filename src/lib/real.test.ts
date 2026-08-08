import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { decode } from 'jpeg-js'
import { runScan } from './cv/pipeline'

const DIR = join(__dirname, '..', '..', 'test-images')

function decodeImage(buf: Buffer): { rgba: Uint8ClampedArray; width: number; height: number } {
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    const png = PNG.sync.read(buf)
    return { rgba: new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.length), width: png.width, height: png.height }
  }
  const jpeg = decode(buf, { useTArray: true })
  const rgba = new Uint8ClampedArray(jpeg.data.length)
  rgba.set(jpeg.data)
  return { rgba, width: jpeg.width, height: jpeg.height }
}

describe('real slate photos (drop PNG/JPG into test-images/)', () => {
  if (!readdirSync(DIR).length) {
    it('no images yet — add real slate photos to test-images/', () => {})
    return
  }
  for (const file of readdirSync(DIR)) {
    const lower = file.toLowerCase()
    if (!/\.(png|jpe?g)$/.test(lower)) continue
    it(`scans ${file}`, () => {
      const { rgba, width, height } = decodeImage(readFileSync(join(DIR, file)))
      const out = runScan(1, rgba, width, height, 'en')
      if (out.ok) {
        console.log(`\n[${file}] -> "${out.text}"  conf=${out.overall.toFixed(2)} cells=${out.stats.cells} dots=${out.stats.dots} flipped=${out.flipped} polarity=${out.polarity}`)
      } else {
        console.log(`\n[${file}] FAIL: ${out.error} — ${out.message}`)
      }
      expect(out.ok).toBe(true)
    })
  }
})
