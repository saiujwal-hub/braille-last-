import type { CellStatus } from '../domain/consensus'

export function statusLabel(status: CellStatus): string {
  return status === 'high' ? 'High confidence' : status === 'tie' ? 'Broken tie' : 'Uncertain'
}

export function ConfidencePill({ status, confidence }: { status: CellStatus; confidence: number }) {
  const cls =
    status === 'high' ? 'pill pill--ok' : status === 'tie' ? 'pill pill--warn' : 'pill pill--danger'
  return (
    <span className={cls}>
      {statusLabel(status)} · {Math.round(confidence * 100)}%
    </span>
  )
}
