import { gameData, getGroup, getProperty } from '../engine/data.ts'
import { instantProbabilities, remaining } from '../engine/draw.ts'
import type { PrizeCategory } from '../engine/types.ts'
import { formatOdds } from '../lib/cards.ts'
import { useGame } from '../state/store.ts'

const SECTIONS: { category: PrizeCategory; title: string; note?: string }[] = [
  { category: 'instant-food', title: 'Instant win: food' },
  { category: 'instant-points', title: 'Instant win: rewards points' },
  { category: 'instant-other', title: 'Instant win: other prizes' },
  {
    category: 'digital-bonus',
    title: 'Digital Bonus Play',
    note: 'Time-seeded in the real game with no published per-code odds, so it is listed for reference and never drawn from a sticker.',
  },
  {
    category: 'golden-draw',
    title: 'Golden Prize Draw',
    note: 'Odds depend on entries, so these are listed for reference only and never drawn from a sticker.',
  },
]

const pct = (p: number) => (p >= 0.01 ? `${(p * 100).toFixed(1)}%` : p > 0 ? `1 in ${Math.round(1 / p).toLocaleString('en-CA')}` : '0')

export function PrizeGuide() {
  const collection = useGame((s) => s.collection)
  const mode = useGame((s) => s.mode)
  const sim = new Map(instantProbabilities(gameData, mode, collection).map((p) => [p.prizeId, p.probability]))
  const { properties, prizes } = gameData

  return (
    <main className="page prize-guide">
      <h1>Prize guide</h1>
      <p className="muted">
        {prizes.promotion}. {prizes.oddsBasis}. The <strong>{mode === 'fun' ? 'Fun' : 'Realistic'}</strong> column shows the
        chance per sticker in this simulator's current mode.
      </p>

      <section>
        <h2>Collect to Win</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Set</th>
                <th>Stamps</th>
                <th>Prize</th>
                <th>Available</th>
                <th>Published odds</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {properties.sets.map((s) => {
                const g = getGroup(s.groupId)
                return (
                  <tr key={s.id}>
                    <td>
                      <span className="swatch" style={{ background: g?.color }} /> {g?.name}
                    </td>
                    <td>
                      {s.stamps.map((n) => (
                        <div key={n}>
                          {getProperty(n)?.name} #{n}
                          {n === s.rareStamp && <span className="rare-mark">*</span>}
                        </div>
                      ))}
                    </td>
                    <td>{s.prize}</td>
                    <td>
                      {s.startingAvailable.toLocaleString('en-CA')}
                      {mode === 'realistic' && <div className="muted small">{remaining(gameData, collection, s.id)} remaining</div>}
                    </td>
                    <td>{s.oddsDisplay}</td>
                    <td>{collection.completedSets.includes(s.id) ? 'Won' : `${s.stamps.filter((n) => collection.collected.includes(n)).length}/${s.stamps.length}`}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="muted small">* Reported rare stamp. {properties.rareStampCaveat}.</p>
      </section>

      {SECTIONS.map(({ category, title, note }) => {
        const list = prizes.prizes.filter((p) => p.category === category)
        if (list.length === 0) return null
        const drawable = list.some((p) => p.drawable)
        return (
          <section key={category}>
            <h2>{title}</h2>
            {note && <p className="muted small">{note}</p>}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Prize</th>
                    <th>Available</th>
                    <th>Published odds</th>
                    {drawable && <th>{mode === 'fun' ? 'Fun' : 'Realistic'} chance</th>}
                    {drawable && <th>You've won</th>}
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>
                        {p.startingAvailable.toLocaleString('en-CA')}
                        {mode === 'realistic' && p.drawable && (
                          <div className="muted small">{remaining(gameData, collection, p.id).toLocaleString('en-CA')} remaining</div>
                        )}
                      </td>
                      <td>{p.oddsOneIn !== null ? formatOdds(p.oddsOneIn) : p.oddsDisplay}</td>
                      {drawable && <td>{pct(sim.get(p.id) ?? 0)}</td>}
                      {drawable && <td>{collection.instantWins[p.id] ?? 0}</td>}
                      <td className="muted small">{p.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
    </main>
  )
}
