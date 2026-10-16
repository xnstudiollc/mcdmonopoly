import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Item, StickerSpot } from '../engine/types.ts'

const STICKER_ASPECT = 532 / 236
const round = (v: number) => Math.round(v * 1000) / 1000

export function PlacementHelper({ item }: { item: Item }) {
  const [spots, setSpots] = useState<StickerSpot[]>(item.stickers)
  const [size, setSize] = useState(item.stickers[0]?.size ?? 0.3)
  const [rotation, setRotation] = useState(0)

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = round((e.clientX - rect.left) / rect.width)
    const y = round((e.clientY - rect.top) / rect.height)
    const spot = { id: `s${spots.length + 1}`, x, y, size, rotation }
    console.log('[sticker placement]', JSON.stringify(spot))
    setSpots((s) => [...s, spot])
  }

  const json = JSON.stringify(spots, null, 2)

  return (
    <main className="page placement">
      <div className="placement__head">
        <h1>Sticker placement: {item.name}</h1>
        <Link to={`/item/${item.id}`} className="btn btn--ghost">
          Exit helper
        </Link>
      </div>
      <p className="muted">
        Click the item to drop a sticker centred on that point. Coordinates are normalized to the image (0 to 1) and also
        logged to the console. Paste the JSON into this item's <code>stickers</code> array in <code>src/data/items.json</code>.
      </p>
      <div className="placement__controls">
        <label>
          Size <input type="range" min={0.05} max={0.8} step={0.005} value={size} onChange={(e) => setSize(Number(e.target.value))} />{' '}
          {size.toFixed(3)}
        </label>
        <label>
          Rotation <input type="range" min={-45} max={45} step={0.5} value={rotation} onChange={(e) => setRotation(Number(e.target.value))} />{' '}
          {rotation}°
        </label>
        <button className="btn" onClick={() => setSpots([])}>
          Clear
        </button>
        <button className="btn" onClick={() => setSpots((s) => s.slice(0, -1))}>
          Undo
        </button>
        <button className="btn btn--primary" onClick={() => void navigator.clipboard?.writeText(json)}>
          Copy JSON
        </button>
      </div>
      <div className="placement__grid">
        <div className="placement__canvas" onClick={onClick}>
          <img src={item.image} alt={item.name} draggable={false} />
          {spots.map((s) => (
            <div
              key={s.id}
              className="placement__spot"
              style={{
                left: `${s.x * 100}%`,
                top: `${s.y * 100}%`,
                width: `${s.size * 100}%`,
                aspectRatio: String(STICKER_ASPECT),
                transform: `translate(-50%, -50%) rotate(${s.rotation}deg)`,
              }}
            >
              {s.id}
            </div>
          ))}
        </div>
        <pre className="placement__json">{json}</pre>
      </div>
    </main>
  )
}
