import { BriefingData } from '../types'
import {
  AlertTriangle,
  TrendingUp,
  Sparkles,
  MessageSquare,
  ChevronRight,
} from 'lucide-react'

interface Props {
  briefing: BriefingData
}

function HealthBar({
  value,
  label,
  color,
}: {
  value: number
  label: string
  color: string
}) {
  const pct = Math.round(value * 100)
  return (
    <div>
      <div className='flex justify-between text-xs mb-1.5'>
        <span className='text-text-secondary font-medium'>{label}</span>
        <span className='font-semibold text-text-primary'>{pct}%</span>
      </div>
      <div className='h-1.5 bg-surface-3 rounded-full overflow-hidden'>
        <div
          className='h-full rounded-full transition-all duration-500 ease-out'
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

const STRENGTH_CONFIG = {
  strong: {
    dot: 'bg-emerald-400',
    label: 'Strong',
    pill: 'bg-emerald-500/15 text-emerald-400',
  },
  moderate: {
    dot: 'bg-amber-400',
    label: 'Moderate',
    pill: 'bg-amber-500/15 text-amber-400',
  },
  weak: {
    dot: 'bg-red-400',
    label: 'Weak',
    pill: 'bg-red-500/15 text-red-400',
  },
}

export function BriefingRoom({ briefing }: Props) {
  const h = briefing.discourse_health

  return (
    <div className='space-y-4'>
      {briefing.ai_powered ? (
        <div className='flex items-center gap-2 px-3 py-2 bg-violet-500/10 border border-violet-500/20 rounded text-xs text-violet-400'>
          <Sparkles size={12} className='text-violet-400' />
          <span className='font-medium'>AI-powered</span>
          <span className='text-violet-400/60'>by Claude</span>
        </div>
      ) : (
        <div className='flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-400'>
          <AlertTriangle size={12} />
          <span>Add ANTHROPIC_API_KEY for AI briefings</span>
        </div>
      )}

      {/* Summary */}
      <div>
        <h3 className='text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1.5'>
          Summary
        </h3>
        <p className='text-xs text-text-secondary leading-relaxed'>
          {briefing.summary || 'No summary yet.'}
        </p>
        {briefing.main_areas_of_contention.length > 0 && (
          <div className='mt-2 flex flex-wrap gap-1.5'>
            {briefing.main_areas_of_contention.map((area, i) => (
              <span
                key={i}
                className='px-2 py-0.5 bg-surface-3 rounded text-[10px] text-text-tertiary font-medium'
              >
                {area}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Key positions */}
      {briefing.key_positions.length > 0 && (
        <div>
          <h3 className='text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-2'>
            Positions
          </h3>
          <div className='space-y-2'>
            {briefing.key_positions.map((pos, i) => {
              const cfg =
                STRENGTH_CONFIG[pos.strength as keyof typeof STRENGTH_CONFIG] ??
                STRENGTH_CONFIG.moderate
              return (
                <div
                  key={i}
                  className='bg-surface-2 rounded-md p-3 border border-border-subtle'
                >
                  <div className='flex items-start justify-between gap-2 mb-1'>
                    <div className='flex items-center gap-2'>
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`}
                      />
                      <span className='text-xs font-semibold text-text-primary'>
                        {pos.position}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${cfg.pill}`}
                    >
                      {cfg.label}
                    </span>
                  </div>
                  <p className='text-[11px] text-text-tertiary leading-relaxed pl-4'>
                    {pos.core_claim}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Health */}
      <div>
        <h3 className='text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-2 flex items-center gap-1.5'>
          <TrendingUp size={11} /> Health
        </h3>
        <div className='space-y-3'>
          <HealthBar value={h.sourced_ratio} label='Sourced' color='#5B7EEA' />
          <HealthBar
            value={h.engagement_ratio}
            label='Engaged'
            color='#a855f7'
          />
          <div className='grid grid-cols-3 gap-2 pt-1'>
            {[
              {
                label: 'Total',
                value: h.total_nodes,
                color: 'text-text-primary',
              },
              {
                label: 'Open',
                value: h.unaddressed_count,
                color: 'text-amber-400',
              },
              {
                label: 'Quality',
                value: h.engagement_quality ?? '\u2014',
                color: 'text-accent',
              },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className='text-center p-2 bg-surface-2 rounded border border-border-subtle'
              >
                <div className={`text-sm font-bold ${color}`}>{value}</div>
                <div className='text-[10px] text-text-tertiary mt-0.5'>
                  {label}
                </div>
              </div>
            ))}
          </div>
          {h.assessment && (
            <p className='text-xs text-text-tertiary italic pt-1'>
              {h.assessment}
            </p>
          )}
        </div>
      </div>

      {/* Unaddressed */}
      {briefing.unaddressed_nodes.length > 0 && (
        <div>
          <h3 className='text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-2 flex items-center gap-1.5'>
            <AlertTriangle size={11} className='text-amber-400' /> Unaddressed
          </h3>
          <div className='space-y-1.5'>
            {briefing.unaddressed_nodes.slice(0, 3).map((node) => (
              <div
                key={node.id}
                className='flex gap-2 bg-amber-500/10 border border-amber-500/20 rounded p-2.5'
              >
                <ChevronRight
                  size={12}
                  className='text-amber-400 shrink-0 mt-0.5'
                />
                <div>
                  <p className='text-[11px] text-text-secondary leading-relaxed line-clamp-2'>
                    {node.content}
                  </p>
                  <p className='text-[10px] text-amber-400 mt-0.5 font-medium'>
                    {node.author.display_name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {briefing.what_has_been_left_unaddressed && briefing.ai_powered && (
        <div>
          <h3 className='text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1.5'>
            Gaps (AI)
          </h3>
          <p className='text-xs text-text-tertiary leading-relaxed'>
            {briefing.what_has_been_left_unaddressed}
          </p>
        </div>
      )}

      {briefing.track_summaries.length > 0 && (
        <div>
          <h3 className='text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-2 flex items-center gap-1.5'>
            <MessageSquare size={11} /> Currents
          </h3>
          <div className='space-y-1'>
            {briefing.track_summaries.map((t) => (
              <div
                key={t.track_id}
                className='flex items-center justify-between bg-surface-2 border border-border-subtle rounded px-3 py-2'
              >
                <span className='text-xs text-text-secondary font-medium'>
                  {t.track_name}
                </span>
                <div className='flex gap-2 text-[10px] text-text-tertiary'>
                  <span>{t.node_count}</span>
                  {t.unchallenged_count > 0 && (
                    <span className='text-amber-400 font-medium'>
                      {t.unchallenged_count} open
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className='text-[10px] text-text-tertiary pt-2 border-t border-border-subtle'>
        Crux maps evidence structure. Debates evolve as new evidence emerges.
      </p>
    </div>
  )
}
