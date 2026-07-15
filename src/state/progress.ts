import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Running tally of answers for one kind of question. */
export interface SkillStat {
  seen: number
  correct: number
}

interface ProgressState {
  /** Most parcels delivered in a single run. */
  bestRun: number
  totalDelivered: number
  runs: number
  /** Per-question-kind accuracy, accumulated across every run. */
  skills: Record<string, SkillStat>
  /** Optional Google Maps API key for real-world postcard rounds. */
  googleKey: string
  recordRun: (delivered: number) => void
  recordAnswer: (mode: string, correct: boolean) => void
  setGoogleKey: (key: string) => void
}

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      bestRun: 0,
      totalDelivered: 0,
      runs: 0,
      skills: {},
      googleKey: '',
      recordRun: (delivered) =>
        set((s) => ({
          bestRun: Math.max(s.bestRun, delivered),
          totalDelivered: s.totalDelivered + delivered,
          runs: s.runs + 1,
        })),
      recordAnswer: (mode, correct) =>
        set((s) => {
          const prev = s.skills[mode] ?? { seen: 0, correct: 0 }
          return {
            skills: {
              ...s.skills,
              [mode]: { seen: prev.seen + 1, correct: prev.correct + (correct ? 1 : 0) },
            },
          }
        }),
      setGoogleKey: (key) => set({ googleKey: key.trim() }),
    }),
    {
      name: 'directmap-progress',
      version: 3,
      // v2 tracked `seenModes` for one-time lessons (now gone) and had no
      // per-skill stats. Carry the real progress forward, drop the rest.
      migrate: (persisted) => {
        const p = (persisted ?? {}) as Partial<ProgressState>
        return {
          bestRun: p.bestRun ?? 0,
          totalDelivered: p.totalDelivered ?? 0,
          runs: p.runs ?? 0,
          skills: p.skills ?? {},
          googleKey: p.googleKey ?? '',
        }
      },
    },
  ),
)
