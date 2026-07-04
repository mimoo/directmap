import { useState } from 'react'
import { Home } from './screens/Home'
import { Run } from './screens/Run'

export default function App() {
  const [screen, setScreen] = useState<'home' | 'run'>('home')
  const [runId, setRunId] = useState(0)

  return (
    <div className="app">
      {screen === 'home' && (
        <Home
          onPlay={() => {
            setRunId((n) => n + 1)
            setScreen('run')
          }}
        />
      )}
      {screen === 'run' && <Run key={runId} onExit={() => setScreen('home')} />}
    </div>
  )
}
