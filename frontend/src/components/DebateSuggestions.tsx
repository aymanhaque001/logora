import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getDebateSuggestions, createTopic } from '../api/client'
import { DebateSuggestion } from '../types'
import {
  Globe,
  Sparkles,
  ExternalLink,
  Plus,
  Search,
  Loader2,
  Newspaper,
  Zap,
  Clock,
  Radio,
} from 'lucide-react'

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Topics', icon: Globe },
  { value: 'geopolitical', label: 'Geopolitical', icon: Globe },
  { value: 'technology', label: 'Technology', icon: Zap },
  { value: 'economic', label: 'Economic', icon: Sparkles },
  { value: 'social', label: 'Social', icon: Globe },
  { value: 'environment', label: 'Environment', icon: Globe },
]

const TIMELINESS_ICON: Record<string, typeof Clock> = {
  breaking: Radio,
  recent: Clock,
  ongoing: Globe,
}

const TIMELINESS_COLORS: Record<string, string> = {
  breaking: 'text-red-400 bg-red-500/10',
  recent: 'text-amber-400 bg-amber-500/10',
  ongoing: 'text-blue-400 bg-blue-500/10',
}

const TAG_COLORS: Record<string, string> = {
  geographic: 'bg-sky-500/15 text-sky-400',
  social: 'bg-violet-500/15 text-violet-400',
  economic: 'bg-emerald-500/15 text-emerald-400',
  scientific: 'bg-blue-500/15 text-blue-400',
  political: 'bg-rose-500/15 text-rose-400',
  environmental: 'bg-teal-500/15 text-teal-400',
  technology: 'bg-orange-500/15 text-orange-400',
  environment: 'bg-teal-500/15 text-teal-400',
}

export function DebateSuggestions() {
  const navigate = useNavigate()
  const [category, setCategory] = useState('')
  const [customQuery, setCustomQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [creating, setCreating] = useState<string | null>(null)

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['suggestions', category, customQuery],
    queryFn: () =>
      getDebateSuggestions({
        category: category || undefined,
        q: customQuery || undefined,
        limit: 6,
      }),
    staleTime: 5 * 60 * 1000, // Cache for 5 min
    enabled: true,
  })

  const suggestions: DebateSuggestion[] = data?.suggestions ?? []

  const handleCreateTopic = async (suggestion: DebateSuggestion) => {
    setCreating(suggestion.canonical_question)
    try {
      const topic = await createTopic({
        canonical_question: suggestion.canonical_question,
        description: suggestion.description,
        tags: suggestion.tags?.filter((t) =>
          [
            'geographic',
            'social',
            'economic',
            'scientific',
            'political',
            'environmental',
          ].includes(t),
        ),
        location: suggestion.location || undefined,
      })
      navigate(`/topics/${topic.id}`)
    } catch (err) {
      console.error('Failed to create topic:', err)
      setCreating(null)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCustomQuery(searchInput)
    setCategory('')
  }

  return (
    <div className='space-y-4'>
      {/* Header */}
      <div className='flex items-center gap-2'>
        <Newspaper size={16} className='text-accent' />
        <h2 className='text-sm font-semibold text-text-primary'>
          Suggested Debates from the News
        </h2>
        {data?.status?.search_available && (
          <span className='flex items-center gap-1 ml-auto text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded'>
            <span className='w-1.5 h-1.5 rounded-full bg-emerald-400' />
            Live
          </span>
        )}
      </div>

      {/* Search & Filters */}
      <div className='flex items-center gap-2'>
        <form onSubmit={handleSearch} className='flex-1 flex gap-2'>
          <div className='relative flex-1'>
            <Search
              size={13}
              className='absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary'
            />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder='Search for a topic to debate...'
              className='input-field pl-8 py-2 text-xs'
            />
          </div>
          <button
            type='submit'
            className='btn-secondary px-3 py-2 text-xs rounded-lg'
          >
            Search
          </button>
        </form>
      </div>

      <div className='flex flex-wrap gap-1.5'>
        {CATEGORY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => {
              setCategory(opt.value)
              setCustomQuery('')
              setSearchInput('')
            }}
            className={`px-2.5 py-1 text-[11px] rounded font-medium transition-colors ${
              category === opt.value && !customQuery
                ? 'bg-accent text-white'
                : 'bg-surface-3 text-text-secondary hover:bg-surface-4'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Suggestions */}
      {isLoading || isFetching ? (
        <div className='flex items-center justify-center py-8 gap-2 text-text-tertiary text-xs'>
          <Loader2 size={14} className='animate-spin' />
          Searching the web for debate-worthy topics...
        </div>
      ) : suggestions.length === 0 ? (
        <div className='text-center py-8 text-xs text-text-tertiary'>
          No suggestions found. Try a different search or category.
        </div>
      ) : (
        <div className='space-y-2'>
          {suggestions.map((s, i) => {
            const TimeIcon = TIMELINESS_ICON[s.timeliness] || Clock
            return (
              <div
                key={i}
                className='bg-surface-2 border border-border-subtle rounded-lg p-3 hover:border-border-default transition-colors'
              >
                <div className='flex items-start gap-3'>
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2 mb-1'>
                      {s.timeliness && (
                        <span
                          className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            TIMELINESS_COLORS[s.timeliness] || ''
                          }`}
                        >
                          <TimeIcon size={10} />
                          {s.timeliness}
                        </span>
                      )}
                      {s.ai_framed && (
                        <span className='flex items-center gap-1 text-[10px] text-accent bg-accent/10 px-1.5 py-0.5 rounded font-medium'>
                          <Sparkles size={10} />
                          AI-framed
                        </span>
                      )}
                    </div>

                    <h3 className='text-sm font-medium text-text-primary leading-snug mb-1'>
                      {s.canonical_question}
                    </h3>

                    {s.description && (
                      <p className='text-xs text-text-tertiary line-clamp-2 mb-2'>
                        {s.description}
                      </p>
                    )}

                    <div className='flex items-center gap-2 flex-wrap'>
                      {s.tags?.map((tag) => (
                        <span
                          key={tag}
                          className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${
                            TAG_COLORS[tag] ??
                            'bg-surface-3 text-text-secondary'
                          }`}
                        >
                          {tag}
                        </span>
                      ))}
                      {s.source_url && (
                        <a
                          href={s.source_url}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='flex items-center gap-1 text-[10px] text-text-tertiary hover:text-accent transition-colors ml-auto'
                        >
                          <ExternalLink size={10} />
                          Source
                        </a>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleCreateTopic(s)}
                    disabled={creating === s.canonical_question}
                    className='shrink-0 flex items-center gap-1 btn-primary px-3 py-1.5 text-xs rounded-lg disabled:opacity-50'
                  >
                    {creating === s.canonical_question ? (
                      <Loader2 size={12} className='animate-spin' />
                    ) : (
                      <Plus size={12} />
                    )}
                    Create
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Refresh */}
      {!isLoading && suggestions.length > 0 && (
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className='w-full text-xs text-text-tertiary hover:text-accent transition-colors py-2'
        >
          {isFetching ? 'Refreshing...' : '↻ Refresh suggestions'}
        </button>
      )}
    </div>
  )
}
