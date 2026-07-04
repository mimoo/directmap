import { useState } from 'react'
import { FeedbackBar } from '../components/FeedbackBar'
import { MapView } from '../components/MapView'
import { StreetView } from '../components/StreetView'
import { describeView } from '../engine/describe'
import type { Question } from '../engine/questions'

type Q = Extract<Question, { mode: 'which-view' }>

export function WhichViewMode({ question: q, qIndex, onDone }: { question: Q; qIndex: number; onDone: (c: boolean) => void }) {
  const [picked, setPicked] = useState<number | null>(null)
  const answered = picked !== null
  const correct = picked === q.correctIndex

  return (
    <div className="mode">
      <p className="prompt">Which postcard shows what the arrow sees?</p>
      <MapView town={q.town} pose={q.pose} rotation={q.mapRotation} style={{ maxWidth: 240, margin: '0 auto' }} />
      <div className={`postcards postcards-${q.options.length}`}>
        {q.options.map((pose, i) => (
          <button
            key={i}
            className={[
              'postcard',
              answered && i === q.correctIndex ? 'postcard-correct' : '',
              answered && i === picked && !correct ? 'postcard-wrong' : '',
              answered && i !== q.correctIndex && i !== picked ? 'postcard-dim' : '',
            ].join(' ')}
            onClick={answered ? undefined : () => setPicked(i)}
          >
            <StreetView town={q.town} pose={pose} className="streetview streetview-card" />
          </button>
        ))}
      </div>
      {answered && (
        <FeedbackBar
          correct={correct}
          variant={qIndex}
          explanation={describeView(q.town, q.pose)}
          onContinue={() => onDone(correct)}
        />
      )}
    </div>
  )
}
