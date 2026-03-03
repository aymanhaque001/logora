import { useMemo } from 'react'
import {
  GraphNode,
  GraphEdge,
  NodeType,
  ArgumentState,
  EdgeRelationship,
} from '../types'
import { NODE_COLORS } from './ArgumentGraph'

/* ── colour maps ──────────────────────────────────────────────────────── */

const STATE_COLORS: Record<ArgumentState, string> = {
  unchallenged: '#f59e0b',
  engaged: '#BF557B',
  refined: '#d4698f',
  branched: '#a855f7',
  merged: '#22c55e',
  conceded: '#14b8a6',
  dormant: '#6e5a7e',
}

const EDGE_COLORS: Record<EdgeRelationship, string> = {
  supports: '#22c55e',
  challenges: '#ef4444',
  qualifies: '#f59e0b',
  refines: '#BF557B',
  contradicts: '#dc2626',
  synthesizes: '#14b8a6',
  questions: '#6e5a7e',
}

/* ── types ────────────────────────────────────────────────────────────── */

interface Props {
  nodes: GraphNode[]
  edges: GraphEdge[]
  onHighlightNode?: (nodeId: string) => void
}

/* ── helpers ──────────────────────────────────────────────────────────── */

function percent(n: number, total: number) {
  return total === 0 ? 0 : Math.round((n / total) * 100)
}

function HBar({
  label,
  value,
  total,
  color,
}: {
  label: string
  value: number
  total: number
  color: string
}) {
  const pct = percent(value, total)
  return (
    <div className='flex items-center gap-2 text-xs'>
      <span
        className='w-2.5 h-2.5 rounded-sm shrink-0'
        style={{ background: color }}
      />
      <span className='text-text-secondary flex-1 truncate capitalize'>
        {label.replace(/_/g, ' ')}
      </span>
      <span className='text-text-tertiary tabular-nums w-6 text-right'>
        {value}
      </span>
      <div className='w-20 h-1.5 rounded-full bg-surface-3 overflow-hidden shrink-0'>
        <div
          className='h-full rounded-full transition-all duration-500'
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

/* ── component ────────────────────────────────────────────────────────── */

export function MapAnalytics({ nodes, edges, onHighlightNode }: Props) {
  const stats = useMemo(() => {
    // Type distribution
    const byType: Record<string, number> = {}
    for (const n of nodes) byType[n.node_type] = (byType[n.node_type] ?? 0) + 1

    // State distribution
    const byState: Record<string, number> = {}
    for (const n of nodes) byState[n.state] = (byState[n.state] ?? 0) + 1

    // Edge relationship distribution
    const byEdge: Record<string, number> = {}
    for (const e of edges)
      byEdge[e.relationship_type] = (byEdge[e.relationship_type] ?? 0) + 1

    // Track distribution
    const byTrack: Record<string, { name: string; count: number }> = {}
    for (const n of nodes) {
      const tid = n.track_id ?? '__none__'
      if (!byTrack[tid])
        byTrack[tid] = { name: n.track_name ?? 'No current', count: 0 }
      byTrack[tid].count++
    }

    // Sourced ratio
    const sourcedCount = nodes.filter((n) => n.sources_count > 0).length

    // Connectivity (degree per node)
    const degree: Record<string, number> = {}
    for (const e of edges) {
      degree[e.source] = (degree[e.source] ?? 0) + 1
      degree[e.target] = (degree[e.target] ?? 0) + 1
    }

    // Most connected nodes
    const mostConnected = Object.entries(degree)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, deg]) => {
        const node = nodes.find((n) => n.id === id)
        return { id, degree: deg, node }
      })
      .filter((x) => x.node)

    // Depth analysis
    const parentOf = new Map<string, string>()
    for (const e of edges) parentOf.set(e.source, e.target)
    function getDepth(id: string): number {
      let d = 0
      let cur = id
      while (parentOf.has(cur)) {
        cur = parentOf.get(cur)!
        d++
        if (d > 50) break
      }
      return d
    }
    const depths = nodes.map((n) => getDepth(n.id))
    const maxDepth = Math.max(0, ...depths)
    const avgDepth =
      depths.length > 0
        ? (depths.reduce((a, b) => a + b, 0) / depths.length).toFixed(1)
        : '0'

    // Challenge ratio (how many edges are challenges/contradicts vs supportive)
    const contentious =
      (byEdge['challenges'] ?? 0) + (byEdge['contradicts'] ?? 0)
    const supportive = (byEdge['supports'] ?? 0) + (byEdge['synthesizes'] ?? 0)

    return {
      byType,
      byState,
      byEdge,
      byTrack,
      sourcedCount,
      sourcedRatio: percent(sourcedCount, nodes.length),
      mostConnected,
      maxDepth,
      avgDepth,
      contentious,
      supportive,
    }
  }, [nodes, edges])

  const totalNodes = nodes.length
  const totalEdges = edges.length

  return (
    <div className='flex flex-col gap-4 p-3 text-xs overflow-y-auto h-full'>
      {/* Key Metrics */}
      <div>
        <h4 className='text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-2'>
          Overview
        </h4>
        <div className='grid grid-cols-2 gap-2'>
          <div className='bg-surface-2 rounded-md px-3 py-2'>
            <div className='text-lg font-bold text-text-primary tabular-nums'>
              {totalNodes}
            </div>
            <div className='text-text-tertiary'>Arguments</div>
          </div>
          <div className='bg-surface-2 rounded-md px-3 py-2'>
            <div className='text-lg font-bold text-text-primary tabular-nums'>
              {totalEdges}
            </div>
            <div className='text-text-tertiary'>Connections</div>
          </div>
          <div className='bg-surface-2 rounded-md px-3 py-2'>
            <div className='text-lg font-bold text-text-primary tabular-nums'>
              {stats.sourcedRatio}%
            </div>
            <div className='text-text-tertiary'>Sourced</div>
          </div>
          <div className='bg-surface-2 rounded-md px-3 py-2'>
            <div className='text-lg font-bold text-text-primary tabular-nums'>
              {stats.maxDepth}
            </div>
            <div className='text-text-tertiary'>Max Depth</div>
          </div>
        </div>
      </div>

      {/* Discourse Health */}
      <div>
        <h4 className='text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-2'>
          Discourse Health
        </h4>
        <div className='bg-surface-2 rounded-md p-3 space-y-2'>
          <div className='flex justify-between'>
            <span className='text-text-secondary'>Avg depth</span>
            <span className='text-text-primary font-medium tabular-nums'>
              {stats.avgDepth}
            </span>
          </div>
          <div className='flex justify-between'>
            <span className='text-text-secondary'>Contentious edges</span>
            <span className='text-red-400 font-medium tabular-nums'>
              {stats.contentious}
            </span>
          </div>
          <div className='flex justify-between'>
            <span className='text-text-secondary'>Supportive edges</span>
            <span className='text-emerald-400 font-medium tabular-nums'>
              {stats.supportive}
            </span>
          </div>
          {/* Contention gauge */}
          {stats.contentious + stats.supportive > 0 && (
            <div>
              <div className='flex justify-between text-[10px] text-text-tertiary mb-0.5'>
                <span>Collaborative</span>
                <span>Contentious</span>
              </div>
              <div className='h-2 rounded-full bg-surface-3 overflow-hidden flex'>
                <div
                  className='h-full transition-all duration-500'
                  style={{
                    width: `${percent(stats.supportive, stats.contentious + stats.supportive)}%`,
                    background: 'linear-gradient(90deg, #22c55e, #86efac)',
                  }}
                />
                <div
                  className='h-full transition-all duration-500'
                  style={{
                    width: `${percent(stats.contentious, stats.contentious + stats.supportive)}%`,
                    background: 'linear-gradient(90deg, #f87171, #ef4444)',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Node Type Distribution */}
      <div>
        <h4 className='text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-2'>
          By Type
        </h4>
        <div className='space-y-1.5'>
          {(Object.keys(NODE_COLORS) as NodeType[]).map((type) => (
            <HBar
              key={type}
              label={type}
              value={stats.byType[type] ?? 0}
              total={totalNodes}
              color={NODE_COLORS[type].accent}
            />
          ))}
        </div>
      </div>

      {/* State Distribution */}
      <div>
        <h4 className='text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-2'>
          By State
        </h4>
        <div className='space-y-1.5'>
          {(Object.keys(STATE_COLORS) as ArgumentState[]).map((state) =>
            (stats.byState[state] ?? 0) > 0 ? (
              <HBar
                key={state}
                label={state}
                value={stats.byState[state]}
                total={totalNodes}
                color={STATE_COLORS[state]}
              />
            ) : null,
          )}
        </div>
      </div>

      {/* Edge Distribution */}
      <div>
        <h4 className='text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-2'>
          Relationships
        </h4>
        <div className='space-y-1.5'>
          {(Object.keys(EDGE_COLORS) as EdgeRelationship[]).map((rel) =>
            (stats.byEdge[rel] ?? 0) > 0 ? (
              <HBar
                key={rel}
                label={rel}
                value={stats.byEdge[rel]}
                total={totalEdges}
                color={EDGE_COLORS[rel]}
              />
            ) : null,
          )}
        </div>
      </div>

      {/* Track Breakdown */}
      {Object.keys(stats.byTrack).length > 0 && (
        <div>
          <h4 className='text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-2'>
            By Current
          </h4>
          <div className='space-y-1.5'>
            {Object.entries(stats.byTrack)
              .sort((a, b) => b[1].count - a[1].count)
              .map(([tid, t]) => (
                <HBar
                  key={tid}
                  label={t.name}
                  value={t.count}
                  total={totalNodes}
                  color='#BF557B'
                />
              ))}
          </div>
        </div>
      )}

      {/* Most Connected Nodes */}
      {stats.mostConnected.length > 0 && (
        <div>
          <h4 className='text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-2'>
            Most Connected
          </h4>
          <div className='space-y-1'>
            {stats.mostConnected.map(({ id, degree, node }) => (
              <button
                key={id}
                onClick={() => onHighlightNode?.(id)}
                className='w-full text-left bg-surface-2 hover:bg-surface-3 rounded-md px-3 py-2 transition-colors group'
              >
                <div className='flex items-center gap-2'>
                  <span
                    className='w-2 h-2 rounded-full shrink-0'
                    style={{
                      background:
                        NODE_COLORS[node!.node_type]?.accent ?? '#6e5a7e',
                    }}
                  />
                  <span className='text-text-secondary flex-1 truncate group-hover:text-text-primary transition-colors'>
                    {node!.ai_summary ?? node!.content.slice(0, 50)}
                  </span>
                  <span className='text-accent font-bold tabular-nums shrink-0'>
                    {degree}
                  </span>
                </div>
                <div className='text-[10px] text-text-tertiary mt-0.5 ml-4'>
                  {node!.author_display_name} ·{' '}
                  {node!.node_type.replace('_', ' ')}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Donut chart – type distribution */}
      <div>
        <h4 className='text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-2'>
          Type Composition
        </h4>
        <div className='flex justify-center'>
          <DonutChart
            data={stats.byType}
            colors={Object.fromEntries(
              Object.entries(NODE_COLORS).map(([k, v]) => [k, v.accent]),
            )}
            total={totalNodes}
          />
        </div>
      </div>
    </div>
  )
}

/* ── Donut chart (pure SVG) ───────────────────────────────────────────── */

function DonutChart({
  data,
  colors,
  total,
}: {
  data: Record<string, number>
  colors: Record<string, string>
  total: number
}) {
  const R = 60
  const STROKE = 14
  const C = 2 * Math.PI * R
  let offset = 0

  const segments = Object.entries(data)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])

  return (
    <svg width={160} height={160} viewBox='0 0 160 160'>
      <circle
        cx={80}
        cy={80}
        r={R}
        fill='none'
        stroke='#281d34'
        strokeWidth={STROKE}
      />
      {segments.map(([key, value]) => {
        const pct = value / total
        const dashArray = `${pct * C} ${C}`
        const dashOffset = -offset * C
        offset += pct
        return (
          <circle
            key={key}
            cx={80}
            cy={80}
            r={R}
            fill='none'
            stroke={colors[key] ?? '#6e5a7e'}
            strokeWidth={STROKE}
            strokeDasharray={dashArray}
            strokeDashoffset={dashOffset}
            strokeLinecap='butt'
            transform='rotate(-90 80 80)'
            className='transition-all duration-700'
          />
        )
      })}
      <text
        x={80}
        y={76}
        textAnchor='middle'
        fill='#f0eaf4'
        fontSize={20}
        fontWeight={700}
        fontFamily='Inter, system-ui, sans-serif'
      >
        {total}
      </text>
      <text
        x={80}
        y={94}
        textAnchor='middle'
        fill='#6e5a7e'
        fontSize={10}
        fontFamily='Inter, system-ui, sans-serif'
      >
        arguments
      </text>
    </svg>
  )
}
