import { remaining } from './draw.ts'
import type { DrawMode, GameData, Outcome } from './types.ts'

export interface CollectionState {
  collected: number[]
  stampCounts: Record<string, number>
  completedSets: string[]
  instantWins: Record<string, number>
  pools: Record<string, number>
  peels: number
}

export interface ApplyResult {
  state: CollectionState
  isNewStamp: boolean
  newlyCompletedSets: string[]
  instantPrizeId: string | null
}

export const emptyCollection = (): CollectionState => ({
  collected: [],
  stampCounts: {},
  completedSets: [],
  instantWins: {},
  pools: {},
  peels: 0,
})

export function applyOutcome(
  data: GameData,
  mode: DrawMode,
  state: CollectionState,
  outcome: Outcome,
): ApplyResult {
  const usePools = data.odds.modes[mode].usePools
  const isNewStamp = !state.collected.includes(outcome.stampNumber)
  const collected = isNewStamp
    ? [...state.collected, outcome.stampNumber].sort((a, b) => a - b)
    : state.collected
  const key = String(outcome.stampNumber)
  const stampCounts = { ...state.stampCounts, [key]: (state.stampCounts[key] ?? 0) + 1 }
  const pools = { ...state.pools }

  let instantPrizeId = outcome.instantPrizeId
  const instantWins = { ...state.instantWins }
  if (instantPrizeId !== null) {
    if (usePools && remaining(data, state, instantPrizeId) <= 0) {
      instantPrizeId = null
    } else {
      instantWins[instantPrizeId] = (instantWins[instantPrizeId] ?? 0) + 1
      if (usePools) pools[instantPrizeId] = remaining(data, state, instantPrizeId) - 1
    }
  }

  const newlyCompletedSets: string[] = []
  if (isNewStamp) {
    for (const set of data.properties.sets) {
      if (state.completedSets.includes(set.id)) continue
      if (!set.stamps.includes(outcome.stampNumber)) continue
      if (set.stamps.every((n) => collected.includes(n))) {
        newlyCompletedSets.push(set.id)
        if (usePools) pools[set.id] = Math.max(0, remaining(data, state, set.id) - 1)
      }
    }
  }

  return {
    state: {
      collected,
      stampCounts,
      completedSets: [...state.completedSets, ...newlyCompletedSets],
      instantWins,
      pools,
      peels: state.peels + 1,
    },
    isNewStamp,
    newlyCompletedSets,
    instantPrizeId,
  }
}

export function setProgress(data: GameData, state: CollectionState) {
  return data.properties.sets.map((set) => ({
    set,
    have: set.stamps.filter((n) => state.collected.includes(n)).length,
    complete: state.completedSets.includes(set.id),
  }))
}
