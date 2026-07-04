import { useState } from 'react'
import { DPad } from '../components/DPad'
import { FeedbackBar } from '../components/FeedbackBar'
import { MapView } from '../components/MapView'
import type { Pose } from '../engine/dir'
import { CARDINAL_NAME, headingToEgo, sameCell, turnLeft, turnRight } from '../engine/dir'
import type { Question } from '../engine/questions'
import { canStep, stepIntersection } from '../engine/town'
import { CardinalWord } from './common'

type Q = Extract<Question, { mode: 'compass-walk' }>

export function CompassWalkMode({ question: q, qIndex, onDone }: { question: Q; qIndex: number; onDone: (c: boolean) => void }) {
  const [pose, setPose] = useState<Pose>(q.pose)
  const [answered, setAnswered] = useState<null | { correct: boolean; from: Pose }>(null)

  const forward = () => {
    if (answered) return
    if (!canStep(q.town, pose)) {
      // Walked off the map edge: that's a wrong answer too.
      setAnswered({ correct: false, from: pose })
      return
    }
    const next = stepIntersection(q.town, pose)
    setPose(next)
    setAnswered({ correct: sameCell(next, q.target), from: pose })
  }

  const wrongEgo = answered && !answered.correct ? headingToEgo(answered.from.heading, q.cardinal) : null

  return (
    <div className="mode">
      <p className="prompt">
        Walk one block <CardinalWord h={q.cardinal} />
      </p>
      <MapView
        town={q.town}
        pose={pose}
        rotation={q.mapRotation}
        cellMarkers={
          answered
            ? [
                { cell: q.target, kind: 'correct' },
                ...(answered.correct ? [] : [{ cell: { x: pose.x, y: pose.y }, kind: 'wrong' as const }]),
              ]
            : []
        }
      />
      {!answered && (
        <DPad
          onTurnLeft={() => setPose((p) => ({ ...p, heading: turnLeft(p.heading) }))}
          onForward={forward}
          onTurnRight={() => setPose((p) => ({ ...p, heading: turnRight(p.heading) }))}
        />
      )}
      {answered && (
        <FeedbackBar
          correct={answered.correct}
          variant={qIndex}
          explanation={
            answered.correct
              ? undefined
              : `Check the compass rose: it shows where ${CARDINAL_NAME[q.cardinal]} really is. When you stepped, you were facing ${CARDINAL_NAME[answered.from.heading]} — ${CARDINAL_NAME[q.cardinal]} was ${wrongEgo === 'ahead' ? 'straight ahead' : `to your ${wrongEgo}`}.`
          }
          onContinue={() => onDone(answered.correct)}
        />
      )}
    </div>
  )
}
