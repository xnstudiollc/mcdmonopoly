import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { applyOutcome, emptyCollection, type ApplyResult, type CollectionState } from '../engine/collection.ts'
import { gameData, getItem } from '../engine/data.ts'
import { drawOutcome } from '../engine/draw.ts'
import { getRng } from '../engine/rng.ts'
import type { DrawMode, Outcome } from '../engine/types.ts'

export interface HistoryEntry {
  id: string
  at: number
  itemId: string
  stampNumber: number
  isNew: boolean
  instantPrizeId: string | null
  completedSets: string[]
  mode: DrawMode
}

interface GameState {
  collection: CollectionState
  history: HistoryEntry[]
  mode: DrawMode
  muted: boolean
  stockUsed: Record<string, number>
  itemsOpened: number
  setMode: (mode: DrawMode) => void
  setMuted: (muted: boolean) => void
  remainingStock: (itemId: string) => number | null
  openItem: (itemId: string) => boolean
  draw: () => Outcome
  commit: (itemId: string, outcome: Outcome) => ApplyResult
  reset: () => void
}

const HISTORY_LIMIT = 300

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      collection: emptyCollection(),
      history: [],
      mode: 'fun',
      muted: false,
      stockUsed: {},
      itemsOpened: 0,

      setMode: (mode) => set({ mode }),
      setMuted: (muted) => set({ muted }),

      remainingStock: (itemId) => {
        const item = getItem(itemId)
        if (!item || item.stock === null) return null
        return Math.max(0, item.stock - (get().stockUsed[itemId] ?? 0))
      },

      openItem: (itemId) => {
        const left = get().remainingStock(itemId)
        if (left !== null && left <= 0) return false
        set((s) => ({
          itemsOpened: s.itemsOpened + 1,
          stockUsed: left === null ? s.stockUsed : { ...s.stockUsed, [itemId]: (s.stockUsed[itemId] ?? 0) + 1 },
        }))
        return true
      },

      draw: () => {
        const { mode, collection } = get()
        return drawOutcome(gameData, mode, collection, getRng())
      },

      commit: (itemId, outcome) => {
        const { mode, collection } = get()
        const result = applyOutcome(gameData, mode, collection, outcome)
        const entry: HistoryEntry = {
          id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
          at: Date.now(),
          itemId,
          stampNumber: outcome.stampNumber,
          isNew: result.isNewStamp,
          instantPrizeId: result.instantPrizeId,
          completedSets: result.newlyCompletedSets,
          mode,
        }
        set((s) => ({
          collection: result.state,
          history: [entry, ...s.history].slice(0, HISTORY_LIMIT),
        }))
        return result
      },

      reset: () =>
        set({ collection: emptyCollection(), history: [], stockUsed: {}, itemsOpened: 0 }),
    }),
    {
      name: 'mcdmonopoly:v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        collection: s.collection,
        history: s.history,
        mode: s.mode,
        muted: s.muted,
        stockUsed: s.stockUsed,
        itemsOpened: s.itemsOpened,
      }),
    },
  ),
)
