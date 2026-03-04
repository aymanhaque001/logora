import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getTopics, getBriefing } from '../api/client'
import { Topic } from '../types'
import {
  MessageSquare,
  MapPin,
  Search,
  Plus,
  Users,
  Flame,
  Sparkles,
  TrendingUp,
  Clock,
  ChevronUp,
  GitBranch,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { LiveFeedSidebar } from '../components/LiveFeedSidebar'
import { HomeRAGQuery } from '../components/HomeRAGQuery'
import { useInView } from '../hooks/useInView'

const TAG_COLORS: Record<string, string> = {
  geographic: 'bg-sky-500/15 text-sky-400',
  social: 'bg-violet-500/15 text-violet-400',
  economic: 'bg-emerald-500/15 text-emerald-400',
  scientific: 'bg-blue-500/15 text-blue-400',
  political: 'bg-rose-500/15 text-rose-400',
  environmental: 'bg-teal-500/15 text-teal-400',
}

const SORT_OPTIONS = [
  { key: 'hot', label: 'Hot', Icon: Flame },
  { key: 'new', label: 'New', Icon: Sparkles },
  { key: 'top', label: 'Top', Icon: TrendingUp },
  { key: 'old', label: 'Old', Icon: Clock },
]

function TopicCard({ topic }: { topic: Topic }) {
  const [cardRef, inView] = useInView<HTMLDivElement>()
  const { data: briefing } = useQuery({
    queryKey: ['briefing', topic.id],
    queryFn: () => getBriefing(topic.id),
    enabled: inView && topic.node_count > 0,
    staleTime: Infinity,
  })

  const activityTime = topic.last_activity ?? topic.created_at

  return (
    <div
      ref={cardRef}
      className='bg-surface-2 border border-border-subtle rounded-md hover:border-accent/30 transition-colors group'
    >
      <div className='flex'>
        {/* Vote-style sidebar */}
        <div className='flex flex-col items-center gap-0.5 px-2.5 py-3 bg-surface-1 rounded-l-md min-w-[44px] border-r border-border-subtle'>
          <ChevronUp
            size={16}
            className='text-text-tertiary group-hover:text-accent transition-colors'
          />
          <span className='text-xs font-semibold text-text-secondary tabular-nums'>
            {topic.node_count}
          </span>
          <span className='text-[9px] text-text-tertiary'>takes</span>
        </div>

        {/* Card content */}
        <div className='flex-1 p-3 min-w-0'>
          {/* Meta line */}
          <div className='flex items-center gap-1.5 text-[10px] text-text-tertiary mb-1.5 flex-wrap'>
            <span className='flex items-center gap-1 font-medium text-accent/70'>
              <GitBranch size={9} /> debate
            </span>
            <span>·</span>
            {topic.location && (
              <>
                <span className='flex items-center gap-1'>
                  <MapPin size={9} /> {topic.location}
                </span>
                <span>·</span>
              </>
            )}
            <span>
              posted{' '}
              {formatDistanceToNow(new Date(topic.created_at), {
                addSuffix: true,
              })}
            </span>
          </div>

          {/* Title */}
          <Link to={`/topics/${topic.id}`} className='block'>
            <h2 className='text-sm font-medium text-text-primary leading-snug group-hover:text-accent transition-colors mb-1.5'>
              {topic.canonical_question}
            </h2>
          </Link>

          {/* Tags */}
          <div className='flex flex-wrap gap-1 mb-2'>
            {topic.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className={`px-1.5 py-0.5 text-[10px] rounded-full font-medium ${TAG_COLORS[tag] ?? 'bg-surface-3 text-text-secondary'}`}
              >
                {tag}
              </span>
            ))}
            <span
              className={`px-1.5 py-0.5 text-[10px] rounded-full font-medium ${
                topic.status === 'active'
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-surface-3 text-text-tertiary'
              }`}
            >
              {topic.status}
            </span>
          </div>

          {/* AI briefing preview */}
          {briefing?.summary && briefing.ai_powered && (
            <p className='text-[11px] text-text-tertiary/80 italic line-clamp-2 mb-2 leading-relaxed border-l-2 border-accent/25 pl-2'>
              {briefing.summary}
            </p>
          )}

          {/* Action bar */}
          <div className='flex items-center gap-3 text-[10px] text-text-tertiary'>
            <Link
              to={`/topics/${topic.id}`}
              className='flex items-center gap-1 hover:text-text-secondary transition-colors'
            >
              <MessageSquare size={11} />
              {topic.node_count} comments
            </Link>
            {topic.participant_count > 0 && (
              <span className='flex items-center gap-1'>
                <Users size={11} />
                {topic.participant_count} contributors
              </span>
            )}
            <span className='flex items-center gap-1 ml-auto'>
              <Flame size={10} />
              {formatDistanceToNow(new Date(activityTime), { addSuffix: true })}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Home() {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [sort, setSort] = useState('hot')

  const { data: topics, isLoading } = useQuery<Topic[]>({
    queryKey: ['topics', query, activeTag],
    queryFn: () =>
      getTopics({ search: query || undefined, tag: activeTag || undefined }),
  })

  // Client-side sort
  const sortedTopics = [...(topics ?? [])].sort((a, b) => {
    if (sort === 'new')
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    if (sort === 'old')
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    if (sort === 'top') return b.node_count - a.node_count
    // hot: score by recency + activity
    const aScore =
      a.node_count * 2 +
      new Date(a.last_activity ?? a.created_at).getTime() / 1e10
    const bScore =
      b.node_count * 2 +
      new Date(b.last_activity ?? b.created_at).getTime() / 1e10
    return bScore - aScore
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
    <div className='min-h-screen bg-surface-0'>
      <div className='max-w-[1200px] mx-auto px-4 py-5 animate-fade-in'>
        <div className='flex gap-6 items-start'>
          {/* ── Left sidebar ─────────────────────────────── */}
          <aside className='hidden xl:flex flex-col gap-3 w-56 shrink-0 sticky top-14'>
            {/* Stats + CTA */}
            <div className='bg-surface-2 border border-border-subtle rounded-md p-3 plum-left'>
              <div className='grid grid-cols-2 gap-2 mb-3 text-center'>
                <div>
                  <div className='text-sm font-semibold text-text-primary'>
                    {topics?.length ?? 0}
                  </div>
                  <div className='text-[10px] text-text-tertiary'>debates</div>
                </div>
                <div>
                  <div className='text-sm font-semibold text-text-primary'>
                    {topics?.reduce(
                      (s, t) => s + (t.participant_count ?? 0),
                      0,
                    ) ?? 0}
                  </div>
                  <div className='text-[10px] text-text-tertiary'>
                    contributors
                  </div>
                </div>
              </div>
              <Link
                to='/topics/new'
                className='flex items-center justify-center gap-1.5 w-full btn-primary py-1.5 text-xs rounded-full font-medium'
              >
                <Plus size={12} /> Create Debate
              </Link>
            </div>

            {/* Tag filter */}
            <div className='bg-surface-2 border border-border-subtle rounded-md p-3 plum-left'>
              <p className='text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-2'>
                Filter by topic
              </p>
              <div className='flex flex-col gap-1'>
                <button
                  onClick={() => setActiveTag(null)}
                  className={`text-left px-2 py-1 text-xs rounded transition-colors ${
                    activeTag === null
                      ? 'bg-accent/20 text-accent'
                      : 'text-text-secondary hover:bg-surface-3'
                  }`}
                >
                  All topics
                </button>
                {ALL_TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                    className={`text-left px-2 py-1 text-xs rounded transition-colors capitalize ${
                      activeTag === tag
                        ? 'bg-accent/20 text-accent'
                        : 'text-text-secondary hover:bg-surface-3'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* ── Main feed ────────────────────────────────── */}
          <main className='flex-1 min-w-0'>
            {/* Sticky search + RAG + sort */}
            <div className='sticky top-14 z-40 space-y-2 pb-3 bg-surface-0'>
              {/* Search bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  setQuery(search)
                }}
                className='flex gap-2 pt-3'
              >
                <div className='relative flex-1'>
                  <Search
                    size={13}
                    className='absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary'
                  />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder='Search debates…'
                    className='input-field input-field-plum w-full pl-9 py-2 text-sm rounded-full'
                  />
                </div>
                {search && (
                  <button
                    type='submit'
                    className='btn-secondary px-4 py-2 text-xs rounded-full'
                  >
                    Search
                  </button>
                )}
              </form>

              {/* RAG query widget */}
              <HomeRAGQuery />

              {/* Sort + mobile tag filter bar */}
              <div className='bg-surface-2 border border-border-subtle rounded-md px-3 py-1.5 flex items-center gap-1 flex-wrap'>
                {SORT_OPTIONS.map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    onClick={() => setSort(key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                      sort === key
                        ? 'bg-accent/15 text-accent'
                        : 'text-text-tertiary hover:bg-surface-3 hover:text-text-secondary'
                    }`}
                  >
                    <Icon size={13} /> {label}
                  </button>
                ))}

                {/* Mobile tag filters */}
                <div className='xl:hidden flex items-center gap-1 ml-auto flex-wrap'>
                  {ALL_TAGS.map((tag) => (
                    <button
                      key={tag}
                      onClick={() =>
                        setActiveTag(activeTag === tag ? null : tag)
                      }
                      className={`px-2 py-0.5 text-[10px] rounded-full font-medium transition-colors capitalize ${
                        activeTag === tag
                          ? 'bg-accent text-white'
                          : 'bg-surface-3 text-text-secondary hover:bg-surface-4'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {/* end sticky bar */}

            {/* Feed */}
            <div className='space-y-2'>
              {isLoading ? (
                <div className='space-y-2'>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className='h-28 bg-surface-2 rounded-md animate-pulse'
                    />
                  ))}
                </div>
              ) : sortedTopics.length === 0 ? (
                <div className='text-center py-16 bg-surface-2 rounded-md border border-border-subtle'>
                  <p className='text-sm text-text-tertiary'>
                    No debates found.
                  </p>
                  <Link
                    to='/topics/new'
                    className='inline-flex items-center gap-1.5 mt-3 btn-primary px-4 py-2 text-xs rounded-full'
                  >
                    <Plus size={12} /> Start one
                  </Link>
                </div>
              ) : (
                <div className='space-y-2'>
                  {sortedTopics.map((topic) => (
                    <TopicCard key={topic.id} topic={topic} />
                  ))}
                </div>
              )}
            </div>
            {/* end feed */}
          </main>

          {/* ── Right sidebar ─────────────────────────────── */}
          <aside className='hidden lg:flex flex-col w-72 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)]'>
            <LiveFeedSidebar />
          </aside>
        </div>
      </div>
    </div>
  )
}
