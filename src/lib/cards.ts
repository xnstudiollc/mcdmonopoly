import { getGroup, getPrize, getProperty, getSet } from '../engine/data.ts'
import type { Outcome } from '../engine/types.ts'
import type { CardSpec } from '../peel/textures.ts'

export function stampCardSpec(stampNumber: number, instantPrizeId: string | null = null): CardSpec {
  const prop = getProperty(stampNumber)
  const set = prop ? getSet(prop.setId) : undefined
  const group = prop ? getGroup(prop.groupId) : undefined
  return {
    title: prop?.name ?? `Stamp ${stampNumber}`,
    number: `#${stampNumber}`,
    requires: set ? `REQ. ${set.stamps.join(', ')}` : '',
    prizeLabel: 'Collect to win',
    prize: set?.prize ?? '',
    accent: group?.color ?? '#999999',
    instant: instantPrizeId ? (getPrize(instantPrizeId)?.name ?? null) : null,
    rare: prop?.rare ?? false,
  }
}

export const outcomeCardSpec = (o: Outcome): CardSpec => stampCardSpec(o.stampNumber, o.instantPrizeId)

export const formatOdds = (oneIn: number | null) =>
  oneIn === null ? '—' : `1 in ${oneIn.toLocaleString('en-CA')}`

export const newSessionId = (itemId: string) => `${itemId}-${Date.now().toString(36)}`
