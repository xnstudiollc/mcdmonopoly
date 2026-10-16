export interface Rng {
  next(): number
}

export const mathRandom: Rng = { next: () => Math.random() }

export function seededRng(seed: number): Rng {
  let a = seed >>> 0
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0
      let t = a
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
  }
}

let current: Rng = mathRandom

export const getRng = (): Rng => current

export const setRng = (rng: Rng): void => {
  current = rng
}

export function pickWeighted<T>(entries: readonly { value: T; weight: number }[], rng: Rng): T {
  const total = entries.reduce((sum, e) => sum + Math.max(0, e.weight), 0)
  if (total <= 0) throw new Error('pickWeighted: no positive weights')
  let roll = rng.next() * total
  for (const e of entries) {
    if (e.weight <= 0) continue
    roll -= e.weight
    if (roll < 0) return e.value
  }
  const last = [...entries].reverse().find((e) => e.weight > 0)
  return last!.value
}
