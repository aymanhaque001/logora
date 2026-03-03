import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import type { CurrentFlowData, CurrentFlowNode } from '../types'
import {
  RefreshCw,
  Flame,
  Sun,
  Snowflake,
  Users,
  MessageCircle,
} from 'lucide-react'
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from 'd3-force'

/* ═══════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════ */

const VIEW_W = 1000
const VIEW_H = 600
const ROOT_R = 42
const MIN_R = 32
const MAX_R = 62

const ACTIVITY_CFG: Record<
  string,
  { ring: string; label: string; Icon: typeof Flame }
> = {
  hot: { ring: '#ef4444', label: 'active now', Icon: Flame },
  warm: { ring: '#f59e0b', label: 'recent', Icon: Sun },
  cool: { ring: '#6e5a7e', label: 'quiet', Icon: Snowflake },
}

const EDGE_COLORS: Record<string, string> = {
  supports: '#22c55e',
  challenges: '#ef4444',
  qualifies: '#f59e0b',
  refines: '#BF557B',
  contradicts: '#dc2626',
  synthesizes: '#14b8a6',
  questions: '#6e5a7e',
}

/* ═══════════════════════════════════════════════════
   SIMULATION TYPES
   ═══════════════════════════════════════════════════ */

interface SimNode extends SimulationNodeDatum {
  id: string
  isRoot: boolean
  current: CurrentFlowNode
  r: number
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  id: string
  weight: number
  relationshipTypes: string[]
  isRootLink: boolean
}

/* ═══════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════ */

/** Bubble radius proportional to take count */
function bubbleRadius(nodeCount: number): number {
  return Math.max(MIN_R, Math.min(MAX_R, 28 + nodeCount * 3))
}

/** Wrap text into lines for SVG (simple word-wrap) */
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const w of words) {
    if (current.length + w.length + 1 > maxCharsPerLine && current.length > 0) {
      lines.push(current)
      current = w
    } else {
      current = current ? current + ' ' + w : w
    }
  }
  if (current) lines.push(current)
  return lines.slice(0, 3) // max 3 lines
}

/* ═══════════════════════════════════════════════════
   PROPS
   ═══════════════════════════════════════════════════ */

export interface CurrentFlowGraphProps {
  data: CurrentFlowData
  onCurrentClick?: (currentId: string) => void
  onRecluster?: () => void
  isReclustering?: boolean
}

/* ═══════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════ */

export function CurrentFlowGraph({
  data,
  onCurrentClick,
  onRecluster,
  isReclustering,
}: CurrentFlowGraphProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [nodes, setNodes] = useState<SimNode[]>([])
  const [links, setLinks] = useState<SimLink[]>([])
  const simRef = useRef<ReturnType<typeof forceSimulation<SimNode>> | null>(
    null,
  )

  const handleClick = useCallback(
    (id: string) => onCurrentClick?.(id),
    [onCurrentClick],
  )

  /* ── Build simulation nodes & links ────────── */
  const { initialNodes, initialLinks } = useMemo(() => {
    const cx = VIEW_W / 2
    const cy = VIEW_H / 2

    // Root node (debate question)
    const rootNode: SimNode = {
      id: data.root.id,
      isRoot: true,
      current: data.root,
      r: ROOT_R,
      x: cx,
      y: cy,
      fx: cx, // pin root to centre
      fy: cy,
    }

    // Current nodes arranged in a circle around centre
    const n = data.currents.length
    const orbitR = Math.min(VIEW_W, VIEW_H) * 0.3
    const currentNodes: SimNode[] = data.currents.map((c, i) => {
      const angle = (2 * Math.PI * i) / Math.max(n, 1) - Math.PI / 2
      return {
        id: c.id,
        isRoot: false,
        current: c,
        r: bubbleRadius(c.node_count),
        x: cx + orbitR * Math.cos(angle),
        y: cy + orbitR * Math.sin(angle),
      }
    })

    const allNodes = [rootNode, ...currentNodes]

    // Links: root → each current, plus cross-current edges
    const rootLinks: SimLink[] = data.currents.map((c) => ({
      id: `root-${c.id}`,
      source: data.root.id,
      target: c.id,
      weight: c.node_count,
      relationshipTypes: [],
      isRootLink: true,
    }))

    const crossLinks: SimLink[] = data.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      weight: e.weight,
      relationshipTypes: e.relationship_types,
      isRootLink: false,
    }))

    return {
      initialNodes: allNodes,
      initialLinks: [...rootLinks, ...crossLinks],
    }
  }, [data])

  /* ── Run force simulation ──────────────────── */
  useEffect(() => {
    // Kill previous simulation
    if (simRef.current) simRef.current.stop()

    const nodesCopy = initialNodes.map((n) => ({ ...n }))
    const linksCopy = initialLinks.map((l) => ({ ...l }))

    const sim = forceSimulation<SimNode>(nodesCopy)
      .force(
        'link',
        forceLink<SimNode, SimLink>(linksCopy)
          .id((d) => d.id)
          .distance((l) => {
            const src = l.source as SimNode
            const tgt = l.target as SimNode
            return l.isRootLink ? src.r + tgt.r + 80 : src.r + tgt.r + 50
          })
          .strength((l) => (l.isRootLink ? 0.7 : 0.3)),
      )
      .force('charge', forceManyBody<SimNode>().strength(-400))
      .force('center', forceCenter(VIEW_W / 2, VIEW_H / 2).strength(0.05))
      .force(
        'collide',
        forceCollide<SimNode>()
          .radius((d) => d.r + 12)
          .strength(0.8),
      )
      .alphaDecay(0.03)
      .on('tick', () => {
        // Clamp positions within bounds
        for (const n of nodesCopy) {
          if (n.fx != null) continue
          n.x = Math.max(
            n.r + 10,
            Math.min(VIEW_W - n.r - 10, n.x ?? VIEW_W / 2),
          )
          n.y = Math.max(
            n.r + 10,
            Math.min(VIEW_H - n.r - 10, n.y ?? VIEW_H / 2),
          )
        }
        setNodes([...nodesCopy])
        setLinks([...linksCopy])
      })

    simRef.current = sim

    return () => {
      sim.stop()
    }
  }, [initialNodes, initialLinks])

  /* ── Empty state ───────────────────────────── */
  if (data.currents.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center h-64 text-text-tertiary gap-2'>
        <p className='text-sm font-light'>
          Currents will appear here as the discussion develops.
        </p>
      </div>
    )
  }

  return (
    <div className='flex flex-col h-full bg-bg-primary'>
      {/* Header bar */}
      <div className='flex items-center gap-2 px-3 py-2 bg-surface-2 border-b border-border-subtle text-xs shrink-0'>
        <span className='text-text-tertiary font-medium'>current web</span>
        {onRecluster && (
          <button
            onClick={onRecluster}
            disabled={isReclustering}
            className='flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border border-border-subtle text-accent hover:bg-accent/10 transition-colors disabled:opacity-40 disabled:cursor-wait'
            title='Re-analyze all arguments and discover emergent currents with AI'
          >
            <RefreshCw
              size={9}
              className={isReclustering ? 'animate-spin' : ''}
            />
            {isReclustering ? 'discovering...' : 're-discover'}
          </button>
        )}
        <span className='ml-auto text-text-tertiary'>
          {data.currents.length} current
          {data.currents.length !== 1 ? 's' : ''}
          {data.edges.length > 0 &&
            ` · ${data.edges.length} connection${data.edges.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* ── SVG Canvas ─────────────────────────── */}
      <div className='flex-1 min-h-[380px] relative overflow-hidden'>
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          width='100%'
          height='100%'
          preserveAspectRatio='xMidYMid meet'
          className='block'
        >
          <defs>
            <filter id='glow' x='-50%' y='-50%' width='200%' height='200%'>
              <feGaussianBlur stdDeviation='8' result='blur' />
              <feComposite in='SourceGraphic' in2='blur' operator='over' />
            </filter>
            <filter
              id='bubble-shadow'
              x='-30%'
              y='-30%'
              width='160%'
              height='160%'
            >
              <feDropShadow
                dx='0'
                dy='2'
                stdDeviation='4'
                floodColor='#000'
                floodOpacity='0.4'
              />
            </filter>
          </defs>

          {/* Subtle dot grid background */}
          <pattern
            id='dot-grid'
            width='24'
            height='24'
            patternUnits='userSpaceOnUse'
          >
            <circle cx='12' cy='12' r='0.7' fill='#2e1f3a' />
          </pattern>
          <rect width={VIEW_W} height={VIEW_H} fill='url(#dot-grid)' />

          {/* ── Edges ──────────────────────────── */}
          {links.map((l) => {
            const src = l.source as SimNode
            const tgt = l.target as SimNode
            if (!src.x || !src.y || !tgt.x || !tgt.y) return null

            const isHoverRelated = hoveredId === src.id || hoveredId === tgt.id

            if (l.isRootLink) {
              // Root → current: thin dotted line
              return (
                <line
                  key={l.id}
                  x1={src.x}
                  y1={src.y}
                  x2={tgt.x}
                  y2={tgt.y}
                  stroke='#BF557B'
                  strokeWidth={1.5}
                  strokeDasharray='4 6'
                  opacity={isHoverRelated ? 0.5 : 0.15}
                  style={{ transition: 'opacity 0.3s ease' }}
                />
              )
            }

            // Cross-current edge: coloured by relationship type
            const color = EDGE_COLORS[l.relationshipTypes[0]] ?? '#6e5a7e'
            const thick = Math.max(1.5, Math.min(5, l.weight * 1.2))

            // Curved edge via midpoint offset
            const mx = (src.x + tgt.x) / 2
            const my = (src.y + tgt.y) / 2
            const dx = tgt.x - src.x
            const dy = tgt.y - src.y
            const dist = Math.sqrt(dx * dx + dy * dy) || 1
            const curvature = Math.min(30, dist * 0.15)
            const nx = -dy / dist
            const ny = dx / dist
            const cx = mx + nx * curvature
            const cy = my + ny * curvature

            return (
              <g key={l.id}>
                <path
                  d={`M ${src.x} ${src.y} Q ${cx} ${cy} ${tgt.x} ${tgt.y}`}
                  fill='none'
                  stroke={color}
                  strokeWidth={thick}
                  strokeLinecap='round'
                  opacity={isHoverRelated ? 0.7 : 0.3}
                  style={{ transition: 'opacity 0.3s ease' }}
                />
                {/* Relationship label at midpoint */}
                {isHoverRelated && (
                  <text
                    x={cx}
                    y={cy - 8}
                    textAnchor='middle'
                    fill={color}
                    fontSize='9'
                    fontFamily='Work Sans, sans-serif'
                    opacity={0.9}
                  >
                    {l.weight}× {l.relationshipTypes[0]}
                  </text>
                )}
              </g>
            )
          })}

          {/* ── Root node (debate question) ───── */}
          {nodes
            .filter((n) => n.isRoot)
            .map((n) => {
              const isHovered = hoveredId === n.id
              return (
                <g key={n.id}>
                  {/* Outer pulse ring */}
                  <circle
                    cx={n.x}
                    cy={n.y}
                    fill='none'
                    stroke='#BF557B'
                    strokeWidth='2'
                    r={ROOT_R}
                  >
                    <animate
                      attributeName='r'
                      values={`${ROOT_R};${ROOT_R + 8};${ROOT_R}`}
                      dur='4s'
                      repeatCount='indefinite'
                    />
                    <animate
                      attributeName='opacity'
                      values='0.3;0.08;0.3'
                      dur='4s'
                      repeatCount='indefinite'
                    />
                  </circle>

                  {/* Core circle */}
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={ROOT_R}
                    fill='#3B1342'
                    stroke='#BF557B'
                    strokeWidth='2.5'
                    filter='url(#bubble-shadow)'
                    opacity={isHovered ? 1 : 0.95}
                  />

                  {/* Question mark */}
                  <text
                    x={n.x}
                    y={n.y! + 1}
                    textAnchor='middle'
                    dominantBaseline='central'
                    fill='#BF557B'
                    fontSize='22'
                    fontWeight='700'
                    fontFamily='Work Sans, sans-serif'
                  >
                    ?
                  </text>

                  {/* Label below root */}
                  <foreignObject
                    x={(n.x ?? 0) - 100}
                    y={(n.y ?? 0) + ROOT_R + 8}
                    width={200}
                    height={40}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: '#a893b8',
                        textAlign: 'center',
                        fontFamily: 'Work Sans, sans-serif',
                        lineHeight: 1.3,
                      }}
                    >
                      {data.root.label.length > 70
                        ? data.root.label.slice(0, 67) + '...'
                        : data.root.label}
                    </div>
                  </foreignObject>
                </g>
              )
            })}

          {/* ── Current bubbles ─────────────────── */}
          {nodes
            .filter((n) => !n.isRoot)
            .map((n) => {
              const cfg =
                ACTIVITY_CFG[n.current.activity_level] ?? ACTIVITY_CFG.cool
              const isHovered = hoveredId === n.id
              const accent = n.current.color_accent
              const r = n.r
              const nameLines = wrapText(n.current.label, Math.floor(r / 3.8))

              return (
                <g
                  key={n.id}
                  onMouseEnter={() => setHoveredId(n.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => handleClick(n.id)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Activity glow ring */}
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={r + 4}
                    fill='none'
                    stroke={cfg.ring}
                    strokeWidth={isHovered ? 3 : 1.5}
                    opacity={isHovered ? 0.8 : 0.4}
                    style={{ transition: 'all 0.3s ease' }}
                  />

                  {/* Bubble body */}
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={r}
                    fill='#1a0e22'
                    stroke={accent}
                    strokeWidth={isHovered ? 2.5 : 1.5}
                    filter='url(#bubble-shadow)'
                    opacity={isHovered ? 1 : 0.92}
                    style={{ transition: 'all 0.3s ease' }}
                  />

                  {/* Current name (inside bubble) */}
                  {nameLines.map((line, i) => (
                    <text
                      key={i}
                      x={n.x}
                      y={(n.y ?? 0) - (nameLines.length - 1) * 6 + i * 12 - 6}
                      textAnchor='middle'
                      dominantBaseline='central'
                      fill={accent}
                      fontSize={r > 45 ? 11 : 9.5}
                      fontWeight='600'
                      fontFamily='Work Sans, sans-serif'
                      style={{
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                      }}
                    >
                      {line}
                    </text>
                  ))}

                  {/* Stats row inside bubble */}
                  <text
                    x={n.x}
                    y={(n.y ?? 0) + (nameLines.length - 1) * 6 + 10}
                    textAnchor='middle'
                    dominantBaseline='central'
                    fill='#a893b8'
                    fontSize='8.5'
                    fontFamily='Work Sans, sans-serif'
                  >
                    {n.current.node_count} takes · {n.current.participant_count}{' '}
                    people
                  </text>

                  {/* Expanded info on hover — summary tooltip */}
                  {isHovered && n.current.evolution_summary && (
                    <foreignObject
                      x={(n.x ?? 0) - 110}
                      y={(n.y ?? 0) - r - 56}
                      width={220}
                      height={50}
                    >
                      <div
                        style={{
                          background: 'rgba(26, 14, 34, 0.95)',
                          border: '1px solid rgba(191, 85, 123, 0.3)',
                          borderRadius: 8,
                          padding: '6px 10px',
                          fontSize: 9.5,
                          color: '#c4b5d0',
                          fontFamily: 'Work Sans, sans-serif',
                          lineHeight: 1.4,
                          fontStyle: 'italic',
                          textAlign: 'center',
                          backdropFilter: 'blur(8px)',
                        }}
                      >
                        {n.current.evolution_summary.length > 120
                          ? n.current.evolution_summary.slice(0, 117) + '...'
                          : n.current.evolution_summary}
                      </div>
                    </foreignObject>
                  )}
                </g>
              )
            })}
        </svg>
      </div>

      {/* ── Legend ──────────────────────────────── */}
      <div className='flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 border-t border-border-subtle text-[10px] text-text-tertiary shrink-0'>
        <div className='flex items-center gap-1'>
          <span
            className='w-2.5 h-2.5 rounded-full border-2'
            style={{ borderColor: '#BF557B', background: '#1a0e22' }}
          />
          <span>current — sized by takes</span>
        </div>
        <div className='flex items-center gap-1.5'>
          <span
            className='w-5 h-0.5 rounded-full opacity-50'
            style={{ background: '#22c55e' }}
          />
          <span>cross-current link</span>
        </div>
        {Object.entries(ACTIVITY_CFG).map(([key, cfg]) => {
          const Icon = cfg.Icon
          return (
            <div
              key={key}
              className='flex items-center gap-1'
              style={{ color: cfg.ring }}
            >
              <Icon size={9} /> {key}
            </div>
          )
        })}
        <span className='ml-auto text-text-tertiary/60 italic'>
          click a current to explore
        </span>
      </div>
    </div>
  )
}
