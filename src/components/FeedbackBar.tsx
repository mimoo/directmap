const GOOD_TITLES = ['Nice bearing!', 'Spot on!', 'True north!', 'Found it!', 'Sharp eyes!']
const BAD_TITLES = ['Not quite…', 'Lost the thread…', 'Off course…']

interface FeedbackBarProps {
  correct: boolean
  explanation?: string
  onContinue: () => void
  /** Stable index so the title doesn't change on re-render. */
  variant?: number
}

export function FeedbackBar({ correct, explanation, onContinue, variant = 0 }: FeedbackBarProps) {
  const titles = correct ? GOOD_TITLES : BAD_TITLES
  return (
    <div className={`feedback ${correct ? 'feedback-good' : 'feedback-bad'}`}>
      <div className="feedback-text">
        <strong>{titles[variant % titles.length]}</strong>
        {explanation && <p>{explanation}</p>}
      </div>
      <button className="btn btn-continue" onClick={onContinue}>
        Continue
      </button>
    </div>
  )
}
