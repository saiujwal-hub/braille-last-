// Braille cell utilities.
// A 6-dot cell is represented as a bitmask:
//   bit0 -> dot1 (top-left), bit1 -> dot2 (middle-left), bit2 -> dot3 (bottom-left)
//   bit3 -> dot4 (top-right), bit4 -> dot5 (middle-right), bit5 -> dot6 (bottom-right)

export type DotMask = number

export const DOT = {
  d1: 1 << 0,
  d2: 1 << 1,
  d3: 1 << 2,
  d4: 1 << 3,
  d5: 1 << 4,
  d6: 1 << 5,
} as const

export const EMPTY_MASK: DotMask = 0
export const FULL_MASK: DotMask = (1 << 6) - 1

export function maskFromDots(dots: readonly number[]): DotMask {
  let m = 0
  for (const d of dots) m |= 1 << (d - 1)
  return m
}

export function dotsFromMask(mask: DotMask): number[] {
  const out: number[] = []
  for (let i = 0; i < 6; i++) if (mask & (1 << i)) out.push(i + 1)
  return out
}

/** Returns a 6-element array, true where a dot is present. */
export function dotPresence(mask: DotMask): boolean[] {
  const out = new Array<boolean>(6).fill(false)
  for (let i = 0; i < 6; i++) out[i] = (mask & (1 << i)) !== 0
  return out
}

/** Human-readable pattern like "1 3 5". */
export function maskToPattern(mask: DotMask): string {
  return dotsFromMask(mask).join(' ')
}

/**
 * Dot positions relative to a cell's top-left corner, in "dot units"
 * (intra-cell spacing = 1.0).
 */
export const DOT_POSITIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 0], // 1 top-left
  [0, 1], // 2 middle-left
  [0, 2], // 3 bottom-left
  [1, 0], // 4 top-right
  [1, 1], // 5 middle-right
  [1, 2], // 6 bottom-right
]

export function dotPosition(dot: number): [number, number] {
  const p = DOT_POSITIONS[dot - 1]
  return [p[0], p[1]]
}
