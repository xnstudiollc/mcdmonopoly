import { pickWeighted, type Rng } from './rng.ts'
import type { DrawMode, GameData, Outcome } from './types.ts'

export interface PoolState {
  pools: Record<string, number>
}

export function remaining(data: GameData, state: PoolState, id: string): number {
  const stored = state.pools[id]
  if (stored !== undefined) return stored
  const set = data.properties.sets.find((s) => s.id === id)
  if (set) return set.startingAvailable
  const prize = data.prizes.prizes.find((p) => p.id === id)
  return prize ? prize.startingAvailable : 0
}

export function stampProbabilities(
  data: GameData,
  mode: DrawMode,
  state: PoolState,
): Map<number, number> {
  const config = data.odds.modes[mode]
  const rare = new Map<number, number>()
  for (const r of data.odds.rareStamps) {
    const exhausted = config.usePools && remaining(data, state, r.setId) <= 0
    rare.set(r.stampNumber, exhausted ? 0 : Math.pow(1 / r.oddsOneIn, config.rareExponent))
  }
  let rareTotal = [...rare.values()].reduce((a, b) => a + b, 0)
  if (rareTotal > 0.95) {
    const scale = 0.95 / rareTotal
    for (const [k, v] of rare) rare.set(k, v * scale)
    rareTotal = 0.95
  }

  const commons = data.properties.properties.filter((p) => !rare.has(p.number))
  const commonShare = (1 - rareTotal) / commons.length
  const result = new Map<number, number>()
  for (const p of data.properties.properties) {
    result.set(p.number, rare.get(p.number) ?? commonShare)
  }
  return result
}

export function instantProbabilities(
  data: GameData,
  mode: DrawMode,
  state: PoolState,
): { prizeId: string; probability: number }[] {
  const config = data.odds.modes[mode]
  const available = data.odds.instant.filter(
    (i) => !config.usePools || remaining(data, state, i.prizeId) > 0,
  )
  const weights = available.map((i) => ({
    prizeId: i.prizeId,
    weight: Math.pow(1 / i.oddsOneIn, config.instantExponent),
  }))

  if (config.instantChance === null) {
    const total = weights.reduce((a, w) => a + w.weight, 0)
    const scale = total > 0.95 ? 0.95 / total : 1
    return weights.map((w) => ({ prizeId: w.prizeId, probability: w.weight * scale }))
  }

  const total = weights.reduce((a, w) => a + w.weight, 0)
  if (total <= 0) return []
  return weights.map((w) => ({
    prizeId: w.prizeId,
    probability: (config.instantChance as number) * (w.weight / total),
  }))
}

export function drawOutcome(data: GameData, mode: DrawMode, state: PoolState, rng: Rng): Outcome {
  const stamps = stampProbabilities(data, mode, state)
  const stampNumber = pickWeighted(
    [...stamps].map(([value, weight]) => ({ value, weight })),
    rng,
  )

  const instants = instantProbabilities(data, mode, state)
  const hit = instants.reduce((a, i) => a + i.probability, 0)
  let instantPrizeId: string | null = null
  if (hit > 0 && rng.next() < hit) {
    instantPrizeId = pickWeighted(
      instants.map((i) => ({ value: i.prizeId, weight: i.probability })),
      rng,
    )
  }
  return { stampNumber, instantPrizeId }
}
