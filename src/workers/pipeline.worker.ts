import { runScan, type ScanOutcome } from '../lib/cv/pipeline'
import type { BrailleLang } from '../domain/tables'

export interface ScanRequestMessage {
  type: 'scan'
  id: number
  rgba: Uint8ClampedArray
  width: number
  height: number
  language: BrailleLang
}

self.onmessage = (e: MessageEvent<ScanRequestMessage>) => {
  const msg = e.data
  if (msg?.type !== 'scan') return
  const outcome: ScanOutcome = runScan(msg.id, msg.rgba, msg.width, msg.height, msg.language)
  ;(self as unknown as Worker).postMessage(outcome)
}
