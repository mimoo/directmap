import { SKILL_LABEL } from '../engine/questions'
import { useProgress, type SkillStat } from '../state/progress'

const LABELS: Record<string, string> = { ...SKILL_LABEL, 'real-view': 'Real-world photos' }

/** Order strongest → weakest; needs a few answers before a % means much. */
function ranked(skills: Record<string, SkillStat>) {
  return Object.entries(skills)
    .filter(([, s]) => s.seen > 0)
    .map(([mode, s]) => ({ mode, label: LABELS[mode] ?? mode, seen: s.seen, acc: s.correct / s.seen }))
    .sort((a, b) => b.acc - a.acc || b.seen - a.seen)
}

/**
 * A living picture of the player's map sense: every kind of question they've
 * met, ranked by how often they nail it. No pass/fail, just "here's what's
 * sharp and here's what to keep practising."
 */
export function Strengths({ title = 'Your map sense' }: { title?: string }) {
  const skills = useProgress((s) => s.skills)
  const rows = ranked(skills)
  if (rows.length === 0) return null

  // Only call something a strength / weak spot once there's enough evidence.
  const solid = rows.filter((r) => r.seen >= 3)
  const strongest = solid[0]
  const weakest = solid.length >= 2 ? solid[solid.length - 1] : undefined

  return (
    <div className="skills-panel card">
      <h3 className="skills-title">{title}</h3>
      <ul className="skills-list">
        {rows.map((r) => {
          const pct = Math.round(r.acc * 100)
          const tag =
            r.seen >= 3 && r === strongest
              ? 'strength'
              : r.seen >= 3 && r === weakest && weakest !== strongest
                ? 'focus'
                : undefined
          return (
            <li key={r.mode} className="skill-row">
              <span className="skill-label">
                {r.label}
                {tag === 'strength' && <span className="skill-tag skill-tag-good">strongest</span>}
                {tag === 'focus' && <span className="skill-tag skill-tag-focus">keep practising</span>}
              </span>
              <span className="skill-meter" aria-hidden>
                <span
                  className={`skill-meter-fill ${tag === 'focus' ? 'is-focus' : ''} ${tag === 'strength' ? 'is-strength' : ''}`}
                  style={{ width: `${Math.max(6, pct)}%` }}
                />
              </span>
              <span className="skill-pct">
                {pct}% <span className="skill-count">· {r.seen}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
