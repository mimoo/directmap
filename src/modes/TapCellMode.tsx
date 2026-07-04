import { useState } from 'react'
import { MapView } from '../components/MapView'
import { FeedbackBar } from '../components/FeedbackBar'
import type { Cell } from '../engine/dir'
import { CARDINAL_NAME, EGO_DIRS, egoNeighbor, headingUpRotation, sameCell } from '../engine/dir'
import type { Question } from '../engine/questions'
import { DirWord } from './common'

type Q = Extract<Question, { mode: 'tap-cell' }>

export function TapCellMode({ question: q, qIndex, onDone }: { question: Q; qIndex: number; onDone: (c: boolean) => void }) {
  const [picked, setPicked] = useState<Cell | null>(null)
  const answered = picked !== null
  const correct = picked !== null && sameCell(picked, q.target)

  const neighbors = EGO_DIRS.map((d) => egoNeighbor(q.pose, d))
  // Teach-back: rotate the map so the character faces up.
  const rotation = answered && !correct ? headingUpRotation(q.pose.heading) : q.mapRotation

  return (
    <div className="mode">
      <p className="prompt">
        Tap the spot on your <DirWord ego={q.ego} />
      </p>
      <MapView
        town={q.town}
        pose={q.pose}
        rotation={rotation}
        tappableCells={answered ? undefined : neighbors}
        onCellTap={answered ? undefined : setPicked}
        cellMarkers={
          answered
            ? [
                { cell: q.target, kind: 'correct' },
                ...(correct ? [] : [{ cell: picked!, kind: 'wrong' as const }]),
              ]
            : []
        }
      />
      {answered && (
        <FeedbackBar
          correct={correct}
          variant={qIndex}
          explanation={
            correct
              ? undefined
              : `You are facing ${CARDINAL_NAME[q.pose.heading]}. I've turned the map so your arrow points up — now your ${q.ego} is where the green dot is.`
          }
          onContinue={() => onDone(correct)}
        />
      )}
    </div>
  )
}
