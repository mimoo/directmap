import { useState } from 'react'
import { FeedbackBar } from '../components/FeedbackBar'
import { MapView, type PoseMarker } from '../components/MapView'
import { StreetView } from '../components/StreetView'
import { describeView } from '../engine/describe'
import type { Question } from '../engine/questions'

type Q = Extract<Question, { mode: 'where-am-i' }>

const LABELS = ['A', 'B', 'C', 'D']

export function WhereAmIMode({ question: q, qIndex, onDone }: { question: Q; qIndex: number; onDone: (c: boolean) => void }) {
  const [picked, setPicked] = useState<number | null>(null)
  const answered = picked !== null
  const correct = picked === q.correctIndex

  const markers: PoseMarker[] = q.options.map((pose, i) => ({
    pose,
    label: LABELS[i],
    state: !answered ? 'idle' : i === q.correctIndex ? 'correct' : i === picked ? 'wrong' : 'dim',
    onTap: answered ? undefined : () => setPicked(i),
  }))

  return (
    <div className="mode">
      <p className="prompt">You see this. Which arrow are you?</p>
      <StreetView town={q.town} pose={q.viewPose} className="streetview streetview-main" />
      <MapView town={q.town} rotation={q.mapRotation} poseMarkers={markers} />
      {answered && !correct && (
        <div className="compare">
          <figure>
            <StreetView town={q.town} pose={q.options[picked!]} className="streetview streetview-mini" />
            <figcaption>
              Arrow {LABELS[picked!]} would see this — not the picture above.
            </figcaption>
          </figure>
        </div>
      )}
      {answered && (
        <FeedbackBar
          correct={correct}
          variant={qIndex}
          explanation={describeView(q.town, q.viewPose)}
          onContinue={() => onDone(correct)}
        />
      )}
    </div>
  )
}
