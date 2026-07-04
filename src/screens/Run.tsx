import { useMemo, useState } from 'react'
import type { Mode, Question } from '../engine/questions'
import { HEARTS, MODE_INFO, generatePuzzle } from '../engine/questions'
import type { RealQuestion } from '../engine/realworld'
import { generateRealPuzzle } from '../engine/realworld'
import { useProgress } from '../state/progress'
import { TapCellMode } from '../modes/TapCellMode'
import { CompassWalkMode } from '../modes/CompassWalkMode'
import { FollowRouteMode } from '../modes/FollowRouteMode'
import { WhereAmIMode } from '../modes/WhereAmIMode'
import { WhichViewMode } from '../modes/WhichViewMode'
import { RealViewMode } from '../modes/RealViewMode'

const REAL_INFO = {
  title: 'The Real World',
  lesson:
    'A real photo, a real map. North is up on the map — it is NOT necessarily where the camera looks. Find a landmark in the photo, find it on the map, and work out which way the camera must be facing.',
}

/** Real-world postcard every Nth parcel (only with an API key). */
const REAL_EVERY = 6

type Puzzle = Question | RealQuestion

interface RunProps {
  onExit: () => void
}

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 0xffffff)) >>> 1
}

export function Run({ onExit }: RunProps) {
  const [base, setBase] = useState(freshSeed)
  const [level, setLevel] = useState(1)
  const [hearts, setHearts] = useState(HEARTS)
  const [delivered, setDelivered] = useState(0)
  const [over, setOver] = useState(false)
  const [prevMode, setPrevMode] = useState<Mode | undefined>(undefined)

  const seenModes = useProgress((s) => s.seenModes)
  const markSeen = useProgress((s) => s.markSeen)
  const googleKey = useProgress((s) => s.googleKey)
  const recordRun = useProgress((s) => s.recordRun)
  const bestRun = useProgress((s) => s.bestRun)

  const puzzle: Puzzle = useMemo(() => {
    if (googleKey && level % REAL_EVERY === 0) return generateRealPuzzle(base + level * 101)
    return generatePuzzle(level, base + level * 7919, prevMode)
  }, [level, base, googleKey, prevMode])

  const info = puzzle.mode === 'real-view' ? REAL_INFO : MODE_INFO[puzzle.mode]
  const needsIntro = !over && !seenModes.includes(puzzle.mode)

  const handleDone = (correct: boolean) => {
    const nextDelivered = correct ? delivered + 1 : delivered
    const nextHearts = correct ? hearts : hearts - 1
    setDelivered(nextDelivered)
    setHearts(nextHearts)
    if (nextHearts <= 0) {
      recordRun(nextDelivered)
      setOver(true)
    } else {
      setPrevMode(puzzle.mode === 'real-view' ? undefined : puzzle.mode)
      setLevel((l) => l + 1)
    }
  }

  const quit = () => {
    if (!over && delivered > 0) recordRun(delivered)
    onExit()
  }

  return (
    <div className="session">
      <header className="session-header">
        <button className="icon-btn" onClick={quit} aria-label="Quit run">
          ✕
        </button>
        <div className="hearts" aria-label={`${hearts} hearts left`}>
          {Array.from({ length: HEARTS }, (_, i) => (
            <span key={i} className={`heart ${i < hearts ? '' : 'heart-lost'}`}>
              ♥
            </span>
          ))}
        </div>
        <span className="run-chip">Parcel #{level}</span>
      </header>

      {over ? (
        <div className="results card">
          <div className="results-big">📦</div>
          <h2>{delivered} delivered</h2>
          <p className="results-note">
            {delivered >= bestRun && delivered > 0
              ? 'New personal best! The town names a street after you.'
              : delivered >= 10
                ? `Solid route. Your best is ${bestRun}.`
                : 'Every courier drops a parcel sometimes. Again?'}
          </p>
          <div className="results-actions">
            <button
              className="btn btn-primary"
              onClick={() => {
                setBase(freshSeed())
                setLevel(1)
                setHearts(HEARTS)
                setDelivered(0)
                setPrevMode(undefined)
                setOver(false)
              }}
            >
              New run
            </button>
            <button className="btn" onClick={onExit}>
              Back home
            </button>
          </div>
        </div>
      ) : needsIntro ? (
        <div className="lesson card">
          <p className="lesson-tagline">New challenge!</p>
          <h2>{info.title}</h2>
          <p className="lesson-text">{info.lesson}</p>
          <button className="btn btn-primary" onClick={() => markSeen(puzzle.mode)}>
            Got it
          </button>
        </div>
      ) : (
        <PuzzleSwitch key={level} puzzle={puzzle} qIndex={level} apiKey={googleKey} onDone={handleDone} />
      )}
    </div>
  )
}

function PuzzleSwitch({
  puzzle,
  qIndex,
  apiKey,
  onDone,
}: {
  puzzle: Puzzle
  qIndex: number
  apiKey: string
  onDone: (c: boolean) => void
}) {
  switch (puzzle.mode) {
    case 'tap-cell':
      return <TapCellMode question={puzzle} qIndex={qIndex} onDone={onDone} />
    case 'compass-walk':
      return <CompassWalkMode question={puzzle} qIndex={qIndex} onDone={onDone} />
    case 'follow-route':
      return <FollowRouteMode question={puzzle} qIndex={qIndex} onDone={onDone} />
    case 'where-am-i':
      return <WhereAmIMode question={puzzle} qIndex={qIndex} onDone={onDone} />
    case 'which-view':
      return <WhichViewMode question={puzzle} qIndex={qIndex} onDone={onDone} />
    case 'real-view':
      return <RealViewMode question={puzzle} apiKey={apiKey} qIndex={qIndex} onDone={onDone} />
  }
}
