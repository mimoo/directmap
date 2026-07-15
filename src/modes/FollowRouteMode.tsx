import { useState } from 'react'
import { DPad } from '../components/DPad'
import { FeedbackBar } from '../components/FeedbackBar'
import { MapView } from '../components/MapView'
import type { Cell, Pose } from '../engine/dir'
import { sameCell, turnLeft, turnRight } from '../engine/dir'
import type { Instruction, Question } from '../engine/questions'
import { instructionText } from '../engine/questions'
import { canStep, stepIntersection, type Town } from '../engine/town'

type Q = Extract<Question, { mode: 'follow-route' }>

/** Every intersection the correct route passes through, start included. */
function routeCells(town: Town, start: Pose, instructions: Instruction[]): Cell[] {
  const cells: Cell[] = [{ x: start.x, y: start.y }]
  let p = start
  for (const ins of instructions) {
    if (ins.type === 'turn') {
      p = { ...p, heading: ins.dir === 'left' ? turnLeft(p.heading) : turnRight(p.heading) }
    } else {
      for (let i = 0; i < ins.blocks; i++) {
        p = stepIntersection(town, p)
        cells.push({ x: p.x, y: p.y })
      }
    }
  }
  return cells
}

export function FollowRouteMode({ question: q, qIndex, onDone }: { question: Q; qIndex: number; onDone: (c: boolean) => void }) {
  const [pose, setPose] = useState<Pose>(q.pose)
  const [answered, setAnswered] = useState<null | { correct: boolean }>(null)
  const [moved, setMoved] = useState(false)

  const forward = () => {
    if (answered || !canStep(q.town, pose)) return
    setPose(stepIntersection(q.town, pose))
    setMoved(true)
  }

  const reset = () => {
    if (answered) return
    setPose(q.pose)
    setMoved(false)
  }

  const arrive = () => {
    if (answered) return
    setAnswered({ correct: sameCell(pose, q.expected) })
  }

  // Once you've walked to the edge you can't step further; in the fog you
  // also can't see it. Nudge you to turn or start over instead of pressing
  // a dead "walk" button.
  const blocked = moved && !answered && !canStep(q.town, pose)

  const hideNow = q.hideCharacter && moved && !answered

  return (
    <div className="mode">
      <div className="route-card">
        <span className="route-card-title">Delivery note</span>
        <ol>
          {q.instructions.map((ins, i) => (
            <li key={i}>{instructionText(ins)}</li>
          ))}
        </ol>
        {q.hideCharacter && <span className="route-card-hint">Foggy day — you vanish once you start walking!</span>}
      </div>
      <MapView
        town={q.town}
        pose={hideNow ? null : pose}
        ghostPose={q.hideCharacter && moved ? q.pose : null}
        rotation={q.mapRotation}
        cellMarkers={
          answered
            ? [
                { cell: q.expected, kind: 'correct' },
                ...(answered.correct ? [] : [{ cell: { x: pose.x, y: pose.y }, kind: 'wrong' as const }]),
              ]
            : []
        }
        path={answered && !answered.correct ? routeCells(q.town, q.pose, q.instructions) : undefined}
      />
      {!answered && (
        <div className="route-controls">
          {blocked && <p className="route-blocked">That’s the edge of town — turn, or start over.</p>}
          <DPad
            onTurnLeft={() => setPose((p) => ({ ...p, heading: turnLeft(p.heading) }))}
            onForward={forward}
            onTurnRight={() => setPose((p) => ({ ...p, heading: turnRight(p.heading) }))}
          />
          <div className="route-actions">
            <button className="btn btn-reset" onClick={reset} disabled={!moved}>
              ↺ Start over
            </button>
            <button className="btn btn-arrive" onClick={arrive} disabled={!moved}>
              I’m here!
            </button>
          </div>
        </div>
      )}
      {answered && (
        <FeedbackBar
          correct={answered.correct}
          variant={qIndex}
          explanation={
            answered.correct
              ? undefined
              : 'The dotted line shows where the note actually led. Remember: after each turn, your left and right point somewhere new.'
          }
          onContinue={() => onDone(answered.correct)}
        />
      )}
    </div>
  )
}
