import type { CardSpec } from '../peel/textures.ts'

interface StampCardProps {
  spec: CardSpec
  dimmed?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function StampCard({ spec, dimmed, size = 'md' }: StampCardProps) {
  return (
    <div
      className={`stamp-card stamp-card--${size}${dimmed ? ' stamp-card--dimmed' : ''}${spec.rare ? ' stamp-card--rare' : ''}`}
      style={{ '--accent': spec.accent } as React.CSSProperties}
    >
      <div className="stamp-card__title">
        {spec.title} • {spec.number}
      </div>
      <div className="stamp-card__req">{spec.requires}</div>
      <div className="stamp-card__label">{spec.prizeLabel}</div>
      <div className="stamp-card__prize">{spec.prize}</div>
      {spec.instant && <div className="stamp-card__instant">Instant win: {spec.instant}</div>}
    </div>
  )
}
