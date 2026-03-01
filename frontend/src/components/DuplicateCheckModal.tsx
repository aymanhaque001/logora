import {
  AlertTriangle,
  CheckCircle,
  Sparkles,
  X,
  ArrowRight,
} from 'lucide-react'
import { DuplicateCheckResult } from '../types'

interface Props {
  result: DuplicateCheckResult
  onProceed: () => void
  onCancel: () => void
  onViewSimilar: (argumentId: string) => void
}

export function DuplicateCheckModal({
  result,
  onProceed,
  onCancel,
  onViewSimilar,
}: Props) {
  return (
    <div className='fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in'>
      <div className='bg-surface-1 border border-border-default rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl'>
        {/* Header */}
        <div className='flex items-center justify-between px-4 py-3 border-b border-border-subtle'>
          <div className='flex items-center gap-2'>
            {result.is_duplicate ? (
              <AlertTriangle size={16} className='text-amber-400' />
            ) : (
              <CheckCircle size={16} className='text-emerald-400' />
            )}
            <span className='text-sm font-semibold text-text-primary'>
              {result.is_duplicate
                ? 'Similar Argument Found'
                : 'Argument Looks Original'}
            </span>
            {result.ai_powered && (
              <span className='flex items-center gap-1 text-[10px] text-accent bg-accent/10 px-1.5 py-0.5 rounded font-medium'>
                <Sparkles size={9} />
                AI
              </span>
            )}
          </div>
          <button
            onClick={onCancel}
            className='text-text-tertiary hover:text-text-primary transition-colors'
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className='px-4 py-3 space-y-3'>
          {/* Explanation */}
          <p className='text-xs text-text-secondary leading-relaxed'>
            {result.explanation}
          </p>

          {/* Confidence bar */}
          <div className='flex items-center gap-2'>
            <span className='text-[10px] text-text-tertiary w-16'>
              Confidence
            </span>
            <div className='flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden'>
              <div
                className={`h-full rounded-full transition-all ${
                  result.is_duplicate ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
                style={{ width: `${Math.round(result.confidence * 100)}%` }}
              />
            </div>
            <span className='text-[10px] text-text-tertiary w-8 text-right'>
              {Math.round(result.confidence * 100)}%
            </span>
          </div>

          {/* Similar arguments */}
          {result.similar_arguments.length > 0 && (
            <div className='space-y-2'>
              <h4 className='text-xs font-medium text-text-secondary'>
                Similar existing arguments:
              </h4>
              {result.similar_arguments.map((sim) => (
                <div
                  key={sim.id}
                  className='bg-surface-2 border border-border-subtle rounded-lg p-2.5 space-y-1.5'
                >
                  <p className='text-xs text-text-primary leading-relaxed'>
                    {sim.content_preview}...
                  </p>
                  <div className='flex items-center justify-between'>
                    <span className='text-[10px] text-text-tertiary'>
                      {Math.round(sim.similarity * 100)}% similar
                    </span>
                    <button
                      onClick={() => onViewSimilar(sim.id)}
                      className='flex items-center gap-1 text-[10px] text-accent hover:text-accent-hover transition-colors'
                    >
                      View <ArrowRight size={10} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Suggestion */}
          {result.suggestion && (
            <div className='bg-accent/5 border border-accent/20 rounded-lg p-2.5'>
              <p className='text-xs text-accent leading-relaxed'>
                <strong>Suggestion:</strong> {result.suggestion}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className='flex items-center justify-end gap-2 px-4 py-3 border-t border-border-subtle'>
          <button
            onClick={onCancel}
            className='btn-secondary px-3 py-1.5 text-xs rounded-lg'
          >
            Edit my argument
          </button>
          <button
            onClick={onProceed}
            className='btn-primary px-3 py-1.5 text-xs rounded-lg'
          >
            {result.is_duplicate ? 'Submit anyway' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  )
}
