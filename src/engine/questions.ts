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

/**
 * Plain-language name for the *skill* each puzzle trains — used only for the
 * strengths readout, never shown as an in-play "challenge" banner. The game
 * itself just asks questions; this is how we tell the player, afterwards,
 * what they're good at and what to practice.
 */
export const SKILL_LABEL: Record<Mode, string> = {
  'tap-cell': 'Your left & right',
  'compass-walk': 'Compass directions',
  'follow-route': 'Following a route',
  'where-am-i': 'Placing yourself',
  'which-view': 'Picturing the view',
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

/**
 * The *salient* part of a view: only the features a player can actually read
 * at a glance — the two nearest facades (f=1), the next pair (f=3), and how
 * far the road runs. Two poses with the same salient signature look basically
 * identical, even if a tiny far-off (f=5) building differs. Picture puzzles
 * require options to differ *here*, so a marked-wrong answer never looks the
 * same as the marked-right one.
 */
export function salientSignature(town: Town, pose: Pose): string {
  let maxF = 0
  while (maxF < VIEW_DEPTH && visibleCell(town, pose, maxF + 1, 0)) maxF++
  const parts: string[] = []
  for (const f of [1, 3]) {
    for (const s of [-1, 1]) {
      const c = visibleCell(town, pose, f, s)
      if (!c) parts.push('~')
      else if (c.kind === 'landmark') parts.push('L' + c.id)
      else if (c.kind === 'house') parts.push('H' + c.variant)
      else if (c.kind === 'park') parts.push('P' + c.variant)
      else parts.push('.')
    }
  }
  parts.push('r' + maxF)
  return parts.join('|')
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
    const sig = salientSignature(town, answer)
    const distractors: Pose[] = []
    // One option per intersection: two arrows on the same cell draw on top of
    // each other into an unreadable star, and you can't tell which badge is
    // which. Keep every candidate arrow on its own corner.
    const usedCells = new Set<string>([`${answer.x},${answer.y}`])
    let guard = 0
    while (distractors.length < optionCount - 1 && guard++ < 200) {
      const d = randomPose(rng, town)
      const cellKey = `${d.x},${d.y}`
      if (usedCells.has(cellKey)) continue
      // Reject look-alikes: a distractor must differ from the answer in a
      // feature the player can actually see up close, not just far away.
      if (salientSignature(town, d) === sig) continue
      distractors.push(d)
      usedCells.add(cellKey)
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
    // Distinct up close, not just deep in the scene: no two postcards may
    // look the same at a glance.
    const sigs = optionPoses.map((p) => salientSignature(town, p))
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
 * The kind of question is just picked at random from whatever the current
 * difficulty level has unlocked; `avoidMode` (the previous puzzle's mode)
 * keeps the same kind from coming up twice in a row.
 */
export function generatePuzzle(level: number, seed: number, avoidMode?: Mode): Question {
  const rng = makeRng(seed)
  const open = availableEntries(level)
  const pool = open.some((e) => e.mode !== avoidMode) ? open.filter((e) => e.mode !== avoidMode) : open
  return generateFromEntry(rng, pick(rng, pool))
}

export function instructionText(ins: Instruction): string {
  if (ins.type === 'turn') return ins.dir === 'left' ? 'Turn LEFT' : 'Turn RIGHT'
  return ins.blocks === 1 ? 'Walk 1 block' : `Walk ${ins.blocks} blocks`
}
