import { describe, expect, it } from 'vitest'
import { applyOutcome, emptyCollection, setProgress } from './collection.ts'
import { gameData, dataErrors } from './data.ts'
import { drawOutcome, instantProbabilities, stampProbabilities } from './draw.ts'
import { pickWeighted, seededRng } from './rng.ts'
import type { GameData } from './types.ts'
import { validateGameData } from './validate.ts'

const clone = (d: GameData): GameData => structuredClone(d)

describe('data', () => {
  it('ships valid data', () => {
    expect(dataErrors).toEqual([])
  })

  it('has 28 stamps numbered 801 to 828 and 10 sets', () => {
    const numbers = gameData.properties.properties.map((p) => p.number)
    expect(numbers).toEqual(Array.from({ length: 28 }, (_, i) => 801 + i))
    expect(gameData.properties.sets).toHaveLength(10)
  })

  it('reports duplicate and missing stamp numbers, bad odds and bad coordinates', () => {
    const d = clone(gameData)
    d.properties.properties[1]!.number = 801
    d.odds.instant[0]!.oddsOneIn = 0
    d.items[0]!.stickers[0]!.x = 1.4
    d.board.spaces[0]!.w = 2
    const errors = validateGameData(d)
    expect(errors.some((e) => e.includes('duplicate stamp number #801'))).toBe(true)
    expect(errors.some((e) => e.includes('missing') || e.includes('no board space'))).toBe(true)
    expect(errors.some((e) => e.includes('invalid odds_one_in'))).toBe(true)
    expect(errors.some((e) => e.includes('x/y must be within'))).toBe(true)
    expect(errors.some((e) => e.includes('outside the board'))).toBe(true)
  })
})

describe('rng', () => {
  it('is deterministic when seeded', () => {
    const a = seededRng(42)
    const b = seededRng(42)
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()])
  })

  it('pickWeighted follows the weights', () => {
    const rng = seededRng(7)
    const counts = { a: 0, b: 0, c: 0 }
    const entries = [
      { value: 'a' as const, weight: 1 },
      { value: 'b' as const, weight: 3 },
      { value: 'c' as const, weight: 6 },
    ]
    const n = 100_000
    for (let i = 0; i < n; i++) counts[pickWeighted(entries, rng)]++
    expect(counts.a / n).toBeCloseTo(0.1, 2)
    expect(counts.b / n).toBeCloseTo(0.3, 2)
    expect(counts.c / n).toBeCloseTo(0.6, 2)
  })
})

describe('draw', () => {
  it('stamp probabilities sum to 1 and rare stamps are rarer than commons', () => {
    for (const mode of ['fun', 'realistic'] as const) {
      const probs = stampProbabilities(gameData, mode, { pools: {} })
      const total = [...probs.values()].reduce((a, b) => a + b, 0)
      expect(total).toBeCloseTo(1, 9)
      const rare = probs.get(801)!
      const common = probs.get(802)!
      expect(rare).toBeLessThan(common / 5)
    }
  })

  it('realistic instant odds match the published 1-in-N figures', () => {
    const probs = instantProbabilities(gameData, 'realistic', { pools: {} })
    const fries = probs.find((p) => p.prizeId === 'instant-food-medium-fries')!
    expect(fries.probability).toBeCloseTo(1 / 23, 9)
  })

  it('weighted distribution of drawn stamps matches the configured probabilities', () => {
    const rng = seededRng(1234)
    const probs = stampProbabilities(gameData, 'fun', { pools: {} })
    const counts = new Map<number, number>()
    const n = 200_000
    for (let i = 0; i < n; i++) {
      const o = drawOutcome(gameData, 'fun', { pools: {} }, rng)
      counts.set(o.stampNumber, (counts.get(o.stampNumber) ?? 0) + 1)
    }
    for (const [num, p] of probs) {
      const observed = (counts.get(num) ?? 0) / n
      expect(Math.abs(observed - p)).toBeLessThan(Math.max(0.003, p * 0.15))
    }
  })

  it('fun mode instant win rate matches instantChance', () => {
    const rng = seededRng(99)
    let hits = 0
    const n = 50_000
    for (let i = 0; i < n; i++) {
      if (drawOutcome(gameData, 'fun', { pools: {} }, rng).instantPrizeId) hits++
    }
    expect(hits / n).toBeCloseTo(gameData.odds.modes.fun.instantChance!, 2)
  })
})

describe('collection', () => {
  it('discards duplicate stamps', () => {
    let s = emptyCollection()
    const first = applyOutcome(gameData, 'fun', s, { stampNumber: 802, instantPrizeId: null })
    s = first.state
    const second = applyOutcome(gameData, 'fun', s, { stampNumber: 802, instantPrizeId: null })
    expect(first.isNewStamp).toBe(true)
    expect(second.isNewStamp).toBe(false)
    expect(second.state.collected).toEqual([802])
    expect(second.state.stampCounts['802']).toBe(2)
    expect(second.state.peels).toBe(2)
  })

  it('detects Collect to Win set completion exactly once', () => {
    let s = emptyCollection()
    const a = applyOutcome(gameData, 'fun', s, { stampNumber: 801, instantPrizeId: null })
    expect(a.newlyCompletedSets).toEqual([])
    s = a.state
    const b = applyOutcome(gameData, 'fun', s, { stampNumber: 802, instantPrizeId: null })
    expect(b.newlyCompletedSets).toEqual(['set-brown'])
    const c = applyOutcome(gameData, 'fun', b.state, { stampNumber: 801, instantPrizeId: null })
    expect(c.newlyCompletedSets).toEqual([])
    const progress = setProgress(gameData, c.state).find((p) => p.set.id === 'set-brown')!
    expect(progress).toMatchObject({ have: 2, complete: true })
  })

  it('depletes finite prize pools in realistic mode and stops drawing them', () => {
    const prizeId = 'instant-other-10-000-cash'
    const start = gameData.prizes.prizes.find((p) => p.id === prizeId)!.startingAvailable
    let s = emptyCollection()
    for (let i = 0; i < start; i++) {
      const r = applyOutcome(gameData, 'realistic', s, { stampNumber: 802, instantPrizeId: prizeId })
      expect(r.instantPrizeId).toBe(prizeId)
      s = r.state
    }
    expect(s.pools[prizeId]).toBe(0)
    const over = applyOutcome(gameData, 'realistic', s, { stampNumber: 802, instantPrizeId: prizeId })
    expect(over.instantPrizeId).toBeNull()
    const probs = instantProbabilities(gameData, 'realistic', s)
    expect(probs.some((p) => p.prizeId === prizeId)).toBe(false)
  })

  it('stops drawing a rare stamp once its set prize pool is empty', () => {
    const probs = stampProbabilities(gameData, 'realistic', { pools: { 'set-brown': 0 } })
    expect(probs.get(801)).toBe(0)
  })

  it('does not touch pools in fun mode', () => {
    const r = applyOutcome(gameData, 'fun', emptyCollection(), {
      stampNumber: 802,
      instantPrizeId: 'instant-other-10-000-cash',
    })
    expect(r.state.pools).toEqual({})
  })
})
