import { useEffect, useRef, useState } from 'react'
import { fileToImageData, dataUrlToImageData, type DecodedImage } from '../lib/imageInput'

export function CaptureArea({
  onCaptured,
  onUpload,
  busy,
}: {
  onCaptured: (img: DecodedImage) => void
  onUpload: (img: DecodedImage) => void
  busy: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera not supported here — use the upload option.')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => undefined)
        }
        setCameraReady(true)
        setCameraError(null)
      } catch (e) {
        setCameraError('Camera unavailable. Use the upload button instead.')
        void e
      }
    }
    void start()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  async function handleCapture() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    try {
      const img = await dataUrlToDecoded(dataUrl)
      onCaptured(img)
    } catch {
      // fall through
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const img = await fileToImageData(file)
      onUpload(img)
    } catch {
      setCameraError('Could not read that image file.')
    }
  }

  return (
    <div className="capture">
      <div className="capture__stage">
        {cameraReady ? (
          <>
            <video ref={videoRef} autoPlay muted playsInline className="capture__video" />
            <div className="capture__guide" aria-hidden="true">
              <div className="guide-label">Align the Braille in the frame</div>
            </div>
          </>
        ) : (
          <div className="capture__placeholder">
            {cameraError ? <p>{cameraError}</p> : <p>Starting camera…</p>}
          </div>
        )}
      </div>
      <div className="capture__actions">
        {cameraReady && (
          <button type="button" className="btn btn--primary btn--lg" onClick={handleCapture} disabled={busy}>
            Capture photo
          </button>
        )}
        <label className="btn btn--ghost">
          Upload a photo
          <input type="file" accept="image/*" hidden onChange={handleFile} />
        </label>
      </div>
    </div>
  )
}

async function dataUrlToDecoded(dataUrl: string): Promise<DecodedImage> {
  return dataUrlToImageData(dataUrl)
}
