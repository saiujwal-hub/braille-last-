import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { decode } from 'jpeg-js'
import { toGray, flattenIllumination, localContrast } from './cv/preprocess'
import { detectDots } from './cv/readerA'
import { buildGrid } from './cv/grid'

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

for (const letter of ['E.png', 'I.png', 'K.png', 'O.png']) {
  const buf = readFileSync(join(ALPHABET_DIR, letter))
  const { rgba, width, height } = decodeImage(buf)
  const grayRaw = toGray(rgba, width, height)
  const gray = flattenIllumination(grayRaw, Math.max(12, Math.min(width, height) * 0.08))
  const bgRadius = Math.max(6, Math.min(width, height) * 0.045)
  const lc = localContrast(gray, bgRadius)
  const dotsOut = detectDots(gray, lc, Math.min(width, height))
  console.log(`\n=== ${letter} ===`)
  console.log('Dots detected:', dotsOut.dots)
  const grid = buildGrid(dotsOut.dots)
  if (grid) {
    console.log('Grid g:', grid.g, 'Cells:', grid.cells.length)
    for (const c of grid.cells) {
      console.log('Cell dotPos:', c.dotPos)
      console.log('Cell dots:', c.dots)
      let m = 0
      for (let p = 0; p < 6; p++) if (c.dots[p].length > 0) m |= 1 << p
      console.log('Mask:', m)
    }
  }
}
