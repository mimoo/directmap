import { useState } from 'react'
import { Strengths } from '../components/Strengths'
import { useProgress } from '../state/progress'

interface HomeProps {
  onPlay: () => void
}

export function Home({ onPlay }: HomeProps) {
  const bestRun = useProgress((s) => s.bestRun)
  const totalDelivered = useProgress((s) => s.totalDelivered)
  const runs = useProgress((s) => s.runs)

  return (
    <div className="home">
      <header className="home-header">
        <div className="home-logo">
          <LogoRose />
        </div>
        <h1>Wayfinder</h1>
        <p className="home-sub">a field guide to never getting lost</p>
      </header>

      <button className="btn btn-primary btn-play" onClick={onPlay}>
        {runs === 0 ? 'Start delivering' : 'New run'}
      </button>

      {runs > 0 && (
        <div className="stats card">
          <div className="stat">
            <span className="stat-num">{bestRun}</span>
            <span className="stat-label">best run</span>
          </div>
          <div className="stat">
            <span className="stat-num">{totalDelivered}</span>
            <span className="stat-label">parcels delivered</span>
          </div>
          <div className="stat">
            <span className="stat-num">{runs}</span>
            <span className="stat-label">runs</span>
          </div>
        </div>
      )}

      <section className="about card">
        <h2>How it works</h2>
        <p>
          You’re the town courier. Every parcel is a little navigation puzzle — three wrong
          deliveries and the run is over. The puzzles come at random and adapt to you: get a
          streak going and they get harder faster; slip up and the next few ease off.
        </p>
      </section>

      <Strengths />

      <RealWorldSettings />

      <footer className="home-footer">Hint: when lost, turn the map in your head — not your phone.</footer>
    </div>
  )
}

function RealWorldSettings() {
  const googleKey = useProgress((s) => s.googleKey)
  const setGoogleKey = useProgress((s) => s.setGoogleKey)
  const [draft, setDraft] = useState(googleKey)
  const [saved, setSaved] = useState(false)

  return (
    <details className="settings card">
      <summary>
        🌍 Real-world postcards {googleKey ? <span className="settings-on">on</span> : <span className="settings-off">off</span>}
      </summary>
      <p>
        With a Google Maps API key (Street View Static + Maps Static APIs enabled), every 6th
        parcel becomes a real photo from a real city: work out which way the camera looks. Your
        key is stored only in this browser and requests go straight from your device to Google.
      </p>
      <div className="settings-row">
        <input
          type="password"
          placeholder="Google Maps API key"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setSaved(false)
          }}
        />
        <button
          className="btn"
          onClick={() => {
            setGoogleKey(draft)
            setSaved(true)
          }}
        >
          {saved ? 'Saved ✓' : 'Save'}
        </button>
      </div>
    </details>
  )
}

function LogoRose() {
  return (
    <svg viewBox="0 0 64 64" width="56" height="56">
      <circle cx="32" cy="32" r="29" fill="var(--paper)" stroke="var(--ink)" strokeWidth="2.5" />
      <circle cx="32" cy="32" r="22" fill="none" stroke="var(--ink-soft)" strokeWidth="1" strokeDasharray="2 4" />
      <path d="M 32 8 L 38 30 L 32 26 L 26 30 Z" fill="var(--accent)" />
      <path d="M 32 56 L 38 34 L 32 38 L 26 34 Z" fill="var(--ink-soft)" />
      <path d="M 8 32 L 30 26 L 26 32 L 30 38 Z" fill="var(--ink-soft)" />
      <path d="M 56 32 L 34 26 L 38 32 L 34 38 Z" fill="var(--ink-soft)" />
      <circle cx="32" cy="32" r="4" fill="var(--ink)" />
    </svg>
  )
}
