interface DPadProps {
  onTurnLeft: () => void
  onForward: () => void
  onTurnRight: () => void
  disabled?: boolean
}

/** Egocentric controls: turn in place or step one block forward. */
export function DPad({ onTurnLeft, onForward, onTurnRight, disabled }: DPadProps) {
  return (
    <div className="dpad">
      <button className="dpad-btn" onClick={onTurnLeft} disabled={disabled} aria-label="Turn left">
        <svg viewBox="0 0 24 24" width="26" height="26">
          <path
            d="M 10 5 L 5 10 L 10 15 M 5 10 L 15 10 A 4 4 0 0 1 19 14 L 19 19"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>turn</span>
      </button>
      <button className="dpad-btn dpad-fwd" onClick={onForward} disabled={disabled} aria-label="Walk forward">
        <svg viewBox="0 0 24 24" width="30" height="30">
          <path
            d="M 12 20 L 12 5 M 6 11 L 12 4.5 L 18 11"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>walk</span>
      </button>
      <button className="dpad-btn" onClick={onTurnRight} disabled={disabled} aria-label="Turn right">
        <svg viewBox="0 0 24 24" width="26" height="26">
          <path
            d="M 14 5 L 19 10 L 14 15 M 19 10 L 9 10 A 4 4 0 0 0 5 14 L 5 19"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>turn</span>
      </button>
    </div>
  )
}
