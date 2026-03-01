import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getNewsFeed, createTopic } from '../api/client'
import { NewsArticle } from '../types'
import {
  Radio,
  ExternalLink,
  Plus,
  Loader2,
  Globe,
  Zap,
  TrendingUp,
  Users,
  Leaf,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
} from 'lucide-react'
import { useEffect, useRef, useCallback } from 'react'

const CATEGORY_ICONS: Record<string, typeof Globe> = {
  geopolitical: Globe,
  technology: Zap,
  economic: TrendingUp,
  social: Users,
  environment: Leaf,
  general: Globe,
}

const CATEGORY_COLORS: Record<string, string> = {
  geopolitical: 'text-sky-400 bg-sky-500/10',
  technology: 'text-orange-400 bg-orange-500/10',
  economic: 'text-emerald-400 bg-emerald-500/10',
  social: 'text-violet-400 bg-violet-500/10',
  environment: 'text-teal-400 bg-teal-500/10',
  general: 'text-text-secondary bg-surface-3',
}

export function NewsTicker() {
  const navigate = useNavigate()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isPaused, setIsPaused] = useState(false)
  const [creating, setCreating] = useState<string | null>(null)
  const animationRef = useRef<number>()
  const scrollSpeed = useRef(0.5)

  const { data, isLoading } = useQuery({
    queryKey: ['news-feed'],
    queryFn: () => getNewsFeed({ limit: 25 }),
    staleTime: 3 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  })

  const articles: NewsArticle[] = data?.articles ?? []

  // Auto-scroll animation
  const animate = useCallback(() => {
    const el = scrollRef.current
    if (!el || isPaused) {
      animationRef.current = requestAnimationFrame(animate)
      return
    }
    el.scrollLeft += scrollSpeed.current
    // Loop: when scrolled past halfway (duplicate content), reset
    if (el.scrollLeft >= el.scrollWidth / 2) {
      el.scrollLeft = 0
    }
    animationRef.current = requestAnimationFrame(animate)
  }, [isPaused])

  useEffect(() => {
    animationRef.current = requestAnimationFrame(animate)
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [animate])

  const handleDebateThis = async (article: NewsArticle) => {
    setCreating(article.title)
    try {
      // Frame the article title as a debate question
      let question = article.title.replace(/\.$/, '')
      if (!question.endsWith('?')) {
        question = `Should we debate: ${question}?`
      }

      const tagMap: Record<string, string> = {
        geopolitical: 'geographic',
        technology: 'scientific',
        economic: 'economic',
        social: 'social',
        environment: 'environmental',
      }

      const topic = await createTopic({
        canonical_question: question,
        description: article.body?.slice(0, 300) || undefined,
        tags: [tagMap[article.category] || 'political'].filter(Boolean),
        location: undefined,
      })
      navigate(`/topics/${topic.id}`)
    } catch (err) {
      console.error('Failed to create topic from news:', err)
      setCreating(null)
    }
  }

  const scrollBy = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 320, behavior: 'smooth' })
  }

  if (isLoading) {
    return (
      <div className='bg-surface-1 border border-border-subtle rounded-lg p-3'>
        <div className='flex items-center gap-2 text-xs text-text-tertiary'>
          <Loader2 size={12} className='animate-spin' />
          Loading news feed...
        </div>
      </div>
    )
  }

  if (articles.length === 0) return null

  // Duplicate articles for seamless infinite scroll
  const tickerItems = [...articles, ...articles]

  return (
    <div className='bg-surface-1 border border-border-subtle rounded-lg overflow-hidden'>
      {/* Header bar */}
      <div className='flex items-center justify-between px-3 py-2 border-b border-border-subtle bg-surface-2/50'>
        <div className='flex items-center gap-2'>
          <Radio size={13} className='text-red-400' />
          <span className='text-[11px] font-semibold text-text-primary uppercase tracking-wider'>
            Live News
          </span>
          <span className='flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded'>
            <span className='w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse' />
            {articles.length} stories
          </span>
        </div>
        <div className='flex items-center gap-1'>
          <button
            onClick={() => setIsPaused(!isPaused)}
            className='p-1 text-text-tertiary hover:text-text-secondary transition'
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? <Play size={12} /> : <Pause size={12} />}
          </button>
          <button
            onClick={() => scrollBy(-1)}
            className='p-1 text-text-tertiary hover:text-text-secondary transition'
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => scrollBy(1)}
            className='p-1 text-text-tertiary hover:text-text-secondary transition'
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Scrolling ticker */}
      <div
        ref={scrollRef}
        className='flex gap-3 px-3 py-3 overflow-x-hidden'
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {tickerItems.map((article, i) => {
          const CatIcon = CATEGORY_ICONS[article.category] || Globe
          const catColor =
            CATEGORY_COLORS[article.category] || CATEGORY_COLORS.general
          return (
            <div
              key={`${article.title}-${i}`}
              className='shrink-0 w-[300px] bg-surface-2 border border-border-subtle rounded-lg p-3 hover:border-border-default transition-colors group'
            >
              {/* Category + source */}
              <div className='flex items-center gap-2 mb-2'>
                <span
                  className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${catColor}`}
                >
                  <CatIcon size={10} />
                  {article.category}
                </span>
                {article.source && (
                  <span className='text-[10px] text-text-tertiary truncate'>
                    {article.source}
                  </span>
                )}
              </div>

              {/* Title */}
              <h3 className='text-xs font-medium text-text-primary leading-snug line-clamp-2 mb-2 min-h-[2.5rem]'>
                {article.title}
              </h3>

              {/* Body preview */}
              {article.body && (
                <p className='text-[11px] text-text-tertiary line-clamp-2 mb-3 leading-relaxed'>
                  {article.body}
                </p>
              )}

              {/* Actions */}
              <div className='flex items-center gap-2'>
                <button
                  onClick={() => handleDebateThis(article)}
                  disabled={creating === article.title}
                  className='flex items-center gap-1 btn-primary px-2.5 py-1 text-[11px] rounded-md disabled:opacity-50'
                >
                  {creating === article.title ? (
                    <Loader2 size={10} className='animate-spin' />
                  ) : (
                    <Plus size={10} />
                  )}
                  Debate This
                </button>
                {article.url && (
                  <a
                    href={article.url}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='flex items-center gap-1 text-[10px] text-text-tertiary hover:text-accent transition-colors ml-auto'
                  >
                    <ExternalLink size={10} />
                    Read
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
