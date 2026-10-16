import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Modal } from '../components/Modal.tsx'
import { StampCard } from '../components/StampCard.tsx'
import { setProgress } from '../engine/collection.ts'
import { gameData, getGroup, getProperty, getSet } from '../engine/data.ts'
import { remaining } from '../engine/draw.ts'
import { stampCardSpec } from '../lib/cards.ts'
import { downloadBoardPng } from '../lib/share.ts'
import { useGame } from '../state/store.ts'

export function BoardPage() {
  const collection = useGame((s) => s.collection)
  const mode = useGame((s) => s.mode)
  const reset = useGame((s) => s.reset)
  const [params] = useSearchParams()
  const debug = params.get('debug') === '1'
  const [selected, setSelected] = useState<number | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [sharing, setSharing] = useState(false)
  const { board, properties } = gameData
  const total = properties.properties.length
  const have = collection.collected.length
  const progress = setProgress(gameData, collection)

  const share = async () => {
    setSharing(true)
    try {
      await downloadBoardPng(collection)
    } finally {
      setSharing(false)
    }
  }

  return (
    <main className="board-page">
      <div className="board-wrap">
        <div className={`board${debug ? ' board--debug' : ''}`}>
          <img src={board.image} alt="McDonald's Monopoly Canada 2026 game board" draggable={false} />
          {board.spaces.map((s) => {
            const prop = getProperty(s.stampNumber)
            const owned = collection.collected.includes(s.stampNumber)
            return (
              <button
                key={s.stampNumber}
                className={`space space--${s.side}${owned ? ' is-owned' : ''}`}
                style={{
                  left: `${s.x * 100}%`,
                  top: `${s.y * 100}%`,
                  width: `${s.w * 100}%`,
                  height: `${s.h * 100}%`,
                }}
                onClick={() => setSelected(s.stampNumber)}
                aria-label={`${prop?.name} #${s.stampNumber}, ${owned ? 'collected' : 'not collected'}`}
              >
                {debug && <span className="space__debug">#{s.stampNumber}</span>}
              </button>
            )
          })}
        </div>
      </div>

      <aside className="board-side">
        <div className="progress-card">
          <div className="progress-card__count">
            <strong>{have}</strong> / {total} collected
          </div>
          <div className="progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={have}>
            <span style={{ width: `${(have / total) * 100}%` }} />
          </div>
          <div className="muted small">
            {collection.peels} peeled · {collection.completedSets.length} of {properties.sets.length} sets complete ·{' '}
            {Object.values(collection.instantWins).reduce((a, b) => a + b, 0)} instant wins
          </div>
        </div>

        <ul className="set-list">
          {progress.map(({ set, have: got, complete }) => {
            const group = getGroup(set.groupId)
            return (
              <li key={set.id} className={`set-row${complete ? ' is-complete' : ''}`}>
                <span className="set-row__swatch" style={{ background: group?.color }} aria-hidden="true" />
                <div className="set-row__body">
                  <div className="set-row__names">
                    {set.stamps.map((n, i) => (
                      <span key={n} className={collection.collected.includes(n) ? 'have' : 'missing'}>
                        {getProperty(n)?.name}
                        {i < set.stamps.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                    <span className="set-row__count">
                      {' '}
                      {got} / {set.stamps.length}
                    </span>
                  </div>
                  <div className="set-row__prize">
                    {complete ? 'Won: ' : ''}
                    {set.prize}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        <div className="row">
          <button className="btn btn--primary" onClick={() => void share()} disabled={sharing}>
            {sharing ? 'Rendering…' : 'Share my board'}
          </button>
          <button className="btn btn--danger" onClick={() => setConfirmReset(true)}>
            Reset progress
          </button>
        </div>
        <p className="muted small">
          Tap any property for details. <Link to="/board?debug=1">Show space outlines</Link>
        </p>
      </aside>

      {selected !== null && (
        <SpaceDetails number={selected} onClose={() => setSelected(null)} mode={mode} />
      )}

      {confirmReset && (
        <Modal title="Reset progress?" onClose={() => setConfirmReset(false)}>
          <p>This clears every collected stamp, instant win, peel count, history entry and item stock. It can't be undone.</p>
          <div className="row">
            <button className="btn" onClick={() => setConfirmReset(false)}>
              Cancel
            </button>
            <button
              className="btn btn--danger"
              onClick={() => {
                reset()
                setConfirmReset(false)
              }}
            >
              Reset everything
            </button>
          </div>
        </Modal>
      )}
    </main>
  )
}

function SpaceDetails({ number, onClose, mode }: { number: number; onClose: () => void; mode: 'fun' | 'realistic' }) {
  const collection = useGame((s) => s.collection)
  const prop = getProperty(number)
  if (!prop) return null
  const set = getSet(prop.setId)
  const group = getGroup(prop.groupId)
  const owned = collection.collected.includes(number)
  const pulled = collection.stampCounts[String(number)] ?? 0
  const left = set ? remaining(gameData, collection, set.id) : 0

  return (
    <Modal title={`${prop.name} #${number}`} onClose={onClose}>
      <div className="space-details">
        <StampCard spec={stampCardSpec(number)} size="lg" dimmed={!owned} />
        <dl className="facts">
          <dt>Status</dt>
          <dd>{owned ? `Collected (pulled ${pulled}×, ${Math.max(0, pulled - 1)} duplicate${pulled - 1 === 1 ? '' : 's'} discarded)` : 'Not collected yet'}</dd>
          <dt>Colour group</dt>
          <dd>
            <span className="swatch" style={{ background: group?.color }} /> {group?.name}
          </dd>
          {set && (
            <>
              <dt>Set</dt>
              <dd>
                {set.stamps.map((n) => (
                  <div key={n} className={collection.collected.includes(n) ? 'have' : 'missing'}>
                    {collection.collected.includes(n) ? '✓' : '○'} {getProperty(n)?.name} #{n}
                  </div>
                ))}
              </dd>
              <dt>Prize at stake</dt>
              <dd>{set.prize}</dd>
              <dt>Published odds</dt>
              <dd>{set.oddsDisplay} (to win the set)</dd>
              <dt>Prizes available</dt>
              <dd>
                {set.startingAvailable.toLocaleString('en-CA')} at launch
                {mode === 'realistic' && ` · ${left.toLocaleString('en-CA')} remaining in this simulator`}
              </dd>
            </>
          )}
          {prop.rare && (
            <>
              <dt>Rarity</dt>
              <dd>
                Reported rare stamp*
                <div className="muted small">*{gameData.properties.rareStampCaveat}.</div>
              </dd>
            </>
          )}
        </dl>
      </div>
    </Modal>
  )
}
