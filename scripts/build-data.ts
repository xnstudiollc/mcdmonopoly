import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  CollectSet,
  ColorGroup,
  OddsData,
  Prize,
  PrizeCategory,
  PrizesData,
  PropertiesData,
  Property,
} from '../src/engine/types.ts'

interface SourcePrize {
  category: string
  prize: string
  required_properties: { name: string; stamp_number: string }[]
  reported_rare_stamp: string
  starting_prizes_available: number
  odds_one_in: number | null
  odds_display: string
  notes: string
}

interface SourceFile {
  promotion: string
  odds_basis: string
  rare_stamp_caveat: string
  prizes: SourcePrize[]
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = JSON.parse(
  readFileSync(resolve(root, 'docs/prizes-and-odds.source.json'), 'utf8'),
) as SourceFile

// Keyed by the first stamp number of each Collect to Win set.
const GROUPS: Record<number, ColorGroup> = {
  801: { id: 'brown', name: 'Brown', color: '#955436', textColor: '#ffffff' },
  803: { id: 'light-blue', name: 'Light Blue', color: '#9fd8f2', textColor: '#10202a' },
  806: { id: 'pink', name: 'Pink', color: '#e23d8f', textColor: '#ffffff' },
  809: { id: 'orange', name: 'Orange', color: '#f89b2e', textColor: '#1a1206' },
  812: { id: 'red', name: 'Red', color: '#ed2c2b', textColor: '#ffffff' },
  815: { id: 'yellow', name: 'Yellow', color: '#ffe500', textColor: '#1a1700' },
  818: { id: 'green', name: 'Green', color: '#46b651', textColor: '#ffffff' },
  821: { id: 'dark-blue', name: 'Dark Blue', color: '#1f5fae', textColor: '#ffffff' },
  823: { id: 'airports', name: 'Airports / Transportation', color: '#393b3a', textColor: '#ffffff' },
  827: { id: 'highways', name: 'Highways / Utilities', color: '#a8a8a8', textColor: '#111111' },
}

const CATEGORY_MAP: Record<string, { id: PrizeCategory; label: string } | 'collect'> = {
  'Collect to win': 'collect',
  'Instant food': { id: 'instant-food', label: 'Instant Win: Food' },
  'Instant rewards points': { id: 'instant-points', label: 'Instant Win: MyMcDonald’s Rewards Points' },
  'Instant other': { id: 'instant-other', label: 'Instant Win' },
  'Digital Bonus Play': { id: 'digital-bonus', label: 'Digital Bonus Play' },
  'Golden Prize Draw': { id: 'golden-draw', label: 'Golden Prize Draw' },
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const parseRare = (text: string): number | null => {
  const m = /#(\d{3})/.exec(text)
  return m ? Number(m[1]) : null
}

const groups: ColorGroup[] = []
const properties: Property[] = []
const sets: CollectSet[] = []
const prizes: Prize[] = []
const odds: OddsData = {
  modes: {
    fun: { instantExponent: 0.35, instantChance: 0.45, rareExponent: 0.3, usePools: false },
    realistic: { instantExponent: 1, instantChance: null, rareExponent: 1, usePools: true },
  },
  commonStampWeight: 1,
  instant: [],
  rareStamps: [],
}

for (const entry of source.prizes) {
  const category = CATEGORY_MAP[entry.category]
  if (!category) throw new Error(`Unknown category "${entry.category}"`)

  if (category === 'collect') {
    const stamps = entry.required_properties.map((p) => Number(p.stamp_number))
    const first = stamps[0]
    const group = first === undefined ? undefined : GROUPS[first]
    if (!group) throw new Error(`No colour group configured for set starting at #${first}`)
    if (entry.odds_one_in === null) throw new Error(`Collect to Win "${entry.prize}" has no odds`)
    const setId = `set-${group.id}`
    const rareStamp = parseRare(entry.reported_rare_stamp)
    groups.push(group)
    sets.push({
      id: setId,
      groupId: group.id,
      prize: entry.prize,
      stamps,
      rareStamp,
      startingAvailable: entry.starting_prizes_available,
      oddsOneIn: entry.odds_one_in,
      oddsDisplay: entry.odds_display,
    })
    for (const p of entry.required_properties) {
      const number = Number(p.stamp_number)
      properties.push({ number, name: p.name, groupId: group.id, setId, rare: number === rareStamp })
    }
    if (rareStamp !== null) {
      odds.rareStamps.push({ stampNumber: rareStamp, setId, oddsOneIn: entry.odds_one_in })
    }
    continue
  }

  const id = `${category.id}-${slug(entry.prize)}`
  const drawable = category.id.startsWith('instant-') && entry.odds_one_in !== null
  prizes.push({
    id,
    name: entry.prize,
    category: category.id,
    categoryLabel: category.label,
    startingAvailable: entry.starting_prizes_available,
    oddsOneIn: entry.odds_one_in,
    oddsDisplay: entry.odds_display,
    notes: entry.notes,
    drawable,
  })
  if (drawable && entry.odds_one_in !== null) {
    odds.instant.push({ prizeId: id, oddsOneIn: entry.odds_one_in })
  }
}

properties.sort((a, b) => a.number - b.number)

const propertiesData: PropertiesData = {
  rareStampCaveat: source.rare_stamp_caveat,
  groups,
  properties,
  sets,
}
const prizesData: PrizesData = {
  promotion: source.promotion,
  oddsBasis: source.odds_basis,
  prizes,
}

const write = (name: string, data: unknown) => {
  writeFileSync(resolve(root, 'src/data', name), JSON.stringify(data, null, 2) + '\n')
  console.log(`wrote src/data/${name}`)
}

write('properties.json', propertiesData)
write('prizes.json', prizesData)
write('odds.json', odds)
console.log(
  `${properties.length} stamps, ${sets.length} sets, ${prizes.length} prizes (${odds.instant.length} drawable instant wins)`,
)
