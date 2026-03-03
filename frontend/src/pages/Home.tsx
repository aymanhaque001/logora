import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getTopics } from '../api/client'
import { Topic } from '../types'
import {
  MessageSquare,
  MapPin,
  Search,
  Plus,
  GitBranch,
  ArrowUpRight,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { DebateSuggestions } from '../components/DebateSuggestions'
import { NewsTicker } from '../components/NewsTicker'
import { HomeRAGQuery } from '../components/HomeRAGQuery'

const TAG_COLORS: Record<string, string> = {
  geographic: 'bg-sky-500/15 text-sky-400',
  social: 'bg-violet-500/15 text-violet-400',
  economic: 'bg-emerald-500/15 text-emerald-400',
  scientific: 'bg-blue-500/15 text-blue-400',
  political: 'bg-rose-500/15 text-rose-400',
  environmental: 'bg-teal-500/15 text-teal-400',
}

function TopicCard({ topic }: { topic: Topic }) {
  return (
    <Link to={`/topics/${topic.id}`} className='group block card-hover p-3'>
      <div className='flex items-start justify-between gap-2 mb-1.5'>
        <h2 className='text-xs font-medium text-text-primary leading-snug group-hover:text-accent-hover transition-colors'>
          {topic.canonical_question}
        </h2>
        <ArrowUpRight
          size={12}
          className='shrink-0 mt-0.5 text-text-tertiary group-hover:text-accent transition-colors'
        />
      </div>

      {topic.description && (
        <p className='text-[11px] text-text-tertiary line-clamp-2 mb-2 leading-relaxed'>
          {topic.description}
        </p>
      )}

      <div className='flex flex-wrap gap-1 mb-2'>
        {topic.tags.map((tag) => (
          <span
            key={tag}
            className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${TAG_COLORS[tag] ?? 'bg-surface-3 text-text-secondary'}`}
          >
            {tag}
          </span>
        ))}
        <span
          className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${
            topic.status === 'active'
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-surface-3 text-text-tertiary'
          }`}
        >
          {topic.status}
        </span>
      </div>

      <div className='flex items-center gap-3 text-[10px] text-text-tertiary pt-2 border-t border-border-subtle'>
        {topic.location && (
          <span className='flex items-center gap-1'>
            <MapPin size={10} /> {topic.location}
          </span>
        )}
        <span className='flex items-center gap-1'>
          <MessageSquare size={10} /> {topic.node_count}
        </span>
        <span className='flex items-center gap-1'>
          <GitBranch size={10} /> {topic.track_count}
        </span>
        <span className='ml-auto'>
          {formatDistanceToNow(new Date(topic.created_at), { addSuffix: true })}
        </span>
      </div>
    </Link>
  )
}

export function Home() {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const { data: topics, isLoading } = useQuery<Topic[]>({
    queryKey: ['topics', query, activeTag],
    queryFn: () =>
      getTopics({ search: query || undefined, tag: activeTag || undefined }),
  })

  const ALL_TAGS = [
    'geographic',
    'social',
    'economic',
    'scientific',
    'political',
    'environmental',
  ]

  return (
    <div className='max-w-[1400px] mx-auto px-6 py-6 animate-fade-in'>
      {/* Header */}
      <div className='mb-5'>
        <h1 className='text-lg font-light text-text-primary tracking-wide lowercase'>
          dashboard
        </h1>
        <p className='text-xs font-light text-text-tertiary mt-0.5'>
          structured discourse — powered by real-time news and graph RAG
        </p>
      </div>

      {/* News Ticker */}
      <div className='mb-4'>
        <NewsTicker />
      </div>

      {/* RAG Query */}
      <div className='mb-5'>
        <HomeRAGQuery />
      </div>

      {/* Two-column layout */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-5'>
        {/* Left: Active Debates */}
        <div className='space-y-3'>
          <div className='flex items-center justify-between'>
            <h2 className='text-sm font-semibold text-text-primary'>
              Active Debates
            </h2>
            <Link
              to='/topics/new'
              className='flex items-center gap-1 btn-primary px-3 py-1.5 text-[11px] rounded-lg whitespace-nowrap'
            >
              <Plus size={12} /> new debate
            </Link>
          </div>

          {/* Search */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setQuery(search)
            }}
            className='flex gap-2'
          >
            <div className='relative flex-1'>
              <Search
                size={13}
                className='absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary'
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder='Search debates...'
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

          {/* Tag filters */}
          <div className='flex flex-wrap gap-1.5'>
            <button
              onClick={() => setActiveTag(null)}
              className={`px-2 py-0.5 text-[11px] rounded font-medium transition-colors ${
                activeTag === null
                  ? 'bg-accent text-white'
                  : 'bg-surface-3 text-text-secondary hover:bg-surface-4'
              }`}
            >
              All
            </button>
            {ALL_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={`px-2 py-0.5 text-[11px] rounded font-medium transition-colors ${
                  activeTag === tag
                    ? 'bg-accent text-white'
                    : (TAG_COLORS[tag] ?? 'bg-surface-3 text-text-secondary') +
                      ' hover:opacity-80'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>

          {/* Topic list */}
          {isLoading ? (
            <div className='space-y-2'>
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className='h-24 bg-surface-2 rounded-lg animate-pulse'
                />
              ))}
            </div>
          ) : topics?.length === 0 ? (
            <div className='text-center py-12'>
              <p className='text-xs text-text-tertiary'>No debates found.</p>
            </div>
          ) : (
            <div className='space-y-1.5 max-h-[calc(100vh-420px)] overflow-y-auto pr-1'>
              {topics?.map((topic) => (
                <TopicCard key={topic.id} topic={topic} />
              ))}
            </div>
          )}
        </div>

        {/* Right: Suggested Debates */}
        <div>
          <DebateSuggestions />
        </div>
      </div>
    </div>
  )
}
