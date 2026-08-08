import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { decode } from 'jpeg-js'
import { runScan } from './cv/pipeline'
import { TABLES } from '../domain/tables'

const ALPHABET_DIR = join(__dirname, '..', '..', 'test-images', 'braille_alphabet_images')

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

describe('alphabet braille images evaluation', () => {
  if (!existsSync(ALPHABET_DIR)) {
    it('no alphabet directory', () => {})
    return
  }
  const files = readdirSync(ALPHABET_DIR).filter((f) => /\.(png|jpe?g)$/i.test(f))
  
  for (const file of files) {
    const expectedLetter = file.split('.')[0].toLowerCase()
    it(`evaluates ${file} (expected: ${expectedLetter})`, () => {
      const { rgba, width, height } = decodeImage(readFileSync(join(ALPHABET_DIR, file)))
      const out = runScan(1, rgba, width, height, 'en')
      if (out.ok) {
        const c = out.cells[0]
        const charA = c.readerA !== null ? (TABLES.en.forward[c.readerA] ?? '?') : null
        const charB = c.readerB !== null ? (TABLES.en.forward[c.readerB] ?? '?') : null
        console.log(`[ALPHABET] ${file} -> Final: "${out.text}" (Expected: "${expectedLetter}") [A="${charA}" (mask ${c.readerA}), B="${charB}" (mask ${c.readerB}), status=${c.status}]`)
        expect(out.text).toBe(expectedLetter)
      } else {
        console.log(`[ALPHABET] ${file} -> FAIL: ${out.error} - ${out.message}`)
        expect(out.ok).toBe(true)
      }
    })
  }
})
