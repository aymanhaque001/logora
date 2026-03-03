import { ArgumentNode } from '../types'
import {
  ExternalLink,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Trash2,
  Edit3,
  Flag,
  ShieldCheck,
  HandshakeIcon,
  GitBranch,
  Merge,
  RefreshCw,
  Moon,
  Zap,
  MessageSquare,
  CornerDownRight,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useState, useEffect, useRef } from 'react'
import { getAvailableTransitions } from '../api/client'

const NODE_ACCENT: Record<string, string> = {
  assertion: '#BF557B',
  counter: '#ef4444',
  qualification: '#f59e0b',
  exception: '#f97316',
  synthesis: '#22c55e',
  reframe: '#a855f7',
  open_question: '#6e5a7e',
  concession: '#14b8a6',
}

const STATE_CONFIG: Record<
  string,
  { dot: string; label: string; terminal?: boolean; icon?: React.ReactNode }
> = {
  unchallenged: { dot: 'bg-text-tertiary', label: 'Unchallenged' },
  engaged: { dot: 'bg-blue-400', label: 'Engaged', icon: <Zap size={10} /> },
  refined: {
    dot: 'bg-indigo-400',
    label: 'Refined',
    icon: <RefreshCw size={10} />,
  },
  branched: {
    dot: 'bg-purple-400',
    label: 'Branched',
    icon: <GitBranch size={10} />,
  },
  merged: {
    dot: 'bg-amber-400',
    label: 'Merged',
    terminal: true,
    icon: <Merge size={10} />,
  },
  conceded: {
    dot: 'bg-teal-400',
    label: 'Conceded',
    terminal: true,
    icon: <HandshakeIcon size={10} />,
  },
  dormant: { dot: 'bg-surface-4', label: 'Dormant', icon: <Moon size={10} /> },
}

const TRANSITION_ICONS: Record<string, React.ReactNode> = {
  conceded: <HandshakeIcon size={12} className='text-teal-400' />,
  refined: <RefreshCw size={12} className='text-indigo-400' />,
  branched: <GitBranch size={12} className='text-purple-400' />,
  merged: <Merge size={12} className='text-amber-400' />,
  engaged: <Zap size={12} className='text-blue-400' />,
  dormant: <Moon size={12} className='text-text-tertiary' />,
}

const NUANCE_LABELS: Record<string, string> = {
  temporal: 'temporal',
  geographic: 'geographic',
  scale: 'scale',
  conditional: 'conditional',
  population_specific: 'population',
  contested_empirically: 'contested',
}

interface TransitionOption {
  state: string
  label: string
  description: string
  author_only: boolean
}

interface Props {
  node: ArgumentNode
  topicId: string
  onReply?: (node: ArgumentNode) => void
  onDelete?: (nodeId: string) => void
  onEdit?: (node: ArgumentNode) => void
  onTransition?: (nodeId: string, newState: string) => void
  onTransitionSuccess?: (message: string) => void
  currentUserId?: string
  depth?: number
  highlighted?: boolean
}

export function ArgumentCard({
  node,
  topicId,
  onReply,
  onDelete,
  onEdit,
  onTransition,
  onTransitionSuccess,
  currentUserId,
  depth = 0,
  highlighted = false,
}: Props) {
  const [showStateMenu, setShowStateMenu] = useState(false)
  const [transitions, setTransitions] = useState<TransitionOption[]>([])
  const [loadingTransitions, setLoadingTransitions] = useState(false)
  const [confirmState, setConfirmState] = useState<TransitionOption | null>(
    null,
  )
  const menuRef = useRef<HTMLDivElement>(null)
  const accent = NODE_ACCENT[node.node_type] ?? NODE_ACCENT.assertion
  const stateConfig = STATE_CONFIG[node.state] ?? STATE_CONFIG.unchallenged
  const isOwner = currentUserId === node.author_id
  const isTerminal = stateConfig.terminal === true

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowStateMenu(false)
        setConfirmState(null)
      }
    }
    if (showStateMenu)
      document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showStateMenu])

  const openTransitionMenu = async () => {
    if (showStateMenu) {
      setShowStateMenu(false)
      setConfirmState(null)
      return
    }
    if (!currentUserId) return
    setShowStateMenu(true)
    setLoadingTransitions(true)
    try {
      const data = await getAvailableTransitions(topicId, node.id)
      setTransitions(data.transitions ?? [])
    } catch {
      setTransitions([])
    } finally {
      setLoadingTransitions(false)
    }
  }

  const handleTransitionConfirm = () => {
    if (!confirmState) return
    onTransition?.(node.id, confirmState.state)
    onTransitionSuccess?.(`Argument marked as "${confirmState.label}"`)
    setShowStateMenu(false)
    setConfirmState(null)
  }

  return (
    <div
      id={`arg-${node.id}`}
      className={`group transition-all duration-200 ${
        isTerminal ? 'opacity-50' : ''
      } ${highlighted ? 'ring-1 ring-accent ring-offset-1 ring-offset-surface-0 rounded-lg animate-pulse-node' : ''}`}
    >
      {/* Comment-style layout */}
      <div className='flex gap-3'>
        {/* Avatar column */}
        <div className='flex flex-col items-center shrink-0'>
          <div
            className='w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white'
            style={{ background: accent }}
          >
            {node.author.display_name?.[0]?.toUpperCase()}
          </div>
          {/* Thread line */}
          {depth === 0 && node.children_count > 0 && (
            <div className='w-px flex-1 bg-border mt-1.5 min-h-[8px]' />
          )}
        </div>

        {/* Content */}
        <div className='flex-1 min-w-0 pb-4'>
          {/* Author line */}
          <div className='flex items-center gap-2 mb-1'>
            <span className='text-sm font-medium text-text-primary'>
              {node.author.display_name}
            </span>
            {node.author.is_verified_expert && (
              <span className='px-1.5 py-0.5 bg-violet-500/15 text-violet-400 rounded text-[10px] font-medium'>
                {node.author.expert_domain}
              </span>
            )}
            <span className='text-[10px] text-text-tertiary flex items-center gap-0.5'>
              <ShieldCheck size={9} />{' '}
              {Math.round(node.author.credibility_score)}
            </span>
            <span className='text-[11px] text-text-tertiary'>
              {formatDistanceToNow(new Date(node.created_at), {
                addSuffix: true,
              })}
            </span>
          </div>

          {/* Type + nuance badges */}
          <div className='flex items-center gap-1.5 mb-2'>
            <span
              className='text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded'
              style={{ color: accent, background: `${accent}20` }}
            >
              {node.node_type.replace('_', ' ')}
            </span>
            {node.nuance_tags.map((tag) => (
              <span
                key={tag}
                className='px-1.5 py-0.5 rounded text-[10px] bg-surface-3 text-text-tertiary font-medium'
              >
                {NUANCE_LABELS[tag] ?? tag}
              </span>
            ))}
            <span className='flex items-center gap-1 text-[10px] text-text-tertiary ml-auto'>
              {stateConfig.icon}
              <span className={`w-1.5 h-1.5 rounded-full ${stateConfig.dot}`} />
              {stateConfig.label}
            </span>
          </div>

          {/* Terminal banner */}
          {isTerminal && (
            <div
              className={`mb-2 px-3 py-1.5 text-xs font-medium rounded flex items-center gap-1.5 ${
                node.state === 'conceded'
                  ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}
            >
              {node.state === 'conceded' ? (
                <>
                  <HandshakeIcon size={11} /> Author conceded this argument
                </>
              ) : (
                <>
                  <Merge size={11} /> This argument was merged
                </>
              )}
            </div>
          )}

          {/* Content body */}
          <p className='text-sm text-text-primary leading-relaxed'>
            {node.content}
          </p>

          {/* Sources */}
          {node.sources.length > 0 && (
            <div className='mt-2 flex flex-wrap gap-1.5'>
              {node.sources.map((src, i) => (
                <a
                  key={i}
                  href={src.url ?? '#'}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover bg-accent-muted rounded px-2 py-0.5 transition-colors'
                >
                  <ExternalLink size={10} /> {src.title}
                </a>
              ))}
            </div>
          )}

          {/* Unverified warning */}
          {node.node_type === 'assertion' && node.sources.length === 0 && (
            <div className='mt-2 flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-3 py-1.5'>
              <AlertCircle size={12} /> <strong>Unverified</strong> — no source
            </div>
          )}

          {/* Action bar (like social media) */}
          <div className='flex items-center gap-1 mt-2.5 -ml-1.5'>
            {onReply && !isTerminal && (
              <button
                onClick={() => onReply(node)}
                className='flex items-center gap-1 text-xs text-text-tertiary hover:text-accent px-2 py-1 rounded-md hover:bg-accent-muted transition-colors'
              >
                <CornerDownRight size={12} /> Reply
              </button>
            )}
            {onReply && isTerminal && (
              <button
                onClick={() => onReply(node)}
                className='flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary px-2 py-1 rounded-md hover:bg-surface-3 transition-colors'
              >
                <CornerDownRight size={12} /> Reply
              </button>
            )}
            {node.children_count > 0 && (
              <span className='flex items-center gap-0.5 text-xs text-text-tertiary px-2 py-1'>
                <MessageSquare size={11} /> {node.children_count}
              </span>
            )}

            {currentUserId && !isTerminal && (
              <div className='relative ml-auto' ref={menuRef}>
                <button
                  onClick={openTransitionMenu}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors ${
                    showStateMenu
                      ? 'text-accent bg-accent-muted'
                      : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-3'
                  }`}
                >
                  <Flag size={11} /> State
                </button>
                {showStateMenu && (
                  <div className='absolute right-0 bottom-full mb-2 bg-surface-2 border border-border rounded-lg shadow-xl z-20 min-w-[240px] overflow-hidden animate-scale-in'>
                    <div className='px-3 py-2.5 border-b border-border-subtle'>
                      <div className='text-xs font-medium text-text-primary'>
                        Transition State
                      </div>
                      <div className='text-[10px] text-text-tertiary mt-0.5'>
                        Current:{' '}
                        <span className='font-medium text-text-secondary'>
                          {stateConfig.label}
                        </span>
                      </div>
                    </div>

                    {loadingTransitions ? (
                      <div className='px-3 py-4 text-xs text-text-tertiary text-center'>
                        <span className='inline-block w-3.5 h-3.5 border-2 border-border border-t-text-secondary rounded-full animate-spin mr-1.5' />
                        Loading...
                      </div>
                    ) : confirmState ? (
                      <div className='p-3 animate-fade-in'>
                        <div className='flex items-center gap-2 mb-1.5'>
                          {TRANSITION_ICONS[confirmState.state]}
                          <span className='text-sm font-semibold text-text-primary'>
                            {confirmState.label}
                          </span>
                        </div>
                        <p className='text-xs text-text-tertiary leading-relaxed mb-2.5'>
                          {confirmState.description}
                        </p>
                        {confirmState.author_only && (
                          <p className='text-[10px] text-amber-400 bg-amber-500/10 rounded px-2 py-1 mb-2.5 font-medium'>
                            Author only
                          </p>
                        )}
                        <div className='flex gap-2'>
                          <button
                            onClick={() => setConfirmState(null)}
                            className='flex-1 px-3 py-1.5 text-xs btn-secondary rounded-md'
                          >
                            Back
                          </button>
                          <button
                            onClick={handleTransitionConfirm}
                            className='flex-1 px-3 py-1.5 text-xs btn-primary rounded-md'
                          >
                            Confirm
                          </button>
                        </div>
                      </div>
                    ) : transitions.length === 0 ? (
                      <div className='px-3 py-4 text-xs text-text-tertiary text-center'>
                        No transitions available
                      </div>
                    ) : (
                      <div className='py-1'>
                        {transitions.map((t) => (
                          <button
                            key={t.state}
                            onClick={() => setConfirmState(t)}
                            className='w-full text-left px-3 py-2 hover:bg-surface-3 flex items-start gap-2.5 transition group'
                          >
                            <span className='mt-0.5 shrink-0'>
                              {TRANSITION_ICONS[t.state] ?? (
                                <span
                                  className={`inline-block w-2.5 h-2.5 rounded-full ${STATE_CONFIG[t.state]?.dot ?? 'bg-text-tertiary'}`}
                                />
                              )}
                            </span>
                            <div className='min-w-0'>
                              <div className='text-xs font-medium text-text-secondary group-hover:text-text-primary flex items-center gap-1.5'>
                                {t.label}
                                {t.author_only && (
                                  <span className='text-[9px] px-1 py-0.5 bg-surface-4 text-text-tertiary rounded'>
                                    author
                                  </span>
                                )}
                              </div>
                              <div className='text-[10px] text-text-tertiary leading-snug mt-0.5 line-clamp-2'>
                                {t.description}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {isOwner && onEdit && !isTerminal && (
              <button
                onClick={() => onEdit(node)}
                className='text-xs p-1.5 rounded-md text-text-tertiary hover:text-accent hover:bg-accent-muted transition-colors'
                title='Edit'
              >
                <Edit3 size={11} />
              </button>
            )}
            {isOwner &&
              onDelete &&
              node.children_count === 0 &&
              !isTerminal && (
                <button
                  onClick={() => {
                    if (window.confirm('Delete this argument?'))
                      onDelete(node.id)
                  }}
                  className='text-xs p-1.5 rounded-md text-text-tertiary hover:text-red-400 hover:bg-red-500/10 transition-colors'
                  title='Delete'
                >
                  <Trash2 size={11} />
                </button>
              )}
          </div>
        </div>
      </div>
    </div>
  )
}
