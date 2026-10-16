import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Modal } from '../components/Modal.tsx'
import { PlacementHelper } from '../components/PlacementHelper.tsx'
import { StampCard } from '../components/StampCard.tsx'
import { gameData, getItem, getPrize, getProperty, getSet } from '../engine/data.ts'
import type { Outcome } from '../engine/types.ts'
import { peelAudio } from '../lib/audio.ts'
import { newSessionId, outcomeCardSpec } from '../lib/cards.ts'
import { useReducedMotion } from '../lib/useReducedMotion.ts'
import { defaultPeelConfig } from '../peel/peelConfig.ts'
import { PeelStage } from '../peel/PeelStage.tsx'
import { useGame } from '../state/store.ts'

interface Result {
  key: string
  outcome: Outcome
  isNew: boolean
  instantPrizeId: string | null
  completedSets: string[]
}

export function PeelView() {
  const { itemId = '' } = useParams()
  const item = getItem(itemId)
  const location = useLocation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const reducedMotion = useReducedMotion()
  const draw = useGame((s) => s.draw)
  const commit = useGame((s) => s.commit)
  const openItem = useGame((s) => s.openItem)
  const remainingStock = useGame((s) => s.remainingStock)
  useGame((s) => s.stockUsed)

  const initialSession = (location.state as { session?: string } | null)?.session ?? null
  const [session, setSession] = useState<string | null>(initialSession)
  const outcomes = useRef(new Map<string, Outcome>())
  const [gone, setGone] = useState<string[]>([])
  const [results, setResults] = useState<Result[]>([])
  const [celebrate, setCelebrate] = useState<string[]>([])
  const [hint, setHint] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(true)
  const hintTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(hintTimer.current), [])

  useEffect(() => {
    if (initialSession) navigate(location.pathname + location.search, { replace: true, state: null })
  }, [initialSession, navigate, location.pathname, location.search])

  const startSession = useCallback(() => {
    if (!item) return
    if (!openItem(item.id)) return
    outcomes.current = new Map()
    setGone([])
    setResults([])
    setSession(newSessionId(item.id))
  }, [item, openItem])

  const showHint = useCallback((m: string) => {
    setHint(m)
    window.clearTimeout(hintTimer.current)
    hintTimer.current = window.setTimeout(() => setHint(null), 2200)
  }, [])

  const callbacks = useMemo(
    () => ({
      onGrab: (stickerId: string) => {
        setShowHelp(false)
        let o = outcomes.current.get(stickerId)
        if (!o) {
          o = draw()
          outcomes.current.set(stickerId, o)
        }
        return outcomeCardSpec(o)
      },
      onDetach: (stickerId: string) => {
        const o = outcomes.current.get(stickerId)
        if (!o || !item) return
        const r = commit(item.id, o)
        setResults((prev) => [
          {
            key: `${stickerId}-${Date.now()}`,
            outcome: o,
            isNew: r.isNewStamp,
            instantPrizeId: r.instantPrizeId,
            completedSets: r.newlyCompletedSets,
          },
          ...prev,
        ])
        if (r.newlyCompletedSets.length > 0) {
          window.setTimeout(() => setCelebrate(r.newlyCompletedSets), 900)
        }
      },
      onGone: (stickerId: string) => setGone((g) => (g.includes(stickerId) ? g : [...g, stickerId])),
      onHint: showHint,
    }),
    [draw, commit, item, showHint],
  )

  if (!item) {
    return (
      <main className="page page--center">
        <h1>Item not found</h1>
        <Link className="btn" to="/">
          Back to items
        </Link>
      </main>
    )
  }

  if (params.get('place') === '1') return <PlacementHelper item={item} />

  const left = remainingStock(item.id)
  const total = item.stickers.length
  const complete = session !== null && gone.length >= total
  const latest = results[0]

  return (
    <main className="peel-view">
      <div className="peel-view__bar">
        <Link to="/" className="btn btn--ghost">
          ← Items
        </Link>
        <div className="peel-view__title">
          <h1>{item.name}</h1>
          <span className="muted small">
            {session ? `${total - gone.length} of ${total} sticker${total === 1 ? '' : 's'} left` : `${total} sticker${total === 1 ? '' : 's'}`}
            {left !== null && ` · ${left} in stock`}
            {item.placeholder && ' · placeholder art'}
          </span>
        </div>
        <Link to="/board" className="btn btn--ghost">
          Board →
        </Link>
      </div>

      <div className="peel-view__stage-wrap">
        <div className="spotlight" aria-hidden="true" />
        {session ? (
          <PeelStage
            className="peel-view__stage"
            itemImage={item.image}
            stickers={item.stickers}
            sessionKey={session}
            config={defaultPeelConfig}
            reducedMotion={reducedMotion}
            audio={peelAudio}
            callbacks={callbacks}
            label={`${item.name} with ${total} Monopoly sticker${total === 1 ? '' : 's'}. Drag a sticker's edge to peel it.`}
          />
        ) : (
          <div className="peel-view__intro">
            <img src={item.image} alt={item.name} />
            <button className="btn btn--primary btn--lg" onClick={startSession} disabled={left === 0}>
              {left === 0 ? 'Sold out' : `Pull ${item.name}`}
            </button>
          </div>
        )}

        {session && showHelp && !complete && (
          <div className="peel-help" role="note">
            {reducedMotion ? (
              <>Tap a sticker to remove it.</>
            ) : (
              <>
                <strong>Grab a sticker's edge</strong> and drag it back across itself to peel. Pull fast to rip it off.
              </>
            )}
          </div>
        )}
        {hint && (
          <div className="peel-hint" role="status">
            {hint}
          </div>
        )}

        {latest && <ResultCard key={latest.key} result={latest} />}

        {complete && (
          <div className="peel-complete">
            <h2>Item complete</h2>
            <p className="muted">
              {results.filter((r) => r.isNew).length} new · {results.filter((r) => !r.isNew).length} duplicate
              {results.some((r) => r.instantPrizeId) && ` · ${results.filter((r) => r.instantPrizeId).length} instant win`}
            </p>
            <div className="row">
              <Link to="/" className="btn">
                Back to items
              </Link>
              <button className="btn btn--primary" onClick={startSession} disabled={left === 0}>
                {left === 0 ? 'Sold out' : 'Pull another'}
              </button>
            </div>
          </div>
        )}
      </div>

      {results.length > 0 && (
        <section className="peel-view__session" aria-label="This item's results">
          {results.map((r) => (
            <StampCard key={r.key} spec={outcomeCardSpec({ ...r.outcome, instantPrizeId: r.instantPrizeId })} size="sm" dimmed={!r.isNew} />
          ))}
        </section>
      )}

      {celebrate.length > 0 && <SetComplete setIds={celebrate} onClose={() => setCelebrate([])} />}
    </main>
  )
}

function ResultCard({ result }: { result: Result }) {
  const prop = getProperty(result.outcome.stampNumber)
  const prize = result.instantPrizeId ? getPrize(result.instantPrizeId) : undefined
  const spec = outcomeCardSpec({ ...result.outcome, instantPrizeId: result.instantPrizeId })
  return (
    <div className={`result-card${result.isNew ? ' is-new' : ' is-dup'}`} role="status" aria-live="polite">
      <div className="result-card__badges">
        {result.isNew ? <span className="badge badge--new">NEW!</span> : <span className="badge badge--dup">Duplicate, discarded</span>}
        {prop?.rare && <span className="badge badge--rare">Reported rare*</span>}
      </div>
      <StampCard spec={spec} size="md" dimmed={!result.isNew} />
      {prize && (
        <div className="result-card__instant">
          Instant win: <strong>{prize.name}</strong>
        </div>
      )}
      {result.outcome.instantPrizeId && !result.instantPrizeId && (
        <div className="result-card__note">That instant prize has run out in Realistic mode.</div>
      )}
      {prop?.rare && <p className="result-card__caveat">*{gameData.properties.rareStampCaveat}.</p>}
    </div>
  )
}

function SetComplete({ setIds, onClose }: { setIds: string[]; onClose: () => void }) {
  const sets = setIds.map((id) => getSet(id)).filter((s) => s !== undefined)
  return (
    <Modal title="Set complete!" onClose={onClose} className="modal--celebrate">
      <div className="confetti" aria-hidden="true">
        {Array.from({ length: 36 }, (_, i) => (
          <span key={i} style={{ '--i': i } as React.CSSProperties} />
        ))}
      </div>
      {sets.map((s) => (
        <div key={s.id} className="celebrate">
          <p className="celebrate__label">Collect to Win</p>
          <p className="celebrate__prize">{s.prize}</p>
          <p className="muted small">
            Stamps {s.stamps.map((n) => `#${n}`).join(', ')} · published odds {s.oddsDisplay}
          </p>
        </div>
      ))}
      <div className="row">
        <Link to="/board" className="btn btn--primary" onClick={onClose}>
          View board
        </Link>
        <button className="btn" onClick={onClose}>
          Keep peeling
        </button>
      </div>
    </Modal>
  )
}
