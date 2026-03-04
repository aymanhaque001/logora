import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ragQuery } from '../api/client'
import { RAGQueryResult } from '../types'
import {
  Search,
  Loader2,
  Sparkles,
  Database,
  GitBranch,
  ChevronDown,
  ChevronRight,
  MessageCircleQuestion,
  X,
} from 'lucide-react'

interface QueryEntry {
  query: string
  result: RAGQueryResult
  timestamp: Date
}

const SUGGESTED_QUERIES = [
  'What are the main points of agreement?',
  'What evidence has been cited?',
  'What arguments remain unchallenged?',
  'Where do the key disagreements lie?',
  'What has been conceded so far?',
]

interface Props {
  topicId: string
}

export function RAGQueryPanel({ topicId }: Props) {
  const [query, setQuery] = useState('')
  const [history, setHistory] = useState<QueryEntry[]>([])
  const [expanded, setExpanded] = useState(true)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  const mutation = useMutation({
    mutationFn: (q: string) => ragQuery(topicId, q),
    onSuccess: (result: RAGQueryResult, q: string) => {
      setHistory((prev) => [
        { query: q, result, timestamp: new Date() },
        ...prev,
      ])
      setQuery('')
      setShowSuggestions(false)
      // Scroll to latest result
      setTimeout(
        () => resultsRef.current?.scrollTo({ top: 0, behavior: 'smooth' }),
        100,
      )
    },
  })

  const handleSubmit = (q?: string) => {
    const text = (q ?? query).trim()
    if (!text || mutation.isPending) return
    mutation.mutate(text)
  }

  // Focus input on expand
  useEffect(() => {
    if (expanded) inputRef.current?.focus()
  }, [expanded])

  return (
    <div className='border-t border-border'>
      <div className='px-4 pt-3 pb-2'>
        <button
          onClick={() => setExpanded(!expanded)}
          className='w-full flex items-center justify-between text-xs font-semibold text-text-secondary uppercase tracking-wider'
        >
          <span className='flex items-center gap-1.5'>
            <MessageCircleQuestion size={13} className='text-accent' /> Ask the
            Debate
          </span>
          {expanded ? (
            <ChevronDown size={13} className='text-text-tertiary' />
          ) : (
            <ChevronRight size={13} className='text-text-tertiary' />
          )}
        </button>
      </div>

      {expanded && (
        <div className='px-4 pb-4 animate-slide-down'>
          {/* Input */}
          <div className='relative mb-2'>
            <input
              ref={inputRef}
              type='text'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit()
              }}
              placeholder='Ask a question about this debate...'
              disabled={mutation.isPending}
              className='w-full bg-surface-2 border border-border-subtle rounded-lg pl-3 pr-9 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50 disabled:opacity-50 transition'
            />
            <button
              onClick={() => handleSubmit()}
              disabled={!query.trim() || mutation.isPending}
              className='absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-text-tertiary hover:text-accent disabled:opacity-30 transition'
            >
              {mutation.isPending ? (
                <Loader2 size={14} className='animate-spin' />
              ) : (
                <Search size={14} />
              )}
            </button>
          </div>

          {/* Suggested queries */}
          {showSuggestions && history.length === 0 && (
            <div className='space-y-1 mb-3'>
              <p className='text-[10px] text-text-tertiary font-medium uppercase tracking-wider'>
                Try asking
              </p>
              {SUGGESTED_QUERIES.map((sq) => (
                <button
                  key={sq}
                  onClick={() => {
                    setQuery(sq)
                    handleSubmit(sq)
                  }}
                  disabled={mutation.isPending}
                  className='w-full text-left text-[11px] text-text-secondary hover:text-accent bg-surface-2 hover:bg-accent-muted rounded-md px-2.5 py-1.5 transition-colors disabled:opacity-50'
                >
                  {sq}
                </button>
              ))}
            </div>
          )}

          {/* Loading state */}
          {mutation.isPending && (
            <div className='bg-surface-2 rounded-lg p-3 mb-2 animate-pulse'>
              <div className='flex items-center gap-2 text-xs text-text-tertiary'>
                <Loader2 size={12} className='animate-spin text-accent' />
                <span>Searching vectors & traversing argument graph...</span>
              </div>
            </div>
          )}

          {/* Error */}
          {mutation.isError && (
            <div className='bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-2 text-xs text-red-400'>
              Failed to query. Make sure the vector store has been backfilled.
            </div>
          )}

          {/* Results */}
          <div
            ref={resultsRef}
            className='space-y-3 max-h-[400px] overflow-y-auto'
          >
            {history.map((entry, i) => (
              <div
                key={i}
                className='bg-surface-2 rounded-lg overflow-hidden animate-slide-down'
              >
                {/* Query */}
                <div className='px-3 py-2 border-b border-border-subtle flex items-start gap-2'>
                  <Search
                    size={11}
                    className='text-text-tertiary mt-0.5 shrink-0'
                  />
                  <p className='text-xs text-text-secondary font-medium'>
                    {entry.query}
                  </p>
                </div>

                {/* Answer */}
                <div className='px-3 py-2.5'>
                  <div className='flex items-center gap-1 mb-1.5'>
                    <Sparkles size={10} className='text-accent' />
                    <span className='text-[10px] font-semibold text-accent uppercase tracking-wider'>
                      {entry.result.ai_powered ? 'AI Answer' : 'Answer'}
                    </span>
                  </div>
                  <p className='text-xs text-text-primary leading-relaxed whitespace-pre-wrap'>
                    {entry.result.answer}
                  </p>
                </div>

                {/* Source nodes */}
                {entry.result.source_nodes &&
                  entry.result.source_nodes.length > 0 && (
                    <div className='px-3 pb-2.5'>
                      <p className='text-[10px] text-text-tertiary font-medium uppercase tracking-wider mb-1.5'>
                        Sources used
                      </p>
                      <div className='flex flex-col gap-1'>
                        {entry.result.source_nodes.slice(0, 6).map((node) => {
                          const isTerminal = [
                            'conceded',
                            'dormant',
                            'merged',
                          ].includes(node.state ?? '')
                          return (
                            <div
                              key={node.id}
                              className={`rounded-md px-2 py-1.5 text-[11px] leading-snug ${
                                isTerminal
                                  ? 'bg-surface-2 opacity-60 line-through-none'
                                  : 'bg-surface-2'
                              }`}
                            >
                              <span
                                className={`inline-block mr-1.5 font-semibold text-[10px] uppercase ${
                                  isTerminal
                                    ? 'text-text-tertiary'
                                    : 'text-accent'
                                }`}
                              >
                                [{node.node_type ?? '?'}]
                                {isTerminal && ` · ${node.state}`}
                              </span>
                              <span className='text-text-tertiary'>
                                by {node.author} ·{' '}
                              </span>
                              <span className='text-text-secondary'>
                                {node.content_preview}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                {/* Retrieval stats */}
                {entry.result.retrieval_stats && (
                  <div className='px-3 py-2 border-t border-border-subtle'>
                    <div className='flex flex-wrap gap-x-3 gap-y-1 text-[10px]'>
                      <span className='flex items-center gap-1 text-text-tertiary'>
                        <Database size={9} />
                        {entry.result.retrieval_stats.vector_count} from vectors
                      </span>
                      <span className='flex items-center gap-1 text-text-tertiary'>
                        <GitBranch size={9} />
                        {entry.result.retrieval_stats.unique_from_graph} from
                        graph
                      </span>
                      <span className='text-text-tertiary'>
                        {entry.result.retrieval_stats.merged_count} total
                        context
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Clear history */}
          {history.length > 0 && (
            <div className='flex items-center justify-between mt-2'>
              <button
                onClick={() => setShowSuggestions(true)}
                className='text-[10px] text-text-tertiary hover:text-text-secondary transition'
              >
                Show suggestions
              </button>
              <button
                onClick={() => {
                  setHistory([])
                  setShowSuggestions(true)
                }}
                className='flex items-center gap-1 text-[10px] text-text-tertiary hover:text-text-secondary transition'
              >
                <X size={9} /> Clear history
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
