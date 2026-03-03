import { useState, useMemo } from 'react'
import { GraphNode, GraphEdge, NodeType, DiscourseTrack } from '../types'
import { ChevronDown, ChevronRight, Search, Layers } from 'lucide-react'

const TYPE_DOTS: Record<NodeType, string> = {
  assertion: '#BF557B',
  counter: '#ef4444',
  qualification: '#f59e0b',
  exception: '#f97316',
  synthesis: '#22c55e',
  reframe: '#a855f7',
  open_question: '#6e5a7e',
  concession: '#14b8a6',
}

interface TreeItem {
  node: GraphNode
  children: TreeItem[]
}

function buildTree(nodes: GraphNode[], edges: GraphEdge[]): TreeItem[] {
  const childrenOf = new Map<string, string[]>()
  const hasParent = new Set<string>()
  for (const e of edges) {
    /* edge.source = child, edge.target = parent */
    if (!childrenOf.has(e.target)) childrenOf.set(e.target, [])
    childrenOf.get(e.target)!.push(e.source)
    hasParent.add(e.source)
  }
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  function build(id: string): TreeItem | null {
    const node = nodeMap.get(id)
    if (!node) return null
    const kidIds = childrenOf.get(id) ?? []
    const children = kidIds.map(build).filter(Boolean) as TreeItem[]
    return { node, children }
  }

  const roots = nodes.filter((n) => !hasParent.has(n.id))
  return roots.map((r) => build(r.id)).filter(Boolean) as TreeItem[]
}

function ExplorerNode({
  item,
  depth,
  selectedId,
  onSelect,
  collapsedIds,
  toggleCollapse,
}: {
  item: TreeItem
  depth: number
  selectedId: string | null
  onSelect: (id: string) => void
  collapsedIds: Set<string>
  toggleCollapse: (id: string) => void
}) {
  const n = item.node
  const isCollapsed = collapsedIds.has(n.id)
  const hasKids = item.children.length > 0
  const isSelected = selectedId === n.id
  const summary =
    n.ai_summary ??
    (n.content.length > 60 ? n.content.slice(0, 60) + '\u2026' : n.content)
  const dotColor = TYPE_DOTS[n.node_type] ?? '#6e5a7e'

  return (
    <div>
      <div
        className={`group flex items-start gap-1.5 px-2 py-1.5 cursor-pointer rounded-md transition-colors ${
          isSelected
            ? 'bg-accent-muted text-text-primary'
            : 'hover:bg-surface-3 text-text-secondary'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(n.id)}
      >
        {/* Expand/collapse toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (hasKids) toggleCollapse(n.id)
          }}
          className='shrink-0 w-4 h-4 flex items-center justify-center mt-0.5'
        >
          {hasKids ? (
            isCollapsed ? (
              <ChevronRight size={12} className='text-text-tertiary' />
            ) : (
              <ChevronDown size={12} className='text-text-tertiary' />
            )
          ) : (
            <span className='w-1' />
          )}
        </button>

        {/* Type dot */}
        <span
          className='shrink-0 w-2 h-2 rounded-full mt-1.5'
          style={{ background: dotColor }}
        />

        {/* Summary text */}
        <div className='min-w-0 flex-1'>
          <p className='text-xs leading-snug line-clamp-2'>{summary}</p>
          <div className='flex items-center gap-2 mt-0.5'>
            <span className='text-[10px] text-text-tertiary'>
              {n.author_display_name}
            </span>
            {n.track_name && (
              <span className='text-[10px] text-text-tertiary opacity-60'>
                · {n.track_name}
              </span>
            )}
            {item.children.length > 0 && (
              <span className='text-[10px] text-text-tertiary opacity-50'>
                {item.children.length} replies
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Children */}
      {hasKids && !isCollapsed && (
        <div>
          {item.children.map((child) => (
            <ExplorerNode
              key={child.node.id}
              item={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              collapsedIds={collapsedIds}
              toggleCollapse={toggleCollapse}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface Props {
  graphNodes: GraphNode[]
  graphEdges: GraphEdge[]
  tracks: DiscourseTrack[]
  onNodeClick: (nodeId: string) => void
  selectedId: string | null
}

export function ExplorerSidebar({
  graphNodes,
  graphEdges,
  tracks,
  onNodeClick,
  selectedId,
}: Props) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [filterTrack, setFilterTrack] = useState('all')

  const toggleCollapse = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const filtered = useMemo(() => {
    let nodes = graphNodes
    if (filterTrack !== 'all')
      nodes = nodes.filter((n) => n.track_id === filterTrack)
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      const matchIds = new Set(
        nodes
          .filter(
            (n) =>
              (n.ai_summary ?? n.content).toLowerCase().includes(q) ||
              n.author_display_name.toLowerCase().includes(q),
          )
          .map((n) => n.id),
      )
      nodes = nodes.filter((n) => matchIds.has(n.id))
    }
    return nodes
  }, [graphNodes, filterTrack, searchTerm])

  const tree = useMemo(
    () => buildTree(filtered, graphEdges),
    [filtered, graphEdges],
  )

  return (
    <div className='flex flex-col h-full'>
      {/* Header */}
      <div className='px-3 py-2.5 border-b border-border flex items-center justify-between'>
        <div className='flex items-center gap-1.5'>
          <Layers size={13} className='text-text-tertiary' />
          <span className='text-xs font-semibold text-text-secondary uppercase tracking-wider'>
            Argument Map
          </span>
        </div>
        <span className='text-[10px] text-text-tertiary'>
          {graphNodes.length}
        </span>
      </div>

      {/* Search + filter */}
      <div className='px-2 py-2 space-y-1.5 border-b border-border-subtle'>
        <div className='relative'>
          <Search
            size={12}
            className='absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary'
          />
          <input
            type='text'
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder='Filter arguments...'
            className='w-full bg-surface-2 border border-border-subtle rounded pl-7 pr-2 py-1 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50'
          />
        </div>
        {tracks.length > 0 && (
          <select
            value={filterTrack}
            onChange={(e) => setFilterTrack(e.target.value)}
            className='w-full bg-surface-2 border border-border-subtle rounded px-2 py-1 text-xs text-text-secondary focus:outline-none focus:border-accent/50'
          >
            <option value='all'>All currents</option>
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Tree */}
      <div className='flex-1 overflow-y-auto py-1'>
        {tree.length === 0 ? (
          <div className='px-3 py-8 text-center'>
            <p className='text-xs text-text-tertiary'>No arguments yet.</p>
          </div>
        ) : (
          tree.map((item) => (
            <ExplorerNode
              key={item.node.id}
              item={item}
              depth={0}
              selectedId={selectedId}
              onSelect={onNodeClick}
              collapsedIds={collapsedIds}
              toggleCollapse={toggleCollapse}
            />
          ))
        )}
      </div>

      {/* Legend */}
      <div className='px-3 py-2 border-t border-border-subtle'>
        <div className='flex flex-wrap gap-x-3 gap-y-1'>
          {(Object.entries(TYPE_DOTS) as [NodeType, string][]).map(
            ([type, color]) => (
              <div
                key={type}
                className='flex items-center gap-1 text-[10px] text-text-tertiary'
              >
                <span
                  className='w-1.5 h-1.5 rounded-full shrink-0'
                  style={{ background: color }}
                />
                {type.replace('_', ' ')}
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  )
}
