// Grid construction: rotation estimation, dot pitch, cell segmentation, and
// per-cell dot assignment. Reconstructs the FULL Braille lattice so that empty
// cells (spaces) are recovered even though they contain no dots.
// Pure math, runs in the worker.

import type { Dot, Grid, GridCell } from './types'

interface Cluster {
  center: number
  members: { x: number; y: number; idx: number }[]
}

interface ColCell {
  left: Cluster
  right: Cluster | null
  start: number
}

interface ColSlot {
  start: number
  rightX: number
  real: ColCell | null
}

/** Cluster 1D projected positions with a gap threshold. */
function cluster1D(members: { x: number; y: number; idx: number }[], gap: number): Cluster[] {
  const sorted = members.slice().sort((a, b) => a.x - b.x)
  const clusters: Cluster[] = []
  let current: Cluster | null = null
  for (const m of sorted) {
    if (!current) {
      current = { center: m.x, members: [m] }
      clusters.push(current)
    } else if (m.x - current.center <= gap) {
      current.members.push(m)
      const sum = current.members.reduce((s, mm) => s + mm.x, 0)
      current.center = sum / current.members.length
    } else {
      current = { center: m.x, members: [m] }
      clusters.push(current)
    }
  }
  return clusters
}

/** Median nearest-neighbour distance = intra-cell dot pitch estimate. */
export function estimatePitch(dots: Dot[]): number {
  if (dots.length < 1) return 0
  const medR = median(dots.map((d) => d.radius))
  const estFromR = medR > 0 ? medR / 0.30 : 20

  if (dots.length === 1) return estFromR

  // Use actual centre-to-centre distances. The old implementation collected
  // dx and dy independently, so a slightly tilted long line contributed many
  // tiny y drifts and those were mistaken for the dot pitch. This made a
  // sentence grid rotate wildly and fabricate thousands of cells.
  const distances: number[] = []
  for (let i = 0; i < dots.length; i++) {
    for (let j = i + 1; j < dots.length; j++) {
      const distance = Math.hypot(dots[i].x - dots[j].x, dots[i].y - dots[j].y)
      if (distance > 1) distances.push(distance)
    }
  }

  if (distances.length === 0) return estFromR
  distances.sort((a, b) => a - b)

  const plausible = distances.filter((distance) => distance >= 2.8 * medR && distance <= 5.4 * medR)
  if (plausible.length) {
    // The detected blob radius gives a stable scale prior. Choose the real
    // spacing closest to that prior instead of the first (smallest) distance:
    // tiny highlight fragments or skewed near-neighbours otherwise shrink the
    // entire lattice on long photographs.
    return plausible.reduce((best, distance) =>
      Math.abs(distance - estFromR) < Math.abs(best - estFromR) ? distance : best,
    )
  }

  return estFromR
}

/** Dominant row-axis angle (degrees, mod 90), from NN vector histogram. */
export function estimateAngle(dots: Dot[], g: number): number {
  // Long phone photos are commonly tilted by only a few degrees. Estimate
  // that row direction directly from horizontally-dominant dot pairs before
  // the local 0/90-degree histogram below. The local method is susceptible to
  // vertical dot pairs in a sparse sentence and can under-correct the tilt,
  // causing every physical row to split into many fake rows.
  const rowAngles: number[] = []
  for (let i = 0; i < dots.length; i++) {
    for (let j = i + 1; j < dots.length; j++) {
      const dx = dots[j].x - dots[i].x
      const dy = dots[j].y - dots[i].y
      const distance = Math.hypot(dx, dy)
      if (Math.abs(dx) < 3 * Math.abs(dy) || distance < 0.75 * g || distance > 8 * g) continue
      rowAngles.push((Math.atan2(dy, dx) * 180) / Math.PI)
    }
  }
  if (rowAngles.length >= 5) {
    rowAngles.sort((a, b) => a - b)
    const mid = rowAngles.length >> 1
    return rowAngles.length % 2 === 1 ? rowAngles[mid] : (rowAngles[mid - 1] + rowAngles[mid]) / 2
  }

  // Fold into [0, 90) because the grid axis is un-oriented: 0 and 180 are the
  // same line direction, as are 90 and 270.
  const bins = new Float32Array(18)
  const raw: { deg: number; w: number }[] = []
  for (let i = 0; i < dots.length; i++) {
    for (let j = i + 1; j < dots.length; j++) {
      const dx = dots[j].x - dots[i].x
      const dy = dots[j].y - dots[i].y
      const d = Math.hypot(dx, dy)
      if (d < 1e-6 || d > 1.45 * g) continue
      let deg = (Math.atan2(dy, dx) * 180) / Math.PI
      deg = ((deg % 180) + 180) % 180
      if (deg >= 90) deg = 180 - deg
      const bin = Math.min(17, Math.floor(deg / 5))
      const w = 1 - d / (2.2 * g)
      bins[bin] += w
      raw.push({ deg, w })
    }
  }
  const smoothed = new Float32Array(18)
  for (let i = 0; i < 18; i++) {
    smoothed[i] = bins[(i + 17) % 18] * 0.25 + bins[i] * 0.5 + bins[(i + 1) % 18] * 0.25
  }
  let bestBin = 0
  let bestScore = -Infinity
  for (let i = 0; i < 18; i++) {
    // Orthogonal direction: theta + 90 folds to 90 - theta, mirroring index.
    const s = smoothed[i] + smoothed[17 - i]
    if (s > bestScore) {
      bestScore = s
      bestBin = i
    }
  }
  if (bestScore <= 0) return 0
  const lo = bestBin * 5
  const hi = lo + 5
  let sum = 0
  let wsum = 0
  for (const v of raw) {
    if (v.deg >= lo && v.deg < hi) {
      sum += v.deg * v.w
      wsum += v.w
    }
  }
  return wsum > 0 ? sum / wsum : bestBin * 5 + 2.5
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0
  const s = arr.slice().sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function buildGrid(dots: Dot[]): Grid | null {
  if (dots.length < 1) return null
  const g = estimatePitch(dots)
  if (!(g > 1)) return null
  const rad0 = (estimateAngle(dots, g) * Math.PI) / 180

  // The folded estimator cannot distinguish a +tilt from a -tilt, and its
  // bin refinement is only accurate to ~0.5-2 degrees (enough to misassign
  // dots across a wide page). Resolve both by minimising the grid's own
  // residual: the true tilt/sign makes the reconstructed lattice positions
  // coincide with the detected dots (RMS ~1px); a wrong sign or a drifted
  // angle shears the lattice and inflates the residual by an order of
  // magnitude.
  const best = { rad: rad0, grid: null as Grid | null, score: Infinity }

  // Coarse sweep across plausible phone-camera tilts. The image's row-angle
  // estimate is only a hint: a sparse sentence can make it drift by several
  // degrees, which previously kept the true horizontal layout out of the
  // candidate set entirely.
  const candidates: number[] = []
  for (let deg = -18; deg <= 18; deg += 0.5) {
    candidates.push((deg * Math.PI) / 180)
  }
  candidates.push(rad0, -rad0)
  for (const rad of candidates) {
    const grid = buildGridAtAngle(dots, g, rad)
    if (!grid) continue
    // Every dot is assigned to its nearest theoretical position, so a wrong
    // tilt can falsely reduce residual by splitting one text line into many
    // fake rows and cells. A valid Braille lattice is the most compact layout
    // that explains the dots; residual only breaks ties between equally sized
    // layouts.
    const score = grid.cells.length * 10 + gridResidual(grid)
    if (score < best.score) {
      best.score = score
      best.grid = grid
      best.rad = rad
    }
  }

  if (!best.grid) {
    // Fall back to a plain build without refinement.
    return buildGridAtAngle(dots, g, rad0) ?? buildGridAtAngle(dots, g, -rad0)
  }

  // Fine refinement around the coarse winner.
  for (const span of [0.3, 0.06, 0.012]) {
    let improved = false
    for (let d = -span; d <= span; d += span / 3) {
      if (Math.abs(d) < 1e-9) continue
      const rad = best.rad + d
      const grid = buildGridAtAngle(dots, g, rad)
      if (!grid) continue
      const score = grid.cells.length * 10 + gridResidual(grid)
      if (score < best.score) {
        best.score = score
        best.grid = grid
        best.rad = rad
        improved = true
      }
    }
    if (!improved) break
  }

  return best.grid
}

/** Mean squared distance from each assigned dot to its lattice position. */
function gridResidual(grid: Grid): number {
  let sum = 0
  let cnt = 0
  for (const c of grid.cells) {
    for (let p = 0; p < 6; p++) {
      for (const d of c.dots[p]) {
        const dx = d.x - c.dotPos[p].x
        const dy = d.y - c.dotPos[p].y
        sum += dx * dx + dy * dy
        cnt++
      }
    }
  }
  return cnt > 0 ? sum / cnt : Infinity
}

/** Build the lattice for an explicit (signed) projection angle in radians. */
export function buildGridAtAngle(dots: Dot[], g: number, rad: number): Grid | null {
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  const projected = dots.map((d, idx) => {
    const u = d.x * cos + d.y * sin
    const v = -d.x * sin + d.y * cos
    return { x: u, y: v, idx }
  })

  const entries = projected.map((p) => ({ x: p.x, y: p.y, idx: p.idx }))
  const cols = cluster1D(entries, 0.65 * g)
  cols.sort((a, b) => a.center - b.center)
  const rows = cluster1D(
    entries.map((e) => ({ x: e.y, y: e.x, idx: e.idx })),
    0.65 * g,
  )
  rows.sort((a, b) => a.center - b.center)

  if (cols.length < 1 || rows.length < 1) return null

  // Pair columns into cells (within-cell gap ~1.0g, cross-cell ~1.44g+).
  const colCells: ColCell[] = []
  if (cols.length === 2 && cols[1].center - cols[0].center < 1.7 * g) {
    colCells.push({ left: cols[0], right: cols[1], start: cols[0].center })
  } else {
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i]
      const next = cols[i + 1]
      if (next && next.center - c.center < 1.25 * g) {
        colCells.push({ left: c, right: next, start: c.center })
        i++
      } else {
        colCells.push({ left: c, right: null, start: c.center })
      }
    }
  }
  console.log('colCells', colCells.map(c => ({ start: c.start, gap: c.right ? c.right.center - c.left.center : null })))

  // Cell-to-cell pitch P: sweep the plausible range and keep the pitch that
  // makes the most observed column-start pairs land on (nearly) integer
  // multiples. Scoring weights each fitting pair by 1/m so the fundamental
  // pitch beats its subharmonics (a half-pitch would otherwise explain the
  // same gaps at double multiplicity and double the cell count). A plain
  // median of consecutive gaps is likewise corrupted when dots are missing or
  // the left edge of the photo is irregular.
  const starts = colCells.map((c) => c.start)
  let P = 2.44 * g
  let bestScore = -1
  for (let cand = 1.5 * g; cand <= 4.5 * g; cand += 0.02 * g) {
    let score = 0
    for (let i = 0; i < starts.length; i++) {
      for (let j = i + 1; j < starts.length; j++) {
        const gap = starts[j] - starts[i]
        const m = Math.round(gap / cand)
        if (m >= 1 && Math.abs(gap - m * cand) < 0.12 * cand) score += 1 / m
      }
    }
    if (score > bestScore) {
      bestScore = score
      P = cand
    }
  }

  // Reconstruct the full column lattice by snapping every observed column onto
  // the nearest node of a regular {origin + k*P} grid. Missing columns (faint
  // or undetected dots) then become empty cells instead of shearing the
  // lattice, and spurious columns that would land on the same node are merged.
  // The first pass uses a crude origin (P/2) to bootstrap; the second pass
  // re-snaps against the real origin. Without the re-snap, any column sitting
  // near a half-pitch boundary is pushed one node too far right/left, which at
  // the line edges fabricates an extra phantom cell (or drops a real one).
  const snapped = starts.map((s, idx) => ({
    s,
    k: Math.round((s - P / 2) / P),
    idx,
  }))
  const medianOff = (list: { s: number; k: number }[]) =>
    list.map((x) => x.s - x.k * P).sort((a, b) => a - b)[list.length >> 1]
  let origin = medianOff(snapped)
  for (let iter = 0; iter < 3; iter++) {
    let changed = false
    for (const x of snapped) {
      const k = Math.round((x.s - origin) / P)
      if (k !== x.k) {
        x.k = k
        changed = true
      }
    }
    if (!changed) break
    origin = medianOff(snapped)
  }

  // console.log('P before regression:', P)
  // Refine P and origin using linear regression on (k, s) pairs
  // to prevent pitch error from accumulating across long lines.
  if (snapped.length > 1) {
    const n = snapped.length
    const sumK = snapped.reduce((acc, x) => acc + x.k, 0)
    const sumS = snapped.reduce((acc, x) => acc + x.s, 0)
    const sumK2 = snapped.reduce((acc, x) => acc + x.k * x.k, 0)
    const sumKS = snapped.reduce((acc, x) => acc + x.k * x.s, 0)
    const denom = n * sumK2 - sumK * sumK
    if (denom !== 0) {
      P = (n * sumKS - sumK * sumS) / denom
      origin = (sumS - P * sumK) / n
    }
  }
  // console.log('P after regression:', P)

  // Re-snap all columns with the refined P and origin
  for (const x of snapped) {
    x.k = Math.round((x.s - origin) / P)
  }

  const kMin = Math.min(...snapped.map((x) => x.k))
  const kMax = Math.max(...snapped.map((x) => x.k))
  // console.log('kMin:', kMin, 'kMax:', kMax)
  const byK = new Map<number, ColCell>()
  for (const x of snapped) {
    // Keep the one closest to the ideal lattice point
    const ideal = origin + x.k * P
    const existing = byK.get(x.k)
    if (!existing || Math.abs(x.s - ideal) < Math.abs(existing.start - ideal)) {
      byK.set(x.k, colCells[x.idx])
    }
  }
  const slots: ColSlot[] = []
  for (let k = kMin - 1; k <= kMax + 1; k++) {
    const real = byK.get(k) ?? null
    const start = real ? real.start : origin + k * P
    const rightX = real && real.right ? real.right.center : start + g
    slots.push({ start, rightX, real })
  }

  // Group rows into cell lines by inter-line gaps (> 1.5 * g)
  const lines: Cluster[][] = []
  let currentLine: Cluster[] = []
  for (let i = 0; i < rows.length; i++) {
    if (currentLine.length === 0) {
      currentLine.push(rows[i])
    } else {
      const gap = rows[i].center - currentLine[currentLine.length - 1].center
      if (gap > 2.3 * g || currentLine.length >= 3) {
        lines.push(currentLine)
        currentLine = [rows[i]]
      } else {
        currentLine.push(rows[i])
      }
    }
  }
  if (currentLine.length > 0) lines.push(currentLine)

  // Invert the rotation so a projected (u,v) coordinate maps back to pixels.
  const toPixel = (u: number, v: number): { x: number; y: number } => ({
    x: u * cos - v * sin,
    y: u * sin + v * cos,
  })

  interface BuildCell {
    cell: GridCell
    pix: { x: number; y: number }[] // 6 pixel dot positions
  }

  // Phase 1: build all cells (geometry only) with pixel-space dot positions.
  const buildCells: BuildCell[] = []
  for (let li = 0; li < lines.length; li++) {
    const lineRows = lines[li].map((r) => r.center).sort((a, b) => a - b)
    if (lineRows.length === 0) continue
    let vPitch = g
    let r0: number, r1: number, r2: number
    if (lineRows.length >= 3) {
      r0 = lineRows[0]
      r1 = lineRows[1]
      r2 = lineRows[2]
      vPitch = (r2 - r0) / 2
    } else if (lineRows.length === 2) {
      const d = lineRows[1] - lineRows[0]
      if (d > 1.4 * g) {
        vPitch = d / 2
        r0 = lineRows[0]
        r1 = lineRows[0] + vPitch
        r2 = lineRows[1]
      } else {
        vPitch = d > 0.4 * g ? d : g
        r0 = lineRows[0]
        r1 = lineRows[1]
        r2 = lineRows[1] + vPitch
      }
    } else {
      r0 = lineRows[0]
      r1 = lineRows[0] + vPitch
      r2 = lineRows[0] + 2 * vPitch
    }

    const rowYs = [r0, r1, r2]
    const top = r0 - vPitch * 0.5

    for (let k = 0; k < slots.length; k++) {
      const slot = slots[k]
      const left = slot.start
      const right = slot.rightX
      const cxU = (left + right) / 2
      const cyU = r1
      const center = toPixel(cxU, cyU)
      const pix: { x: number; y: number }[] = []
      for (let p = 0; p < 6; p++) {
        const colPos = p >= 3 ? 1 : 0
        const rowPos = p % 3
        const u = colPos === 0 ? left : right
        const v = rowYs[rowPos]
        pix.push(toPixel(u, v))
      }
      // Pixel-space cell box (left column center = pix[0], top row = line top).
      const leftColPix = toPixel(left, r0)
      const rightColPix = toPixel(right, r0)
      const topPix = toPixel(cxU, top)
      const bottomPix = toPixel(cxU, r2)
      const cell: GridCell = {
        line: li,
        lineTop: topPix.y,
        colPair: k,
        cx: center.x,
        cy: center.y,
        box: {
          x: leftColPix.x - g * 0.6,
          y: topPix.y - g * 0.6,
          w: rightColPix.x - leftColPix.x + g * 1.2,
          h: bottomPix.y - topPix.y + g * 1.2,
        },
        dots: Array.from({ length: 6 }, () => [] as Dot[]),
        dotPos: pix.map((p) => ({ x: p.x, y: p.y })),
        rows: lineRows,
        rowYs,
      }
      buildCells.push({ cell, pix })
    }
  }

  // Phase 2: assign every dot to the nearest cell's nearest dot position in
  // pixel space. Nearest-neighbour in pixels is immune to residual angle
  // drift that grows across wide lines.
  const assigned = new Set<number>()
  const cells: GridCell[] = buildCells.map((b) => b.cell)
  for (let i = 0; i < dots.length; i++) {
    const d = dots[i]
    let best: BuildCell | null = null
    let bestP = -1
    let bestD = Infinity
    for (const b of buildCells) {
      for (let p = 0; p < 6; p++) {
        const dx = d.x - b.pix[p].x
        const dy = d.y - b.pix[p].y
        const dist = dx * dx + dy * dy
        if (dist < bestD) {
          bestD = dist
          best = b
          bestP = p
        }
      }
    }
    if (best) {
      best.cell.dots[bestP].push(d)
      assigned.add(i)
    }
  }

  // Phase 3: exact pixel-space row positions per line for Reader B.
  const yByLine = new Map<number, number[][]>()
  for (const b of buildCells) {
    const c = b.cell
    let arr = yByLine.get(c.line)
    if (!arr) {
      arr = [[], [], []]
      yByLine.set(c.line, arr)
    }
    for (let p = 0; p < 6; p++) {
      for (const dd of c.dots[p]) arr[p % 3].push(dd.y)
    }
  }
  for (const b of buildCells) {
    const arr = yByLine.get(b.cell.line)!
    b.cell.rowYs = arr.map((ys) => (ys.length ? median(ys) : NaN))
  }

  if (cells.length === 0) return null

  return { g, angle: (rad * 180) / Math.PI, cells, unassigned: dots.length - assigned.size, totalDots: dots.length }
}
