import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ProgressState {
  /** Most parcels delivered in a single run. */
  bestRun: number
  totalDelivered: number
  runs: number
  /** Challenge modes whose lesson has been shown. */
  seenModes: string[]
  /** Optional Google Maps API key for real-world postcard rounds. */
  googleKey: string
  recordRun: (delivered: number) => void
  markSeen: (mode: string) => void
  setGoogleKey: (key: string) => void
}

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      bestRun: 0,
      totalDelivered: 0,
      runs: 0,
      seenModes: [],
      googleKey: '',
      recordRun: (delivered) =>
        set((s) => ({
          bestRun: Math.max(s.bestRun, delivered),
          totalDelivered: s.totalDelivered + delivered,
          runs: s.runs + 1,
        })),
      markSeen: (mode) =>
        set((s) => (s.seenModes.includes(mode) ? s : { seenModes: [...s.seenModes, mode] })),
      setGoogleKey: (key) => set({ googleKey: key.trim() }),
    }),
    { name: 'directmap-progress', version: 2 },
  ),
)
