import { dotPresence, type DotMask } from '../domain/cell'

export function CellDiagram({
  mask,
  size = 44,
  highlight,
  showLabels,
}: {
  mask: DotMask
  size?: number
  highlight?: 'high' | 'tie' | 'uncertain' | 'none'
  showLabels?: boolean
}) {
  const dots = dotPresence(mask)
  const dotSize = Math.max(3, size * 0.16)
  const color =
    highlight === 'high'
      ? 'var(--ok)'
      : highlight === 'tie'
        ? 'var(--warn)'
        : highlight === 'uncertain'
          ? 'var(--danger)'
          : 'var(--fg)'

  return (
    <div
      role="img"
      aria-label={`Braille dot pattern ${dots.map((d, i) => (d ? i + 1 : null)).filter(Boolean).join(', ') || 'empty'}`}
      style={{
        width: size,
        height: size,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr 1fr',
        gap: size * 0.12,
        padding: size * 0.1,
        background: 'rgba(255,255,255,0.04)',
        borderRadius: 8,
      }}
    >
      {dots.map((present, i) => (
        <div
          key={i}
          style={{
            borderRadius: '50%',
            background: present ? color : 'rgba(255,255,255,0.14)',
            alignSelf: 'center',
            justifySelf: 'center',
            width: present ? dotSize : dotSize * 0.7,
            height: present ? dotSize : dotSize * 0.7,
            boxShadow: present ? `0 0 ${dotSize}px ${color}44` : 'none',
          }}
          title={showLabels ? `dot ${i + 1}` : undefined}
        />
      ))}
    </div>
  )
}
