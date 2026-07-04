import type { EgoDir, Heading } from '../engine/dir'
import { CARDINAL_NAME } from '../engine/dir'

export interface Answered {
  correct: boolean
}

/** Color-coded direction word used inside prompts. */
export function DirWord({ ego }: { ego: EgoDir }) {
  return <span className={`dirword dirword-${ego}`}>{ego.toUpperCase()}</span>
}

export function CardinalWord({ h }: { h: Heading }) {
  return <span className="dirword dirword-cardinal">{CARDINAL_NAME[h].toUpperCase()}</span>
}
