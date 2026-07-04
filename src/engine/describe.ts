// Human explanations for teach-back feedback.

import { CARDINAL_NAME, type Pose } from './dir'
import { visibleCell } from './questions'
import { LANDMARK_BY_ID, type Town } from './town'

/** Describe the most distinctive thing a pose sees, for feedback text. */
export function describeView(town: Town, pose: Pose): string {
  for (const f of [1, 3, 5]) {
    for (const s of [-1, 1] as const) {
      const c = visibleCell(town, pose, f, s)
      if (c && c.kind === 'landmark') {
        const name = LANDMARK_BY_ID[c.id].name
        const side = s < 0 ? 'left' : 'right'
        const dist = f === 1 ? '' : ' further ahead'
        return `Facing ${CARDINAL_NAME[pose.heading]}, ${name} is on your ${side}${dist}.`
      }
    }
  }
  return `This spot faces ${CARDINAL_NAME[pose.heading]}.`
}
