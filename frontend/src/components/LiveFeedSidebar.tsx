/**
 * LiveFeedSidebar — combines live news articles and AI-suggested debate
 * topics into a single interleaved vertical feed for the right sidebar.
 */
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getNewsFeed, getDebateSuggestions, createTopic } from '../api/client'
import { NewsArticle, DebateSuggestion } from '../types'
import {
  Radio,
  Sparkles,
  ExternalLink,
  Plus,
  Loader2,
  Globe,
  Zap,
  TrendingUp,
  Users,
  Leaf,
  RefreshCw,
  Newspaper,
} from 'lucide-react'

/* ── colour maps ─────────────────────────────────────────── */
const CAT_COLORS: Record<string, string> = {
  geopolitical: 'text-sky-400 bg-sky-500/10',
  technology: 'text-orange-400 bg-orange-500/10',
  economic: 'text-emerald-400 bg-emerald-500/10',
  social: 'text-violet-400 bg-violet-500/10',
  environment: 'text-teal-400 bg-teal-500/10',
  general: 'text-text-secondary bg-surface-3',
}
const CAT_ICONS: Record<string, typeof Globe> = {
  geopolitical: Globe,
  technology: Zap,
  economic: TrendingUp,
  social: Users,
  environment: Leaf,
  general: Globe,
}
const TIMELINESS_COLORS: Record<string, string> = {
  breaking: 'text-red-400 bg-red-500/10',
  recent: 'text-amber-400 bg-amber-500/10',
  ongoing: 'text-blue-400 bg-blue-500/10',
}

/* ── feed item types ─────────────────────────────────────── */
type NewsItem = { kind: 'news'; data: NewsArticle }
type SuggestItem = { kind: 'suggestion'; data: DebateSuggestion }
type FeedItem = NewsItem | SuggestItem

export function LiveFeedSidebar() {
  const navigate = useNavigate()
  const [creating, setCreating] = useState<string | null>(null)

  const {
    data: newsData,
    isLoading: newsLoading,
    refetch: refetchNews,
  } = useQuery({
    queryKey: ['news-feed-sidebar'],
    queryFn: () => getNewsFeed({ limit: 20 }),
    staleTime: 3 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  })

  const {
    data: suggestData,
    isLoading: suggestLoading,
    refetch: refetchSuggestions,
  } = useQuery({
    queryKey: ['suggestions-sidebar'],
    queryFn: () => getDebateSuggestions({ limit: 8 }),
    staleTime: 5 * 60 * 1000,
  })

  const isLoading = newsLoading || suggestLoading

  /* Interleave: 2 news → 1 suggestion → repeat */
  const feed: FeedItem[] = useMemo(() => {
    const news: NewsItem[] = (newsData?.articles ?? []).map(
      (d: NewsArticle) => ({ kind: 'news' as const, data: d }),
    )
    const suggest: SuggestItem[] = (suggestData?.suggestions ?? []).map(
      (d: DebateSuggestion) => ({ kind: 'suggestion' as const, data: d }),
    )
    const result: FeedItem[] = []
    let ni = 0,
      si = 0,
      slot = 0
    while (ni < news.length || si < suggest.length) {
      if (slot % 3 === 2 && si < suggest.length) {
        result.push(suggest[si++])
      } else if (ni < news.length) {
        result.push(news[ni++])
      } else if (si < suggest.length) {
        result.push(suggest[si++])
      }
      slot++
    }
    return result
  }, [newsData, suggestData])

  const handleDebateNews = async (article: NewsArticle) => {
    setCreating(article.title)
    try {
      const tagMap: Record<string, string> = {
        geopolitical: 'geographic',
        technology: 'scientific',
        economic: 'economic',
        social: 'social',
        environment: 'environmental',
      }
      const topic = await createTopic({
        canonical_question: article.title.endsWith('?')
          ? article.title
          : `Should we debate: ${article.title.replace(/\.$/, '')}?`,
        description: article.body?.slice(0, 300) || undefined,
        tags: [tagMap[article.category] || 'political'],
      })
      navigate(`/topics/${topic.id}`)
    } catch {
      setCreating(null)
    }
  }

  const handleDebateSuggestion = async (s: DebateSuggestion) => {
    setCreating(s.canonical_question)
    try {
      const topic = await createTopic({
        canonical_question: s.canonical_question,
        description: s.description,
        tags: s.tags?.filter((t) =>
          [
            'geographic',
            'social',
            'economic',
            'scientific',
            'political',
            'environmental',
          ].includes(t),
        ),
        location: s.location || undefined,
      })
      navigate(`/topics/${topic.id}`)
    } catch {
      setCreating(null)
    }
  }

  const refetchAll = () => {
    refetchNews()
    refetchSuggestions()
  }

  return (
    <div className='bg-surface-2 border border-border-subtle rounded-md overflow-hidden flex flex-col h-full'>
      {/* Header */}
      <div className='flex items-center gap-2 px-3 py-2 border-b border-border-subtle shrink-0'>
        <Radio size={12} className='text-red-400' />
        <span className='text-xs font-semibold text-text-primary'>
          Live Feed
        </span>
        <span className='flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded ml-0.5'>
          <span className='w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse' />
          live
        </span>
        <button
          onClick={refetchAll}
          disabled={isLoading}
          className='ml-auto p-1 text-text-tertiary hover:text-accent transition disabled:opacity-40'
          title='Refresh feed'
        >
          <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Feed */}
      {isLoading ? (
        <div className='flex items-center justify-center py-10 gap-2 text-text-tertiary text-xs'>
          <Loader2 size={13} className='animate-spin' /> Loading feed…
        </div>
      ) : (
        <div className='overflow-y-auto flex-1'>
          {feed.map((item, i) =>
            item.kind === 'news' ? (
              <NewsCard
                key={`n-${i}`}
                article={item.data}
                creating={creating}
                onDebate={handleDebateNews}
              />
            ) : (
              <SuggestionCard
                key={`s-${i}`}
                suggestion={item.data}
                creating={creating}
                onDebate={handleDebateSuggestion}
              />
            ),
          )}
          {feed.length === 0 && (
            <p className='text-xs text-text-tertiary text-center py-10'>
              No feed items available.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/* ── News card ──────────────────────────────────────────── */
function NewsCard({
  article,
  creating,
  onDebate,
}: {
  article: NewsArticle
  creating: string | null
  onDebate: (a: NewsArticle) => void
}) {
  const CatIcon = CAT_ICONS[article.category] || Globe
  const catColor = CAT_COLORS[article.category] || CAT_COLORS.general

  return (
    <div className='px-3 py-3 border-b border-border-subtle hover:bg-surface-3/30 transition-colors group'>
      {/* Label row */}
      <div className='flex items-center gap-1.5 mb-1.5'>
        <span
          className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${catColor}`}
        >
          <CatIcon size={9} /> {article.category}
        </span>
        {article.source && (
          <span className='text-[10px] text-text-tertiary truncate'>
            {article.source}
          </span>
        )}
        <span className='ml-auto text-[9px] text-text-tertiary/50 flex items-center gap-1'>
          <Newspaper size={9} /> news
        </span>
      </div>

      {/* Title */}
      <p className='text-xs font-medium text-text-primary leading-snug line-clamp-2 mb-2'>
        {article.title}
      </p>

      {/* Body */}
      {article.body && (
        <p className='text-[11px] text-text-tertiary line-clamp-2 mb-2 leading-relaxed'>
          {article.body}
        </p>
      )}

      {/* Actions */}
      <div className='flex items-center gap-2'>
        <button
          onClick={() => onDebate(article)}
          disabled={creating === article.title}
          className='flex items-center gap-1 btn-primary px-2.5 py-1 text-[11px] rounded disabled:opacity-50'
        >
          {creating === article.title ? (
            <Loader2 size={9} className='animate-spin' />
          ) : (
            <Plus size={9} />
          )}
          Debate this
        </button>
        {article.url && (
          <a
            href={article.url}
            target='_blank'
            rel='noopener noreferrer'
            className='flex items-center gap-1 text-[10px] text-text-tertiary hover:text-accent transition-colors ml-auto'
          >
            <ExternalLink size={9} /> Read
          </a>
        )}
      </div>
    </div>
  )
}

/* ── Suggestion card ────────────────────────────────────── */
function SuggestionCard({
  suggestion: s,
  creating,
  onDebate,
}: {
  suggestion: DebateSuggestion
  creating: string | null
  onDebate: (s: DebateSuggestion) => void
}) {
  const timelinessCls =
    TIMELINESS_COLORS[s.timeliness] || TIMELINESS_COLORS.ongoing

  return (
    <div className='px-3 py-3 border-b border-border-subtle bg-accent/[0.03] hover:bg-accent/[0.06] transition-colors'>
      {/* Label row */}
      <div className='flex items-center gap-1.5 mb-1.5'>
        <span className='flex items-center gap-1 text-[10px] text-accent bg-accent/10 px-1.5 py-0.5 rounded font-medium'>
          <Sparkles size={9} /> AI suggestion
        </span>
        {s.timeliness && (
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${timelinessCls}`}
          >
            {s.timeliness}
          </span>
        )}
      </div>

      {/* Question */}
      <p className='text-xs font-medium text-text-primary leading-snug mb-2'>
        {s.canonical_question}
      </p>

      {s.description && (
        <p className='text-[11px] text-text-tertiary line-clamp-2 mb-2 leading-relaxed'>
          {s.description}
        </p>
      )}

      {/* Actions */}
      <div className='flex items-center gap-2'>
        <button
          onClick={() => onDebate(s)}
          disabled={creating === s.canonical_question}
          className='flex items-center gap-1 btn-primary px-2.5 py-1 text-[11px] rounded disabled:opacity-50'
        >
          {creating === s.canonical_question ? (
            <Loader2 size={9} className='animate-spin' />
          ) : (
            <Plus size={9} />
          )}
          Start debate
        </button>
        {s.source_url && (
          <a
            href={s.source_url}
            target='_blank'
            rel='noopener noreferrer'
            className='flex items-center gap-1 text-[10px] text-text-tertiary hover:text-accent transition-colors ml-auto'
          >
            <ExternalLink size={9} /> Source
          </a>
        )}
      </div>
    </div>
  )
}
