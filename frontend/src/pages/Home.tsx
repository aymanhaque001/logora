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
    <Link to={`/topics/${topic.id}`} className='group block card-hover p-4'>
      <div className='flex items-start justify-between gap-3 mb-2'>
        <h2 className='text-sm font-medium text-text-primary leading-snug group-hover:text-accent-hover transition-colors'>
          {topic.canonical_question}
        </h2>
        <ArrowUpRight
          size={14}
          className='shrink-0 mt-0.5 text-text-tertiary group-hover:text-accent transition-colors'
        />
      </div>

      {topic.description && (
        <p className='text-xs text-text-tertiary line-clamp-2 mb-3 leading-relaxed'>
          {topic.description}
        </p>
      )}

      <div className='flex flex-wrap gap-1.5 mb-3'>
        {topic.tags.map((tag) => (
          <span
            key={tag}
            className={`px-2 py-0.5 text-[11px] rounded font-medium ${TAG_COLORS[tag] ?? 'bg-surface-3 text-text-secondary'}`}
          >
            {tag}
          </span>
        ))}
        <span
          className={`px-2 py-0.5 text-[11px] rounded font-medium ${
            topic.status === 'active'
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-surface-3 text-text-tertiary'
          }`}
        >
          {topic.status}
        </span>
      </div>

      <div className='flex items-center gap-4 text-xs text-text-tertiary pt-3 border-t border-border-subtle'>
        {topic.location && (
          <span className='flex items-center gap-1'>
            <MapPin size={11} /> {topic.location}
          </span>
        )}
        <span className='flex items-center gap-1'>
          <MessageSquare size={11} /> {topic.node_count}
        </span>
        <span className='flex items-center gap-1'>
          <GitBranch size={11} /> {topic.track_count}
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
    <div className='max-w-3xl mx-auto px-6 py-10 animate-fade-in'>
      <div className='mb-8'>
        <h1 className='text-xl font-semibold text-text-primary tracking-tight'>
          Debates
        </h1>
        <p className='text-sm text-text-tertiary mt-1'>
          Structured, evidence-based discourse.
        </p>
      </div>

      <div className='flex items-center gap-3 mb-4'>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setQuery(search)
          }}
          className='flex-1 flex gap-2'
        >
          <div className='relative flex-1'>
            <Search
              size={15}
              className='absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary'
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Search debates...'
              className='input-field pl-9'
            />
          </div>
          <button
            type='submit'
            className='btn-secondary px-4 py-2.5 text-sm rounded-lg'
          >
            Search
          </button>
        </form>
        <Link
          to='/topics/new'
          className='flex items-center gap-1.5 btn-primary px-4 py-2.5 text-sm rounded-lg whitespace-nowrap'
        >
          <Plus size={15} /> New
        </Link>
      </div>

      <div className='flex flex-wrap gap-1.5 mb-6'>
        <button
          onClick={() => setActiveTag(null)}
          className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
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
            className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
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

      {isLoading ? (
        <div className='space-y-3'>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className='h-32 bg-surface-2 rounded-lg animate-pulse'
            />
          ))}
        </div>
      ) : topics?.length === 0 ? (
        <div className='text-center py-20'>
          <p className='text-sm text-text-tertiary'>No debates found.</p>
        </div>
      ) : (
        <div className='space-y-2'>
          {topics?.map((topic) => (
            <TopicCard key={topic.id} topic={topic} />
          ))}
        </div>
      )}

      {/* Web Search Suggestions */}
      <div className='mt-10 pt-8 border-t border-border-subtle'>
        <DebateSuggestions />
      </div>
    </div>
  )
}
