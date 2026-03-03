import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import type { CurrentFlowData, CurrentFlowNode } from '../types'
import { RefreshCw } from 'lucide-react'
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
const ROOT_R = 38
const MIN_R = 30
const MAX_R = 56

// Activity level → glow appearance
const ACTIVITY_GLOW: Record<
  string,
  { color: string; blur: number; outerOpacity: number; label: string }
> = {
  hot: { color: '#ff85b3', blur: 16, outerOpacity: 0.6, label: 'active' },
  warm: { color: '#c97fa8', blur: 11, outerOpacity: 0.38, label: 'recent' },
  cool: { color: '#7a6a8a', blur: 8, outerOpacity: 0.22, label: 'quiet' },
}

// Seeded pseudo-random for stable star field
function seededRand(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
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
  return Math.max(MIN_R, Math.min(MAX_R, 24 + nodeCount * 2.8))
}

/** Wrap text into lines for SVG */
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
  return lines.slice(0, 3)
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

  /* ── Star field (stable across renders) ────── */
  const stars = useMemo(() => {
    const rand = seededRand(42)
    return Array.from({ length: 60 }, (_, i) => ({
      id: i,
      cx: rand() * VIEW_W,
      cy: rand() * VIEW_H,
      r: rand() * 0.9 + 0.3,
      opacity: rand() * 0.35 + 0.08,
    }))
  }, [])

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
    <div className='flex flex-col h-full' style={{ background: '#06040d' }}>
      {/* Header bar */}
      <div
        className='flex items-center gap-2 px-3 py-2 border-b border-border-subtle text-xs shrink-0'
        style={{ background: 'rgba(255,255,255,0.02)' }}
      >
        <span
          className='font-light tracking-widest uppercase text-[9px]'
          style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em' }}
        >
          current web
        </span>
        {onRecluster && (
          <button
            onClick={onRecluster}
            disabled={isReclustering}
            className='flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors disabled:opacity-40 disabled:cursor-wait'
            style={{
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.35)',
              background: 'transparent',
            }}
            title='Re-analyze all arguments and discover emergent currents with AI'
          >
            <RefreshCw
              size={9}
              className={isReclustering ? 'animate-spin' : ''}
            />
            {isReclustering ? 'discovering…' : 're-discover'}
          </button>
        )}
        <span
          className='ml-auto'
          style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9 }}
        >
          {data.currents.length} current{data.currents.length !== 1 ? 's' : ''}
          {data.edges.length > 0 &&
            ` · ${data.edges.length} link${data.edges.length !== 1 ? 's' : ''}`}
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
            {/* Glow filters per activity level */}
            {Object.entries(ACTIVITY_GLOW).map(([key, cfg]) => (
              <filter
                key={key}
                id={`glow-${key}`}
                x='-80%'
                y='-80%'
                width='260%'
                height='260%'
              >
                <feGaussianBlur
                  in='SourceGraphic'
                  stdDeviation={cfg.blur}
                  result='blur'
                />
                <feFlood
                  floodColor={cfg.color}
                  floodOpacity={cfg.outerOpacity}
                  result='color'
                />
                <feComposite
                  in='color'
                  in2='blur'
                  operator='in'
                  result='glow'
                />
                <feMerge>
                  <feMergeNode in='glow' />
                  <feMergeNode in='SourceGraphic' />
                </feMerge>
              </filter>
            ))}
            {/* Root glow */}
            <filter id='glow-root' x='-80%' y='-80%' width='260%' height='260%'>
              <feGaussianBlur
                in='SourceGraphic'
                stdDeviation='14'
                result='blur'
              />
              <feFlood floodColor='#BF557B' floodOpacity='0.5' result='color' />
              <feComposite in='color' in2='blur' operator='in' result='glow' />
              <feMerge>
                <feMergeNode in='glow' />
                <feMergeNode in='SourceGraphic' />
              </feMerge>
            </filter>
            {/* Radial vignette */}
            <radialGradient id='vignette' cx='50%' cy='50%' r='70%'>
              <stop offset='40%' stopColor='#06040d' stopOpacity='0' />
              <stop offset='100%' stopColor='#06040d' stopOpacity='0.7' />
            </radialGradient>
          </defs>

          {/* Deep space background */}
          <rect width={VIEW_W} height={VIEW_H} fill='#06040d' />

          {/* Star field */}
          {stars.map((s) => (
            <circle
              key={s.id}
              cx={s.cx}
              cy={s.cy}
              r={s.r}
              fill='white'
              opacity={s.opacity}
            />
          ))}

          {/* Vignette overlay */}
          <rect width={VIEW_W} height={VIEW_H} fill='url(#vignette)' />

          {/* ── Edges ──────────────────────────── */}
          {links.map((l) => {
            const src = l.source as SimNode
            const tgt = l.target as SimNode
            if (!src.x || !src.y || !tgt.x || !tgt.y) return null
            const isRelated = hoveredId === src.id || hoveredId === tgt.id

            if (l.isRootLink) {
              return (
                <line
                  key={l.id}
                  x1={src.x}
                  y1={src.y}
                  x2={tgt.x}
                  y2={tgt.y}
                  stroke='white'
                  strokeWidth={1}
                  strokeDasharray='3 8'
                  opacity={isRelated ? 0.22 : 0.07}
                  style={{ transition: 'opacity 0.4s ease' }}
                />
              )
            }

            // Cross-current edge — curved
            const mx = (src.x + tgt.x) / 2
            const my = (src.y + tgt.y) / 2
            const dx = tgt.x - src.x
            const dy = tgt.y - src.y
            const dist = Math.sqrt(dx * dx + dy * dy) || 1
            const nx = -dy / dist
            const ny = dx / dist
            const curve = Math.min(28, dist * 0.14)
            const qx = mx + nx * curve
            const qy = my + ny * curve

            return (
              <g key={l.id}>
                <path
                  d={`M ${src.x} ${src.y} Q ${qx} ${qy} ${tgt.x} ${tgt.y}`}
                  fill='none'
                  stroke='white'
                  strokeWidth={Math.max(0.8, Math.min(2.5, l.weight * 0.9))}
                  strokeLinecap='round'
                  opacity={isRelated ? 0.3 : 0.1}
                  style={{ transition: 'opacity 0.4s ease' }}
                />
                {isRelated && (
                  <text
                    x={qx}
                    y={qy - 8}
                    textAnchor='middle'
                    fill='rgba(255,255,255,0.45)'
                    fontSize='8.5'
                    fontFamily='Work Sans, sans-serif'
                  >
                    {l.relationshipTypes[0] ?? 'linked'} ×{l.weight}
                  </text>
                )}
              </g>
            )
          })}

          {/* ── Root node ──────────────────────── */}
          {nodes
            .filter((n) => n.isRoot)
            .map((n) => {
              const isHovered = hoveredId === n.id
              return (
                <g
                  key={n.id}
                  onMouseEnter={() => setHoveredId(n.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* Outer pulse ring */}
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={ROOT_R}
                    fill='none'
                    stroke='#BF557B'
                    strokeWidth='1'
                  >
                    <animate
                      attributeName='r'
                      values={`${ROOT_R};${ROOT_R + 10};${ROOT_R}`}
                      dur='5s'
                      repeatCount='indefinite'
                    />
                    <animate
                      attributeName='opacity'
                      values='0.25;0.04;0.25'
                      dur='5s'
                      repeatCount='indefinite'
                    />
                  </circle>
                  {/* Glow + core */}
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={ROOT_R}
                    fill='#0e0816'
                    stroke='rgba(191,85,123,0.7)'
                    strokeWidth='1.5'
                    filter='url(#glow-root)'
                    opacity={isHovered ? 1 : 0.92}
                  />
                  {/* ? glyph */}
                  <text
                    x={n.x}
                    y={(n.y ?? 0) + 1}
                    textAnchor='middle'
                    dominantBaseline='central'
                    fill='rgba(191,85,123,0.9)'
                    fontSize='20'
                    fontWeight='300'
                    fontFamily='Work Sans, sans-serif'
                  >
                    ?
                  </text>
                  {/* Label below */}
                  <foreignObject
                    x={(n.x ?? 0) - 100}
                    y={(n.y ?? 0) + ROOT_R + 6}
                    width={200}
                    height={38}
                  >
                    <div
                      style={{
                        fontSize: 9,
                        color: 'rgba(255,255,255,0.22)',
                        textAlign: 'center',
                        fontFamily: 'Work Sans, sans-serif',
                        lineHeight: 1.4,
                        letterSpacing: '0.01em',
                      }}
                    >
                      {data.root.label.length > 70
                        ? data.root.label.slice(0, 67) + '…'
                        : data.root.label}
                    </div>
                  </foreignObject>
                </g>
              )
            })}

          {/* ── Current nodes ──────────────────── */}
          {nodes
            .filter((n) => !n.isRoot)
            .map((n) => {
              const cfg =
                ACTIVITY_GLOW[n.current.activity_level] ?? ACTIVITY_GLOW.cool
              const isHovered = hoveredId === n.id
              const r = n.r
              const nameLines = wrapText(n.current.label, Math.floor(r / 3.6))

              return (
                <g
                  key={n.id}
                  onMouseEnter={() => setHoveredId(n.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => handleClick(n.id)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Glow aura */}
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={r}
                    fill='#0a0612'
                    stroke={cfg.color}
                    strokeWidth={isHovered ? 1.5 : 0.8}
                    filter={`url(#glow-${n.current.activity_level ?? 'cool'})`}
                    opacity={isHovered ? 1 : 0.88}
                    style={{ transition: 'all 0.35s ease' }}
                  />

                  {/* Current name */}
                  {nameLines.map((line, i) => (
                    <text
                      key={i}
                      x={n.x}
                      y={(n.y ?? 0) - (nameLines.length - 1) * 6.5 + i * 13 - 5}
                      textAnchor='middle'
                      dominantBaseline='central'
                      fill={
                        isHovered
                          ? 'rgba(255,255,255,0.88)'
                          : 'rgba(255,255,255,0.62)'
                      }
                      fontSize={r > 44 ? 10.5 : 9}
                      fontWeight='300'
                      fontFamily='Work Sans, sans-serif'
                      style={{
                        letterSpacing: '0.02em',
                        transition: 'fill 0.3s ease',
                      }}
                    >
                      {line}
                    </text>
                  ))}

                  {/* Stats */}
                  <text
                    x={n.x}
                    y={(n.y ?? 0) + (nameLines.length - 1) * 6.5 + 10}
                    textAnchor='middle'
                    dominantBaseline='central'
                    fill='rgba(255,255,255,0.22)'
                    fontSize='7.5'
                    fontFamily='Work Sans, sans-serif'
                  >
                    {n.current.node_count} takes · {n.current.participant_count}
                    p
                  </text>

                  {/* Hover tooltip */}
                  {isHovered && n.current.evolution_summary && (
                    <foreignObject
                      x={(n.x ?? 0) - 110}
                      y={(n.y ?? 0) - r - 52}
                      width={220}
                      height={46}
                    >
                      <div
                        style={{
                          background: 'rgba(6, 4, 13, 0.92)',
                          border: `1px solid ${cfg.color}33`,
                          borderRadius: 6,
                          padding: '5px 10px',
                          fontSize: 9,
                          color: 'rgba(255,255,255,0.5)',
                          fontFamily: 'Work Sans, sans-serif',
                          lineHeight: 1.45,
                          fontStyle: 'italic',
                          textAlign: 'center',
                        }}
                      >
                        {n.current.evolution_summary.length > 120
                          ? n.current.evolution_summary.slice(0, 117) + '…'
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
      <div
        className='flex flex-wrap items-center gap-x-5 gap-y-1 px-3 py-1.5 border-t border-border-subtle shrink-0'
        style={{ background: 'rgba(255,255,255,0.015)' }}
      >
        {Object.entries(ACTIVITY_GLOW).map(([key, cfg]) => (
          <div key={key} className='flex items-center gap-1.5'>
            <span
              style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: cfg.color,
                boxShadow: `0 0 5px ${cfg.color}`,
              }}
            />
            <span
              style={{
                fontSize: 9,
                color: 'rgba(255,255,255,0.25)',
                fontFamily: 'Work Sans, sans-serif',
              }}
            >
              {cfg.label}
            </span>
          </div>
        ))}
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 9,
            color: 'rgba(255,255,255,0.15)',
            fontStyle: 'italic',
            fontFamily: 'Work Sans, sans-serif',
          }}
        >
          click to explore
        </span>
      </div>
    </div>
  )
}
