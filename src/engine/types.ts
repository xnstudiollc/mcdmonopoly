export interface ColorGroup {
  id: string
  name: string
  color: string
  textColor: string
}

export interface Property {
  number: number
  name: string
  groupId: string
  setId: string
  rare: boolean
}

export interface CollectSet {
  id: string
  groupId: string
  prize: string
  stamps: number[]
  rareStamp: number | null
  startingAvailable: number
  oddsOneIn: number
  oddsDisplay: string
}

export type PrizeCategory =
  | 'instant-food'
  | 'instant-points'
  | 'instant-other'
  | 'digital-bonus'
  | 'golden-draw'

export interface Prize {
  id: string
  name: string
  category: PrizeCategory
  categoryLabel: string
  startingAvailable: number
  oddsOneIn: number | null
  oddsDisplay: string
  notes: string
  drawable: boolean
}

export interface PropertiesData {
  rareStampCaveat: string
  groups: ColorGroup[]
  properties: Property[]
  sets: CollectSet[]
}

export interface PrizesData {
  promotion: string
  oddsBasis: string
  prizes: Prize[]
}

export interface ModeConfig {
  instantExponent: number
  instantChance: number | null
  rareExponent: number
  usePools: boolean
}

export type DrawMode = 'fun' | 'realistic'

export interface OddsData {
  modes: Record<DrawMode, ModeConfig>
  commonStampWeight: number
  instant: { prizeId: string; oddsOneIn: number }[]
  rareStamps: { stampNumber: number; setId: string; oddsOneIn: number }[]
}

export interface StickerSpot {
  id: string
  x: number
  y: number
  size: number
  rotation: number
}

export interface Item {
  id: string
  name: string
  image: string
  placeholder?: boolean
  stock: number | null
  stickers: StickerSpot[]
}

export interface BoardSpace {
  stampNumber: number
  x: number
  y: number
  w: number
  h: number
  side: 'top' | 'right' | 'bottom' | 'left'
}

export interface BoardData {
  image: string
  width: number
  height: number
  spaces: BoardSpace[]
}

export interface GameData {
  properties: PropertiesData
  prizes: PrizesData
  odds: OddsData
  items: Item[]
  board: BoardData
}

export interface Outcome {
  stampNumber: number
  instantPrizeId: string | null
}
