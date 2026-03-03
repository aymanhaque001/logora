import { useState, useMemo, useCallback } from 'react'
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
} from 'reactflow'
import dagre from 'dagre'
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  SimulationNodeDatum,
} from 'd3-force'
import 'reactflow/dist/style.css'
import {
  GraphNode,
  GraphEdge,
  NodeType,
  EdgeRelationship,
  DiscourseTrack,
  MeshGraphEdge,
  MeshGraphData,
} from '../types'
import {
  ChevronDown,
  ChevronRight,
  Maximize2,
  GitBranch,
  Waves,
  Brain,
} from 'lucide-react'

export const NODE_COLORS: Record<
  NodeType,
  { bg: string; border: string; text: string; accent: string }
> = {
  assertion: {
    bg: '#1e1b4b',
    border: '#BF557B',
    text: '#c7d2fe',
    accent: '#BF557B',
  },
  counter: {
    bg: '#450a0a',
    border: '#ef4444',
    text: '#fecaca',
    accent: '#ef4444',
  },
  qualification: {
    bg: '#451a03',
    border: '#f59e0b',
    text: '#fde68a',
    accent: '#f59e0b',
  },
  exception: {
    bg: '#431407',
    border: '#f97316',
    text: '#fed7aa',
    accent: '#f97316',
  },
  synthesis: {
    bg: '#052e16',
    border: '#22c55e',
    text: '#bbf7d0',
    accent: '#22c55e',
  },
  reframe: {
    bg: '#3b0764',
    border: '#a855f7',
    text: '#e9d5ff',
    accent: '#a855f7',
  },
  open_question: {
    bg: '#1e1528',
    border: '#6e5a7e',
    text: '#a893b8',
    accent: '#6e5a7e',
  },
  concession: {
    bg: '#042f2e',
    border: '#14b8a6',
    text: '#99f6e4',
    accent: '#14b8a6',
  },
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

const NODE_W = 240
const NODE_H = 92
const NODE_H_CONCEPT = 76

function applyLRLayout(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: 'LR',
    ranksep: 100,
    nodesep: 35,
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

interface SimNode extends SimulationNodeDatum {
  id: string
}

function applyForceLayout(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes
  const simNodes: SimNode[] = nodes.map((n, i) => ({
    id: n.id,
    x: (i % 6) * 280 - 700,
    y: Math.floor(i / 6) * 180 - 400,
  }))
  const idMap = new Map(simNodes.map((n) => [n.id, n]))
  const simLinks = edges
    .filter(
      (e) => idMap.has(e.source as string) && idMap.has(e.target as string),
    )
    .map((e) => ({
      source: idMap.get(e.source as string)!,
      target: idMap.get(e.target as string)!,
    }))

  const sim = forceSimulation(simNodes)
    .force(
      'link',
      forceLink(simLinks)
        .id((d: any) => d.id)
        .distance(320)
        .strength(0.35),
    )
    .force('charge', forceManyBody().strength(-750))
    .force('center', forceCenter(0, 0))
    .force('collide', forceCollide(155).strength(1))
    .stop()

  for (let i = 0; i < 350; i++) sim.tick()

  const posMap = new Map(
    simNodes.map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }]),
  )
  return nodes.map((n) => ({
    ...n,
    position: posMap.get(n.id) ?? { x: 0, y: 0 },
  }))
}

function getChildIds(nodeId: string, edges: GraphEdge[]): string[] {
  return edges.filter((e) => e.target === nodeId).map((e) => e.source)
}

function getAllDescendants(
  nodeId: string,
  edges: (GraphEdge | MeshGraphEdge)[],
): Set<string> {
  const result = new Set<string>()
  const queue = edges.filter((e) => e.target === nodeId).map((e) => e.source)
  while (queue.length) {
    const cur = queue.shift()!
    if (!result.has(cur)) {
      result.add(cur)
      edges
        .filter((e) => e.target === cur)
        .map((e) => e.source)
        .forEach((c) => queue.push(c))
    }
  }
  return result
}

interface NodeData {
  graphNode: GraphNode
  childCount: number
  collapsed: boolean
  onToggle: (id: string) => void
  onNodeClick: (id: string) => void
  isMesh: boolean
  meshTopicLabel: string
  knowledgeMode: boolean
}

function ArgumentNodeCard({ data }: NodeProps<NodeData>) {
  const {
    graphNode: n,
    childCount,
    collapsed,
    onToggle,
    onNodeClick,
    isMesh,
    meshTopicLabel,
    knowledgeMode,
  } = data
  const c = NODE_COLORS[n.node_type] ?? NODE_COLORS.assertion
  const hasChildren = childCount > 0
  const concept = n.ai_summary ?? null
  const fallback =
    n.content.length > 88 ? n.content.slice(0, 86) + '\u2026' : n.content

  if (knowledgeMode) {
    return (
      <div
        onClick={() => onNodeClick(n.id)}
        style={{
          background: isMesh ? '#0a0613' : '#120b1c',
          borderLeft: `4px solid ${c.border}`,
          border: `1px solid ${c.border}${isMesh ? '30' : '40'}`,
          borderRadius: 8,
          width: NODE_W,
          cursor: 'pointer',
          opacity: isMesh ? 0.78 : 1,
          fontFamily: "'Work Sans', system-ui, sans-serif",
          boxShadow: `0 1px 8px rgba(0,0,0,0.4)`,
        }}
      >
        <Handle
          type='target'
          position={Position.Left}
          style={{
            background: c.border,
            width: 7,
            height: 7,
            border: '2px solid #0e0812',
            left: -6,
          }}
        />

        {isMesh && (
          <div
            style={{
              padding: '2px 9px',
              borderBottom: `1px solid ${c.border}20`,
              fontSize: 9,
              color: c.accent,
              opacity: 0.7,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            ↗ {meshTopicLabel}
          </div>
        )}

        {/* Type row */}
        <div
          style={{
            padding: '5px 9px 2px',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <span
            style={{
              color: c.accent,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
            }}
          >
            {n.node_type.replace('_', ' ')}
          </span>
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggle(n.id)
              }}
              style={{
                marginLeft: 'auto',
                background: collapsed ? c.accent : 'transparent',
                color: collapsed ? '#0e0812' : '#6e5a7e',
                border: `1px solid ${collapsed ? c.accent : '#3a2848'}`,
                borderRadius: 3,
                padding: '1px 5px',
                fontSize: 9,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                fontWeight: 600,
              }}
            >
              {collapsed ? <ChevronRight size={8} /> : <ChevronDown size={8} />}
              {childCount}
            </button>
          )}
          {!hasChildren && n.sources_count > 0 && (
            <span
              style={{
                marginLeft: 'auto',
                background: c.accent + '20',
                color: c.accent,
                fontSize: 8,
                padding: '1px 4px',
                borderRadius: 3,
                fontWeight: 600,
              }}
            >
              {n.sources_count}src
            </span>
          )}
        </div>

        {/* Concept text — THE primary display */}
        <div style={{ padding: '3px 10px 8px' }}>
          <p
            style={{
              margin: 0,
              fontSize: 12.5,
              lineHeight: 1.45,
              color: concept ? '#f0eaf4' : '#7a6888',
              fontWeight: concept ? 400 : 300,
              fontStyle: concept ? 'normal' : 'italic',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {concept ?? fallback}
          </p>
        </div>

        <Handle
          type='source'
          position={Position.Right}
          style={{
            background: c.border,
            width: 7,
            height: 7,
            border: '2px solid #0e0812',
            right: -6,
          }}
        />
      </div>
    )
  }

  /* ── Regular mode ── */
  return (
    <div
      onClick={() => onNodeClick(n.id)}
      style={{
        background: isMesh ? '#0e0812' : '#160f1e',
        borderLeft: `5px solid ${c.border}`,
        border: `1px solid ${c.border}${isMesh ? '40' : '55'}`,
        borderRadius: 8,
        width: NODE_W,
        cursor: 'pointer',
        opacity: isMesh ? 0.82 : 1,
        fontFamily: "'Work Sans', system-ui, sans-serif",
        boxShadow: `0 2px 12px rgba(0,0,0,${isMesh ? '0.2' : '0.35'})`,
      }}
    >
      <Handle
        type='target'
        position={Position.Left}
        style={{
          background: c.border,
          width: 7,
          height: 7,
          border: '2px solid #0e0812',
          left: -6,
        }}
      />

      {isMesh && (
        <div
          style={{
            padding: '3px 10px',
            borderBottom: `1px solid ${c.border}20`,
            fontSize: 9,
            color: c.accent,
            fontWeight: 500,
            letterSpacing: '0.03em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            opacity: 0.75,
          }}
        >
          ↗ {meshTopicLabel}
        </div>
      )}

      <div
        style={{
          padding: '5px 10px 4px',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span
          style={{
            color: c.accent,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            flexShrink: 0,
          }}
        >
          {n.node_type.replace('_', ' ')}
        </span>
        <span style={{ flex: 1 }} />
        {n.sources_count > 0 && (
          <span
            style={{
              background: c.accent + '22',
              color: c.accent,
              fontSize: 9,
              padding: '1px 5px',
              borderRadius: 3,
              fontWeight: 600,
            }}
          >
            {n.sources_count}src
          </span>
        )}
        {n.nuance_tags[0] && (
          <span
            style={{
              background: '#281d34',
              color: '#6e5a7e',
              fontSize: 9,
              padding: '1px 4px',
              borderRadius: 3,
            }}
          >
            {n.nuance_tags[0].replace(/_/g, ' ')}
          </span>
        )}
      </div>

      <div style={{ padding: '0 10px 5px' }}>
        <p
          style={{
            margin: 0,
            fontSize: 11.5,
            lineHeight: 1.4,
            color: concept ? '#f0eaf4' : '#c4adc9',
            fontWeight: concept ? 400 : 300,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {concept ?? fallback}
        </p>
      </div>

      <div
        style={{
          padding: '4px 8px 5px',
          borderTop: '1px solid #281d34',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span
          style={{
            fontSize: 9.5,
            color: '#6e5a7e',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {n.author_display_name}
          {n.track_name && (
            <span style={{ color: c.accent + '80', marginLeft: 4 }}>
              · {n.track_name}
            </span>
          )}
        </span>
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggle(n.id)
            }}
            style={{
              background: collapsed ? c.accent : '#281d34',
              color: collapsed ? '#0e0812' : '#a893b8',
              border: 'none',
              borderRadius: 4,
              padding: '2px 7px',
              fontSize: 9.5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {collapsed ? <ChevronRight size={9} /> : <ChevronDown size={9} />}
            {childCount}
          </button>
        )}
      </div>

      <Handle
        type='source'
        position={Position.Right}
        style={{
          background: c.border,
          width: 7,
          height: 7,
          border: '2px solid #0e0812',
          right: -6,
        }}
      />
    </div>
  )
}

const RF_NODE_TYPES = { argument: ArgumentNodeCard }

/* ═══════════════════════════════════════════════════
   PROPS & GRAPH INNER
   ═══════════════════════════════════════════════════ */

export interface ArgumentGraphProps {
  graphNodes: GraphNode[]
  graphEdges: GraphEdge[]
  tracks: DiscourseTrack[]
  onNodeClick?: (nodeId: string) => void
  onExpand?: () => void
  meshData?: MeshGraphData
  currentTopicId?: string
}

type LayoutMode = 'tree' | 'rhizome'

function GraphInner({
  graphNodes,
  graphEdges,
  tracks,
  onNodeClick,
  onExpand,
  meshData,
  currentTopicId,
}: ArgumentGraphProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [filterTrack, setFilterTrack] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('tree')
  const [knowledgeMode, setKnowledgeMode] = useState(false)

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const handleNodeClick = useCallback(
    (id: string) => {
      onNodeClick?.(id)
    },
    [onNodeClick],
  )

  /* Merge local + mesh nodes */
  const allNodes = useMemo<GraphNode[]>(() => {
    if (!meshData) return graphNodes
    const localIds = new Set(graphNodes.map((n) => n.id))
    return [...graphNodes, ...meshData.nodes.filter((n) => !localIds.has(n.id))]
  }, [graphNodes, meshData])

  const allEdges = useMemo<(GraphEdge | MeshGraphEdge)[]>(() => {
    if (!meshData) return graphEdges
    const localEdgeIds = new Set(graphEdges.map((e) => e.id))
    return [
      ...graphEdges,
      ...meshData.edges.filter((e) => !localEdgeIds.has(e.id)),
    ]
  }, [graphEdges, meshData])

  const { visibleNodes, visibleEdges } = useMemo(() => {
    let filtered = allNodes
    if (filterTrack !== 'all')
      filtered = filtered.filter((n) => n.track_id === filterTrack)
    if (filterType !== 'all')
      filtered = filtered.filter((n) => n.node_type === filterType)
    const visibleIds = new Set(filtered.map((n) => n.id))
    collapsed.forEach((cid) => {
      getAllDescendants(cid, allEdges).forEach((d) => visibleIds.delete(d))
    })
    return {
      visibleNodes: filtered.filter((n) => visibleIds.has(n.id)),
      visibleEdges: allEdges.filter(
        (e) => visibleIds.has(e.source) && visibleIds.has(e.target),
      ),
    }
  }, [allNodes, allEdges, collapsed, filterTrack, filterType])

  const rfNodes: Node[] = useMemo(() => {
    const rawEdges: Edge[] = visibleEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
    }))
    const raw: Node[] = visibleNodes.map((n) => ({
      id: n.id,
      type: 'argument',
      position: { x: 0, y: 0 },
      data: {
        graphNode: n,
        childCount: getChildIds(n.id, graphEdges).filter((c) =>
          visibleNodes.some((v) => v.id === c),
        ).length,
        collapsed: collapsed.has(n.id),
        onToggle: toggleCollapse,
        onNodeClick: handleNodeClick,
        isMesh: !!meshData && n.topic_id !== currentTopicId,
        meshTopicLabel: meshData?.topic_labels?.[n.topic_id] ?? 'linked debate',
        knowledgeMode,
      } satisfies NodeData,
    }))
    return layoutMode === 'tree'
      ? applyLRLayout(raw, rawEdges, knowledgeMode ? NODE_H_CONCEPT : NODE_H)
      : applyForceLayout(raw, rawEdges)
  }, [
    visibleNodes,
    visibleEdges,
    collapsed,
    toggleCollapse,
    handleNodeClick,
    graphEdges,
    layoutMode,
    meshData,
    currentTopicId,
    knowledgeMode,
  ])

  const rfEdges: Edge[] = useMemo(() => {
    return visibleEdges.map((e) => {
      const isCross =
        'is_cross_topic' in e && (e as MeshGraphEdge).is_cross_topic
      const rel = e.relationship_type as EdgeRelationship
      const strokeColor = isCross ? '#f59e0b' : (EDGE_COLORS[rel] ?? '#6e5a7e')
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        label: isCross ? `↗ ${e.relationship_type}` : e.relationship_type,
        animated: ['challenges', 'contradicts'].includes(rel),
        style: {
          stroke: strokeColor,
          strokeWidth: isCross ? 2 : 1.5,
          strokeDasharray: isCross ? '6 3' : undefined,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: strokeColor,
          width: 11,
          height: 11,
        },
        labelStyle: {
          fontSize: 9,
          fill: isCross ? '#f59e0b' : '#a893b8',
          fontWeight: 500,
        },
        labelBgStyle: { fill: 'rgba(14,8,18,0.9)' },
        labelBgPadding: [3, 5] as [number, number],
        labelBgBorderRadius: 4,
      }
    })
  }, [visibleEdges])

  if (graphNodes.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center h-48 text-text-tertiary gap-2'>
        <p className='text-sm font-light'>
          Submit the first argument to see the graph.
        </p>
      </div>
    )
  }

  return (
    <div className='flex flex-col h-full'>
      {/* Toolbar */}
      <div className='flex flex-wrap items-center gap-2 px-3 py-2 bg-surface-2 border-b border-border-subtle text-xs shrink-0'>
        <span className='text-text-tertiary font-medium'>filter:</span>
        <select
          value={filterTrack}
          onChange={(e) => setFilterTrack(e.target.value)}
          className='border border-border-subtle rounded-lg px-2 py-1 text-xs bg-surface-1 text-text-secondary focus:outline-none focus:border-accent/50'
        >
          <option value='all'>all tracks</option>
          {tracks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className='border border-border-subtle rounded-lg px-2 py-1 text-xs bg-surface-1 text-text-secondary focus:outline-none focus:border-accent/50'
        >
          <option value='all'>all types</option>
          {(Object.keys(NODE_COLORS) as NodeType[]).map((t) => (
            <option key={t} value={t}>
              {t.replace('_', ' ')}
            </option>
          ))}
        </select>

        {/* Layout toggle */}
        <div className='flex rounded-lg overflow-hidden border border-border-subtle ml-1'>
          <button
            onClick={() => setLayoutMode('tree')}
            className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium transition-colors ${
              layoutMode === 'tree'
                ? 'bg-accent text-white'
                : 'bg-surface-1 text-text-tertiary hover:text-text-secondary'
            }`}
          >
            <GitBranch size={9} /> tree
          </button>
          <button
            onClick={() => setLayoutMode('rhizome')}
            className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium transition-colors ${
              layoutMode === 'rhizome'
                ? 'bg-accent text-white'
                : 'bg-surface-1 text-text-tertiary hover:text-text-secondary'
            }`}
          >
            <Waves size={9} /> rhizome
          </button>
        </div>

        {/* Knowledge mode toggle */}
        <button
          onClick={() => setKnowledgeMode((k) => !k)}
          title='Knowledge mode — shows only distilled concepts'
          className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded-lg border transition-colors ${
            knowledgeMode
              ? 'bg-accent text-white border-accent'
              : 'border-border-subtle bg-surface-1 text-text-tertiary hover:text-text-secondary'
          }`}
        >
          <Brain size={9} /> concepts
        </button>

        <span className='ml-auto text-text-tertiary'>
          {rfNodes.length} nodes
          {meshData ? ` (${allNodes.length - graphNodes.length} linked)` : ''}
        </span>
        {onExpand && (
          <button
            onClick={onExpand}
            className='flex items-center gap-1 text-accent hover:text-accent-hover font-medium transition'
          >
            <Maximize2 size={11} /> focus
          </button>
        )}
        {collapsed.size > 0 && (
          <button
            onClick={() => setCollapsed(new Set())}
            className='text-accent hover:text-accent-hover font-medium transition'
          >
            expand all
          </button>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 380 }}>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={RF_NODE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.1 }}
          minZoom={0.12}
          maxZoom={2}
          attributionPosition='bottom-right'
        >
          <Background color='#2e1f3a' gap={20} size={1} />
          <Controls
            showInteractive={false}
            style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
          />
          <MiniMap
            nodeColor={(n) =>
              NODE_COLORS[n.data?.graphNode?.node_type as NodeType]?.accent ??
              '#6e5a7e'
            }
            maskColor='rgba(14,8,18,0.85)'
            style={{ border: '1px solid #2e1f3a', borderRadius: 8 }}
          />
        </ReactFlow>
      </div>

      {/* Legend */}
      <div className='flex flex-wrap gap-x-3 gap-y-1 px-3 py-2 border-t border-border-subtle text-[10px] shrink-0'>
        {(
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
              className='w-2 h-2 rounded-sm'
              style={{ background: c.bg, border: `1px solid ${c.border}` }}
            />
            <span>{type.replace('_', ' ')}</span>
          </div>
        ))}
        {meshData && (
          <div className='flex items-center gap-1 text-amber-400/70 ml-2'>
            <span className='w-2 h-2 rounded-sm border border-amber-400/40 bg-transparent' />
            <span>linked debate</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function ArgumentGraph(props: ArgumentGraphProps) {
  return (
    <ReactFlowProvider>
      <GraphInner {...props} />
    </ReactFlowProvider>
  )
}
