import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getTopics, ragQuery } from '../api/client'
import { Topic, RAGQueryResult } from '../types'
import {
  MessageCircleQuestion,
  Search,
  Loader2,
  Sparkles,
  Database,
  GitBranch,
  ChevronDown,
  X,
} from 'lucide-react'

export function HomeRAGQuery() {
  const [selectedTopicId, setSelectedTopicId] = useState('')
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<RAGQueryResult | null>(null)
  const [lastQuery, setLastQuery] = useState('')

  const { data: topics } = useQuery<Topic[]>({
    queryKey: ['topics-for-rag'],
    queryFn: () => getTopics({}),
    staleTime: 2 * 60 * 1000,
  })

  const mutation = useMutation({
    mutationFn: ({ topicId, q }: { topicId: string; q: string }) =>
      ragQuery(topicId, q),
    onSuccess: (data: RAGQueryResult) => {
      setResult(data)
      setLastQuery(query)
      setQuery('')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q || !selectedTopicId || mutation.isPending) return
    mutation.mutate({ topicId: selectedTopicId, q })
  }

  const clearResult = () => {
    setResult(null)
    setLastQuery('')
    mutation.reset()
  }

  return (
    <div
      className='bg-surface-1 border rounded-lg overflow-hidden'
      style={{ borderColor: 'rgba(191, 85, 123, 0.4)' }}
    >
      {/* Header + form */}
      <div className='px-4 py-3'>
        <div className='flex items-center gap-2 mb-3'>
          <MessageCircleQuestion size={14} className='text-accent' />
          <span className='text-[11px] font-semibold text-text-primary uppercase tracking-wider'>
            Ask the Debates
          </span>
          <span className='text-[10px] text-text-tertiary'>
            — Query any debate using Graph RAG
          </span>
        </div>

        <form onSubmit={handleSubmit} className='flex items-center gap-2'>
          {/* Topic selector */}
          <div className='relative shrink-0'>
            <select
              value={selectedTopicId}
              onChange={(e) => {
                setSelectedTopicId(e.target.value)
                clearResult()
              }}
              className='appearance-none bg-surface-2 border border-border-subtle rounded-lg pl-3 pr-7 py-2 text-xs text-text-primary focus:outline-none transition min-w-[180px] max-w-[240px] truncate input-field-plum'
            >
              <option value=''>Select a debate...</option>
              {topics?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.canonical_question.slice(0, 60)}
                  {t.canonical_question.length > 60 ? '...' : ''}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              className='absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none'
            />
          </div>

          {/* Query input */}
          <div className='relative flex-1'>
            <Search
              size={13}
              className='absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary'
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                selectedTopicId
                  ? 'Ask a question about this debate...'
                  : 'Select a debate first...'
              }
              disabled={!selectedTopicId || mutation.isPending}
              className='input-field input-field-plum pl-8 py-2 text-xs disabled:opacity-40'
            />
          </div>

          <button
            type='submit'
            disabled={!query.trim() || !selectedTopicId || mutation.isPending}
            className='btn-primary px-3 py-2 text-xs rounded-lg disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap'
          >
            {mutation.isPending ? (
              <Loader2 size={12} className='animate-spin' />
            ) : (
              <Sparkles size={12} />
            )}
            Ask
          </button>
        </form>
      </div>

      {/* Loading */}
      {mutation.isPending && (
        <div className='px-4 pb-3'>
          <div className='bg-surface-2 rounded-lg p-3 animate-pulse'>
            <div className='flex items-center gap-2 text-xs text-text-tertiary'>
              <Loader2 size={12} className='animate-spin text-accent' />
              Searching vectors & traversing argument graph...
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {mutation.isError && (
        <div className='px-4 pb-3'>
          <div className='bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-400'>
            Query failed. The vector store may need backfilling for this topic.
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div
          className='border-t'
          style={{ borderColor: 'rgba(191, 85, 123, 0.3)' }}
        >
          <div className='px-4 py-3'>
            <div className='flex items-start justify-between gap-2 mb-2'>
              <div className='flex items-center gap-1.5'>
                <Sparkles size={11} className='text-accent' />
                <span className='text-[10px] font-semibold text-accent uppercase tracking-wider'>
                  {result.ai_powered ? 'AI Answer' : 'Answer'}
                </span>
                <span className='text-[10px] text-text-tertiary'>
                  — "{lastQuery}"
                </span>
              </div>
              <button
                onClick={clearResult}
                className='p-0.5 text-text-tertiary hover:text-text-secondary transition'
              >
                <X size={12} />
              </button>
            </div>

            <p className='text-xs text-text-primary leading-relaxed whitespace-pre-wrap mb-2'>
              {result.answer}
            </p>

            {/* Source nodes */}
            {result.source_nodes && result.source_nodes.length > 0 && (
              <div className='mb-2'>
                <p className='text-[10px] text-text-tertiary font-medium uppercase tracking-wider mb-1.5'>
                  Sources used
                </p>
                <div className='flex flex-col gap-1'>
                  {result.source_nodes.slice(0, 5).map((node) => {
                    const isTerminal = [
                      'conceded',
                      'dormant',
                      'merged',
                    ].includes(node.state ?? '')
                    return (
                      <div
                        key={node.id}
                        className='bg-surface-2 rounded-md px-2 py-1.5 text-[11px] leading-snug'
                      >
                        <span
                          className={`inline-block mr-1.5 font-semibold text-[10px] uppercase ${
                            isTerminal ? 'text-text-tertiary' : 'text-accent'
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

            {/* Stats */}
            {result.retrieval_stats && (
              <div className='flex flex-wrap gap-x-4 gap-y-1 text-[10px] pt-2 border-t border-border-subtle'>
                <span className='flex items-center gap-1 text-text-tertiary'>
                  <Database size={9} />
                  {result.retrieval_stats.vector_count} from vectors
                </span>
                <span className='flex items-center gap-1 text-text-tertiary'>
                  <GitBranch size={9} />
                  {result.retrieval_stats.unique_from_graph} from graph
                </span>
                <span className='text-text-tertiary'>
                  {result.retrieval_stats.merged_count} total context
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
