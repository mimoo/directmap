// First-person street view, rendered from the same town data as the map.
// Painter's algorithm over ego coordinates: standing on an intersection,
// buildings flank the road at odd forward distances, cross streets at even.

import type { ReactNode } from 'react'
import type { Pose } from '../engine/dir'
import { VIEW_DEPTH, visibleCell } from '../engine/questions'
import { LANDMARK_BY_ID, type Town, type TownCell } from '../engine/town'

const W = 400
const H = 300
const HORIZON = 132
const CX = W / 2
const K = 1.6
const ROAD_HALF = 118
const BLOCK_OFFSET = 205
const BLOCK_W = 158

const scale = (d: number) => K / (d + K)
const groundY = (d: number) => HORIZON + (H - HORIZON) * scale(d)

const HOUSE_COLORS = ['#cba57e', '#bd9a9a', '#a3aec7', '#c4b784']

interface StreetViewProps {
  town: Town
  pose: Pose
  className?: string
}

export function StreetView({ town, pose, className }: StreetViewProps) {
  // How far the road runs before leaving town.
  let maxF = 0
  while (maxF < VIEW_DEPTH && visibleCell(town, pose, maxF + 1, 0)) maxF++

  const layers: ReactNode[] = []

  // Road surface up to the edge of town.
  const farY = groundY(maxF + 0.5)
  const farHalf = ROAD_HALF * scale(maxF + 0.5)
  layers.push(
    <g key="road">
      <polygon
        points={`${CX - ROAD_HALF},${H} ${CX + ROAD_HALF},${H} ${CX + farHalf},${farY} ${CX - farHalf},${farY}`}
        fill="var(--sv-road)"
      />
      <polygon
        points={`${CX - 4},${H} ${CX + 4},${H} ${CX + 1.2},${farY} ${CX - 1.2},${farY}`}
        fill="var(--sv-road-line)"
        opacity={0.7}
      />
    </g>,
  )

  // Far to near.
  for (let f = VIEW_DEPTH; f >= 1; f--) {
    const isBlockRow = f % 2 === 1
    if (!isBlockRow) {
      // Cross street band (only while still inside town).
      if (f <= maxF) {
        const yNear = groundY(f - 0.35)
        const yFar = groundY(f + 0.35)
        const spanNear = ROAD_HALF + (BLOCK_OFFSET + BLOCK_W / 2 - ROAD_HALF) * 1
        layers.push(
          <g key={`cross${f}`}>
            <polygon
              points={`${CX - spanNear * scale(f - 0.35)},${yNear} ${CX + spanNear * scale(f - 0.35)},${yNear} ${CX + spanNear * scale(f + 0.35)},${yFar} ${CX - spanNear * scale(f + 0.35)},${yFar}`}
              fill="var(--sv-road)"
            />
            <line
              x1={CX - spanNear * scale(f)}
              y1={groundY(f)}
              x2={CX + spanNear * scale(f)}
              y2={groundY(f)}
              stroke="var(--sv-road-line)"
              strokeWidth={2.5 * scale(f)}
              strokeDasharray={`${2 * scale(f)} ${9 * scale(f)}`}
              opacity={0.7}
            />
          </g>,
        )
      }
      continue
    }
    // Buildings at sides. Draw both flanks at this depth.
    for (const s of [-1, 1] as const) {
      const cell = visibleCell(town, pose, f, s)
      if (!cell) continue
      const d = f - 0.5
      const sc = scale(d)
      const cx = CX + s * BLOCK_OFFSET * sc
      const baseY = groundY(d)
      const fade = f >= 5 ? 0.72 : f >= 3 ? 0.88 : 1
      layers.push(
        <g key={`b${f}${s}`} opacity={fade} transform={`translate(${cx}, ${baseY}) scale(${sc})`}>
          <Facade cell={cell} />
        </g>,
      )
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className ?? 'streetview'} preserveAspectRatio="xMidYMid slice">
      {/* sky */}
      <rect width={W} height={HORIZON + 10} fill="var(--sv-sky)" />
      <circle cx={330} cy={44} r={22} fill="var(--sv-sun)" opacity={0.9} />
      <circle cx={330} cy={44} r={32} fill="var(--sv-sun)" opacity={0.25} />
      <Cloud x={70} y={46} s={1} />
      <Cloud x={220} y={70} s={0.65} />
      {/* distant hills */}
      <path
        d={`M 0 ${HORIZON + 6} Q 60 ${HORIZON - 26} 130 ${HORIZON + 4} T 280 ${HORIZON + 2} T 420 ${HORIZON + 4} L ${W} ${H} L 0 ${H} Z`}
        fill="var(--sv-hills)"
      />
      {/* meadow ground */}
      <rect y={HORIZON + 4} width={W} height={H - HORIZON} fill="var(--sv-grass)" />
      {layers}
      {/* vignette */}
      <rect width={W} height={H} fill="url(#sv-vignette)" pointerEvents="none" />
      <defs>
        <radialGradient id="sv-vignette" cx="50%" cy="42%" r="75%">
          <stop offset="70%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#3a2d16" stopOpacity="0.22" />
        </radialGradient>
      </defs>
    </svg>
  )
}

function Cloud({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x}, ${y}) scale(${s})`} fill="var(--sv-cloud)" opacity={0.85}>
      <ellipse cx={0} cy={0} rx={26} ry={11} />
      <ellipse cx={18} cy={-6} rx={16} ry={9} />
      <ellipse cx={-16} cy={-4} rx={14} ry={8} />
    </g>
  )
}

/**
 * Front view of one block, drawn in unit coords: ground at y=0, up is -y,
 * roughly -80..80 wide. Scaled/translated by the caller.
 */
function Facade({ cell }: { cell: TownCell }) {
  switch (cell.kind) {
    case 'landmark':
      return <LandmarkFacade id={cell.id} />
    case 'house':
      return <House variant={cell.variant} />
    case 'park':
      return <Park variant={cell.variant} />
    default:
      return null
  }
}

function Shadow({ w = 90 }: { w?: number }) {
  return <ellipse cx={0} cy={2} rx={w} ry={10} fill="#4a3a1d" opacity={0.18} />
}

function House({ variant }: { variant: number }) {
  const c = HOUSE_COLORS[variant % HOUSE_COLORS.length]
  return (
    <g>
      <Shadow w={75} />
      <rect x={-62} y={-82} width={124} height={82} fill={c} stroke="var(--sv-outline)" strokeWidth={3} />
      <polygon points="-70,-82 70,-82 0,-132" fill="#a4552e" stroke="var(--sv-outline)" strokeWidth={3} />
      <rect x={-14} y={-44} width={28} height={44} rx={3} fill="#6b4a2e" />
      <rect x={-48} y={-66} width={22} height={22} rx={3} fill="#f4ecd7" stroke="var(--sv-outline)" strokeWidth={2.5} />
      <rect x={26} y={-66} width={22} height={22} rx={3} fill="#f4ecd7" stroke="var(--sv-outline)" strokeWidth={2.5} />
    </g>
  )
}

function Park({ variant }: { variant: number }) {
  return (
    <g>
      <Shadow w={80} />
      <ellipse cx={0} cy={-2} rx={85} ry={14} fill="#8fae6d" />
      <Tree x={-45} s={0.8} />
      <Tree x={30} s={1.05} />
      {variant % 2 === 0 && <Tree x={70} s={0.6} />}
      {variant % 3 === 0 && (
        <g>
          <rect x={-12} y={-22} width={40} height={6} rx={3} fill="#8a6b43" />
          <rect x={-8} y={-16} width={5} height={16} fill="#8a6b43" />
          <rect x={19} y={-16} width={5} height={16} fill="#8a6b43" />
        </g>
      )}
    </g>
  )
}

function Tree({ x, s }: { x: number; s: number }) {
  return (
    <g transform={`translate(${x},0) scale(${s})`}>
      <rect x={-6} y={-34} width={12} height={34} fill="#7a5230" />
      <circle cx={0} cy={-58} r={34} fill="#5d8a4a" />
      <circle cx={-20} cy={-44} r={22} fill="#6d9a55" />
      <circle cx={20} cy={-46} r={24} fill="#527d40" />
    </g>
  )
}

function LandmarkFacade({ id }: { id: keyof typeof LANDMARK_BY_ID }) {
  const color = LANDMARK_BY_ID[id].color
  switch (id) {
    case 'lighthouse':
      return (
        <g>
          <Shadow w={55} />
          {/* striped tapered tower */}
          <polygon points="-34,0 34,0 20,-150 -20,-150" fill="#f2ede0" stroke="var(--sv-outline)" strokeWidth={3} />
          {[0, 1, 2].map((i) => {
            const t0 = 22 + i * 42
            const t1 = t0 + 21
            const w0 = 34 - (14 * t0) / 150
            const w1 = 34 - (14 * t1) / 150
            return <polygon key={i} points={`${-w0},${-t0} ${w0},${-t0} ${w1},${-t1} ${-w1},${-t1}`} fill={color} />
          })}
          <rect x={-24} y={-178} width={48} height={28} rx={4} fill="#33415c" />
          <circle cx={0} cy={-164} r={10} fill="#ffd76a" />
          <polygon points="-20,-178 20,-178 0,-198" fill={color} stroke="var(--sv-outline)" strokeWidth={3} />
        </g>
      )
    case 'windmill':
      return (
        <g>
          <Shadow w={60} />
          <polygon points="-42,0 42,0 26,-110 -26,-110" fill={color} stroke="var(--sv-outline)" strokeWidth={3} />
          <polygon points="-30,-110 30,-110 0,-140" fill="#8a5a33" stroke="var(--sv-outline)" strokeWidth={3} />
          <g stroke="#f2ede0" strokeWidth={10} strokeLinecap="round">
            <line x1={0} y1={-118} x2={52} y2={-66} />
            <line x1={0} y1={-118} x2={-52} y2={-66} />
            <line x1={0} y1={-118} x2={52} y2={-170} />
            <line x1={0} y1={-118} x2={-52} y2={-170} />
          </g>
          <circle cx={0} cy={-118} r={9} fill="#33415c" />
          <rect x={-13} y={-38} width={26} height={38} rx={3} fill="#6b4a2e" />
        </g>
      )
    case 'church':
      return (
        <g>
          <Shadow w={70} />
          <rect x={-58} y={-88} width={116} height={88} fill="#ded8c8" stroke="var(--sv-outline)" strokeWidth={3} />
          <polygon points="-64,-88 64,-88 0,-126" fill={color} stroke="var(--sv-outline)" strokeWidth={3} />
          <rect x={-14} y={-150} width={28} height={64} fill="#ded8c8" stroke="var(--sv-outline)" strokeWidth={3} />
          <polygon points="-18,-150 18,-150 0,-186" fill={color} stroke="var(--sv-outline)" strokeWidth={3} />
          <g stroke="#8d99b8" strokeWidth={5} strokeLinecap="round">
            <line x1={0} y1={-206} x2={0} y2={-186} />
            <line x1={-7} y1={-199} x2={7} y2={-199} />
          </g>
          <path d="M -12 0 L -12 -34 A 12 12 0 0 1 12 -34 L 12 0 Z" fill="#6b4a2e" />
          <circle cx={0} cy={-108} r={9} fill="#f4ecd7" stroke="var(--sv-outline)" strokeWidth={2.5} />
        </g>
      )
    case 'cafe':
      return (
        <g>
          <Shadow w={70} />
          <rect x={-60} y={-86} width={120} height={86} fill={color} stroke="var(--sv-outline)" strokeWidth={3} />
          {/* striped awning */}
          <g>
            {[-54, -36, -18, 0, 18, 36].map((x, i) => (
              <path
                key={x}
                d={`M ${x} -52 L ${x + 18} -52 L ${x + 18} -34 A 9 9 0 0 1 ${x} -34 Z`}
                fill={i % 2 ? '#f2ede0' : '#c73734'}
                stroke="var(--sv-outline)"
                strokeWidth={2}
              />
            ))}
          </g>
          <rect x={-52} y={-30} width={30} height={30} rx={3} fill="#f7e9c9" stroke="var(--sv-outline)" strokeWidth={2.5} />
          <rect x={10} y={-30} width={26} height={30} rx={3} fill="#6b4a2e" />
          <rect x={-26} y={-76} width={52} height={16} rx={4} fill="#f2ede0" />
          <text x={0} y={-63.5} textAnchor="middle" fontSize={12} fontWeight={900} fill="#c73734" fontFamily="inherit" letterSpacing={1}>
            CAFÉ
          </text>
        </g>
      )
    case 'clocktower':
      return (
        <g>
          <Shadow w={45} />
          <rect x={-30} y={-168} width={60} height={168} fill="#d9cdb2" stroke="var(--sv-outline)" strokeWidth={3} />
          <rect x={-36} y={-186} width={72} height={20} fill={color} stroke="var(--sv-outline)" strokeWidth={3} />
          <polygon points="-36,-186 36,-186 0,-216" fill="#33415c" stroke="var(--sv-outline)" strokeWidth={3} />
          <circle cx={0} cy={-138} r={22} fill="#f7f1de" stroke="var(--sv-outline)" strokeWidth={3} />
          <g stroke="#33415c" strokeWidth={4} strokeLinecap="round">
            <line x1={0} y1={-138} x2={0} y2={-152} />
            <line x1={0} y1={-138} x2={9} y2={-133} />
          </g>
          <rect x={-12} y={-36} width={24} height={36} rx={3} fill="#6b4a2e" />
        </g>
      )
    case 'fountain':
      return (
        <g>
          <Shadow w={70} />
          <ellipse cx={0} cy={-8} rx={70} ry={20} fill="#7fb4c1" stroke="var(--sv-outline)" strokeWidth={3} />
          <ellipse cx={0} cy={-14} rx={52} ry={13} fill="#a9d2db" />
          <rect x={-8} y={-46} width={16} height={34} fill="#b6b0a0" stroke="var(--sv-outline)" strokeWidth={2.5} />
          <ellipse cx={0} cy={-48} rx={26} ry={8} fill="#7fb4c1" stroke="var(--sv-outline)" strokeWidth={2.5} />
          <g stroke="#cfe9ef" strokeWidth={4} strokeLinecap="round" fill="none">
            <path d="M 0 -54 C 0 -74 -14 -74 -16 -58" />
            <path d="M 0 -54 C 0 -78 14 -76 16 -58" />
            <line x1={0} y1={-54} x2={0} y2={-70} />
          </g>
        </g>
      )
    case 'market':
      return (
        <g>
          <Shadow w={80} />
          {[-42, 42].map((x, k) => (
            <g key={x} transform={`translate(${x},0)`}>
              <rect x={-30} y={-40} width={60} height={40} fill="#e6d9b8" stroke="var(--sv-outline)" strokeWidth={2.5} />
              {[-30, -10, 10].map((sx, i) => (
                <polygon
                  key={sx}
                  points={`${sx},-64 ${sx + 20},-64 ${sx + 20},-40 ${sx},-40`}
                  fill={(i + k) % 2 ? '#f2ede0' : color}
                  stroke="var(--sv-outline)"
                  strokeWidth={2}
                />
              ))}
              <circle cx={-12} cy={-30} r={6} fill="#d9413d" />
              <circle cx={2} cy={-28} r={6} fill="#e8a33d" />
              <circle cx={14} cy={-31} r={6} fill="#5c9e6d" />
            </g>
          ))}
        </g>
      )
    case 'bigtree':
      return (
        <g>
          <Shadow w={75} />
          <rect x={-14} y={-70} width={28} height={70} rx={6} fill="#7a5230" stroke="var(--sv-outline)" strokeWidth={3} />
          <circle cx={0} cy={-118} r={58} fill="#4c7d4f" stroke="var(--sv-outline)" strokeWidth={3} />
          <circle cx={-40} cy={-92} r={34} fill="#5d8a4a" />
          <circle cx={40} cy={-96} r={36} fill="#42703f" />
          <circle cx={0} cy={-150} r={30} fill="#5d8a4a" />
        </g>
      )
    case 'theater':
      return (
        <g>
          <Shadow w={75} />
          <rect x={-64} y={-92} width={128} height={92} fill="#cfc0d6" stroke="var(--sv-outline)" strokeWidth={3} />
          <polygon points="-72,-92 72,-92 0,-128" fill={color} stroke="var(--sv-outline)" strokeWidth={3} />
          {[-40, 0, 40].map((x) => (
            <rect key={x} x={x - 8} y={-84} width={16} height={84} fill="#efe8f2" stroke="var(--sv-outline)" strokeWidth={2.5} />
          ))}
          <circle cx={0} cy={-106} r={8} fill="#f7f1de" />
        </g>
      )
    case 'firestation':
      return (
        <g>
          <Shadow w={75} />
          <rect x={-62} y={-90} width={124} height={90} fill={color} stroke="var(--sv-outline)" strokeWidth={3} />
          <rect x={-62} y={-102} width={124} height={12} fill="#b3542a" stroke="var(--sv-outline)" strokeWidth={3} />
          <rect x={-40} y={-58} width={80} height={58} rx={5} fill="#f0e2c8" stroke="var(--sv-outline)" strokeWidth={3} />
          <g>
            {[-44, -30, -16, -2, 12, 26].map((y) => (
              <line key={y} x1={-40} y1={y} x2={40} y2={y} stroke="#cbb98e" strokeWidth={2.5} />
            ))}
          </g>
          <circle cx={0} cy={-74} r={9} fill="#f7f1de" stroke="var(--sv-outline)" strokeWidth={2.5} />
        </g>
      )
  }
}
