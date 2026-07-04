// Direction math. Headings are 0=N, 1=E, 2=S, 3=W.
// Grid coordinates: x grows east, y grows south (SVG convention).

export type Heading = 0 | 1 | 2 | 3
export type EgoDir = 'ahead' | 'right' | 'behind' | 'left'

export interface Cell {
  x: number
  y: number
}

export interface Pose extends Cell {
  heading: Heading
}

export const HEADINGS: Heading[] = [0, 1, 2, 3]

export const CARDINAL_NAME: Record<Heading, string> = {
  0: 'north',
  1: 'east',
  2: 'south',
  3: 'west',
}

export const EGO_DIRS: EgoDir[] = ['ahead', 'right', 'behind', 'left']

/** Unit vector for a heading, in grid coords (y grows south). */
export function dirVec(h: Heading): Cell {
  switch (h) {
    case 0:
      return { x: 0, y: -1 }
    case 1:
      return { x: 1, y: 0 }
    case 2:
      return { x: 0, y: 1 }
    case 3:
      return { x: -1, y: 0 }
  }
}

export function turn(h: Heading, by: number): Heading {
  return ((((h + by) % 4) + 4) % 4) as Heading
}

export function turnLeft(h: Heading): Heading {
  return turn(h, -1)
}

export function turnRight(h: Heading): Heading {
  return turn(h, 1)
}

/** Heading you face after turning `ego` relative to `h` (e.g. 'left'). */
export function egoToHeading(h: Heading, ego: EgoDir): Heading {
  const offset = { ahead: 0, right: 1, behind: 2, left: 3 }[ego]
  return turn(h, offset)
}

/** How does absolute heading `target` feel from heading `h`? */
export function headingToEgo(h: Heading, target: Heading): EgoDir {
  const offset = (((target - h) % 4) + 4) % 4
  return (['ahead', 'right', 'behind', 'left'] as EgoDir[])[offset]
}

export function step(p: Pose, n = 1): Pose {
  const v = dirVec(p.heading)
  return { x: p.x + v.x * n, y: p.y + v.y * n, heading: p.heading }
}

/** Cell adjacent to `p` in the given egocentric direction. */
export function egoNeighbor(p: Pose, ego: EgoDir): Cell {
  const v = dirVec(egoToHeading(p.heading, ego))
  return { x: p.x + v.x, y: p.y + v.y }
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y
}

export function samePose(a: Pose, b: Pose): boolean {
  return sameCell(a, b) && a.heading === b.heading
}

/**
 * Ego coordinates of world cell `c` as seen from pose `p`:
 * forward = blocks ahead (+), side = blocks to the right (+) / left (-).
 */
export function toEgo(p: Pose, c: Cell): { forward: number; side: number } {
  const dx = c.x - p.x
  const dy = c.y - p.y
  switch (p.heading) {
    case 0:
      return { forward: -dy, side: dx }
    case 1:
      return { forward: dx, side: dy }
    case 2:
      return { forward: dy, side: -dx }
    case 3:
      return { forward: -dx, side: -dy }
  }
}

/** Rotation in degrees that puts heading `h` pointing up on screen. */
export function headingUpRotation(h: Heading): number {
  return -h * 90
}
