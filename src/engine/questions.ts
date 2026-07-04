// Question generation for every puzzle mode, plus the infinite run's
// difficulty schedule. Each puzzle carries its own freshly generated town.

import type { Cell, EgoDir, Heading, Pose } from './dir'
import { EGO_DIRS, dirVec, egoNeighbor, sameCell, turnLeft, turnRight } from './dir'
import type { Rng } from './rng'
import { makeRng, pick, randInt, shuffle } from './rng'
import type { Town } from './town'
import { canStep, cellAt, generateTown, randomPose, stepIntersection } from './town'

export type Instruction = { type: 'forward'; blocks: number } | { type: 'turn'; dir: 'left' | 'right' }

interface QBase {
  town: Town
  /** Extra rotation applied to the map display, in degrees (kiosk mode). */
  mapRotation: number
}

export type Question =
  | (QBase & { mode: 'tap-cell'; pose: Pose; ego: EgoDir; target: Cell })
  | (QBase & { mode: 'compass-walk'; pose: Pose; cardinal: Heading; target: Cell })
  | (QBase & {
      mode: 'follow-route'
      pose: Pose
      instructions: Instruction[]
      expected: Pose
      hideCharacter: boolean
    })
  | (QBase & { mode: 'where-am-i'; viewPose: Pose; options: Pose[]; correctIndex: number })
  | (QBase & { mode: 'which-view'; pose: Pose; options: Pose[]; correctIndex: number })

export type Mode = Question['mode']

export interface PuzzleConfig {
  headings: Heading[]
  mapRotations: number[]
  egoDirs?: EgoDir[]
  instructionRange?: [number, number]
  hideCharacter?: boolean
  optionCount?: number
  townSize: number
}

export const HEARTS = 3

export interface ModeInfo {
  title: string
  /** One-paragraph "how to think about it", shown when the mode first appears. */
  lesson: string
}

export const MODE_INFO: Record<Mode, ModeInfo> = {
  'tap-cell': {
    title: 'Body Compass',
    lesson:
      'The arrow on the map is you. “Left” means the arrow’s left — not the left of your screen. Trick: imagine turning the map in your head until the arrow points up. Then left is left again.',
  },
  'compass-walk': {
    title: 'Compass Steps',
    lesson:
      'North is up on the map — but you might be facing east. To walk north, first work out where north is compared to your nose, turn until you face it, then step. Watch the little compass: it never lies.',
  },
  'follow-route': {
    title: 'The Delivery Note',
    lesson:
      'After every turn, your left and right change! Keep asking: “which way am I facing NOW?” Say it out loud if it helps. The directions are from your point of view at each moment, not from the map’s.',
  },
  'where-am-i': {
    title: 'Lost & Found',
    lesson:
      'Look at the street view like a detective: what’s on your LEFT, what’s on your RIGHT, what’s far AHEAD? Then find the one arrow on the map that would see exactly that. Two spots can face the same building — but its side changes.',
  },
  'which-view': {
    title: 'Postcards',
    lesson:
      'Same street corner, four directions, four completely different views. Before peeking at the postcards, read the map: “facing that way, the café should be on my right.” Then find the postcard that agrees.',
  },
}

/**
 * The infinite run's difficulty curve. Each entry becomes available at
 * minLevel and (optionally) retires at maxLevel once it's too easy.
 */
export interface ScheduleEntry {
  minLevel: number
  maxLevel?: number
  mode: Mode
  cfg: PuzzleConfig
}

const ALL: Heading[] = [0, 1, 2, 3]
const TWIST = [90, 180, 270]

export const SCHEDULE: ScheduleEntry[] = [
  // gentle start: facing up, left/right only
  { minLevel: 1, maxLevel: 6, mode: 'tap-cell', cfg: { headings: [0], egoDirs: ['left', 'right'], mapRotations: [0], townSize: 7 } },
  // any facing
  { minLevel: 3, maxLevel: 24, mode: 'tap-cell', cfg: { headings: ALL, egoDirs: ['left', 'right', 'ahead', 'behind'], mapRotations: [0], townSize: 7 } },
  { minLevel: 5, maxLevel: 14, mode: 'compass-walk', cfg: { headings: [0], mapRotations: [0], townSize: 7 } },
  { minLevel: 7, maxLevel: 20, mode: 'which-view', cfg: { headings: ALL, optionCount: 2, mapRotations: [0], townSize: 7 } },
  { minLevel: 9, mode: 'compass-walk', cfg: { headings: ALL, mapRotations: [0], townSize: 7 } },
  { minLevel: 11, maxLevel: 28, mode: 'follow-route', cfg: { headings: ALL, instructionRange: [2, 3], mapRotations: [0], townSize: 7 } },
  { minLevel: 14, mode: 'where-am-i', cfg: { headings: ALL, optionCount: 3, mapRotations: [0], townSize: 7 } },
  { minLevel: 17, mode: 'which-view', cfg: { headings: ALL, optionCount: 4, mapRotations: [0], townSize: 7 } },
  // the twist: map no longer points north
  { minLevel: 20, mode: 'tap-cell', cfg: { headings: ALL, egoDirs: ['left', 'right', 'ahead', 'behind'], mapRotations: TWIST, townSize: 7 } },
  { minLevel: 23, mode: 'follow-route', cfg: { headings: ALL, instructionRange: [4, 5], mapRotations: [0], townSize: 9 } },
  { minLevel: 26, mode: 'where-am-i', cfg: { headings: ALL, optionCount: 4, mapRotations: [0], townSize: 9 } },
  { minLevel: 29, mode: 'compass-walk', cfg: { headings: ALL, mapRotations: TWIST, townSize: 7 } },
  { minLevel: 33, mode: 'which-view', cfg: { headings: ALL, optionCount: 4, mapRotations: TWIST, townSize: 7 } },
  // fog: navigate the note without seeing yourself
  { minLevel: 37, mode: 'follow-route', cfg: { headings: ALL, instructionRange: [4, 5], mapRotations: [0], hideCharacter: true, townSize: 9 } },
]

/** How far the street view can see, in ego blocks. Keep in sync with StreetView. */
export const VIEW_DEPTH = 5

/**
 * What a pose sees, serialized. Two poses with different signatures are
 * distinguishable in the street view; we use this to guarantee questions
 * have exactly one defensible answer.
 */
export function sceneSignature(town: Town, pose: Pose): string {
  const parts: string[] = []
  for (let f = 0; f <= VIEW_DEPTH; f++) {
    for (const s of [-1, 0, 1]) {
      const c = visibleCell(town, pose, f, s)
      parts.push(c ? JSON.stringify(c) : '~')
    }
  }
  return parts.join('|')
}

/** World cell at ego coords (forward f, side s) from pose, or null. */
export function visibleCell(town: Town, pose: Pose, f: number, s: number) {
  const c = egoToWorld(pose, f, s)
  return cellAt(town, c)
}

/** World coordinates of ego point (forward f, side s) from pose. */
export function egoToWorld(pose: Pose, f: number, s: number): Cell {
  const v = dirVec(pose.heading)
  const r = dirVec(turnRight(pose.heading))
  return { x: pose.x + v.x * f + r.x * s, y: pose.y + v.y * f + r.y * s }
}

function pickRotation(rng: Rng, tier: PuzzleConfig): number {
  return pick(rng, tier.mapRotations)
}

function genTapCell(rng: Rng, tier: PuzzleConfig): Question {
  const town = generateTown(rng, tier.townSize)
  const pose = randomPose(rng, town, tier.headings)
  const ego = pick(rng, tier.egoDirs ?? EGO_DIRS)
  return { mode: 'tap-cell', town, pose, ego, target: egoNeighbor(pose, ego), mapRotation: pickRotation(rng, tier) }
}

function genCompassWalk(rng: Rng, tier: PuzzleConfig): Question {
  const town = generateTown(rng, tier.townSize)
  for (let attempt = 0; attempt < 50; attempt++) {
    const pose = randomPose(rng, town, tier.headings)
    const cardinals = ([0, 1, 2, 3] as Heading[]).filter((h) =>
      canStep(town, { ...pose, heading: h }),
    )
    if (cardinals.length === 0) continue
    const cardinal = pick(rng, cardinals)
    const target = stepIntersection(town, { ...pose, heading: cardinal })
    return { mode: 'compass-walk', town, pose, cardinal, target, mapRotation: pickRotation(rng, tier) }
  }
  throw new Error('could not generate compass-walk question')
}

/** Simulate instructions from a pose. Returns null if the route leaves town. */
export function runInstructions(town: Town, start: Pose, instructions: Instruction[]): Pose | null {
  let p = start
  for (const ins of instructions) {
    if (ins.type === 'turn') {
      p = { ...p, heading: ins.dir === 'left' ? turnLeft(p.heading) : turnRight(p.heading) }
    } else {
      for (let i = 0; i < ins.blocks; i++) {
        if (!canStep(town, p)) return null
        p = stepIntersection(town, p)
      }
    }
  }
  return p
}

function genFollowRoute(rng: Rng, tier: PuzzleConfig): Question {
  const town = generateTown(rng, tier.townSize)
  const [minIns, maxIns] = tier.instructionRange ?? [2, 3]
  for (let attempt = 0; attempt < 200; attempt++) {
    const start = randomPose(rng, town, tier.headings)
    const count = randInt(rng, minIns, maxIns + 1)
    const instructions: Instruction[] = []
    let p = start
    let ok = true
    for (let i = 0; i < count; i++) {
      const wantTurn = i > 0 && instructions[i - 1].type === 'forward' && rng() < 0.7
      if (wantTurn) {
        const dir = rng() < 0.5 ? 'left' : 'right'
        instructions.push({ type: 'turn', dir })
        p = { ...p, heading: dir === 'left' ? turnLeft(p.heading) : turnRight(p.heading) }
      } else {
        const blocks = randInt(rng, 1, 3)
        const after = runInstructions(town, p, [{ type: 'forward', blocks }])
        if (!after) {
          ok = false
          break
        }
        instructions.push({ type: 'forward', blocks })
        p = after
      }
    }
    if (!ok || instructions.every((i) => i.type === 'turn')) continue
    if (sameCell(p, start)) continue
    return {
      mode: 'follow-route',
      town,
      pose: start,
      instructions,
      expected: p,
      hideCharacter: tier.hideCharacter ?? false,
      mapRotation: pickRotation(rng, tier),
    }
  }
  throw new Error('could not generate follow-route question')
}

function genWhereAmI(rng: Rng, tier: PuzzleConfig): Question {
  const optionCount = tier.optionCount ?? 3
  for (let attempt = 0; attempt < 100; attempt++) {
    const town = generateTown(rng, tier.townSize)
    const answer = randomPose(rng, town, tier.headings)
    const sig = sceneSignature(town, answer)
    const distractors: Pose[] = []
    let guard = 0
    while (distractors.length < optionCount - 1 && guard++ < 200) {
      const wantSameCell = distractors.length === 0 && rng() < 0.6
      const d: Pose = wantSameCell
        ? { ...answer, heading: pick(rng, ([0, 1, 2, 3] as Heading[]).filter((h) => h !== answer.heading)) }
        : randomPose(rng, town)
      if (d.x === answer.x && d.y === answer.y && d.heading === answer.heading) continue
      if (distractors.some((o) => o.x === d.x && o.y === d.y && o.heading === d.heading)) continue
      if (sceneSignature(town, d) === sig) continue
      distractors.push(d)
    }
    if (distractors.length < optionCount - 1) continue
    const options = shuffle(rng, [answer, ...distractors])
    return {
      mode: 'where-am-i',
      town,
      viewPose: answer,
      options,
      correctIndex: options.findIndex((o) => o.x === answer.x && o.y === answer.y && o.heading === answer.heading),
      mapRotation: pickRotation(rng, tier),
    }
  }
  throw new Error('could not generate where-am-i question')
}

function genWhichView(rng: Rng, tier: PuzzleConfig): Question {
  const optionCount = tier.optionCount ?? 4
  for (let attempt = 0; attempt < 100; attempt++) {
    const town = generateTown(rng, tier.townSize)
    const pose = randomPose(rng, town, tier.headings)
    const headings =
      optionCount === 2
        ? shuffle(rng, [pose.heading, turn2(pose.heading, pick(rng, [1, 2, 3]))])
        : shuffle(rng, [0, 1, 2, 3] as Heading[])
    const optionPoses = headings.map((h) => ({ ...pose, heading: h }))
    const sigs = optionPoses.map((p) => sceneSignature(town, p))
    if (new Set(sigs).size !== sigs.length) continue
    return {
      mode: 'which-view',
      town,
      pose,
      options: optionPoses,
      correctIndex: optionPoses.findIndex((p) => p.heading === pose.heading),
      mapRotation: pickRotation(rng, tier),
    }
  }
  throw new Error('could not generate which-view question')
}

function turn2(h: Heading, by: number): Heading {
  return ((((h + by) % 4) + 4) % 4) as Heading
}

/** Schedule entries playable at a level. Never empty (fallback: last entry). */
export function availableEntries(level: number): ScheduleEntry[] {
  const open = SCHEDULE.filter(
    (e) => level >= e.minLevel && (e.maxLevel === undefined || level <= e.maxLevel),
  )
  return open.length > 0 ? open : [SCHEDULE[SCHEDULE.length - 1]]
}

function generateFromEntry(rng: Rng, entry: ScheduleEntry): Question {
  switch (entry.mode) {
    case 'tap-cell':
      return genTapCell(rng, entry.cfg)
    case 'compass-walk':
      return genCompassWalk(rng, entry.cfg)
    case 'follow-route':
      return genFollowRoute(rng, entry.cfg)
    case 'where-am-i':
      return genWhereAmI(rng, entry.cfg)
    case 'which-view':
      return genWhichView(rng, entry.cfg)
  }
}

/**
 * One puzzle of the infinite run. Deterministic in (level, seed).
 * Freshly unlocked challenges are favored so the game keeps surprising;
 * `avoidMode` (the previous puzzle's mode) reduces immediate repeats.
 */
export function generatePuzzle(level: number, seed: number, avoidMode?: Mode): Question {
  const rng = makeRng(seed)
  const open = availableEntries(level)
  const weights = open.map((e) => (level - e.minLevel <= 6 ? 3 : 1))
  let entry = pickWeighted(rng, open, weights)
  if (entry.mode === avoidMode && open.some((e) => e.mode !== avoidMode)) {
    const others = open.filter((e) => e.mode !== avoidMode)
    entry = pickWeighted(rng, others, others.map((e) => (level - e.minLevel <= 6 ? 3 : 1)))
  }
  return generateFromEntry(rng, entry)
}

function pickWeighted<T>(rng: Rng, items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0)
  let roll = rng() * total
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return items[i]
  }
  return items[items.length - 1]
}

export function instructionText(ins: Instruction): string {
  if (ins.type === 'turn') return ins.dir === 'left' ? 'Turn LEFT' : 'Turn RIGHT'
  return ins.blocks === 1 ? 'Walk 1 block' : `Walk ${ins.blocks} blocks`
}
