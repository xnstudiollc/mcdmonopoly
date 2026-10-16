import type { DrawMode, GameData } from './types.ts'

const inUnit = (v: number) => Number.isFinite(v) && v >= 0 && v <= 1

export function validateGameData(data: GameData): string[] {
  const errors: string[] = []
  const { properties, prizes, odds, items, board } = data

  const numbers = new Set<number>()
  for (const p of properties.properties) {
    if (numbers.has(p.number)) errors.push(`properties: duplicate stamp number #${p.number}`)
    numbers.add(p.number)
    if (!properties.groups.some((g) => g.id === p.groupId))
      errors.push(`properties: #${p.number} references unknown group "${p.groupId}"`)
    if (!properties.sets.some((s) => s.id === p.setId))
      errors.push(`properties: #${p.number} references unknown set "${p.setId}"`)
  }
  const sorted = [...numbers].sort((a, b) => a - b)
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!
    const cur = sorted[i]!
    for (let n = prev + 1; n < cur; n++) errors.push(`properties: missing stamp number #${n}`)
  }

  for (const s of properties.sets) {
    if (s.stamps.length === 0) errors.push(`sets: ${s.id} has no stamps`)
    for (const n of s.stamps)
      if (!numbers.has(n)) errors.push(`sets: ${s.id} requires unknown stamp #${n}`)
    if (s.rareStamp !== null && !s.stamps.includes(s.rareStamp))
      errors.push(`sets: ${s.id} rare stamp #${s.rareStamp} is not part of the set`)
    if (!(s.oddsOneIn > 0)) errors.push(`sets: ${s.id} has invalid odds ${s.oddsOneIn}`)
  }

  const prizeIds = new Set<string>()
  for (const p of prizes.prizes) {
    if (prizeIds.has(p.id)) errors.push(`prizes: duplicate prize id "${p.id}"`)
    prizeIds.add(p.id)
  }

  for (const i of odds.instant) {
    if (!prizeIds.has(i.prizeId)) errors.push(`odds: unknown prize id "${i.prizeId}"`)
    if (!(Number.isFinite(i.oddsOneIn) && i.oddsOneIn >= 1))
      errors.push(`odds: "${i.prizeId}" has invalid odds_one_in ${i.oddsOneIn}`)
  }
  for (const r of odds.rareStamps) {
    if (!numbers.has(r.stampNumber)) errors.push(`odds: rare stamp #${r.stampNumber} does not exist`)
    if (!(Number.isFinite(r.oddsOneIn) && r.oddsOneIn >= 1))
      errors.push(`odds: rare stamp #${r.stampNumber} has invalid odds_one_in ${r.oddsOneIn}`)
  }
  if (!(odds.commonStampWeight > 0)) errors.push('odds: commonStampWeight must be greater than 0')
  for (const mode of ['fun', 'realistic'] as DrawMode[]) {
    const m = odds.modes[mode]
    if (!m) {
      errors.push(`odds: missing mode "${mode}"`)
      continue
    }
    if (!(m.instantExponent > 0)) errors.push(`odds: ${mode}.instantExponent must be greater than 0`)
    if (!(m.rareExponent > 0)) errors.push(`odds: ${mode}.rareExponent must be greater than 0`)
    if (m.instantChance !== null && !(m.instantChance > 0 && m.instantChance <= 1))
      errors.push(`odds: ${mode}.instantChance must be in (0, 1] or null`)
  }

  const itemIds = new Set<string>()
  for (const item of items) {
    if (itemIds.has(item.id)) errors.push(`items: duplicate item id "${item.id}"`)
    itemIds.add(item.id)
    if (!item.image) errors.push(`items: "${item.id}" has no image`)
    if (item.stock !== null && !(Number.isInteger(item.stock) && item.stock >= 0))
      errors.push(`items: "${item.id}" stock must be null or a non-negative integer`)
    if (item.stickers.length === 0) errors.push(`items: "${item.id}" has no stickers`)
    const stickerIds = new Set<string>()
    for (const s of item.stickers) {
      if (stickerIds.has(s.id)) errors.push(`items: "${item.id}" duplicate sticker id "${s.id}"`)
      stickerIds.add(s.id)
      if (!inUnit(s.x) || !inUnit(s.y))
        errors.push(`items: "${item.id}/${s.id}" x/y must be within 0..1 (got ${s.x}, ${s.y})`)
      if (!(s.size > 0 && s.size <= 1))
        errors.push(`items: "${item.id}/${s.id}" size must be within (0, 1] (got ${s.size})`)
      if (!Number.isFinite(s.rotation))
        errors.push(`items: "${item.id}/${s.id}" rotation must be a number`)
    }
  }

  const spaceNumbers = new Set<number>()
  for (const s of board.spaces) {
    if (spaceNumbers.has(s.stampNumber))
      errors.push(`boardSpaces: duplicate space for #${s.stampNumber}`)
    spaceNumbers.add(s.stampNumber)
    if (!numbers.has(s.stampNumber)) errors.push(`boardSpaces: unknown stamp #${s.stampNumber}`)
    if (![s.x, s.y, s.w, s.h].every(inUnit) || s.x + s.w > 1.0001 || s.y + s.h > 1.0001)
      errors.push(`boardSpaces: #${s.stampNumber} rectangle is outside the board`)
  }
  for (const n of numbers)
    if (!spaceNumbers.has(n)) errors.push(`boardSpaces: no board space for stamp #${n}`)

  return errors
}
