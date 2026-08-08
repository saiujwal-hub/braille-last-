import { CaptureArea } from '../components/CaptureArea'
import { ErrorCard } from '../components/ErrorCard'
import { useApp, useScan } from '../store'
import type { DecodedImage } from '../lib/imageInput'

export function ScanScreen() {
  const { scanError, startScan, clearScanError } = useScan()
  const { language } = useApp()

  if (scanError) {
    return (
      <main className="screen">
        <h1 className="page-title">Scan Braille</h1>
        <ErrorCard code={scanError.error} message={scanError.message} onRetry={clearScanError} />
      </main>
    )
  }

  return (
    <main className="screen">
      <h1 className="page-title">Scan Braille</h1>
      <p className="page-sub">Fill the frame with the Braille. Hold the phone level and use good lighting.</p>
      <CaptureArea
        busy={false}
        onCaptured={(img: DecodedImage) => void startScan(img.rgba, img.width, img.height, language)}
        onUpload={(img: DecodedImage) => void startScan(img.rgba, img.width, img.height, language)}
      />
    </main>
  )
}
