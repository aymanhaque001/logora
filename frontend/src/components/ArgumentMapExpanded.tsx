import { useState, useMemo, useCallback, useEffect } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  NodeProps,
  Handle,
  Position,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow'
import dagre from 'dagre'
import 'reactflow/dist/style.css'
import {
  GraphNode,
  GraphEdge,
  NodeType,
  EdgeRelationship,
  DiscourseTrack,
  ArgumentState,
} from '../types'
import { NODE_COLORS } from './ArgumentGraph'
import { MapAnalytics } from './MapAnalytics'
import {
  X,
  Maximize2,
  BarChart3,
  Layers,
  GitBranch,
  Clock,
  ChevronDown,
  ChevronRight,
  Search,
  Focus,
  Palette,
  Network,
  TreePine,
  Columns3,
  Radio,
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════════════
   CONSTANTS & TYPES
   ═══════════════════════════════════════════════════════════════════════ */

type LayoutMode = 'hierarchy-tb' | 'hierarchy-lr' | 'radial' | 'cluster-track'
type ColorMode = 'type' | 'state' | 'age' | 'connectivity'

const LAYOUT_OPTIONS: {
  value: LayoutMode
  label: string
  icon: typeof TreePine
}[] = [
  { value: 'hierarchy-tb', label: 'Top-Down', icon: TreePine },
  { value: 'hierarchy-lr', label: 'Left-Right', icon: Columns3 },
  { value: 'radial', label: 'Radial', icon: Radio },
  { value: 'cluster-track', label: 'By Track', icon: Network },
]

const COLOR_OPTIONS: { value: ColorMode; label: string }[] = [
  { value: 'type', label: 'Node Type' },
  { value: 'state', label: 'Argument State' },
  { value: 'age', label: 'Age (Newest → Oldest)' },
  { value: 'connectivity', label: 'Connectivity' },
]

const EDGE_COLORS: Record<EdgeRelationship, string> = {
  supports: '#22c55e',
  challenges: '#ef4444',
  qualifies: '#f59e0b',
  refines: '#6366f1',
  contradicts: '#dc2626',
  synthesizes: '#14b8a6',
  questions: '#6b7080',
}

const STATE_COLORS: Record<
  ArgumentState,
  { bg: string; border: string; text: string; accent: string }
> = {
  unchallenged: {
    bg: '#451a03',
    border: '#f59e0b',
    text: '#fde68a',
    accent: '#f59e0b',
  },
  engaged: {
    bg: '#1e1b4b',
    border: '#6366f1',
    text: '#c7d2fe',
    accent: '#6366f1',
  },
  refined: {
    bg: '#2e1065',
    border: '#818cf8',
    text: '#ddd6fe',
    accent: '#818cf8',
  },
  branched: {
    bg: '#3b0764',
    border: '#a855f7',
    text: '#e9d5ff',
    accent: '#a855f7',
  },
  merged: {
    bg: '#052e16',
    border: '#22c55e',
    text: '#bbf7d0',
    accent: '#22c55e',
  },
  conceded: {
    bg: '#042f2e',
    border: '#14b8a6',
    text: '#99f6e4',
    accent: '#14b8a6',
  },
  dormant: {
    bg: '#1a1d23',
    border: '#6b7080',
    text: '#9ca0ab',
    accent: '#6b7080',
  },
}

const NODE_W = 280
const NODE_H = 150

/* ═══════════════════════════════════════════════════════════════════════
   LAYOUT ALGORITHMS
   ═══════════════════════════════════════════════════════════════════════ */

function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR',
): Node[] {
  if (nodes.length === 0) return nodes
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: direction,
    ranksep: 100,
    nodesep: 50,
    marginx: 40,
    marginy: 40,
  })
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }))
  edges.forEach((e) => g.setEdge(e.target, e.source))
  dagre.layout(g)
  return nodes.map((n) => {
    const pos = g.node(n.id)
    return { ...n, position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 } }
  })
}

function applyRadialLayout(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes

  // Find roots (nodes that are not targets of any edge relationship = have no parent)
  const hasParent = new Set(edges.map((e) => e.source))
  const roots = nodes.filter((n) => !hasParent.has(n.id))
  if (roots.length === 0) return applyDagreLayout(nodes, edges, 'TB')

  // Build adjacency
  const children = new Map<string, string[]>()
  for (const e of edges) {
    if (!children.has(e.target)) children.set(e.target, [])
    children.get(e.target)!.push(e.source)
  }

  // BFS to assign layers
  const layer = new Map<string, number>()
  const queue: string[] = []
  for (const r of roots) {
    layer.set(r.id, 0)
    queue.push(r.id)
  }
  while (queue.length) {
    const cur = queue.shift()!
    const curLayer = layer.get(cur)!
    for (const child of children.get(cur) ?? []) {
      if (!layer.has(child)) {
        layer.set(child, curLayer + 1)
        queue.push(child)
      }
    }
  }

  // Group nodes by layer
  const maxLayer = Math.max(0, ...Array.from(layer.values()))
  const layers: string[][] = Array.from({ length: maxLayer + 1 }, () => [])
  for (const n of nodes) {
    const l = layer.get(n.id) ?? 0
    layers[l].push(n.id)
  }

  // Position in concentric circles
  const cx = 600
  const cy = 600
  const ringGap = 200
  const positions = new Map<string, { x: number; y: number }>()

  for (let l = 0; l <= maxLayer; l++) {
    const ring = layers[l]
    if (l === 0) {
      // Center the root(s)
      if (ring.length === 1) {
        positions.set(ring[0], { x: cx - NODE_W / 2, y: cy - NODE_H / 2 })
      } else {
        const angleStep = (2 * Math.PI) / ring.length
        ring.forEach((id, i) => {
          const r = ringGap * 0.5
          positions.set(id, {
            x: cx + r * Math.cos(i * angleStep - Math.PI / 2) - NODE_W / 2,
            y: cy + r * Math.sin(i * angleStep - Math.PI / 2) - NODE_H / 2,
          })
        })
      }
    } else {
      const r = l * ringGap
      const angleStep = (2 * Math.PI) / Math.max(ring.length, 1)
      ring.forEach((id, i) => {
        positions.set(id, {
          x: cx + r * Math.cos(i * angleStep - Math.PI / 2) - NODE_W / 2,
          y: cy + r * Math.sin(i * angleStep - Math.PI / 2) - NODE_H / 2,
        })
      })
    }
  }

  return nodes.map((n) => ({
    ...n,
    position: positions.get(n.id) ?? { x: 0, y: 0 },
  }))
}

function applyClusterLayout(
  nodes: Node[],
  edges: Edge[],
  graphNodes: GraphNode[],
): Node[] {
  if (nodes.length === 0) return nodes

  // Group by track
  const trackGroups = new Map<string, string[]>()
  for (const n of graphNodes) {
    const tid = n.track_id ?? '__untracked__'
    if (!trackGroups.has(tid)) trackGroups.set(tid, [])
    trackGroups.get(tid)!.push(n.id)
  }

  // For each cluster, use dagre internally then offset
  const allPositioned: Map<string, { x: number; y: number }> = new Map()
  let xOffset = 0
  const GAP = 100

  for (const [, group] of trackGroups) {
    const groupSet = new Set(group)
    const groupNodes = nodes.filter((n) => groupSet.has(n.id))
    const groupEdges = edges.filter(
      (e) => groupSet.has(e.source) && groupSet.has(e.target),
    )

    if (groupNodes.length === 0) continue

    const g = new dagre.graphlib.Graph()
    g.setDefaultEdgeLabel(() => ({}))
    g.setGraph({
      rankdir: 'TB',
      ranksep: 80,
      nodesep: 40,
      marginx: 20,
      marginy: 20,
    })
    groupNodes.forEach((n) =>
      g.setNode(n.id, { width: NODE_W, height: NODE_H }),
    )
    groupEdges.forEach((e) => g.setEdge(e.target, e.source))
    dagre.layout(g)

    let maxX = 0
    for (const n of groupNodes) {
      const pos = g.node(n.id)
      allPositioned.set(n.id, {
        x: pos.x - NODE_W / 2 + xOffset,
        y: pos.y - NODE_H / 2,
      })
      maxX = Math.max(maxX, pos.x + NODE_W / 2)
    }
    xOffset += maxX + GAP
  }

  return nodes.map((n) => ({
    ...n,
    position: allPositioned.get(n.id) ?? { x: 0, y: 0 },
  }))
}

/* ═══════════════════════════════════════════════════════════════════════
   COLOR RESOLVER
   ═══════════════════════════════════════════════════════════════════════ */

function getNodeColors(
  node: GraphNode,
  colorMode: ColorMode,
  allNodes: GraphNode[],
  edges: GraphEdge[],
): { bg: string; border: string; text: string; accent: string } {
  switch (colorMode) {
    case 'type':
      return NODE_COLORS[node.node_type] ?? NODE_COLORS.assertion
    case 'state':
      return STATE_COLORS[node.state] ?? STATE_COLORS.unchallenged
    case 'age': {
      const timestamps = allNodes.map((n) => new Date(n.created_at).getTime())
      const min = Math.min(...timestamps)
      const max = Math.max(...timestamps)
      const range = max - min || 1
      const t = (new Date(node.created_at).getTime() - min) / range
      // Newer = bright accent, older = dim
      const hue = Math.round(240 + t * 120) // blue → green (newer = greener)
      const sat = 60 + t * 20
      const lum = 30 + t * 25
      return {
        bg: `hsl(${hue}, ${sat}%, ${Math.max(8, lum - 25)}%)`,
        border: `hsl(${hue}, ${sat}%, ${lum}%)`,
        text: `hsl(${hue}, 30%, 85%)`,
        accent: `hsl(${hue}, ${sat}%, ${lum}%)`,
      }
    }
    case 'connectivity': {
      const degree = edges.filter(
        (e) => e.source === node.id || e.target === node.id,
      ).length
      const maxDeg = Math.max(
        1,
        ...allNodes.map(
          (n) =>
            edges.filter((e) => e.source === n.id || e.target === n.id).length,
        ),
      )
      const t = degree / maxDeg
      // Low connectivity = dim, high = bright
      if (t < 0.3)
        return {
          bg: '#1a1d23',
          border: '#3a3f4a',
          text: '#9ca0ab',
          accent: '#6b7080',
        }
      if (t < 0.6)
        return {
          bg: '#1e1b4b',
          border: '#6366f1',
          text: '#c7d2fe',
          accent: '#6366f1',
        }
      return {
        bg: '#312e81',
        border: '#818cf8',
        text: '#e0e7ff',
        accent: '#818cf8',
      }
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   EXPANDED NODE CARD
   ═══════════════════════════════════════════════════════════════════════ */

interface ExpandedNodeData {
  graphNode: GraphNode
  colors: { bg: string; border: string; text: string; accent: string }
  childCount: number
  collapsed: boolean
  onToggle: (id: string) => void
  onNodeClick: (id: string) => void
  selected: boolean
  degree: number
}

function ExpandedNodeCard({ data }: NodeProps<ExpandedNodeData>) {
  const {
    graphNode: n,
    colors: c,
    childCount,
    collapsed,
    onToggle,
    onNodeClick,
    selected,
    degree,
  } = data
  const hasChildren = childCount > 0
  const displayText =
    n.ai_summary ??
    (n.content.length > 100 ? n.content.slice(0, 100) + '\u2026' : n.content)

  return (
    <div
      onClick={() => onNodeClick(n.id)}
      style={{
        background: '#13161a',
        border: `1.5px solid ${selected ? '#e2e4e9' : c.border}`,
        borderLeft: `4px solid ${c.border}`,
        borderRadius: 10,
        width: NODE_W,
        fontFamily: 'Inter, system-ui, sans-serif',
        boxShadow: selected
          ? '0 0 0 2px rgba(99,102,241,0.4), 0 4px 16px rgba(0,0,0,0.5)'
          : '0 2px 12px rgba(0,0,0,0.4)',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s, border-color 0.2s',
      }}
    >
      <Handle
        type='target'
        position={Position.Top}
        style={{
          background: c.border,
          width: 8,
          height: 8,
          border: '2px solid #0d0f11',
        }}
      />

      {/* Header */}
      <div
        style={{
          padding: '6px 10px',
          borderBottom: `1px solid ${c.border}30`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            color: c.accent,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {n.node_type.replace('_', ' ')}
        </span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {n.nuance_tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              style={{
                background: '#22262e',
                color: '#9ca0ab',
                fontSize: 9,
                padding: '1px 5px',
                borderRadius: 4,
                fontWeight: 500,
              }}
            >
              {tag.replace(/_/g, ' ')}
            </span>
          ))}
          {degree > 0 && (
            <span
              style={{
                background: 'rgba(99,102,241,0.15)',
                color: '#818cf8',
                fontSize: 9,
                padding: '1px 5px',
                borderRadius: 4,
                fontWeight: 600,
              }}
            >
              {degree} links
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '8px 10px', minHeight: 50 }}>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            lineHeight: 1.55,
            color: '#e2e4e9',
          }}
        >
          {displayText}
        </p>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '5px 10px 6px',
          borderTop: '1px solid #22262e',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: '#6b7080',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span style={{ color: '#9ca0ab', fontWeight: 500 }}>
            {n.author_display_name}
          </span>
          {n.track_name && (
            <span style={{ color: c.accent }}>
              {'\u00b7'} {n.track_name}
            </span>
          )}
          <span
            style={{
              background: STATE_COLORS[n.state]?.accent
                ? `${STATE_COLORS[n.state].accent}20`
                : '#22262e',
              color: STATE_COLORS[n.state]?.accent ?? '#6b7080',
              fontSize: 9,
              padding: '1px 5px',
              borderRadius: 4,
              fontWeight: 500,
            }}
          >
            {n.state}
          </span>
          {n.sources_count > 0 && (
            <span
              style={{
                background: 'rgba(99,102,241,0.15)',
                color: '#818cf8',
                fontSize: 9,
                padding: '1px 5px',
                borderRadius: 4,
                fontWeight: 500,
              }}
            >
              {n.sources_count} src
            </span>
          )}
        </div>
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggle(n.id)
            }}
            style={{
              background: collapsed ? c.accent : '#22262e',
              color: collapsed ? '#fff' : '#9ca0ab',
              border: 'none',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 10,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              fontWeight: 600,
            }}
          >
            {collapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
            {collapsed ? `+${childCount}` : `${childCount}`}
          </button>
        )}
      </div>

      <Handle
        type='source'
        position={Position.Bottom}
        style={{
          background: c.border,
          width: 8,
          height: 8,
          border: '2px solid #0d0f11',
        }}
      />
    </div>
  )
}

const RF_NODE_TYPES = { expandedArg: ExpandedNodeCard }

/* ═══════════════════════════════════════════════════════════════════════
   NODE DETAIL PANEL
   ═══════════════════════════════════════════════════════════════════════ */

function NodeDetailPanel({
  node,
  edges,
  allNodes,
  onClose,
}: {
  node: GraphNode
  edges: GraphEdge[]
  allNodes: GraphNode[]
  onClose: () => void
}) {
  const c = NODE_COLORS[node.node_type] ?? NODE_COLORS.assertion

  const connections = useMemo(() => {
    const incoming = edges.filter((e) => e.target === node.id)
    const outgoing = edges.filter((e) => e.source === node.id)
    return { incoming, outgoing }
  }, [edges, node.id])

  return (
    <div className='absolute right-0 top-0 bottom-0 w-80 bg-surface-1 border-l border-border z-50 overflow-y-auto animate-slide-in-right'>
      <div className='p-4'>
        <div className='flex items-center justify-between mb-3'>
          <span
            className='text-[10px] font-semibold uppercase tracking-wider'
            style={{ color: c.accent }}
          >
            {node.node_type.replace('_', ' ')}
          </span>
          <button
            onClick={onClose}
            className='p-1 rounded hover:bg-surface-3 text-text-tertiary hover:text-text-secondary transition'
          >
            <X size={14} />
          </button>
        </div>

        {/* Full content */}
        <div className='bg-surface-2 rounded-lg p-3 mb-3'>
          <p className='text-sm text-text-primary leading-relaxed'>
            {node.content}
          </p>
        </div>

        {/* AI Summary */}
        {node.ai_summary && (
          <div className='bg-accent-muted rounded-lg p-3 mb-3'>
            <p className='text-[10px] font-semibold text-accent uppercase tracking-wider mb-1'>
              AI Summary
            </p>
            <p className='text-xs text-text-secondary leading-relaxed'>
              {node.ai_summary}
            </p>
          </div>
        )}

        {/* Metadata */}
        <div className='space-y-2 text-xs mb-3'>
          <div className='flex justify-between'>
            <span className='text-text-tertiary'>Author</span>
            <span className='text-text-primary font-medium'>
              {node.author_display_name}
            </span>
          </div>
          <div className='flex justify-between'>
            <span className='text-text-tertiary'>State</span>
            <span
              className='px-2 py-0.5 rounded text-[10px] font-medium'
              style={{
                background: `${STATE_COLORS[node.state]?.accent}20`,
                color: STATE_COLORS[node.state]?.accent,
              }}
            >
              {node.state}
            </span>
          </div>
          {node.track_name && (
            <div className='flex justify-between'>
              <span className='text-text-tertiary'>Track</span>
              <span className='text-text-secondary'>{node.track_name}</span>
            </div>
          )}
          <div className='flex justify-between'>
            <span className='text-text-tertiary'>Sources</span>
            <span className='text-text-secondary'>{node.sources_count}</span>
          </div>
          <div className='flex justify-between'>
            <span className='text-text-tertiary'>Children</span>
            <span className='text-text-secondary'>{node.children_count}</span>
          </div>
          <div className='flex justify-between'>
            <span className='text-text-tertiary'>Created</span>
            <span className='text-text-secondary'>
              {new Date(node.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Nuance Tags */}
        {node.nuance_tags.length > 0 && (
          <div className='mb-3'>
            <p className='text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1'>
              Nuance Tags
            </p>
            <div className='flex flex-wrap gap-1'>
              {node.nuance_tags.map((tag) => (
                <span
                  key={tag}
                  className='bg-surface-3 text-text-secondary text-[10px] px-2 py-0.5 rounded'
                >
                  {tag.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Connections */}
        <div className='mb-3'>
          <p className='text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1'>
            Incoming ({connections.incoming.length})
          </p>
          <div className='space-y-1'>
            {connections.incoming.map((e) => {
              const src = allNodes.find((n) => n.id === e.source)
              return (
                <div
                  key={e.id}
                  className='bg-surface-2 rounded px-2 py-1.5 text-[10px]'
                >
                  <span
                    className='font-medium'
                    style={{ color: EDGE_COLORS[e.relationship_type] }}
                  >
                    {e.relationship_type}
                  </span>
                  <span className='text-text-tertiary'> from </span>
                  <span className='text-text-secondary'>
                    {src?.author_display_name ?? 'unknown'}
                  </span>
                  {src && (
                    <p className='text-text-tertiary mt-0.5 line-clamp-1'>
                      {src.ai_summary ?? src.content.slice(0, 60)}
                    </p>
                  )}
                </div>
              )
            })}
            {connections.incoming.length === 0 && (
              <p className='text-text-tertiary text-[10px]'>Root argument</p>
            )}
          </div>
        </div>

        <div>
          <p className='text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1'>
            Outgoing ({connections.outgoing.length})
          </p>
          <div className='space-y-1'>
            {connections.outgoing.map((e) => {
              const tgt = allNodes.find((n) => n.id === e.target)
              return (
                <div
                  key={e.id}
                  className='bg-surface-2 rounded px-2 py-1.5 text-[10px]'
                >
                  <span
                    className='font-medium'
                    style={{ color: EDGE_COLORS[e.relationship_type] }}
                  >
                    {e.relationship_type}
                  </span>
                  <span className='text-text-tertiary'> to </span>
                  <span className='text-text-secondary'>
                    {tgt?.author_display_name ?? 'unknown'}
                  </span>
                  {tgt && (
                    <p className='text-text-tertiary mt-0.5 line-clamp-1'>
                      {tgt.ai_summary ?? tgt.content.slice(0, 60)}
                    </p>
                  )}
                </div>
              )
            })}
            {connections.outgoing.length === 0 && (
              <p className='text-text-tertiary text-[10px]'>No responses yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════ */

function getChildIds(nodeId: string, edges: GraphEdge[]): string[] {
  return edges.filter((e) => e.target === nodeId).map((e) => e.source)
}

function getAllDescendants(nodeId: string, edges: GraphEdge[]): Set<string> {
  const result = new Set<string>()
  const queue = getChildIds(nodeId, edges)
  while (queue.length) {
    const cur = queue.shift()!
    if (!result.has(cur)) {
      result.add(cur)
      getChildIds(cur, edges).forEach((c) => queue.push(c))
    }
  }
  return result
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */

interface Props {
  graphNodes: GraphNode[]
  graphEdges: GraphEdge[]
  tracks: DiscourseTrack[]
  onClose: () => void
  onNodeClick?: (nodeId: string) => void
}

function ExpandedMapInner({
  graphNodes,
  graphEdges,
  tracks,
  onClose,
  onNodeClick,
}: Props) {
  const { fitView } = useReactFlow()

  // State
  const [layout, setLayout] = useState<LayoutMode>('hierarchy-tb')
  const [colorMode, setColorMode] = useState<ColorMode>('type')
  const [showAnalytics, setShowAnalytics] = useState(true)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [filterTrack, setFilterTrack] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [filterState, setFilterState] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showLayoutMenu, setShowLayoutMenu] = useState(false)
  const [showColorMenu, setShowColorMenu] = useState(false)

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedNodeId) setSelectedNodeId(null)
        else onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, selectedNodeId])

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  // Compute degree for each node
  const degreeMap = useMemo(() => {
    const d: Record<string, number> = {}
    for (const e of graphEdges) {
      d[e.source] = (d[e.source] ?? 0) + 1
      d[e.target] = (d[e.target] ?? 0) + 1
    }
    return d
  }, [graphEdges])

  // Apply filters
  const { visibleNodes, visibleEdges } = useMemo(() => {
    let filtered = graphNodes
    if (filterTrack !== 'all')
      filtered = filtered.filter((n) => n.track_id === filterTrack)
    if (filterType !== 'all')
      filtered = filtered.filter((n) => n.node_type === filterType)
    if (filterState !== 'all')
      filtered = filtered.filter((n) => n.state === filterState)
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (n) =>
          (n.ai_summary ?? n.content).toLowerCase().includes(q) ||
          n.author_display_name.toLowerCase().includes(q),
      )
    }

    const visibleIds = new Set(filtered.map((n) => n.id))
    collapsed.forEach((cid) => {
      getAllDescendants(cid, graphEdges).forEach((d) => visibleIds.delete(d))
    })

    return {
      visibleNodes: filtered.filter((n) => visibleIds.has(n.id)),
      visibleEdges: graphEdges.filter(
        (e) => visibleIds.has(e.source) && visibleIds.has(e.target),
      ),
    }
  }, [
    graphNodes,
    graphEdges,
    collapsed,
    filterTrack,
    filterType,
    filterState,
    searchTerm,
  ])

  const handleNodeClick = useCallback(
    (id: string) => {
      setSelectedNodeId(id)
      onNodeClick?.(id)
    },
    [onNodeClick],
  )

  // Build ReactFlow nodes
  const rfNodes: Node[] = useMemo(() => {
    const rawEdges: Edge[] = visibleEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
    }))
    const raw: Node[] = visibleNodes.map((n) => ({
      id: n.id,
      type: 'expandedArg',
      position: { x: 0, y: 0 },
      data: {
        graphNode: n,
        colors: getNodeColors(n, colorMode, graphNodes, graphEdges),
        childCount: getChildIds(n.id, graphEdges).filter((c) =>
          visibleNodes.some((v) => v.id === c),
        ).length,
        collapsed: collapsed.has(n.id),
        onToggle: toggleCollapse,
        onNodeClick: handleNodeClick,
        selected: selectedNodeId === n.id,
        degree: degreeMap[n.id] ?? 0,
      },
    }))

    switch (layout) {
      case 'hierarchy-tb':
        return applyDagreLayout(raw, rawEdges, 'TB')
      case 'hierarchy-lr':
        return applyDagreLayout(raw, rawEdges, 'LR')
      case 'radial':
        return applyRadialLayout(raw, rawEdges)
      case 'cluster-track':
        return applyClusterLayout(raw, rawEdges, visibleNodes)
    }
  }, [
    visibleNodes,
    visibleEdges,
    collapsed,
    toggleCollapse,
    graphEdges,
    graphNodes,
    handleNodeClick,
    layout,
    colorMode,
    selectedNodeId,
    degreeMap,
  ])

  // Build ReactFlow edges
  const rfEdges: Edge[] = useMemo(
    () =>
      visibleEdges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.relationship_type,
        animated: ['challenges', 'contradicts'].includes(e.relationship_type),
        style: {
          stroke: EDGE_COLORS[e.relationship_type] ?? '#6b7080',
          strokeWidth: 1.5,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: EDGE_COLORS[e.relationship_type] ?? '#6b7080',
          width: 14,
          height: 14,
        },
        labelStyle: { fontSize: 10, fill: '#9ca0ab', fontWeight: 500 },
        labelBgStyle: { fill: 'rgba(19,22,26,0.95)' },
        labelBgPadding: [4, 6] as [number, number],
        labelBgBorderRadius: 4,
      })),
    [visibleEdges],
  )

  // Re-fit on layout change
  useEffect(() => {
    setTimeout(() => fitView({ padding: 0.1, duration: 400 }), 50)
  }, [layout, fitView])

  const selectedNode = selectedNodeId
    ? (graphNodes.find((n) => n.id === selectedNodeId) ?? null)
    : null

  return (
    <div
      className='fixed inset-0 z-[100] bg-surface-0 flex flex-col animate-fade-in'
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* ── TOOLBAR ─────────────────────────────────────────────── */}
      <div className='h-11 bg-surface-1 border-b border-border flex items-center px-3 gap-2 shrink-0'>
        {/* Left: title + search */}
        <div className='flex items-center gap-2 flex-1 min-w-0'>
          <Maximize2 size={14} className='text-accent shrink-0' />
          <span className='text-xs font-semibold text-text-secondary uppercase tracking-wider shrink-0'>
            Argument Map
          </span>
          <span className='text-text-tertiary text-xs'>·</span>
          <span className='text-text-tertiary text-xs tabular-nums'>
            {visibleNodes.length}/{graphNodes.length} nodes
          </span>

          <div className='ml-3 relative flex-1 max-w-xs'>
            <Search
              size={12}
              className='absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary'
            />
            <input
              type='text'
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder='Search arguments...'
              className='w-full bg-surface-2 border border-border-subtle rounded-md pl-7 pr-3 py-1 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50'
            />
          </div>
        </div>

        {/* Center: filters */}
        <div className='flex items-center gap-1.5'>
          <select
            value={filterTrack}
            onChange={(e) => setFilterTrack(e.target.value)}
            className='bg-surface-2 border border-border-subtle rounded-md px-2 py-1 text-xs text-text-secondary focus:outline-none focus:border-accent/50'
          >
            <option value='all'>All tracks</option>
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className='bg-surface-2 border border-border-subtle rounded-md px-2 py-1 text-xs text-text-secondary focus:outline-none focus:border-accent/50'
          >
            <option value='all'>All types</option>
            {(Object.keys(NODE_COLORS) as NodeType[]).map((t) => (
              <option key={t} value={t}>
                {t.replace('_', ' ')}
              </option>
            ))}
          </select>
          <select
            value={filterState}
            onChange={(e) => setFilterState(e.target.value)}
            className='bg-surface-2 border border-border-subtle rounded-md px-2 py-1 text-xs text-text-secondary focus:outline-none focus:border-accent/50'
          >
            <option value='all'>All states</option>
            {(Object.keys(STATE_COLORS) as ArgumentState[]).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Right: layout, color, analytics, close */}
        <div className='flex items-center gap-1'>
          {/* Layout picker */}
          <div className='relative'>
            <button
              onClick={() => {
                setShowLayoutMenu(!showLayoutMenu)
                setShowColorMenu(false)
              }}
              className='flex items-center gap-1 px-2 py-1 text-xs bg-surface-2 border border-border-subtle rounded-md text-text-secondary hover:text-text-primary hover:border-border-hover transition'
              title='Layout mode'
            >
              <Layers size={12} />
              {LAYOUT_OPTIONS.find((o) => o.value === layout)?.label}
              <ChevronDown size={10} />
            </button>
            {showLayoutMenu && (
              <div className='absolute right-0 top-full mt-1 bg-surface-2 border border-border rounded-lg shadow-lg py-1 z-50 min-w-[160px] animate-scale-in'>
                {LAYOUT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setLayout(opt.value)
                      setShowLayoutMenu(false)
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition ${
                      layout === opt.value
                        ? 'text-accent bg-accent-muted'
                        : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary'
                    }`}
                  >
                    <opt.icon size={12} />
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Color picker */}
          <div className='relative'>
            <button
              onClick={() => {
                setShowColorMenu(!showColorMenu)
                setShowLayoutMenu(false)
              }}
              className='flex items-center gap-1 px-2 py-1 text-xs bg-surface-2 border border-border-subtle rounded-md text-text-secondary hover:text-text-primary hover:border-border-hover transition'
              title='Color mode'
            >
              <Palette size={12} />
              {COLOR_OPTIONS.find((o) => o.value === colorMode)?.label}
              <ChevronDown size={10} />
            </button>
            {showColorMenu && (
              <div className='absolute right-0 top-full mt-1 bg-surface-2 border border-border rounded-lg shadow-lg py-1 z-50 min-w-[180px] animate-scale-in'>
                {COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setColorMode(opt.value)
                      setShowColorMenu(false)
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs transition ${
                      colorMode === opt.value
                        ? 'text-accent bg-accent-muted'
                        : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => fitView({ padding: 0.1, duration: 400 })}
            className='p-1.5 bg-surface-2 border border-border-subtle rounded-md text-text-secondary hover:text-text-primary hover:border-border-hover transition'
            title='Fit to view'
          >
            <Focus size={13} />
          </button>

          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            className={`flex items-center gap-1 px-2 py-1 text-xs border rounded-md transition ${
              showAnalytics
                ? 'bg-accent-muted border-accent/30 text-accent'
                : 'bg-surface-2 border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-hover'
            }`}
            title='Toggle analytics'
          >
            <BarChart3 size={12} />
            Analytics
          </button>

          {collapsed.size > 0 && (
            <button
              onClick={() => setCollapsed(new Set())}
              className='px-2 py-1 text-xs text-accent hover:text-accent-hover font-medium transition'
            >
              Expand all
            </button>
          )}

          <div className='w-px h-5 bg-border-subtle mx-1' />

          <button
            onClick={onClose}
            className='p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-3 transition'
            title='Close (Esc)'
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* ── BODY ────────────────────────────────────────────────── */}
      <div className='flex-1 flex overflow-hidden relative'>
        {/* Graph canvas */}
        <div className='flex-1 relative'>
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={RF_NODE_TYPES}
            fitView
            fitViewOptions={{ padding: 0.1 }}
            minZoom={0.05}
            maxZoom={3}
            attributionPosition='bottom-right'
            onClick={() => {
              setShowLayoutMenu(false)
              setShowColorMenu(false)
            }}
          >
            <Background color='#2a2f38' gap={24} size={1} />
            <Controls
              showInteractive={false}
              style={{
                borderRadius: 8,
                boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
              }}
            />
            <MiniMap
              nodeColor={(n) => {
                const gn = n.data?.graphNode as GraphNode | undefined
                if (!gn) return '#6b7080'
                return getNodeColors(gn, colorMode, graphNodes, graphEdges)
                  .accent
              }}
              maskColor='rgba(13,15,17,0.85)'
              style={{ border: '1px solid #2a2f38', borderRadius: 8 }}
              pannable
              zoomable
            />
          </ReactFlow>

          {/* Legend bar at bottom */}
          <div className='absolute bottom-2 left-2 right-2 mx-auto max-w-3xl'>
            <div className='bg-surface-1/90 backdrop-blur border border-border-subtle rounded-lg px-4 py-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[10px]'>
              {colorMode === 'type' &&
                (
                  Object.entries(NODE_COLORS) as [
                    NodeType,
                    (typeof NODE_COLORS)[NodeType],
                  ][]
                ).map(([type, c]) => (
                  <div
                    key={type}
                    className='flex items-center gap-1 text-text-tertiary'
                  >
                    <span
                      className='w-2.5 h-2.5 rounded-sm'
                      style={{
                        background: c.bg,
                        border: `1px solid ${c.border}`,
                      }}
                    />
                    <span>{type.replace('_', ' ')}</span>
                  </div>
                ))}
              {colorMode === 'state' &&
                (
                  Object.entries(STATE_COLORS) as [
                    ArgumentState,
                    (typeof STATE_COLORS)[ArgumentState],
                  ][]
                ).map(([state, c]) => (
                  <div
                    key={state}
                    className='flex items-center gap-1 text-text-tertiary'
                  >
                    <span
                      className='w-2.5 h-2.5 rounded-sm'
                      style={{
                        background: c.bg,
                        border: `1px solid ${c.border}`,
                      }}
                    />
                    <span>{state}</span>
                  </div>
                ))}
              {colorMode === 'age' && (
                <>
                  <span className='text-text-tertiary flex items-center gap-1'>
                    <span
                      className='w-8 h-2.5 rounded-sm'
                      style={{
                        background:
                          'linear-gradient(90deg, hsl(240,60%,30%), hsl(360,80%,55%))',
                      }}
                    />
                    Oldest → Newest
                  </span>
                </>
              )}
              {colorMode === 'connectivity' && (
                <>
                  <div className='flex items-center gap-1 text-text-tertiary'>
                    <span
                      className='w-2.5 h-2.5 rounded-sm'
                      style={{ background: '#3a3f4a' }}
                    />{' '}
                    Low
                  </div>
                  <div className='flex items-center gap-1 text-text-tertiary'>
                    <span
                      className='w-2.5 h-2.5 rounded-sm'
                      style={{ background: '#6366f1' }}
                    />{' '}
                    Medium
                  </div>
                  <div className='flex items-center gap-1 text-text-tertiary'>
                    <span
                      className='w-2.5 h-2.5 rounded-sm'
                      style={{ background: '#818cf8' }}
                    />{' '}
                    High
                  </div>
                </>
              )}
              {/* Edge legend */}
              <div className='w-px h-3 bg-border-subtle self-center' />
              {(
                Object.entries(EDGE_COLORS) as [EdgeRelationship, string][]
              ).map(([rel, color]) => (
                <div
                  key={rel}
                  className='flex items-center gap-1 text-text-tertiary'
                >
                  <span
                    className='w-3 h-0.5 rounded-full'
                    style={{ background: color }}
                  />
                  <span>{rel}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Analytics sidebar */}
        {showAnalytics && (
          <aside className='w-72 border-l border-border bg-surface-1 shrink-0 overflow-hidden animate-slide-in-right'>
            <div className='h-full flex flex-col'>
              <div className='px-3 py-2.5 border-b border-border flex items-center justify-between shrink-0'>
                <div className='flex items-center gap-1.5'>
                  <BarChart3 size={13} className='text-accent' />
                  <span className='text-xs font-semibold text-text-secondary uppercase tracking-wider'>
                    Analytics
                  </span>
                </div>
                <button
                  onClick={() => setShowAnalytics(false)}
                  className='p-1 rounded hover:bg-surface-3 text-text-tertiary hover:text-text-secondary transition'
                >
                  <X size={12} />
                </button>
              </div>
              <div className='flex-1 overflow-y-auto'>
                <MapAnalytics
                  nodes={visibleNodes}
                  edges={visibleEdges}
                  onHighlightNode={(id) => {
                    setSelectedNodeId(id)
                  }}
                />
              </div>
            </div>
          </aside>
        )}

        {/* Node detail panel */}
        {selectedNode && (
          <NodeDetailPanel
            node={selectedNode}
            edges={graphEdges}
            allNodes={graphNodes}
            onClose={() => setSelectedNodeId(null)}
          />
        )}
      </div>
    </div>
  )
}

export function ArgumentMapExpanded(props: Props) {
  return (
    <ReactFlowProvider>
      <ExpandedMapInner {...props} />
    </ReactFlowProvider>
  )
}
