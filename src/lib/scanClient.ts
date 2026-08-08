import type { BrailleLang } from '../domain/tables'
import type { ScanOutcome } from '../lib/cv/pipeline'
import type { ScanRequestMessage } from '../workers/pipeline.worker'

let worker: Worker | null = null
let counter = 0
const pending = new Map<number, { resolve: (o: ScanOutcome) => void; timer: number }>()

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/pipeline.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<ScanOutcome>) => {
      const msg = e.data
      if (!msg || typeof msg.id !== 'number') return
      const entry = pending.get(msg.id)
      if (!entry) return
      pending.delete(msg.id)
      clearTimeout(entry.timer)
      entry.resolve(msg)
    }
    worker.onerror = (e) => {
      // Resolve all pending with a timeout-style failure.
      for (const [id, entry] of pending) {
        pending.delete(id)
        clearTimeout(entry.timer)
        entry.resolve({ ok: false, id, error: 'timeout', message: 'The vision worker crashed. Please retry.' })
      }
      e.preventDefault()
    }
  }
  return worker
}

/** Send a scan request to the worker. Resolves with the outcome or a timeout error. */
export function scanImage(rgba: Uint8ClampedArray, width: number, height: number, language: BrailleLang): Promise<ScanOutcome> {
  return new Promise((resolve) => {
    const id = ++counter
    const w = getWorker()
    const timer = window.setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        resolve({ ok: false, id, error: 'timeout', message: 'Processing is taking too long. Please try again.' })
      }
    }, 30000)
    pending.set(id, { resolve, timer })
    const msg: ScanRequestMessage = { type: 'scan', id, rgba, width, height, language }
    w.postMessage(msg, [rgba.buffer])
  })
}
