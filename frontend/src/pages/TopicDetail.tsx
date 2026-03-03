import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import {
  getTopic,
  getBriefing,
  getArguments,
  getGraph,
  getTracks,
  deleteArgument,
  transitionArgumentState,
  deleteTopic,
  archiveTopic,
  getCatchUp,
  getMeshGraph,
  batchSummarize,
  getCurrentFlow,
  reclusterCurrents,
} from '../api/client'
import {
  ArgumentNode,
  BriefingData,
  GraphData,
  Topic,
  DiscourseTrack,
  CatchUpData,
  MeshGraphData,
  CurrentFlowData,
} from '../types'
import { CatchUpModal } from '../components/CatchUpModal'
import { BriefingRoom } from '../components/BriefingRoom'
import { ArgumentCard } from '../components/ArgumentCard'
import { SubmitArgumentForm } from '../components/SubmitArgumentForm'
import { ExplorerSidebar } from '../components/ExplorerSidebar'
import { ArgumentGraph } from '../components/ArgumentGraph'
import { CurrentFlowGraph } from '../components/CurrentFlowGraph'
import { ArgumentMapExpanded } from '../components/ArgumentMapExpanded'
import { RAGQueryPanel } from '../components/RAGQueryPanel'
import { useAuth } from '../hooks/useAuth'
import {
  MapPin,
  Tag,
  Plus,
  GitBranch,
  Archive,
  Trash2,
  ArrowLeft,
  CheckCircle2,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
  Maximize2,
  MessageSquare,
  Network,
  Waves,
  Brain,
  ChevronDown,
  ChevronUp,
  GitMerge,
  Bot,
  X,
  BookOpen,
} from 'lucide-react'

function buildChildMap(
  nodes: ArgumentNode[],
): Map<string | null, ArgumentNode[]> {
  const map = new Map<string | null, ArgumentNode[]>()
  for (const node of nodes) {
    const key = node.parent_id ?? null
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(node)
  }
  return map
}

interface TreeNodeProps {
  node: ArgumentNode
  childMap: Map<string | null, ArgumentNode[]>
  topicId: string
  onReply: (node: ArgumentNode) => void
  onDelete: (nodeId: string) => void
  onTransition: (nodeId: string, newState: string) => void
  onTransitionSuccess: (message: string) => void
  currentUserId?: string
  depth: number
  highlightedId: string | null
  replyToId: string | null
  onCancelReply: () => void
  onReplySuccess: () => void
}

function TreeNode({
  node,
  childMap,
  topicId,
  onReply,
  onDelete,
  onTransition,
  onTransitionSuccess,
  currentUserId,
  depth,
  highlightedId,
  replyToId,
  onCancelReply,
  onReplySuccess,
}: TreeNodeProps) {
  const children = childMap.get(node.id) ?? []
  const [childrenVisible, setChildrenVisible] = useState(true)
  const showInlineReply = replyToId === node.id

  return (
    <div>
      <ArgumentCard
        node={node}
        topicId={topicId}
        onReply={onReply}
        onDelete={onDelete}
        onTransition={onTransition}
        onTransitionSuccess={onTransitionSuccess}
        currentUserId={currentUserId}
        depth={depth}
        highlighted={highlightedId === node.id}
      />

      {/* Inline reply form — appears directly below the comment being replied to */}
      {showInlineReply && (
        <div className='ml-11'>
          <SubmitArgumentForm
            topicId={topicId}
            replyTo={node}
            onCancel={onCancelReply}
            onSuccess={onReplySuccess}
            inline
          />
        </div>
      )}

      {children.length > 0 && (
        <div className='mt-1'>
          {depth === 0 && (
            <button
              onClick={() => setChildrenVisible((v) => !v)}
              className='ml-11 mb-1 text-xs text-text-tertiary hover:text-accent flex items-center gap-1 font-medium transition-colors'
            >
              <GitBranch size={11} />
              {childrenVisible
                ? `hide ${children.length} response${children.length !== 1 ? 's' : ''}`
                : `show ${children.length} response${children.length !== 1 ? 's' : ''}`}
            </button>
          )}
          {childrenVisible && (
            <div className='ml-11 pl-4 border-l border-border-subtle space-y-1'>
              {children.map((child) => (
                <TreeNode
                  key={child.id}
                  node={child}
                  childMap={childMap}
                  topicId={topicId}
                  onReply={onReply}
                  onDelete={onDelete}
                  onTransition={onTransition}
                  onTransitionSuccess={onTransitionSuccess}
                  currentUserId={currentUserId}
                  depth={depth + 1}
                  highlightedId={highlightedId}
                  replyToId={replyToId}
                  onCancelReply={onCancelReply}
                  onReplySuccess={onReplySuccess}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function TopicDetail() {
  const { id } = useParams<{ id: string }>()
  const topicId = id!
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [replyToId, setReplyToId] = useState<string | null>(null)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [explorerOpen, setExplorerOpen] = useState(false)
  const [catchUpDismissed, setCatchUpDismissed] = useState(false)
  const [showCatchUp, setShowCatchUp] = useState(false)
  const [centerTab, setCenterTab] = useState<'comments' | 'graph'>('comments')
  const [graphMode, setGraphMode] = useState<'arguments' | 'flow'>('flow')
  const [showExpandedMap, setShowExpandedMap] = useState(false)
  const [meshMode, setMeshMode] = useState(false)
  // Briefing left panel open state — persisted, defaults open
  const [briefingPanelOpen, setBriefingPanelOpen] = useState(
    () => localStorage.getItem('briefing-panel-open') !== 'false',
  )
  // Right drawer: null = closed, 'tracks' | 'rag' | 'compose' = open panel
  const [rightDrawer, setRightDrawer] = useState<
    null | 'tracks' | 'rag' | 'compose'
  >(null)
  // Active track filter — null means show all
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null)

  const toggleBriefing = useCallback(() => {
    setBriefingPanelOpen((v) => {
      localStorage.setItem('briefing-panel-open', String(!v))
      return !v
    })
  }, [])

  const toggleDrawer = useCallback((panel: 'tracks' | 'rag' | 'compose') => {
    setRightDrawer((v) => (v === panel ? null : panel))
  }, [])

  const showToast = useCallback((message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 3000)
  }, [])

  const { data: topic } = useQuery<Topic>({
    queryKey: ['topic', topicId],
    queryFn: () => getTopic(topicId),
  })
  const { data: tracks = [] } = useQuery<DiscourseTrack[]>({
    queryKey: ['tracks', topicId],
    queryFn: () => getTracks(topicId),
  })
  const { data: briefing } = useQuery<BriefingData>({
    queryKey: ['briefing', topicId],
    queryFn: () => getBriefing(topicId),
  })
  const { data: nodes } = useQuery<ArgumentNode[]>({
    queryKey: ['arguments', topicId],
    queryFn: () => getArguments(topicId),
  })
  const { data: graphData } = useQuery<GraphData>({
    queryKey: ['graph', topicId],
    queryFn: () => getGraph(topicId),
  })
  const { data: catchUpData } = useQuery<CatchUpData>({
    queryKey: ['catch-up', topicId],
    queryFn: () => getCatchUp(topicId),
    enabled: !catchUpDismissed,
  })
  const { data: meshData } = useQuery<MeshGraphData>({
    queryKey: ['mesh', topicId],
    queryFn: () => getMeshGraph([topicId]),
    enabled: meshMode,
  })
  const { data: currentFlowData } = useQuery<CurrentFlowData>({
    queryKey: ['current-flow', topicId],
    queryFn: () => getCurrentFlow(topicId),
    enabled: centerTab === 'graph' && graphMode === 'flow',
  })

  const childMap = useMemo(() => buildChildMap(nodes ?? []), [nodes])
  const allRootNodes = useMemo(() => childMap.get(null) ?? [], [childMap])
  const rootNodes = useMemo(() => {
    if (!selectedTrackId) return allRootNodes
    // Collect all node IDs in the selected track
    const trackNodeIds = new Set(
      (nodes ?? [])
        .filter((n) => n.track_id === selectedTrackId)
        .map((n) => n.id),
    )
    return allRootNodes.filter(
      (n) => n.track_id === selectedTrackId || trackNodeIds.has(n.id),
    )
  }, [allRootNodes, nodes, selectedTrackId])

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['arguments', topicId] })
    qc.invalidateQueries({ queryKey: ['briefing', topicId] })
    qc.invalidateQueries({ queryKey: ['graph', topicId] })
    qc.invalidateQueries({ queryKey: ['topic', topicId] })
    qc.invalidateQueries({ queryKey: ['tracks', topicId] })
    qc.invalidateQueries({ queryKey: ['catch-up', topicId] })
  }

  const handleSuccess = () => {
    setReplyToId(null)
    invalidateAll()
  }

  const handleReply = (node: ArgumentNode) => {
    setReplyToId(node.id)
    setRightDrawer('compose')
  }

  const deleteArgMutation = useMutation({
    mutationFn: (argumentId: string) => deleteArgument(topicId, argumentId),
    onSuccess: () => handleSuccess(),
  })
  const transitionMutation = useMutation({
    mutationFn: ({
      argumentId,
      newState,
    }: {
      argumentId: string
      newState: string
    }) => transitionArgumentState(topicId, argumentId, { new_state: newState }),
    onSuccess: () => handleSuccess(),
  })
  const deleteTopicMutation = useMutation({
    mutationFn: () => deleteTopic(topicId),
    onSuccess: () => navigate('/'),
  })
  const archiveTopicMutation = useMutation({
    mutationFn: () => archiveTopic(topicId),
    onSuccess: () => handleSuccess(),
  })
  const summarizeMutation = useMutation({
    mutationFn: () => batchSummarize(topicId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['graph', topicId] })
      qc.invalidateQueries({ queryKey: ['arguments', topicId] })
      showToast(`${res.updated ?? 0} concepts distilled`)
    },
  })
  const reclusterMutation = useMutation({
    mutationFn: () => reclusterCurrents(topicId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['tracks', topicId] })
      qc.invalidateQueries({ queryKey: ['current-flow', topicId] })
      qc.invalidateQueries({ queryKey: ['briefing', topicId] })
      showToast(`discovered ${res.discovered ?? 0} currents`)
    },
  })

  const handleExplorerNodeClick = useCallback((nodeId: string) => {
    setHighlightedId(nodeId)
    setTimeout(() => {
      const el = document.getElementById(`arg-${nodeId}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
    setTimeout(() => setHighlightedId(null), 3500)
  }, [])

  // Auto-show catch-up modal for newcomers
  useEffect(() => {
    if (
      catchUpData &&
      catchUpData.is_newcomer &&
      catchUpData.total_nodes > 0 &&
      !catchUpDismissed
    ) {
      setShowCatchUp(true)
    }
  }, [catchUpData, catchUpDismissed])

  const handleCatchUpClose = useCallback(() => {
    setShowCatchUp(false)
    setCatchUpDismissed(true)
  }, [])

  const handleCatchUpNavigate = useCallback(
    (argumentId: string) => {
      if (argumentId) {
        handleExplorerNodeClick(argumentId)
      }
    },
    [handleExplorerNodeClick],
  )

  if (!topic)
    return (
      <div className='max-w-6xl mx-auto px-6 py-16'>
        <div className='space-y-4'>
          <div className='h-5 w-2/3 bg-surface-2 rounded animate-pulse' />
          <div className='h-4 w-1/3 bg-surface-2 rounded animate-pulse' />
          <div className='h-48 bg-surface-2 rounded-lg animate-pulse mt-6' />
        </div>
      </div>
    )

  return (
    <div
      className='animate-fade-in flex flex-col'
      style={{ height: 'calc(100vh - 3rem)' }}
    >
      {/* ── Single chrome bar: back + title + tabs + actions ───────────────── */}
      <div className='px-3 border-b border-border bg-surface-1 shrink-0 flex items-center gap-2 h-10'>
        {/* Back */}
        <button
          onClick={() => navigate('/')}
          className='text-text-tertiary hover:text-text-secondary transition shrink-0 p-1'
        >
          <ArrowLeft size={14} />
        </button>

        {/* Title + status pill */}
        <div className='flex items-center gap-2 min-w-0 flex-1'>
          <h1 className='text-xs font-semibold text-text-primary truncate'>
            {topic.canonical_question}
          </h1>
          <span
            className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium ${
              topic.status === 'active'
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-surface-3 text-text-tertiary'
            }`}
          >
            {topic.status}
          </span>
        </div>

        {/* View tabs */}
        <div className='flex items-center shrink-0 h-full'>
          <button
            onClick={() => setCenterTab('comments')}
            className={`flex items-center gap-1 px-3 h-full text-xs font-medium border-b-2 transition-colors ${
              centerTab === 'comments'
                ? 'border-accent text-accent'
                : 'border-transparent text-text-tertiary hover:text-text-secondary'
            }`}
          >
            <MessageSquare size={11} /> Discussion
          </button>
          <button
            onClick={() => setCenterTab('graph')}
            className={`flex items-center gap-1 px-3 h-full text-xs font-medium border-b-2 transition-colors ${
              centerTab === 'graph'
                ? 'border-accent text-accent'
                : 'border-transparent text-text-tertiary hover:text-text-secondary'
            }`}
          >
            <Network size={11} /> Graph
          </button>
        </div>

        {/* Separator */}
        <div className='w-px h-4 bg-border shrink-0' />

        {/* Tool drawer toggles */}
        <div className='flex items-center gap-0.5 shrink-0'>
          {briefing && (
            <button
              onClick={toggleBriefing}
              title={briefingPanelOpen ? 'Hide briefing' : 'Show briefing'}
              className={`p-1.5 rounded transition-colors ${briefingPanelOpen ? 'text-accent bg-accent/10' : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-3'}`}
            >
              <BookOpen size={13} />
            </button>
          )}
          {tracks.length > 0 && (
            <button
              onClick={() => toggleDrawer('tracks')}
              title={`Currents (${tracks.length})`}
              className={`p-1.5 rounded transition-colors ${rightDrawer === 'tracks' ? 'text-accent bg-accent/10' : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-3'}`}
            >
              <GitMerge size={13} />
            </button>
          )}
          <button
            onClick={() => toggleDrawer('rag')}
            title='Ask AI'
            className={`p-1.5 rounded transition-colors ${rightDrawer === 'rag' ? 'text-accent bg-accent/10' : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-3'}`}
          >
            <Bot size={13} />
          </button>

          {/* Separator */}
          <div className='w-px h-4 bg-border mx-0.5 shrink-0' />

          {graphData && graphData.nodes.length > 0 && (
            <button
              onClick={() => setShowExpandedMap(true)}
              title='Focus mode'
              className='p-1.5 rounded text-text-tertiary hover:text-text-secondary hover:bg-surface-3 transition-colors'
            >
              <Maximize2 size={13} />
            </button>
          )}
          <button
            onClick={() => {
              setMeshMode((m) => !m)
              if (centerTab !== 'graph') setCenterTab('graph')
            }}
            title='Mesh view'
            className={`p-1.5 rounded transition-colors ${meshMode ? 'text-accent bg-accent/10' : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-3'}`}
          >
            <Waves size={13} />
          </button>
          <button
            onClick={() => summarizeMutation.mutate()}
            disabled={summarizeMutation.isPending}
            title='Distil concepts'
            className='p-1.5 rounded text-text-tertiary hover:text-text-secondary hover:bg-surface-3 transition-colors disabled:opacity-40'
          >
            <Brain size={13} />
          </button>
          {catchUpData && catchUpData.total_nodes > 0 && (
            <button
              onClick={() => setShowCatchUp(true)}
              title='Catch up'
              className='p-1.5 rounded text-text-tertiary hover:text-text-secondary hover:bg-surface-3 transition-colors'
            >
              <Sparkles size={13} />
            </button>
          )}
          {user &&
            topic.created_by === user.id &&
            topic.status === 'active' && (
              <button
                onClick={() => {
                  if (window.confirm('Archive this debate?'))
                    archiveTopicMutation.mutate()
                }}
                title='Archive'
                className='p-1.5 rounded text-text-tertiary hover:text-amber-400 hover:bg-amber-500/10 transition-colors'
              >
                <Archive size={13} />
              </button>
            )}
          {user && topic.created_by === user.id && topic.node_count === 0 && (
            <button
              onClick={() => {
                if (window.confirm('Delete permanently?'))
                  deleteTopicMutation.mutate()
              }}
              title='Delete'
              className='p-1.5 rounded text-text-tertiary hover:text-red-400 hover:bg-red-500/10 transition-colors'
            >
              <Trash2 size={13} />
            </button>
          )}
          <button
            onClick={() => setExplorerOpen(!explorerOpen)}
            title={explorerOpen ? 'Hide explorer' : 'Show explorer'}
            className='p-1.5 rounded text-text-tertiary hover:text-text-secondary hover:bg-surface-3 transition-colors'
          >
            {explorerOpen ? (
              <PanelLeftClose size={13} />
            ) : (
              <PanelLeft size={13} />
            )}
          </button>
        </div>
      </div>

      {/* Body: [optional briefing] [center] [optional explorer] [optional right drawer] */}
      <div className='flex-1 flex overflow-hidden relative'>
        {/* LEFT: Briefing panel */}
        {briefing && briefingPanelOpen && (
          <aside className='w-64 border-r border-border bg-surface-1 shrink-0 flex flex-col overflow-hidden'>
            <div className='px-4 pt-3 pb-2 border-b border-border shrink-0 flex items-center gap-1.5'>
              <BookOpen size={11} className='text-accent' />
              <span className='text-[10px] font-semibold text-text-secondary uppercase tracking-wider'>
                Briefing
              </span>
            </div>
            <div className='flex-1 overflow-y-auto p-4'>
              <BriefingRoom briefing={briefing} />
            </div>
          </aside>
        )}

        {/* CENTER: Comment feed / Graph view */}
        <main className='flex-1 overflow-y-auto flex flex-col min-w-0'>
          {/* Tab content */}
          {centerTab === 'comments' ? (
            <div className='flex-1 overflow-y-auto'>
              <div className='max-w-2xl mx-auto px-5 py-5'>
                {/* Track filter badge */}
                {selectedTrackId &&
                  (() => {
                    const track = tracks.find((t) => t.id === selectedTrackId)
                    return track ? (
                      <div className='flex items-center gap-2 mb-4 px-3 py-2 bg-accent/10 border border-accent/30 rounded-lg'>
                        <GitMerge size={12} className='text-accent shrink-0' />
                        <span className='text-xs text-accent font-medium flex-1 truncate'>
                          {track.name}
                        </span>
                        <button
                          onClick={() => setSelectedTrackId(null)}
                          className='text-accent/60 hover:text-accent transition'
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : null
                  })()}

                {/* Add your take button — opens right compose pane */}
                <button
                  onClick={() => {
                    setReplyToId(null)
                    toggleDrawer('compose')
                  }}
                  className={`w-full flex items-center justify-center gap-2 py-3 border border-dashed text-sm rounded-lg transition-colors font-medium mb-5 ${
                    rightDrawer === 'compose'
                      ? 'border-accent/50 text-accent bg-accent/5'
                      : 'border-border hover:border-accent/50 text-text-tertiary hover:text-accent'
                  }`}
                >
                  <Plus size={15} /> Add your take
                </button>

                {/* Arguments as comments */}
                {rootNodes.length === 0 && (
                  <div className='text-center py-20'>
                    <GitBranch
                      size={24}
                      className='text-text-tertiary mx-auto mb-2 opacity-30'
                    />
                    <p className='text-sm text-text-tertiary'>
                      No takes yet. Start the debate.
                    </p>
                  </div>
                )}

                <div className='space-y-1'>
                  {rootNodes.map((root, i) => (
                    <div
                      key={root.id}
                      className='animate-slide-up'
                      style={{
                        animationDelay: `${i * 0.03}s`,
                        animationFillMode: 'backwards',
                      }}
                    >
                      <TreeNode
                        node={root}
                        childMap={childMap}
                        topicId={topicId}
                        onReply={handleReply}
                        onDelete={(id) => deleteArgMutation.mutate(id)}
                        onTransition={(id, state) =>
                          transitionMutation.mutate({
                            argumentId: id,
                            newState: state,
                          })
                        }
                        onTransitionSuccess={showToast}
                        currentUserId={user?.id}
                        depth={0}
                        highlightedId={highlightedId}
                        replyToId={replyToId}
                        onCancelReply={() => setReplyToId(null)}
                        onReplySuccess={handleSuccess}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Graph View tab */
            <div className='flex-1 flex flex-col'>
              {/* Graph mode toggle */}
              <div className='flex items-center gap-1 px-3 py-1.5 bg-surface-2 border-b border-border-subtle shrink-0'>
                <div className='flex rounded-lg overflow-hidden border border-border-subtle'>
                  <button
                    onClick={() => setGraphMode('flow')}
                    className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium transition-colors ${
                      graphMode === 'flow'
                        ? 'bg-accent text-white'
                        : 'bg-surface-1 text-text-tertiary hover:text-text-secondary'
                    }`}
                  >
                    <Waves size={9} /> flow
                  </button>
                  <button
                    onClick={() => setGraphMode('arguments')}
                    className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium transition-colors ${
                      graphMode === 'arguments'
                        ? 'bg-accent text-white'
                        : 'bg-surface-1 text-text-tertiary hover:text-text-secondary'
                    }`}
                  >
                    <Network size={9} /> arguments
                  </button>
                </div>
              </div>

              {/* Graph content */}
              <div className='flex-1'>
                {graphMode === 'flow' ? (
                  currentFlowData && currentFlowData.currents.length > 0 ? (
                    <CurrentFlowGraph
                      data={currentFlowData}
                      onCurrentClick={(currentId) => {
                        setSelectedTrackId(currentId)
                        setRightDrawer('tracks')
                      }}
                      onRecluster={() => reclusterMutation.mutate()}
                      isReclustering={reclusterMutation.isPending}
                    />
                  ) : (
                    <div className='flex flex-col items-center justify-center h-64 text-text-tertiary gap-2'>
                      <Waves size={24} className='opacity-30' />
                      <p className='text-sm'>
                        Currents will appear as the discussion develops.
                      </p>
                    </div>
                  )
                ) : graphData && graphData.nodes.length > 0 ? (
                  <ArgumentGraph
                    graphNodes={graphData.nodes}
                    graphEdges={graphData.edges}
                    tracks={tracks}
                    onNodeClick={handleExplorerNodeClick}
                    onExpand={() => setShowExpandedMap(true)}
                    meshData={meshMode ? meshData : undefined}
                    currentTopicId={topicId}
                  />
                ) : (
                  <div className='flex flex-col items-center justify-center h-64 text-text-tertiary gap-2'>
                    <Network size={24} className='opacity-30' />
                    <p className='text-sm'>
                      Submit arguments to see the graph.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        {/* RIGHT-1: Explorer sidebar with AI summaries */}
        {explorerOpen && (
          <aside className='w-72 border-l border-border bg-surface-1 shrink-0 flex flex-col overflow-hidden animate-slide-in-right'>
            {graphData ? (
              <ExplorerSidebar
                graphNodes={graphData.nodes}
                graphEdges={graphData.edges}
                tracks={tracks}
                onNodeClick={handleExplorerNodeClick}
                selectedId={highlightedId}
              />
            ) : (
              <div className='flex-1 flex items-center justify-center'>
                <span className='text-xs text-text-tertiary'>Loading...</span>
              </div>
            )}
          </aside>
        )}

        {/* RIGHT-2: slide-in drawer — Compose / Currents / Ask AI */}
        {rightDrawer && (
          <aside className='w-80 border-l border-border bg-surface-1 shrink-0 flex flex-col overflow-hidden animate-slide-in-right'>
            {/* Drawer header */}
            <div className='flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0'>
              <span className='text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5'>
                {rightDrawer === 'compose' && (
                  <>
                    <MessageSquare size={12} />{' '}
                    {replyToId ? 'Reply' : 'Add your take'}
                  </>
                )}
                {rightDrawer === 'tracks' && (
                  <>
                    <GitMerge size={12} /> Currents
                  </>
                )}
                {rightDrawer === 'rag' && (
                  <>
                    <Bot size={12} /> Ask AI
                  </>
                )}
              </span>
              <button
                onClick={() => {
                  setRightDrawer(null)
                  setReplyToId(null)
                }}
                className='p-1 rounded text-text-tertiary hover:text-text-secondary hover:bg-surface-3 transition'
              >
                <X size={13} />
              </button>
            </div>

            {/* Drawer content */}
            <div className='flex-1 overflow-y-auto'>
              {rightDrawer === 'compose' && (
                <div className='p-4'>
                  <SubmitArgumentForm
                    topicId={topicId}
                    replyTo={
                      replyToId
                        ? (nodes ?? []).find((n) => n.id === replyToId)
                        : undefined
                    }
                    onCancel={() => {
                      setRightDrawer(null)
                      setReplyToId(null)
                    }}
                    onSuccess={() => {
                      handleSuccess()
                      setRightDrawer(null)
                    }}
                  />
                </div>
              )}
              {rightDrawer === 'tracks' && (
                <div className='p-3 space-y-4'>
                  {tracks.length === 0 && (
                    <p className='text-xs text-text-tertiary px-2 py-4 text-center'>
                      Currents emerge as the debate evolves.
                    </p>
                  )}
                  {tracks.map((t) => (
                    <div key={t.id} className='space-y-2'>
                      {/* Current header — clickable to filter */}
                      <button
                        onClick={() => {
                          setSelectedTrackId((v: string | null) =>
                            v === t.id ? null : t.id,
                          )
                          setCenterTab('comments')
                        }}
                        className={`w-full flex items-center justify-between text-xs rounded-lg px-3 py-2 transition-colors text-left ${
                          selectedTrackId === t.id
                            ? 'bg-accent/10 text-accent border border-accent/30'
                            : 'bg-surface-2 text-text-secondary hover:bg-surface-3 hover:text-text-primary'
                        }`}
                      >
                        <span className='font-semibold truncate mr-2'>
                          {t.name}
                        </span>
                        <span className='text-text-tertiary shrink-0 tabular-nums text-[10px]'>
                          {t.node_count} takes
                        </span>
                      </button>

                      {/* Evolution summary */}
                      {t.evolution_summary && (
                        <p className='text-[11px] text-text-secondary italic px-2 leading-relaxed'>
                          {t.evolution_summary}
                        </p>
                      )}

                      {/* Concept chain */}
                      {t.chain.length > 0 && (
                        <div className='pl-1'>
                          {t.chain.map((step, i) => {
                            const typeColors: Record<string, string> = {
                              assertion:
                                'bg-blue-500/20 text-blue-400 border-blue-500/30',
                              counter:
                                'bg-red-500/20 text-red-400 border-red-500/30',
                              qualification:
                                'bg-amber-500/20 text-amber-400 border-amber-500/30',
                              synthesis:
                                'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
                              reframe:
                                'bg-purple-500/20 text-purple-400 border-purple-500/30',
                              concession:
                                'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
                              exception:
                                'bg-orange-500/20 text-orange-400 border-orange-500/30',
                              open_question:
                                'bg-pink-500/20 text-pink-400 border-pink-500/30',
                            }
                            const edgeLabels: Record<string, string> = {
                              supports: '↑ supports',
                              challenges: '⚡ challenges',
                              qualifies: '~ qualifies',
                              refines: '→ refines',
                              contradicts: '✕ contradicts',
                              synthesizes: '∴ synthesizes',
                              questions: '? questions',
                            }
                            return (
                              <div key={step.id}>
                                {/* Edge connector line */}
                                {i > 0 && (
                                  <div className='flex items-center gap-1 pl-3 py-0.5'>
                                    <div className='w-px h-3 bg-border' />
                                    {step.edge_from_previous && (
                                      <span className='text-[9px] text-text-tertiary ml-1'>
                                        {edgeLabels[step.edge_from_previous] ??
                                          step.edge_from_previous}
                                      </span>
                                    )}
                                  </div>
                                )}
                                {/* Chain node */}
                                <button
                                  onClick={() => {
                                    handleExplorerNodeClick(step.id)
                                    setCenterTab('comments')
                                  }}
                                  className='w-full text-left group flex items-start gap-2 px-2 py-1.5 rounded hover:bg-surface-3 transition-colors'
                                >
                                  {/* Type dot */}
                                  <span
                                    className={`mt-1 shrink-0 text-[8px] px-1 py-0.5 rounded border font-bold uppercase ${typeColors[step.node_type] ?? 'bg-surface-3 text-text-tertiary border-border'}`}
                                  >
                                    {step.node_type.slice(0, 3)}
                                  </span>
                                  <div className='min-w-0 flex-1'>
                                    <p className='text-[11px] text-text-primary leading-snug line-clamp-2 group-hover:text-accent transition-colors'>
                                      {step.ai_summary ?? step.content_snippet}
                                    </p>
                                    <p className='text-[9px] text-text-tertiary mt-0.5'>
                                      {step.author_name}
                                    </p>
                                  </div>
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Separator between currents */}
                      <div className='border-b border-border/50' />
                    </div>
                  ))}
                </div>
              )}
              {rightDrawer === 'rag' && <RAGQueryPanel topicId={topicId} />}
            </div>
          </aside>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className='fixed bottom-5 right-5 z-50 animate-slide-in-right'>
          <div className='bg-surface-3 text-text-primary text-sm px-4 py-2.5 rounded-lg shadow-lg border border-border flex items-center gap-2'>
            <CheckCircle2 size={15} className='text-emerald-400' />
            {toast}
          </div>
        </div>
      )}

      {/* Catch-Up Modal */}
      {showCatchUp && catchUpData && (
        <CatchUpModal
          catchUp={catchUpData}
          onClose={handleCatchUpClose}
          onNavigateToArgument={handleCatchUpNavigate}
        />
      )}

      {/* Expanded Argument Map */}
      {showExpandedMap && graphData && (
        <ArgumentMapExpanded
          graphNodes={graphData.nodes}
          graphEdges={graphData.edges}
          tracks={tracks}
          onClose={() => setShowExpandedMap(false)}
          onNodeClick={handleExplorerNodeClick}
        />
      )}
    </div>
  )
}
