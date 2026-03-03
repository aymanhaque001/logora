import { useState, useEffect, useRef } from 'react'
import {
  ArgumentNode,
  EdgeRelationship,
  NodeType,
  NuanceTag,
  SourceItem,
  DuplicateCheckResult,
} from '../types'
import { NODE_TYPES, NODE_TYPE_DESCRIPTIONS } from './NodeTypeBadge'
import { submitArgument, checkDuplicate, preClassify } from '../api/client'
import {
  Plus,
  Minus,
  X,
  AlertCircle,
  Send,
  CornerDownRight,
  Sparkles,
} from 'lucide-react'
import { DuplicateCheckModal } from './DuplicateCheckModal'

const NUANCE_TAGS: NuanceTag[] = [
  'temporal',
  'geographic',
  'scale',
  'conditional',
  'population_specific',
  'contested_empirically',
]

const EDGE_RELATIONSHIPS: { value: EdgeRelationship; label: string }[] = [
  { value: 'supports', label: 'Supports' },
  { value: 'challenges', label: 'Challenges' },
  { value: 'qualifies', label: 'Qualifies' },
  { value: 'refines', label: 'Refines' },
  { value: 'contradicts', label: 'Contradicts' },
  { value: 'synthesizes', label: 'Synthesizes' },
  { value: 'questions', label: 'Questions' },
]

// Plain-English labels for each node type (issue #29)
const NODE_TYPE_LABELS: Record<NodeType, { primary: string; subtitle: string }> = {
  assertion:     { primary: "I’m claiming…",           subtitle: 'assertion' },
  counter:       { primary: 'I disagree…',             subtitle: 'counter' },
  qualification: { primary: 'Yes, but…',               subtitle: 'qualification' },
  exception:     { primary: 'This breaks down when…',  subtitle: 'exception' },
  synthesis:     { primary: 'We both agree that…',     subtitle: 'synthesis' },
  reframe:       { primary: 'The real question is…',   subtitle: 'reframe' },
  open_question: { primary: 'Nobody has addressed…',  subtitle: 'open question' },
  concession:    { primary: 'Fair point, I’ll grant…', subtitle: 'concession' },
}

interface Props {
  topicId: string
  replyTo?: ArgumentNode | null
  onCancel?: () => void
  onSuccess: () => void
  inline?: boolean /* compact mode for inline reply */
}

export function SubmitArgumentForm({
  topicId,
  replyTo,
  onCancel,
  onSuccess,
  inline = false,
}: Props) {
  const [content, setContent] = useState('')
  const [nodeType, setNodeType] = useState<NodeType>('assertion')
  const [nuanceTags, setNuanceTags] = useState<NuanceTag[]>([])
  const [edgeRelationship, setEdgeRelationship] =
    useState<EdgeRelationship>('challenges')
  const [sources, setSources] = useState<Partial<SourceItem>[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [dupResult, setDupResult] = useState<DuplicateCheckResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<{ type: NodeType; confidence: number } | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [userOverrode, setUserOverrode] = useState(false)
  const classifyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // AI pre-classification: debounce 900 ms after user stops typing
  useEffect(() => {
    if (content.trim().length < 35) {
      setAiSuggestion(null)
      setUserOverrode(false)
      return
    }
    if (classifyTimer.current) clearTimeout(classifyTimer.current)
    classifyTimer.current = setTimeout(async () => {
      setAiLoading(true)
      try {
        const result = await preClassify(topicId, content.trim(), replyTo?.content)
        const suggestedType = result.suggested_type as NodeType
        setAiSuggestion({ type: suggestedType, confidence: result.confidence })
        if (!userOverrode) setNodeType(suggestedType)
      } catch {
        // silently ignore — classification errors don’t block submission
      } finally {
        setAiLoading(false)
      }
    }, 900)
    return () => { if (classifyTimer.current) clearTimeout(classifyTimer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, topicId])

  const toggleNuance = (tag: NuanceTag) => {
    setNuanceTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
  }
  const addSource = () => setSources((s) => [...s, { title: '', url: '' }])
  const removeSource = (i: number) =>
    setSources((s) => s.filter((_, idx) => idx !== i))
  const updateSource = (i: number, field: keyof SourceItem, value: string) => {
    setSources((s) =>
      s.map((src, idx) => (idx === i ? { ...src, [field]: value } : src)),
    )
  }

  const doSubmit = async () => {
    setError('')
    const validSources = sources.filter((s) => s.title?.trim())
    setLoading(true)
    try {
      await submitArgument(topicId, {
        content,
        node_type: nodeType,
        sources: validSources,
        nuance_tags: nuanceTags,
        parent_id: replyTo?.id,
        edge_relationship: replyTo ? edgeRelationship : undefined,
      })
      setDupResult(null)
      onSuccess()
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Failed to submit argument.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (content.trim().length < 20) return

    // Run duplicate check first
    setChecking(true)
    try {
      const result = await checkDuplicate(topicId, content)
      if (
        result.is_duplicate ||
        (result.similar_arguments?.length > 0 &&
          result.similar_arguments[0]?.similarity > 0.7)
      ) {
        setDupResult(result)
        setChecking(false)
        return // Show modal, let user decide
      }
      // Not a duplicate — submit directly
      setChecking(false)
      await doSubmit()
    } catch {
      // If duplicate check fails, submit anyway
      setChecking(false)
      await doSubmit()
    }
  }

  /* Inline (compact) version for reply-under-comment */
  if (inline) {
    return (
      <>
        {dupResult && (
          <DuplicateCheckModal
            result={dupResult}
            onProceed={() => {
              setDupResult(null)
              doSubmit()
            }}
            onCancel={() => setDupResult(null)}
            onViewSimilar={() => setDupResult(null)}
          />
        )}
        <form onSubmit={handleSubmit} className='animate-slide-down'>
          <div className='bg-surface-2 border border-border-subtle rounded-lg p-3 mt-1'>
            {replyTo && (
              <div className='flex items-center gap-1.5 text-[11px] text-text-tertiary mb-2'>
                <CornerDownRight size={10} />
                <span>
                  Replying to{' '}
                  <span className='text-text-secondary font-medium'>
                    {replyTo.author.display_name}
                  </span>
                </span>
                {onCancel && (
                  <button
                    type='button'
                    onClick={onCancel}
                    className='ml-auto text-text-tertiary hover:text-text-secondary p-0.5 rounded hover:bg-surface-3 transition'
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}

            <textarea
              rows={2}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder='Write your reply...'
              className='w-full bg-surface-1 border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50 resize-none'
              required
              minLength={20}
            />

            <div className='flex items-center gap-2 mt-2'>
              {/* Compact type selector with AI indicator */}
              <div className='flex items-center gap-1'>
                {aiLoading && (
                  <span className='w-2.5 h-2.5 border border-accent/40 border-t-accent rounded-full animate-spin flex-shrink-0' />
                )}
                {aiSuggestion && !aiLoading && (
                  <Sparkles size={9} className='text-accent flex-shrink-0' />
                )}
                <select
                  value={nodeType}
                  onChange={(e) => {
                    setNodeType(e.target.value as NodeType)
                    setUserOverrode(true)
                  }}
                  className='bg-surface-1 border border-border-subtle rounded px-2 py-1 text-xs text-text-secondary focus:outline-none focus:border-accent/50'
                >
                  {NODE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {NODE_TYPE_LABELS[t].primary}
                    </option>
                  ))}
                </select>
              </div>

              {replyTo && (
                <select
                  value={edgeRelationship}
                  onChange={(e) =>
                    setEdgeRelationship(e.target.value as EdgeRelationship)
                  }
                  className='bg-surface-1 border border-border-subtle rounded px-2 py-1 text-xs text-text-secondary focus:outline-none focus:border-accent/50'
                >
                  {EDGE_RELATIONSHIPS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              )}

              <button
                type='button'
                onClick={() => setShowAdvanced(!showAdvanced)}
                className='text-[11px] text-text-tertiary hover:text-text-secondary transition'
              >
                {showAdvanced ? 'Less' : 'More'}
              </button>

              <div className='ml-auto flex gap-2'>
                {onCancel && (
                  <button
                    type='button'
                    onClick={onCancel}
                    className='btn-ghost px-3 py-1 rounded text-xs'
                  >
                    Cancel
                  </button>
                )}
                <button
                  type='submit'
                  disabled={loading || checking}
                  className='btn-primary px-3 py-1 rounded text-xs flex items-center gap-1'
                >
                  {loading || checking ? (
                    <span className='w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin' />
                  ) : (
                    <>
                      <Send size={10} /> Reply
                    </>
                  )}
                </button>
              </div>
            </div>

            {showAdvanced && (
              <div className='mt-3 pt-3 border-t border-border-subtle space-y-3 animate-slide-down'>
                {/* Nuance tags */}
                <div>
                  <label className='text-[11px] text-text-tertiary font-medium mb-1 block'>
                    Nuance tags
                  </label>
                  <div className='flex flex-wrap gap-1'>
                    {NUANCE_TAGS.map((tag) => (
                      <button
                        key={tag}
                        type='button'
                        onClick={() => toggleNuance(tag)}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium border transition ${
                          nuanceTags.includes(tag)
                            ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                            : 'bg-surface-3 border-border-subtle text-text-tertiary hover:text-text-secondary'
                        }`}
                      >
                        {tag.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sources */}
                <div>
                  <div className='flex items-center justify-between mb-1'>
                    <label className='text-[11px] text-text-tertiary font-medium'>
                      Sources
                    </label>
                    <button
                      type='button'
                      onClick={addSource}
                      className='text-[11px] text-accent hover:text-accent-hover flex items-center gap-0.5 transition'
                    >
                      <Plus size={10} /> Add
                    </button>
                  </div>
                  {nodeType === 'assertion' &&
                    sources.filter((s) => s.title?.trim()).length === 0 && (
                      <div className='flex items-center gap-1.5 text-[11px] text-amber-400 bg-amber-500/10 rounded px-2 py-1 mb-1'>
                        <AlertCircle size={10} /> Unverified without sources
                      </div>
                    )}
                  {sources.map((src, i) => (
                    <div
                      key={i}
                      className='flex gap-1.5 items-center mt-1 animate-slide-down'
                    >
                      <input
                        type='text'
                        placeholder='Title'
                        value={src.title ?? ''}
                        onChange={(e) =>
                          updateSource(i, 'title', e.target.value)
                        }
                        className='flex-1 bg-surface-1 border border-border-subtle rounded px-2 py-1 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50'
                      />
                      <input
                        type='url'
                        placeholder='URL'
                        value={src.url ?? ''}
                        onChange={(e) => updateSource(i, 'url', e.target.value)}
                        className='flex-1 bg-surface-1 border border-border-subtle rounded px-2 py-1 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50'
                      />
                      <button
                        type='button'
                        onClick={() => removeSource(i)}
                        className='text-text-tertiary hover:text-red-400 transition'
                      >
                        <Minus size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <p className='text-xs text-red-400 bg-red-500/10 rounded px-2 py-1.5 mt-2 animate-slide-down'>
                {error}
              </p>
            )}
          </div>
        </form>
      </>
    )
  }

  /* Full form (for top-level submission) */
  return (
    <>
      {dupResult && (
        <DuplicateCheckModal
          result={dupResult}
          onProceed={() => {
            setDupResult(null)
            doSubmit()
          }}
          onCancel={() => setDupResult(null)}
          onViewSimilar={() => setDupResult(null)}
        />
      )}
      <form onSubmit={handleSubmit} className='card p-5 space-y-4'>
        {replyTo && (
          <div className='flex items-start justify-between bg-surface-2 border border-border-subtle rounded-md p-3'>
            <div>
              <span className='text-xs font-medium text-text-secondary'>
                Responding to:
              </span>
              <p className='mt-1 line-clamp-2 text-text-tertiary text-xs leading-relaxed'>
                {replyTo.content}
              </p>
            </div>
            {onCancel && (
              <button
                type='button'
                onClick={onCancel}
                className='text-text-tertiary hover:text-text-secondary ml-2 p-1 rounded hover:bg-surface-3 transition'
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* Textarea first — AI classifies as you type */}
        <div>
          <label className='block text-sm font-medium text-text-secondary mb-1.5'>
            Your argument
          </label>
          <textarea
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder='State your argument clearly…'
            className='input-field resize-none'
            required
            minLength={20}
            autoFocus
          />
        </div>

        {replyTo && (
          <div>
            <label className='block text-sm font-medium text-text-secondary mb-1.5'>
              Relationship
            </label>
            <select
              value={edgeRelationship}
              onChange={(e) =>
                setEdgeRelationship(e.target.value as EdgeRelationship)
              }
              className='input-field'
            >
              {EDGE_RELATIONSHIPS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Type picker — AI pre-selects, user can override */}
        <div>
          <div className='flex items-center justify-between mb-2'>
            <label className='text-sm font-medium text-text-secondary'>Type</label>
            <span className='text-[11px] flex items-center gap-1 h-4'>
              {aiLoading && (
                <span className='w-2.5 h-2.5 border border-accent/40 border-t-accent rounded-full animate-spin' />
              )}
              {aiSuggestion && !aiLoading && (
                <span className='flex items-center gap-1 text-accent'>
                  <Sparkles size={9} />
                  AI suggests <em>{NODE_TYPE_LABELS[aiSuggestion.type].subtitle}</em>
                  {userOverrode && (
                    <span className='text-text-tertiary not-italic'> · overridden</span>
                  )}
                </span>
              )}
              {!aiSuggestion && !aiLoading && (
                <span className='text-text-tertiary'>{NODE_TYPE_DESCRIPTIONS[nodeType]}</span>
              )}
            </span>
          </div>
          <div className='grid grid-cols-2 sm:grid-cols-4 gap-1.5'>
            {NODE_TYPES.map((t) => {
              const isAiSuggested = aiSuggestion?.type === t
              const lbl = NODE_TYPE_LABELS[t]
              return (
                <label
                  key={t}
                  className={`cursor-pointer border rounded-md px-2 py-2.5 text-xs text-center transition-all relative ${
                    nodeType === t
                      ? 'border-accent bg-accent-muted text-accent font-medium'
                      : 'border-border hover:border-border-hover text-text-tertiary hover:text-text-secondary'
                  }`}
                >
                  <input
                    type='radio'
                    className='sr-only'
                    checked={nodeType === t}
                    onChange={() => {
                      setNodeType(t)
                      setUserOverrode(aiSuggestion?.type !== t)
                    }}
                  />
                  {isAiSuggested && (
                    <span className='absolute top-1 right-1'>
                      <Sparkles size={8} className='text-accent opacity-70' />
                    </span>
                  )}
                  <span className='block font-medium text-[11px] leading-snug'>{lbl.primary}</span>
                  <span className='block text-[9px] text-text-tertiary mt-0.5 opacity-70'>{lbl.subtitle}</span>
                </label>
              )
            })}
          </div>
        </div>

        <div>
          <label className='block text-sm font-medium text-text-secondary mb-2'>
            Nuance tags{' '}
            <span className='text-text-tertiary font-normal text-xs'>
              (optional)
            </span>
          </label>
          <div className='flex flex-wrap gap-1.5'>
            {NUANCE_TAGS.map((tag) => (
              <button
                key={tag}
                type='button'
                onClick={() => toggleNuance(tag)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                  nuanceTags.includes(tag)
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                    : 'bg-surface-2 border-border text-text-tertiary hover:border-border-hover'
                }`}
              >
                {tag.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className='flex items-center justify-between mb-2'>
            <label className='text-sm font-medium text-text-secondary'>
              Sources{' '}
              <span className='font-normal text-text-tertiary text-xs'>
                (optional)
              </span>
            </label>
            <button
              type='button'
              onClick={addSource}
              className='text-xs text-accent flex items-center gap-1 hover:text-accent-hover font-medium transition'
            >
              <Plus size={12} /> Add
            </button>
          </div>
          {nodeType === 'assertion' &&
            sources.filter((s) => s.title?.trim()).length === 0 && (
              <div className='flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-3 py-2 mb-2'>
                <AlertCircle size={12} /> Assertions without sources are tagged{' '}
                <strong className='ml-0.5'>Unverified</strong>
              </div>
            )}
          <div className='space-y-1.5'>
            {sources.map((src, i) => (
              <div
                key={i}
                className='flex gap-2 items-start animate-slide-down'
              >
                <div className='flex-1 grid grid-cols-2 gap-1.5'>
                  <input
                    type='text'
                    placeholder='Title'
                    value={src.title ?? ''}
                    onChange={(e) => updateSource(i, 'title', e.target.value)}
                    className='input-field text-xs !py-1.5'
                  />
                  <input
                    type='url'
                    placeholder='URL'
                    value={src.url ?? ''}
                    onChange={(e) => updateSource(i, 'url', e.target.value)}
                    className='input-field text-xs !py-1.5'
                  />
                </div>
                <button
                  type='button'
                  onClick={() => removeSource(i)}
                  className='text-text-tertiary hover:text-red-400 mt-1.5 transition'
                >
                  <Minus size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <p className='text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2 animate-slide-down'>
            {error}
          </p>
        )}

        <div className='flex justify-end gap-3 pt-1'>
          {onCancel && (
            <button
              type='button'
              onClick={onCancel}
              className='btn-ghost px-4 py-2 rounded-lg text-sm'
            >
              Cancel
            </button>
          )}
          <button
            type='submit'
            disabled={loading || checking}
            className='px-5 py-2 btn-primary rounded-lg text-sm'
          >
            {loading || checking ? (
              <span className='flex items-center gap-2'>
                <span className='w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin' />
                {checking ? 'Checking...' : 'Submitting...'}
              </span>
            ) : (
              <span className='flex items-center gap-2'>
                <Send size={13} /> Submit
              </span>
            )}
          </button>
        </div>
      </form>
    </>
  )
}
