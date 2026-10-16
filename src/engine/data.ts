import boardJson from '../data/boardSpaces.json'
import itemsJson from '../data/items.json'
import oddsJson from '../data/odds.json'
import prizesJson from '../data/prizes.json'
import propertiesJson from '../data/properties.json'
import type {
  BoardData,
  CollectSet,
  ColorGroup,
  GameData,
  Item,
  OddsData,
  Prize,
  PrizesData,
  PropertiesData,
  Property,
} from './types.ts'
import { validateGameData } from './validate.ts'

export const gameData: GameData = {
  properties: propertiesJson as PropertiesData,
  prizes: prizesJson as PrizesData,
  odds: oddsJson as OddsData,
  items: itemsJson as Item[],
  board: boardJson as BoardData,
}

export const dataErrors = validateGameData(gameData)

const byNumber = new Map<number, Property>(gameData.properties.properties.map((p) => [p.number, p]))
const byGroup = new Map<string, ColorGroup>(gameData.properties.groups.map((g) => [g.id, g]))
const bySet = new Map<string, CollectSet>(gameData.properties.sets.map((s) => [s.id, s]))
const byPrize = new Map<string, Prize>(gameData.prizes.prizes.map((p) => [p.id, p]))
const byItem = new Map<string, Item>(gameData.items.map((i) => [i.id, i]))

export const getProperty = (n: number) => byNumber.get(n)
export const getGroup = (id: string) => byGroup.get(id)
export const getSet = (id: string) => bySet.get(id)
export const getPrize = (id: string) => byPrize.get(id)
export const getItem = (id: string) => byItem.get(id)
