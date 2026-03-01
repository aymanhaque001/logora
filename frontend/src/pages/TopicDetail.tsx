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
} from '../api/client'
import {
  ArgumentNode,
  BriefingData,
  GraphData,
  Topic,
  DiscourseTrack,
  CatchUpData,
} from '../types'
import { BriefingRoom } from '../components/BriefingRoom'
import { CatchUpModal } from '../components/CatchUpModal'
import { ArgumentCard } from '../components/ArgumentCard'
import { SubmitArgumentForm } from '../components/SubmitArgumentForm'
import { ExplorerSidebar } from '../components/ExplorerSidebar'
import { ArgumentGraph } from '../components/ArgumentGraph'
import { ArgumentMapExpanded } from '../components/ArgumentMapExpanded'
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
  ChevronDown,
  ChevronRight,
  BookOpen,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
  Maximize2,
  MessageSquare,
  Network,
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
  const [showForm, setShowForm] = useState(false)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [explorerOpen, setExplorerOpen] = useState(true)
  const [briefingOpen, setBriefingOpen] = useState(true)
  const [catchUpDismissed, setCatchUpDismissed] = useState(false)
  const [showCatchUp, setShowCatchUp] = useState(false)
  const [centerTab, setCenterTab] = useState<'comments' | 'graph'>('comments')
  const [showExpandedMap, setShowExpandedMap] = useState(false)

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

  const childMap = useMemo(() => buildChildMap(nodes ?? []), [nodes])
  const rootNodes = useMemo(() => childMap.get(null) ?? [], [childMap])

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
    setShowForm(false)
    invalidateAll()
  }

  const handleReply = (node: ArgumentNode) => {
    setReplyToId(node.id)
    setShowForm(false)
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
      {/* Topic header */}
      <div className='px-5 py-3 border-b border-border bg-surface-1 shrink-0'>
        <div className='max-w-[1400px] mx-auto'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3 min-w-0'>
              <button
                onClick={() => navigate('/')}
                className='text-text-tertiary hover:text-text-secondary transition shrink-0'
              >
                <ArrowLeft size={16} />
              </button>
              <div className='min-w-0'>
                <div className='flex items-center gap-2 mb-0.5'>
                  {topic.tags.map((tag) => (
                    <span
                      key={tag}
                      className='flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-surface-3 text-text-tertiary rounded font-medium'
                    >
                      <Tag size={8} /> {tag}
                    </span>
                  ))}
                  {topic.location && (
                    <span className='flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-surface-3 text-text-tertiary rounded'>
                      <MapPin size={8} /> {topic.location}
                    </span>
                  )}
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      topic.status === 'active'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-surface-3 text-text-tertiary'
                    }`}
                  >
                    {topic.status}
                  </span>
                </div>
                <h1 className='text-sm font-semibold text-text-primary truncate'>
                  {topic.canonical_question}
                </h1>
              </div>
            </div>
            <div className='flex items-center gap-2 shrink-0'>
              {graphData && graphData.nodes.length > 0 && (
                <button
                  onClick={() => setShowExpandedMap(true)}
                  className='flex items-center gap-1 px-2.5 py-1 text-xs border border-accent/30 rounded-md text-accent hover:bg-accent/10 transition-colors'
                >
                  <Maximize2 size={11} /> Focus Mode
                </button>
              )}
              {catchUpData && catchUpData.total_nodes > 0 && (
                <button
                  onClick={() => setShowCatchUp(true)}
                  className='flex items-center gap-1 px-2.5 py-1 text-xs border border-accent/30 rounded-md text-accent hover:bg-accent/10 transition-colors'
                >
                  <Sparkles size={11} /> Catch Up
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
                    className='flex items-center gap-1 px-2.5 py-1 text-xs border border-border rounded-md text-text-tertiary hover:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/20 transition-colors'
                  >
                    <Archive size={11} /> Archive
                  </button>
                )}
              {user &&
                topic.created_by === user.id &&
                topic.node_count === 0 && (
                  <button
                    onClick={() => {
                      if (window.confirm('Delete permanently?'))
                        deleteTopicMutation.mutate()
                    }}
                    className='flex items-center gap-1 px-2.5 py-1 text-xs border border-border rounded-md text-text-tertiary hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-colors'
                  >
                    <Trash2 size={11} /> Delete
                  </button>
                )}
              <button
                onClick={() => setExplorerOpen(!explorerOpen)}
                className='p-1.5 rounded-md text-text-tertiary hover:text-text-secondary hover:bg-surface-3 transition'
                title={explorerOpen ? 'Hide map' : 'Show map'}
              >
                {explorerOpen ? (
                  <PanelLeftClose size={15} />
                ) : (
                  <PanelLeft size={15} />
                )}
              </button>
            </div>
          </div>
          {topic.description && (
            <p className='mt-1 text-xs text-text-tertiary max-w-2xl ml-7'>
              {topic.description}
            </p>
          )}
        </div>
      </div>

      {/* Three-column body */}
      <div className='flex-1 flex overflow-hidden'>
        {/* LEFT: Explorer sidebar with AI summaries */}
        {explorerOpen && (
          <aside className='w-72 border-r border-border bg-surface-1 shrink-0 flex flex-col overflow-hidden animate-slide-in-right'>
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

        {/* CENTER: Comment feed / Graph view */}
        <main className='flex-1 overflow-y-auto flex flex-col'>
          {/* Tab bar */}
          <div className='border-b border-border bg-surface-1 px-5 flex items-center gap-0 shrink-0'>
            <button
              onClick={() => setCenterTab('comments')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                centerTab === 'comments'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-tertiary hover:text-text-secondary'
              }`}
            >
              <MessageSquare size={12} /> Discussion
            </button>
            <button
              onClick={() => setCenterTab('graph')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                centerTab === 'graph'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-tertiary hover:text-text-secondary'
              }`}
            >
              <Network size={12} /> Graph View
            </button>
          </div>

          {/* Tab content */}
          {centerTab === 'comments' ? (
          <div className='flex-1 overflow-y-auto'>
          <div className='max-w-2xl mx-auto px-5 py-5'>
            {/* New top-level argument */}
            {showForm ? (
              <div className='mb-5 animate-slide-down'>
                <SubmitArgumentForm
                  topicId={topicId}
                  onCancel={() => setShowForm(false)}
                  onSuccess={handleSuccess}
                />
              </div>
            ) : (
              <button
                onClick={() => {
                  setShowForm(true)
                  setReplyToId(null)
                }}
                className='w-full flex items-center justify-center gap-2 py-3 border border-dashed border-border hover:border-accent/50 text-sm text-text-tertiary hover:text-accent rounded-lg transition-colors font-medium mb-5'
              >
                <Plus size={15} /> Add an argument
              </button>
            )}

            {/* Arguments as comments */}
            {rootNodes.length === 0 && !showForm && (
              <div className='text-center py-20'>
                <GitBranch
                  size={24}
                  className='text-text-tertiary mx-auto mb-2 opacity-30'
                />
                <p className='text-sm text-text-tertiary'>
                  No arguments yet. Start the debate.
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
            <div className='flex-1'>
              {graphData && graphData.nodes.length > 0 ? (
                <ArgumentGraph
                  graphNodes={graphData.nodes}
                  graphEdges={graphData.edges}
                  tracks={tracks}
                  onNodeClick={handleExplorerNodeClick}
                  onExpand={() => setShowExpandedMap(true)}
                />
              ) : (
                <div className='flex flex-col items-center justify-center h-64 text-text-tertiary gap-2'>
                  <Network size={24} className='opacity-30' />
                  <p className='text-sm'>Submit arguments to see the graph.</p>
                </div>
              )}
            </div>
          )}
        </main>

        {/* RIGHT: Briefing panel */}
        <aside className='w-80 border-l border-border bg-surface-1 shrink-0 overflow-y-auto hidden xl:block'>
          <div className='p-4'>
            <button
              onClick={() => setBriefingOpen(!briefingOpen)}
              className='w-full flex items-center justify-between text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3'
            >
              <span className='flex items-center gap-1.5'>
                <BookOpen size={13} className='text-text-tertiary' /> Briefing
              </span>
              {briefingOpen ? (
                <ChevronDown size={13} className='text-text-tertiary' />
              ) : (
                <ChevronRight size={13} className='text-text-tertiary' />
              )}
            </button>
            {briefingOpen && (
              <div className='animate-slide-down'>
                {briefing ? (
                  <BriefingRoom briefing={briefing} />
                ) : (
                  <div className='space-y-2'>
                    {[1, 2].map((i) => (
                      <div
                        key={i}
                        className='h-16 bg-surface-2 rounded animate-pulse'
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tracks */}
          <div className='px-4 pb-4'>
            <h3 className='text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2'>
              Tracks ({tracks.length})
            </h3>
            <div className='space-y-1'>
              {tracks.map((t) => (
                <div
                  key={t.id}
                  className='flex items-center justify-between text-xs text-text-secondary bg-surface-2 rounded-md px-3 py-2'
                >
                  <span className='font-medium'>{t.name}</span>
                  <span className='text-text-tertiary'>{t.node_count}</span>
                </div>
              ))}
              {tracks.length === 0 && (
                <p className='text-xs text-text-tertiary'>
                  Tracks appear as arguments are submitted.
                </p>
              )}
            </div>
          </div>
        </aside>
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
