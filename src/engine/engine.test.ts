import { describe, expect, it } from 'vitest'
import {
  egoNeighbor,
  egoToHeading,
  headingToEgo,
  toEgo,
  turnLeft,
  turnRight,
  type Heading,
  type Pose,
} from './dir'
import { makeRng } from './rng'
import { canStep, generateTown, intersections, isIntersection, stepIntersection } from './town'
import {
  SCHEDULE,
  availableEntries,
  egoToWorld,
  generatePuzzle,
  runInstructions,
  sceneSignature,
} from './questions'

describe('dir math', () => {
  it('turns correctly', () => {
    expect(turnLeft(0)).toBe(3)
    expect(turnRight(0)).toBe(1)
    expect(turnRight(3)).toBe(0)
    expect(turnLeft(3)).toBe(2)
  })

  it('ego -> heading: facing south, left is east', () => {
    expect(egoToHeading(2, 'left')).toBe(1)
    expect(egoToHeading(2, 'right')).toBe(3)
    expect(egoToHeading(1, 'behind')).toBe(3)
  })

  it('heading -> ego roundtrips', () => {
    for (const h of [0, 1, 2, 3] as Heading[])
      for (const ego of ['ahead', 'right', 'behind', 'left'] as const)
        expect(headingToEgo(h, egoToHeading(h, ego))).toBe(ego)
  })

  it('egoNeighbor: facing south at (3,3), left is the cell to the east', () => {
    const p: Pose = { x: 3, y: 3, heading: 2 }
    expect(egoNeighbor(p, 'left')).toEqual({ x: 4, y: 3 })
    expect(egoNeighbor(p, 'right')).toEqual({ x: 2, y: 3 })
    expect(egoNeighbor(p, 'ahead')).toEqual({ x: 3, y: 4 })
  })

  it('toEgo and egoToWorld are inverses', () => {
    const rng = makeRng(7)
    for (let i = 0; i < 200; i++) {
      const p: Pose = {
        x: Math.floor(rng() * 9),
        y: Math.floor(rng() * 9),
        heading: Math.floor(rng() * 4) as Heading,
      }
      const c = { x: Math.floor(rng() * 9), y: Math.floor(rng() * 9) }
      const e = toEgo(p, c)
      expect(egoToWorld(p, e.forward, e.side)).toEqual(c)
    }
  })
})

describe('town', () => {
  it('is deterministic for a seed', () => {
    const a = generateTown(makeRng(42), 7)
    const b = generateTown(makeRng(42), 7)
    expect(a).toEqual(b)
  })

  it('has the right structure', () => {
    const t = generateTown(makeRng(1), 7)
    expect(intersections(t)).toHaveLength(9)
    let landmarks = 0
    for (let y = 0; y < 7; y++)
      for (let x = 0; x < 7; x++) {
        const c = t.cells[y][x]
        if (x % 2 === 1 && y % 2 === 1) expect(c.kind).toBe('intersection')
        else if (x % 2 === 1 || y % 2 === 1) expect(c.kind).toBe('street')
        else expect(['landmark', 'house', 'park']).toContain(c.kind)
        if (c.kind === 'landmark') landmarks++
      }
    expect(landmarks).toBe(6)
  })

  it('steps between intersections and respects bounds', () => {
    const t = generateTown(makeRng(1), 7)
    const p: Pose = { x: 1, y: 1, heading: 0 }
    expect(canStep(t, p)).toBe(false) // north edge
    const east: Pose = { x: 1, y: 1, heading: 1 }
    expect(canStep(t, east)).toBe(true)
    const q = stepIntersection(t, east)
    expect(q).toEqual({ x: 3, y: 1, heading: 1 })
    expect(isIntersection(q)).toBe(true)
  })
})

describe('puzzle generation', () => {
  const seeds = Array.from({ length: 40 }, (_, i) => i * 1013 + 7)
  const levels = [1, 2, 4, 6, 8, 10, 13, 16, 19, 22, 25, 28, 31, 35, 40, 55, 80]

  it('every level has at least one open schedule entry', () => {
    for (let level = 1; level <= 100; level++) {
      expect(availableEntries(level).length).toBeGreaterThan(0)
    }
  })

  it('schedule modes all appear somewhere', () => {
    const modes = new Set(SCHEDULE.map((e) => e.mode))
    expect(modes.size).toBe(5)
  })

  for (const level of levels) {
    it(`level ${level} generates valid puzzles`, () => {
      for (const seed of seeds) {
        {
          const q = generatePuzzle(level, seed)

          if (q.mode === 'tap-cell') {
            expect(isIntersection(q.pose)).toBe(true)
            expect(q.target).toEqual(egoNeighbor(q.pose, q.ego))
          }
          if (q.mode === 'compass-walk') {
            expect(isIntersection(q.pose)).toBe(true)
            expect(isIntersection(q.target)).toBe(true)
            expect(canStep(q.town, { ...q.pose, heading: q.cardinal })).toBe(true)
          }
          if (q.mode === 'follow-route') {
            const end = runInstructions(q.town, q.pose, q.instructions)
            expect(end).not.toBeNull()
            expect(end).toEqual(q.expected)
            expect(end!.x === q.pose.x && end!.y === q.pose.y).toBe(false)
          }
          if (q.mode === 'where-am-i') {
            const correct = q.options[q.correctIndex]
            expect(correct).toEqual(q.viewPose)
            const sig = sceneSignature(q.town, q.viewPose)
            q.options.forEach((o, i) => {
              if (i !== q.correctIndex) expect(sceneSignature(q.town, o)).not.toBe(sig)
            })
          }
          if (q.mode === 'which-view') {
            expect(q.options[q.correctIndex].heading).toBe(q.pose.heading)
            const sigs = q.options.map((o) => sceneSignature(q.town, o))
            expect(new Set(sigs).size).toBe(sigs.length)
          }
        }
      }
    })
  }

  it('same (level, seed) gives same puzzle', () => {
    const a = generatePuzzle(25, 999)
    const b = generatePuzzle(25, 999)
    expect(a).toEqual(b)
  })

  it('avoidMode reduces immediate repeats when alternatives exist', () => {
    for (let seed = 0; seed < 50; seed++) {
      const q = generatePuzzle(30, seed * 31 + 1, 'compass-walk')
      expect(q.mode).not.toBe('compass-walk')
    }
  })
})
