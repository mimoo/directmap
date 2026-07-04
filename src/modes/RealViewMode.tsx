import { useState } from 'react'
import { FeedbackBar } from '../components/FeedbackBar'
import type { Heading } from '../engine/dir'
import { CARDINAL_NAME } from '../engine/dir'
import type { RealQuestion } from '../engine/realworld'
import { staticMapUrl, streetViewUrl } from '../engine/realworld'

interface RealViewModeProps {
  question: RealQuestion
  apiKey: string
  qIndex: number
  onDone: (c: boolean) => void
}

/**
 * Real-world bonus round: a Street View photo taken facing a known cardinal,
 * next to a north-up map of the same spot. Which way does the camera look?
 */
export function RealViewMode({ question: q, apiKey, qIndex, onDone }: RealViewModeProps) {
  const [picked, setPicked] = useState<Heading | null>(null)
  const [photoFailed, setPhotoFailed] = useState(false)
  const answered = picked !== null
  const correct = picked === q.heading

  if (photoFailed) {
    // No coverage / quota hit: don't punish the player, just move on.
    return (
      <div className="mode">
        <p className="prompt">The postcard got lost in the mail…</p>
        <button className="btn btn-primary" onClick={() => onDone(true)}>
          Keep walking
        </button>
      </div>
    )
  }

  return (
    <div className="mode">
      <p className="prompt">
        Real postcard from <em>{q.place.name}</em> — which way does the camera look?
      </p>
      <img
        className="real-img"
        src={streetViewUrl(apiKey, q.place, q.heading)}
        alt={`Street view near ${q.place.name}`}
        onError={() => setPhotoFailed(true)}
      />
      <img className="real-img" src={staticMapUrl(apiKey, q.place)} alt={`Map of ${q.place.name} (north is up)`} />
      <p className="real-hint">North is up on the map. Match what the camera sees to the streets.</p>
      <div className="cardinal-row">
        {([0, 1, 2, 3] as Heading[]).map((h) => (
          <button
            key={h}
            className={[
              'btn',
              'cardinal-btn',
              answered && h === q.heading ? 'cardinal-correct' : '',
              answered && h === picked && !correct ? 'cardinal-wrong' : '',
            ].join(' ')}
            disabled={answered}
            onClick={() => setPicked(h)}
          >
            {CARDINAL_NAME[h].toUpperCase()}
          </button>
        ))}
      </div>
      {answered && (
        <FeedbackBar
          correct={correct}
          variant={qIndex}
          explanation={
            correct
              ? undefined
              : `The camera was looking ${CARDINAL_NAME[q.heading]}. Find a landmark in the photo, find it on the map, then imagine standing at the red pin.`
          }
          onContinue={() => onDone(correct)}
        />
      )}
    </div>
  )
}
