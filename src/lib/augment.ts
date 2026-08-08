// Augment synthetic renders with the degradations a real camera photo has:
// rotation, perspective (trapezoid) warp, brightness/shadow gradients, blur
// and noise. Used to stress-test the pipeline before real slate photos arrive.

export interface AugmentOpts {
  /** rotation in degrees about the image center */
  rotateDeg?: number
  /** fractional perspective warp: 0 = none, ~0.08 = strong trapezoid */
  perspective?: number
  /** 0..1 shadow gradient strength (top-left darker, bottom-right lighter) */
  shadow?: number
  /** blur kernel radius (px) */
  blur?: number
  /** gaussian-ish noise amplitude (0..~25) */
  noise?: number
  /** scale factor (down/up) applied before other transforms */
  scale?: number
}

export function augmentRgba(src: Uint8ClampedArray, w: number, h: number, o: AugmentOpts = {}): {
  data: Uint8ClampedArray
  width: number
  height: number
} {
  let data = new Uint8ClampedArray(src)
  let W = w
  let H = h

  if (o.scale && o.scale !== 1) {
    const r = resample(data, W, H, o.scale)
    data = r.data
    W = r.width
    H = r.height
  }
  if (o.rotateDeg) {
    const r = rotate(data, W, H, o.rotateDeg)
    data = r.data
    W = r.width
    H = r.height
  }
  if (o.perspective) {
    const r = perspective(data, W, H, o.perspective)
    data = r.data
    W = r.width
    H = r.height
  }
  if (o.blur && o.blur > 0) {
    data = boxBlurRgba(data, W, H, Math.round(o.blur))
  }
  if (o.shadow) {
    const g = o.shadow
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = (x / W) * 0.4 + (y / H) * 0.6
        const f = 1 - g * t
        const i = (y * W + x) * 4
        data[i] *= f
        data[i + 1] *= f
        data[i + 2] *= f
      }
    }
  }
  if (o.noise && o.noise > 0) {
    const a = o.noise
    let s = 12345
    const rand = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff
      return s / 0x7fffffff
    }
    for (let i = 0; i < W * H * 4; i++) data[i] = Math.max(0, Math.min(255, data[i] + (rand() - 0.5) * 2 * a))
  }

  return { data, width: W, height: H }
}

/** Bilinear rotation around center; canvas slightly enlarged. */
function rotate(src: Uint8ClampedArray, w: number, h: number, deg: number): { data: Uint8ClampedArray; width: number; height: number } {
  const rad = (deg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const nw = Math.ceil(Math.abs(w * cos) + Math.abs(h * sin)) + 2
  const nh = Math.ceil(Math.abs(w * sin) + Math.abs(h * cos)) + 2
  const out = new Uint8ClampedArray(nw * nh * 4).fill(240)
  const cx = w / 2
  const cy = h / 2
  const ox = nw / 2
  const oy = nh / 2
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      // inverse map
      const dx = x - ox
      const dy = y - oy
      const sx = dx * cos + dy * sin + cx
      const sy = -dx * sin + dy * cos + cy
      const o = (y * nw + x) * 4
      sample(src, w, h, sx, sy, out, o)
    }
  }
  return { data: out, width: nw, height: nh }
}

/** Perspective: pull the four corners toward the center by `p` fraction. */
function perspective(src: Uint8ClampedArray, w: number, h: number, p: number): { data: Uint8ClampedArray; width: number; height: number } {
  const out = new Uint8ClampedArray(w * h * 4).fill(240)
  const dx = w * p
  const dy = h * p
  // Source quad: inset corners (mimics a photo of a tilted page).
  const q = [
    { x: dx, y: 0 },
    { x: w - dx, y: dy },
    { x: w, y: h - dy },
    { x: 0, y: h },
  ]
  for (let y = 0; y < h; y++) {
    const ty = y / (h - 1)
    for (let x = 0; x < w; x++) {
      const tx = x / (w - 1)
      const topX = q[0].x + (q[1].x - q[0].x) * tx
      const botX = q[3].x + (q[2].x - q[3].x) * tx
      const topY = q[0].y + (q[3].y - q[0].y) * ty
      const botY = q[1].y + (q[2].y - q[1].y) * ty
      const sx = topX + (botX - topX) * ty
      const sy = topY + (botY - topY) * tx
      const o = (y * w + x) * 4
      sample(src, w, h, sx, sy, out, o)
    }
  }
  return { data: out, width: w, height: h }
}

function sample(src: Uint8ClampedArray, w: number, h: number, sx: number, sy: number, out: Uint8ClampedArray, o: number) {
  const x0 = Math.floor(sx)
  const y0 = Math.floor(sy)
  const fx = sx - x0
  const fy = sy - y0
  const x1 = Math.min(w - 1, x0 + 1)
  const y1 = Math.min(h - 1, y0 + 1)
  for (let c = 0; c < 4; c++) {
    const p00 = src[(y0 * w + x0) * 4 + c]
    const p10 = src[(y0 * w + x1) * 4 + c]
    const p01 = src[(y1 * w + x0) * 4 + c]
    const p11 = src[(y1 * w + x1) * 4 + c]
    const top = p00 + (p10 - p00) * fx
    const bottom = p01 + (p11 - p01) * fx
    out[o + c] = top + (bottom - top) * fy
  }
}

function resample(src: Uint8ClampedArray, w: number, h: number, scale: number): { data: Uint8ClampedArray; width: number; height: number } {
  const nw = Math.max(2, Math.round(w * scale))
  const nh = Math.max(2, Math.round(h * scale))
  const out = new Uint8ClampedArray(nw * nh * 4)
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      sample(src, w, h, (x * w) / nw, (y * h) / nh, out, (y * nw + x) * 4)
    }
  }
  return { data: out, width: nw, height: nh }
}

function boxBlurRgba(src: Uint8ClampedArray, w: number, h: number, r: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let rsum = 0
      let gsum = 0
      let bsum = 0
      let n = 0
      for (let ky = -r; ky <= r; ky++) {
        const yy = y + ky
        if (yy < 0 || yy >= h) continue
        for (let kx = -r; kx <= r; kx++) {
          const xx = x + kx
          if (xx < 0 || xx >= w) continue
          const i = (yy * w + xx) * 4
          rsum += src[i]
          gsum += src[i + 1]
          bsum += src[i + 2]
          n++
        }
      }
      const i = (y * w + x) * 4
      out[i] = rsum / n
      out[i + 1] = gsum / n
      out[i + 2] = bsum / n
      out[i + 3] = 255
    }
  }
  return out
}
