import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from '../components/Icons.tsx'
import { gameData } from '../engine/data.ts'
import type { Item } from '../engine/types.ts'
import { newSessionId } from '../lib/cards.ts'
import { useGame } from '../state/store.ts'

export function Home() {
  const items = gameData.items
  const trackRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [active, setActive] = useState(0)
  const activeRef = useRef(0)
  const drag = useRef<{ x: number; scroll: number; moved: boolean; id: number } | null>(null)
  const suppressClick = useRef(false)
  const navigate = useNavigate()
  const openItem = useGame((s) => s.openItem)
  const stockUsed = useGame((s) => s.stockUsed)
  const [soldOut, setSoldOut] = useState<string | null>(null)

  const updateFocus = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    const center = rect.left + rect.width / 2
    let best = 0
    let bestDist = Infinity
    cardRefs.current.forEach((el, i) => {
      if (!el) return
      const r = el.getBoundingClientRect()
      const dist = Math.abs(r.left + r.width / 2 - center)
      const focus = Math.max(0, 1 - dist / (r.width * 1.1))
      el.style.setProperty('--focus', focus.toFixed(3))
      if (dist < bestDist) {
        bestDist = dist
        best = i
      }
    })
    if (best !== activeRef.current) {
      activeRef.current = best
      setActive(best)
    }
  }, [])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(updateFocus)
    }
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      e.preventDefault()
      track.scrollLeft += e.deltaY
    }
    track.addEventListener('scroll', onScroll, { passive: true })
    track.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('resize', onScroll)
    updateFocus()
    return () => {
      cancelAnimationFrame(frame)
      track.removeEventListener('scroll', onScroll)
      track.removeEventListener('wheel', onWheel)
      window.removeEventListener('resize', onScroll)
    }
  }, [updateFocus])

  const scrollToIndex = (i: number) => {
    const idx = Math.max(0, Math.min(items.length - 1, i))
    const el = cardRefs.current[idx]
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    el?.focus({ preventScroll: true })
  }

  const remaining = (item: Item) =>
    item.stock === null ? null : Math.max(0, item.stock - (stockUsed[item.id] ?? 0))

  const pull = (item: Item) => {
    if (!openItem(item.id)) {
      setSoldOut(item.id)
      return
    }
    navigate(`/item/${item.id}`, { state: { session: newSessionId(item.id) } })
  }

  const onCardClick = (item: Item, i: number) => {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    if (i !== activeRef.current) scrollToIndex(i)
    else pull(item)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    const track = trackRef.current!
    drag.current = { x: e.clientX, scroll: track.scrollLeft, moved: false, id: e.pointerId }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const track = trackRef.current!
    const dx = e.clientX - d.x
    if (!d.moved && Math.abs(dx) > 6) {
      d.moved = true
      track.setPointerCapture(e.pointerId)
      track.classList.add('is-dragging')
    }
    if (d.moved) track.scrollLeft = d.scroll - dx
  }

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    const track = trackRef.current!
    if (d.moved) {
      suppressClick.current = true
      track.classList.remove('is-dragging')
      window.setTimeout(() => (suppressClick.current = false), 0)
      updateFocus()
      scrollToIndex(activeRef.current)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      scrollToIndex(activeRef.current + 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      scrollToIndex(activeRef.current - 1)
    }
  }

  const activeItem = items[active]

  return (
    <main className="home">
      <section className="home__intro">
        <h1>
          Peel the <span className="gold-text">gold</span>. Collect Canada.
        </h1>
        <p>
          Pick a McDonald's item, peel its Golden Edition stickers, and fill the board. Collect every stamp in a colour
          set to win its prize.
        </p>
      </section>

      <section className="carousel" aria-roledescription="carousel" aria-label="Items with Monopoly stickers">
        <button className="carousel__nav carousel__nav--prev" onClick={() => scrollToIndex(active - 1)} aria-label="Previous item" disabled={active === 0}>
          <ChevronLeft />
        </button>
        <div
          ref={trackRef}
          className="carousel__track"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onKeyDown}
        >
          {items.map((item, i) => {
            const left = remaining(item)
            const out = left === 0
            return (
              <button
                key={item.id}
                ref={(el) => {
                  cardRefs.current[i] = el
                }}
                className={`item-card${i === active ? ' is-active' : ''}${out ? ' is-sold-out' : ''}`}
                onClick={() => onCardClick(item, i)}
                aria-label={`${item.name}, ${item.stickers.length} sticker${item.stickers.length === 1 ? '' : 's'}${out ? ', sold out' : ''}`}
                aria-current={i === active}
                tabIndex={i === active ? 0 : -1}
              >
                <div className="item-card__art">
                  <img src={item.image} alt="" draggable={false} loading={i < 3 ? 'eager' : 'lazy'} />
                </div>
                <div className="item-card__name">{item.name}</div>
                <div className="item-card__meta">
                  <span className="chip chip--gold">
                    {item.stickers.length} sticker{item.stickers.length === 1 ? '' : 's'}
                  </span>
                  <span className="chip">{left === null ? 'Unlimited' : out ? 'Sold out' : `${left} left`}</span>
                </div>
                {item.placeholder && <span className="item-card__ph">Placeholder art</span>}
              </button>
            )
          })}
        </div>
        <button className="carousel__nav carousel__nav--next" onClick={() => scrollToIndex(active + 1)} aria-label="Next item" disabled={active === items.length - 1}>
          <ChevronRight />
        </button>
      </section>

      {activeItem && (
        <div className="home__cta">
          <button
            className="btn btn--primary btn--lg"
            onClick={() => pull(activeItem)}
            disabled={remaining(activeItem) === 0}
          >
            {remaining(activeItem) === 0 ? 'Sold out' : `Pull ${activeItem.name}`}
          </button>
          <p className="muted small">Scroll, swipe, drag or use the arrow keys to browse. Click the centre item to pull it in.</p>
          {soldOut === activeItem.id && <p className="warn small">That item is sold out. Reset progress on the Board page to restock.</p>}
        </div>
      )}
    </main>
  )
}
