// Image input helpers: turn a File or dataURL into RGBA bytes for the worker.

export interface DecodedImage {
  rgba: Uint8ClampedArray
  width: number
  height: number
}

export async function fileToImageData(file: File | Blob): Promise<DecodedImage> {
  const bitmap = await createImageBitmap(file)
  try {
    return bitmapToImageData(bitmap)
  } finally {
    bitmap.close()
  }
}

export async function dataUrlToImageData(dataUrl: string): Promise<DecodedImage> {
  const img = new Image()
  img.src = dataUrl
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas 2D unavailable')
  ctx.drawImage(img, 0, 0)
  return canvasToImageData(canvas)
}

export function imageDataToDataUrl(rgba: Uint8ClampedArray, width: number, height: number, quality = 0.85): string {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0)
  return canvas.toDataURL('image/jpeg', quality)
}

function bitmapToImageData(bitmap: ImageBitmap): DecodedImage {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas 2D unavailable')
  ctx.drawImage(bitmap, 0, 0)
  return canvasToImageData(canvas)
}

function canvasToImageData(canvas: HTMLCanvasElement | OffscreenCanvas): DecodedImage {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas 2D unavailable')
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return { rgba: imageData.data, width: canvas.width, height: canvas.height }
}
