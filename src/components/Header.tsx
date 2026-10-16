import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { gameData } from '../engine/data.ts'
import { useGame } from '../state/store.ts'
import { HistoryDrawer } from './HistoryDrawer.tsx'
import { HistoryIcon, SoundOffIcon, SoundOnIcon } from './Icons.tsx'

export function Wordmark() {
  return (
    <span className="wordmark" aria-label="McDMonopoly">
      <span className="wordmark__mcd">McD</span>
      <span className="wordmark__mono">MONOPOLY</span>
    </span>
  )
}

export function Header() {
  const peels = useGame((s) => s.collection.peels)
  const collected = useGame((s) => s.collection.collected.length)
  const mode = useGame((s) => s.mode)
  const setMode = useGame((s) => s.setMode)
  const muted = useGame((s) => s.muted)
  const setMuted = useGame((s) => s.setMuted)
  const [historyOpen, setHistoryOpen] = useState(false)
  const total = gameData.properties.properties.length

  return (
    <header className="site-header">
      <NavLink to="/" className="site-header__brand" aria-label="McDMonopoly home">
        <Wordmark />
      </NavLink>
      <nav className="site-nav" aria-label="Main">
        <NavLink to="/" end>
          Items
        </NavLink>
        <NavLink to="/board">Board</NavLink>
        <NavLink to="/prizes">Prizes</NavLink>
      </nav>
      <div className="site-header__tools">
        <div className="stat" title="Stickers peeled so far">
          <span className="stat__value">{peels}</span>
          <span className="stat__label">peeled</span>
        </div>
        <div className="stat" title="Unique game stamps collected">
          <span className="stat__value">
            {collected}/{total}
          </span>
          <span className="stat__label">stamps</span>
        </div>
        <div className="segmented" role="group" aria-label="Odds mode">
          <button aria-pressed={mode === 'fun'} onClick={() => setMode('fun')} title="Boosted odds so you see variety">
            Fun
          </button>
          <button
            aria-pressed={mode === 'realistic'}
            onClick={() => setMode('realistic')}
            title="Published starting odds and finite prize pools"
          >
            Realistic
          </button>
        </div>
        <button className="icon-btn" onClick={() => setHistoryOpen(true)} aria-label="Peel history" title="History">
          <HistoryIcon />
        </button>
        <button
          className="icon-btn"
          onClick={() => setMuted(!muted)}
          aria-label={muted ? 'Unmute sound' : 'Mute sound'}
          aria-pressed={muted}
          title={muted ? 'Sound off' : 'Sound on'}
        >
          {muted ? <SoundOffIcon /> : <SoundOnIcon />}
        </button>
      </div>
      {historyOpen && <HistoryDrawer onClose={() => setHistoryOpen(false)} />}
    </header>
  )
}
