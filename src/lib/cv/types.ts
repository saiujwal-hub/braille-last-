// Shared CV types.

export interface Dot {
  x: number
  y: number
  radius: number
  /** 0..1 quality (circularity + contrast strength) */
  quality: number
}

export interface GridCell {
  line: number
  lineTop: number
  colPair: number
  cx: number
  cy: number
  box: { x: number; y: number; w: number; h: number }
  /** 6 dot positions; each holds assigned dots (usually 0 or 1) */
  dots: Dot[][]
  /** Pixel-space x/y of the 6 expected dot locations (rotated with the grid) */
  dotPos: { x: number; y: number }[]
  rows: number[]
  /** Pixel-space y of each of the line's dot rows (NaN if that row has no dots) */
  rowYs: number[]
}

export interface Grid {
  g: number
  angle: number
  cells: GridCell[]
  /** dots that could not be assigned to any cell */
  unassigned: number
  totalDots: number
}
