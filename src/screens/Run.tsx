import { useMemo, useState } from 'react'
import type { Mode, Question } from '../engine/questions'
import { HEARTS, generatePuzzle } from '../engine/questions'
import type { RealQuestion } from '../engine/realworld'
import { generateRealPuzzle } from '../engine/realworld'
import { useProgress } from '../state/progress'
import { Strengths } from '../components/Strengths'
import { TapCellMode } from '../modes/TapCellMode'
import { CompassWalkMode } from '../modes/CompassWalkMode'
import { FollowRouteMode } from '../modes/FollowRouteMode'
import { WhereAmIMode } from '../modes/WhereAmIMode'
import { WhichViewMode } from '../modes/WhichViewMode'
import { RealViewMode } from '../modes/RealViewMode'

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
  // Difficulty level, decoupled from the parcel count: it climbs faster the
  // longer you're on a roll and drops back when you slip, so the game keeps
  // pace with the player instead of crawling up one notch per delivery.
  const [level, setLevel] = useState(1)
  const [streak, setStreak] = useState(0)
  const [parcelNo, setParcelNo] = useState(1)
  const [hearts, setHearts] = useState(HEARTS)
  const [delivered, setDelivered] = useState(0)
  const [over, setOver] = useState(false)
  const [prevMode, setPrevMode] = useState<Mode | undefined>(undefined)

  const googleKey = useProgress((s) => s.googleKey)
  const recordRun = useProgress((s) => s.recordRun)
  const recordAnswer = useProgress((s) => s.recordAnswer)
  const bestRun = useProgress((s) => s.bestRun)

  const puzzle: Puzzle = useMemo(() => {
    // Seed off the parcel number too, so difficulty can revisit a level
    // without ever repeating the exact same puzzle.
    if (googleKey && parcelNo % REAL_EVERY === 0) return generateRealPuzzle(base + parcelNo * 101)
    return generatePuzzle(level, base + parcelNo * 7919 + level * 31, prevMode)
  }, [level, parcelNo, base, googleKey, prevMode])

  const handleDone = (correct: boolean) => {
    recordAnswer(puzzle.mode, correct)
    const nextDelivered = correct ? delivered + 1 : delivered
    const nextHearts = correct ? hearts : hearts - 1
    setDelivered(nextDelivered)
    setHearts(nextHearts)
    if (nextHearts <= 0) {
      recordRun(nextDelivered)
      setOver(true)
      return
    }
    // Adaptive difficulty: a win nudges the level up — and further each time
    // you're on a streak (+1 up to +4) — while a miss knocks it back two and
    // resets the streak. Strong players ramp up quickly; a wrong turn eases
    // the next few parcels instead of pushing on regardless.
    if (correct) {
      const gain = 1 + Math.min(3, Math.floor(streak / 2))
      setLevel((l) => l + gain)
      setStreak((s) => s + 1)
    } else {
      setLevel((l) => Math.max(1, l - 2))
      setStreak(0)
    }
    setPrevMode(puzzle.mode === 'real-view' ? undefined : puzzle.mode)
    setParcelNo((n) => n + 1)
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
        <span className="run-chip">Parcel #{parcelNo}</span>
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
                setStreak(0)
                setParcelNo(1)
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
          <Strengths title="How you did" />
        </div>
      ) : (
        <PuzzleSwitch key={parcelNo} puzzle={puzzle} qIndex={parcelNo} apiKey={googleKey} onDone={handleDone} />
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
