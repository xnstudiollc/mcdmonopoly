import { getItem, getPrize, getProperty, getSet } from '../engine/data.ts'
import { useGame } from '../state/store.ts'
import { Modal } from './Modal.tsx'

export function HistoryDrawer({ onClose }: { onClose: () => void }) {
  const history = useGame((s) => s.history)
  return (
    <Modal title="Peel history" onClose={onClose} className="modal--drawer">
      {history.length === 0 ? (
        <p className="muted">Nothing peeled yet. Pick an item and start peeling.</p>
      ) : (
        <ol className="history">
          {history.map((h) => {
            const prop = getProperty(h.stampNumber)
            const prize = h.instantPrizeId ? getPrize(h.instantPrizeId) : undefined
            return (
              <li key={h.id} className="history__row">
                <div className="history__main">
                  <strong>
                    {prop?.name} #{h.stampNumber}
                  </strong>
                  <span className={h.isNew ? 'badge badge--new' : 'badge badge--dup'}>
                    {h.isNew ? 'NEW' : 'Duplicate'}
                  </span>
                  {prize && <span className="badge badge--instant">Instant: {prize.name}</span>}
                  {h.completedSets.map((id) => (
                    <span key={id} className="badge badge--set">
                      Set complete: {getSet(id)?.prize}
                    </span>
                  ))}
                </div>
                <div className="history__meta">
                  {getItem(h.itemId)?.name ?? h.itemId} · {h.mode === 'fun' ? 'Fun' : 'Realistic'} ·{' '}
                  {new Date(h.at).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </Modal>
  )
}
