// Town model. A town is an odd-sized grid:
//  - cells with both coords even are blocks (buildings, parks, water)
//  - cells with both coords odd are intersections (where the character stands)
//  - remaining cells are street segments
// Poses live on intersections; one "step" moves 2 cells to the next intersection.

import type { Cell, Pose, Heading } from './dir'
import { dirVec } from './dir'
import type { Rng } from './rng'
import { pick, randInt, shuffle } from './rng'

export type LandmarkId =
  | 'lighthouse'
  | 'windmill'
  | 'church'
  | 'cafe'
  | 'clocktower'
  | 'fountain'
  | 'market'
  | 'bigtree'
  | 'theater'
  | 'firestation'

export interface LandmarkDef {
  id: LandmarkId
  /** Name with article, e.g. "the lighthouse" */
  name: string
  color: string
}

export const LANDMARKS: LandmarkDef[] = [
  { id: 'lighthouse', name: 'the lighthouse', color: '#e2504c' },
  { id: 'windmill', name: 'the windmill', color: '#c98f4e' },
  { id: 'church', name: 'the church', color: '#8d99b8' },
  { id: 'cafe', name: 'the red café', color: '#d9413d' },
  { id: 'clocktower', name: 'the clock tower', color: '#caa54a' },
  { id: 'fountain', name: 'the fountain', color: '#5aa7b8' },
  { id: 'market', name: 'the market', color: '#5c9e6d' },
  { id: 'bigtree', name: 'the great oak', color: '#4c7d4f' },
  { id: 'theater', name: 'the theater', color: '#a06fae' },
  { id: 'firestation', name: 'the fire station', color: '#d97236' },
]

export const LANDMARK_BY_ID: Record<LandmarkId, LandmarkDef> = Object.fromEntries(
  LANDMARKS.map((l) => [l.id, l]),
) as Record<LandmarkId, LandmarkDef>

export type TownCell =
  | { kind: 'street' }
  | { kind: 'intersection' }
  | { kind: 'landmark'; id: LandmarkId }
  | { kind: 'house'; variant: number }
  | { kind: 'park'; variant: number }

export interface Town {
  size: number
  seed: number
  cells: TownCell[][] // indexed [y][x]
}

export function inBounds(town: Town, c: Cell): boolean {
  return c.x >= 0 && c.y >= 0 && c.x < town.size && c.y < town.size
}

export function cellAt(town: Town, c: Cell): TownCell | null {
  return inBounds(town, c) ? town.cells[c.y][c.x] : null
}

export function isIntersection(c: Cell): boolean {
  return c.x % 2 === 1 && c.y % 2 === 1
}

export function isRoad(c: Cell): boolean {
  return c.x % 2 === 1 || c.y % 2 === 1
}

/** All intersections of a town, i.e. valid character cells. */
export function intersections(town: Town): Cell[] {
  const out: Cell[] = []
  for (let y = 1; y < town.size; y += 2)
    for (let x = 1; x < town.size; x += 2) out.push({ x, y })
  return out
}

/** Can the character take one step (2 cells) forward without leaving town? */
export function canStep(town: Town, p: Pose): boolean {
  const v = dirVec(p.heading)
  return inBounds(town, { x: p.x + v.x * 2, y: p.y + v.y * 2 })
}

/** One intersection-to-intersection step. Throws if out of bounds. */
export function stepIntersection(town: Town, p: Pose): Pose {
  if (!canStep(town, p)) throw new Error('step out of bounds')
  const v = dirVec(p.heading)
  return { x: p.x + v.x * 2, y: p.y + v.y * 2, heading: p.heading }
}

/**
 * Generate a town. Blocks get a handful of unique landmarks; the rest are
 * houses and parks. Deterministic for a given (seed, size, landmarkCount).
 */
export function generateTown(rng: Rng, size = 7, landmarkCount = 6): Town {
  if (size % 2 === 0) throw new Error('town size must be odd')
  const cells: TownCell[][] = []
  const blocks: Cell[] = []
  for (let y = 0; y < size; y++) {
    const row: TownCell[] = []
    for (let x = 0; x < size; x++) {
      if (x % 2 === 1 && y % 2 === 1) row.push({ kind: 'intersection' })
      else if (x % 2 === 1 || y % 2 === 1) row.push({ kind: 'street' })
      else {
        row.push({ kind: 'house', variant: 0 }) // placeholder, filled below
        blocks.push({ x, y })
      }
    }
    cells.push(row)
  }

  const chosen = shuffle(rng, LANDMARKS).slice(0, Math.min(landmarkCount, blocks.length))
  const spots = shuffle(rng, blocks)
  chosen.forEach((lm, i) => {
    const c = spots[i]
    cells[c.y][c.x] = { kind: 'landmark', id: lm.id }
  })
  for (const c of spots.slice(chosen.length)) {
    cells[c.y][c.x] =
      rng() < 0.3
        ? { kind: 'park', variant: randInt(rng, 0, 3) }
        : { kind: 'house', variant: randInt(rng, 0, 4) }
  }

  return { size, seed: 0, cells }
}

/** Random pose on an intersection. */
export function randomPose(rng: Rng, town: Town, headings: Heading[] = [0, 1, 2, 3]): Pose {
  const c = pick(rng, intersections(town))
  return { ...c, heading: pick(rng, headings) }
}

/** Landmarks placed in the town, with their cells. */
export function placedLandmarks(town: Town): { cell: Cell; id: LandmarkId }[] {
  const out: { cell: Cell; id: LandmarkId }[] = []
  for (let y = 0; y < town.size; y++)
    for (let x = 0; x < town.size; x++) {
      const c = town.cells[y][x]
      if (c.kind === 'landmark') out.push({ cell: { x, y }, id: c.id })
    }
  return out
}
