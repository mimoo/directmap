import type { CSSProperties, ReactNode } from 'react'
import type { Cell, Heading, Pose } from '../engine/dir'
import { dirVec, turn } from '../engine/dir'
import { LANDMARK_BY_ID, type LandmarkId, type Town, type TownCell } from '../engine/town'

export const CELL = 44

const HOUSE_COLORS = ['#cba57e', '#bd9a9a', '#a3aec7', '#c4b784']
const PARK_GREEN = '#9db77f'

export interface PoseMarker {
  pose: Pose
  label: string
  state: 'idle' | 'correct' | 'wrong' | 'dim'
  onTap?: () => void
}

export interface CellMarker {
  cell: Cell
  kind: 'target' | 'correct' | 'wrong'
}

interface MapViewProps {
  town: Town
  /** The player character; omit to hide. */
  pose?: Pose | null
  /** Ghost of a pose (e.g. start position in blind courier). */
  ghostPose?: Pose | null
  /** Map rotation in degrees (kiosk mode / teach-back). Animated. */
  rotation?: number
  tappableCells?: Cell[]
  onCellTap?: (c: Cell) => void
  cellMarkers?: CellMarker[]
  poseMarkers?: PoseMarker[]
  /** Trail through intersections, drawn as a dashed line. */
  path?: Cell[]
  showCompass?: boolean
  style?: CSSProperties
}

function key(c: Cell) {
  return `${c.x},${c.y}`
}

export function MapView({
  town,
  pose,
  ghostPose,
  rotation = 0,
  tappableCells,
  onCellTap,
  cellMarkers = [],
  poseMarkers = [],
  path,
  showCompass = true,
  style,
}: MapViewProps) {
  const px = town.size * CELL
  const center = px / 2

  return (
    <div className="mapview" style={style}>
      <svg viewBox={`${-8} ${-8} ${px + 16} ${px + 16}`} className="mapview-svg">
        <g
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: `${center}px ${center}px`,
            transition: 'transform 700ms cubic-bezier(.4,0,.2,1)',
          }}
        >
          {/* ground */}
          <rect x={-8} y={-8} width={px + 16} height={px + 16} rx={14} fill="var(--map-ground)" />

          {/* cells */}
          {town.cells.map((row, y) =>
            row.map((cell, x) => (
              <MapCell key={`${x}-${y}`} cell={cell} x={x} y={y} />
            )),
          )}

          {/* path trail */}
          {path && path.length > 1 && (
            <polyline
              points={path.map((c) => `${c.x * CELL + CELL / 2},${c.y * CELL + CELL / 2}`).join(' ')}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={5}
              strokeDasharray="2 9"
              strokeLinecap="round"
              opacity={0.85}
            />
          )}

          {/* cell markers */}
          {cellMarkers.map((m, i) => (
            <g key={`m${i}`} transform={`translate(${m.cell.x * CELL + CELL / 2}, ${m.cell.y * CELL + CELL / 2})`}>
              {m.kind === 'target' && (
                <circle r={CELL * 0.34} className="pulse-ring" fill="none" stroke="var(--gold)" strokeWidth={4} />
              )}
              {m.kind === 'correct' && (
                <circle r={CELL * 0.34} fill="var(--good)" opacity={0.9} />
              )}
              {m.kind === 'wrong' && <circle r={CELL * 0.34} fill="var(--bad)" opacity={0.85} />}
              {m.kind === 'correct' && <Check />}
              {m.kind === 'wrong' && <Cross />}
            </g>
          ))}

          {/* tappable overlays */}
          {tappableCells?.map((c) => (
            <rect
              key={`t${key(c)}`}
              x={c.x * CELL + 3}
              y={c.y * CELL + 3}
              width={CELL - 6}
              height={CELL - 6}
              rx={10}
              className="tap-cell"
              onClick={() => onCellTap?.(c)}
            />
          ))}
          {/* invisible full-board taps when caller allows any cell */}
          {onCellTap && !tappableCells &&
            town.cells.map((row, y) =>
              row.map((_, x) => (
                <rect
                  key={`any${x}-${y}`}
                  x={x * CELL}
                  y={y * CELL}
                  width={CELL}
                  height={CELL}
                  fill="transparent"
                  onClick={() => onCellTap({ x, y })}
                />
              )),
            )}

          {/* pose option markers (Lost & Found) */}
          {poseMarkers.map((m, i) => {
            // Badge sits at the arrow's tail so same-cell options don't overlap.
            const tail = dirVec(turn(m.pose.heading, 2))
            const bx = tail.x * 27
            const by = tail.y * 27
            return (
              <g
                key={`p${i}`}
                transform={`translate(${m.pose.x * CELL + CELL / 2}, ${m.pose.y * CELL + CELL / 2})`}
                onClick={m.onTap}
                className={`pose-marker pose-${m.state}`}
              >
                <circle r={22} fill="transparent" />
                <g transform={`rotate(${m.pose.heading * 90})`}>
                  <path
                    d="M 0 -16 L 11 10 L 0 4 L -11 10 Z"
                    className="pose-marker-arrow"
                    strokeWidth={2.5}
                    strokeLinejoin="round"
                  />
                </g>
                <g transform={`translate(${bx}, ${by}) rotate(${-rotation})`} style={{ transition: 'transform 700ms cubic-bezier(.4,0,.2,1)' }}>
                  <circle cx={0} cy={0} r={11} className="pose-marker-badge" />
                  <text x={0} y={4.5} textAnchor="middle" className="pose-marker-label">
                    {m.label}
                  </text>
                </g>
              </g>
            )
          })}

          {/* ghost pose */}
          {ghostPose && (
            <g
              transform={`translate(${ghostPose.x * CELL + CELL / 2}, ${ghostPose.y * CELL + CELL / 2})`}
              opacity={0.45}
            >
              <Courier heading={ghostPose.heading} mapRotation={rotation} ghost />
            </g>
          )}

          {/* character */}
          {pose && (
            <g
              style={{
                transform: `translate(${pose.x * CELL + CELL / 2}px, ${pose.y * CELL + CELL / 2}px)`,
                transition: 'transform 320ms cubic-bezier(.34,1.3,.5,1)',
              }}
            >
              <Courier heading={pose.heading} mapRotation={rotation} />
            </g>
          )}
        </g>

        {showCompass && <CompassRose cx={px - 22} cy={14} rotation={rotation} />}
      </svg>
    </div>
  )
}

/**
 * Pip the courier as a map token: a front-facing face in a round badge that
 * always stays upright on screen (counter-rotated against the map), plus a
 * bold chevron that rotates around the badge to show heading.
 */
export function Courier({
  heading,
  mapRotation = 0,
  ghost = false,
}: {
  heading: Heading
  mapRotation?: number
  ghost?: boolean
}) {
  const cap = ghost ? '#8d94a8' : 'var(--accent)'
  const beam = ghost ? '#8d94a8' : 'var(--accent)'
  const skin = ghost ? '#d4d2c8' : '#f6d7b0'
  const ink = ghost ? '#767d92' : '#3a3428'
  return (
    <g>
      {!ghost && <circle r={17} fill="var(--accent)" opacity={0.18} />}
      {/* direction chevron, rotating with heading */}
      <g
        style={{
          transform: `rotate(${heading * 90}deg)`,
          transition: 'transform 260ms cubic-bezier(.34,1.3,.5,1)',
        }}
      >
        <path
          d="M 0 -23.5 L 8.5 -11.5 L -8.5 -11.5 Z"
          fill={beam}
          stroke="#fff"
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
      </g>
      {/* face badge, always upright on screen */}
      <g
        style={{
          transform: `rotate(${-mapRotation}deg)`,
          transition: 'transform 700ms cubic-bezier(.4,0,.2,1)',
        }}
      >
        <circle r={11.5} fill={skin} stroke="#fff" strokeWidth={2.4} />
        {/* cap: crown + visor band */}
        <path d="M -11.5 -2 A 11.5 11.5 0 0 1 11.5 -2 L -11.5 -2 Z" fill={cap} />
        <rect x={-11.5} y={-3.2} width={23} height={3} rx={1.5} fill={ghost ? '#767d92' : 'var(--accent-deep)'} />
        {/* eyes + smile */}
        <circle cx={-4} cy={2.5} r={1.7} fill={ink} />
        <circle cx={4} cy={2.5} r={1.7} fill={ink} />
        <path d="M -3.5 6.5 Q 0 9.5 3.5 6.5" fill="none" stroke={ink} strokeWidth={1.6} strokeLinecap="round" />
      </g>
    </g>
  )
}

function Check() {
  return (
    <path d="M -7 0 L -2 5.5 L 8 -5" fill="none" stroke="#fff" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
  )
}

function Cross() {
  return (
    <g stroke="#fff" strokeWidth={4} strokeLinecap="round">
      <line x1={-6} y1={-6} x2={6} y2={6} />
      <line x1={6} y1={-6} x2={-6} y2={6} />
    </g>
  )
}

/** North indicator; rotates with the map so it always points to true north. */
function CompassRose({ cx, cy, rotation }: { cx: number; cy: number; rotation: number }) {
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <circle r={17} fill="var(--paper)" stroke="var(--ink-soft)" strokeWidth={1.5} />
      <g
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: 'transform 700ms cubic-bezier(.4,0,.2,1)',
        }}
      >
        <path d="M 0 -12 L 4 2 L 0 0 L -4 2 Z" fill="var(--accent)" />
        <path d="M 0 12 L 4 -2 L 0 0 L -4 -2 Z" fill="var(--ink-soft)" opacity={0.5} />
        <text y={-4.5} x={0} textAnchor="middle" fontSize={7} fontWeight={800} fill="#fff" fontFamily="inherit">
          N
        </text>
      </g>
    </g>
  )
}

function MapCell({ cell, x, y }: { cell: TownCell; x: number; y: number }) {
  const px = x * CELL
  const py = y * CELL
  switch (cell.kind) {
    case 'street':
    case 'intersection': {
      // centerline dots along the street direction
      const horizontal = y % 2 === 1
      const vertical = x % 2 === 1
      return (
        <g>
          <rect x={px} y={py} width={CELL} height={CELL} fill="var(--map-street)" />
          {horizontal && (
            <line
              x1={px}
              y1={py + CELL / 2}
              x2={px + CELL}
              y2={py + CELL / 2}
              stroke="var(--map-street-line)"
              strokeWidth={2}
              strokeDasharray="1 8"
              strokeLinecap="round"
            />
          )}
          {vertical && (
            <line
              x1={px + CELL / 2}
              y1={py}
              x2={px + CELL / 2}
              y2={py + CELL}
              stroke="var(--map-street-line)"
              strokeWidth={2}
              strokeDasharray="1 8"
              strokeLinecap="round"
            />
          )}
        </g>
      )
    }
    case 'house':
      return (
        <g>
          <rect
            x={px + 5}
            y={py + 5}
            width={CELL - 10}
            height={CELL - 10}
            rx={7}
            fill={HOUSE_COLORS[cell.variant % HOUSE_COLORS.length]}
            stroke="var(--map-outline)"
            strokeWidth={1.5}
          />
          <rect
            x={px + 12}
            y={py + 12}
            width={CELL - 24}
            height={CELL - 24}
            rx={4}
            fill="#00000012"
          />
        </g>
      )
    case 'park':
      return (
        <g>
          <rect
            x={px + 5}
            y={py + 5}
            width={CELL - 10}
            height={CELL - 10}
            rx={12}
            fill={PARK_GREEN}
            stroke="var(--map-outline)"
            strokeWidth={1.5}
          />
          <circle cx={px + CELL * 0.36} cy={py + CELL * 0.4} r={5.5} fill="#6d8f52" />
          <circle cx={px + CELL * 0.62} cy={py + CELL * 0.6} r={7} fill="#7ba05b" />
        </g>
      )
    case 'landmark':
      return <LandmarkMapGlyph id={cell.id} px={px} py={py} />
  }
}

/** Top-down landmark badge: colored plate + distinctive white glyph. */
export function LandmarkMapGlyph({ id, px, py }: { id: LandmarkId; px: number; py: number }) {
  const def = LANDMARK_BY_ID[id]
  const cx = px + CELL / 2
  const cy = py + CELL / 2
  return (
    <g>
      <rect
        x={px + 4}
        y={py + 4}
        width={CELL - 8}
        height={CELL - 8}
        rx={9}
        fill={def.color}
        stroke="var(--map-outline)"
        strokeWidth={1.8}
      />
      <g transform={`translate(${cx}, ${cy})`}>{glyph(id)}</g>
    </g>
  )
}

function glyph(id: LandmarkId): ReactNode {
  const W = '#ffffff'
  switch (id) {
    case 'lighthouse':
      return (
        <g>
          <circle r={11} fill="none" stroke={W} strokeWidth={3} />
          <circle r={4.5} fill={W} />
        </g>
      )
    case 'windmill':
      return (
        <g stroke={W} strokeWidth={4} strokeLinecap="round">
          <line x1={-9} y1={-9} x2={9} y2={9} />
          <line x1={9} y1={-9} x2={-9} y2={9} />
        </g>
      )
    case 'church':
      return (
        <g stroke={W} strokeWidth={4} strokeLinecap="round">
          <line x1={0} y1={-11} x2={0} y2={11} />
          <line x1={-8} y1={-3} x2={8} y2={-3} />
        </g>
      )
    case 'cafe':
      return (
        <g fill="none" stroke={W} strokeWidth={3} strokeLinecap="round">
          <path d="M -8 -4 L -8 4 A 8 8 0 0 0 8 4 L 8 -4 Z" fill={W} stroke="none" />
          <path d="M 8 -2 A 5 4 0 0 1 8 5" />
        </g>
      )
    case 'clocktower':
      return (
        <g>
          <circle r={10} fill="none" stroke={W} strokeWidth={3} />
          <line x1={0} y1={0} x2={0} y2={-6} stroke={W} strokeWidth={3} strokeLinecap="round" />
          <line x1={0} y1={0} x2={4.5} y2={2} stroke={W} strokeWidth={3} strokeLinecap="round" />
        </g>
      )
    case 'fountain':
      return (
        <g fill="none" stroke={W}>
          <circle r={10.5} strokeWidth={3} />
          <circle r={4} fill={W} stroke="none" />
        </g>
      )
    case 'market':
      return (
        <g stroke={W} strokeWidth={3.5} strokeLinecap="round">
          <line x1={-9} y1={-6} x2={9} y2={-6} />
          <line x1={-9} y1={1} x2={9} y2={1} />
          <line x1={-9} y1={8} x2={9} y2={8} />
        </g>
      )
    case 'bigtree':
      return (
        <g fill={W}>
          <circle cx={0} cy={-2} r={8} />
          <rect x={-2} y={4} width={4} height={7} rx={2} />
        </g>
      )
    case 'theater':
      return (
        <g fill={W}>
          <path d="M -10 -8 L 10 -8 L 7 -3 L -7 -3 Z" />
          <rect x={-8} y={-1} width={3.5} height={10} rx={1.5} />
          <rect x={-1.75} y={-1} width={3.5} height={10} rx={1.5} />
          <rect x={4.5} y={-1} width={3.5} height={10} rx={1.5} />
        </g>
      )
    case 'firestation':
      return (
        <g fill={W}>
          <path d="M -10 10 L -10 -2 L 0 -10 L 10 -2 L 10 10 Z" fillOpacity={0} stroke={W} strokeWidth={3} strokeLinejoin="round" />
          <rect x={-4} y={0} width={8} height={10} rx={2} />
        </g>
      )
  }
}
