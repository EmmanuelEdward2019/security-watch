import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { CASE_STATUS_LABELS, type CaseStatus } from '@/types';
import { cn } from '@/utils/cn';

const STATUS_ORDER: CaseStatus[] = [
  'submitted',
  'under_review',
  'assigned',
  'investigating',
  'legal_processing',
  'completed',
  'closed',
];

export interface CaseStatusTrackerProps {
  currentStatus: CaseStatus;
  className?: string;
}

export function CaseStatusTracker({ currentStatus, className }: CaseStatusTrackerProps) {
  const currentIndex = STATUS_ORDER.indexOf(currentStatus);

  return (
    <div className={cn('w-full', className)}>
      {/* Desktop: horizontal */}
      <div className="hidden md:block">
        <div className="flex items-center justify-between">
          {STATUS_ORDER.map((status, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;
            const isFuture = index > currentIndex;

            return (
              <div key={status} className="flex flex-1 items-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    'flex flex-col items-center',
                    isFuture && 'opacity-60'
                  )}
                >
                  <motion.div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                      isCompleted && 'bg-brand-500 border-brand-500 text-white',
                      isCurrent && 'bg-brand-500 border-brand-500 text-white ring-4 ring-brand-200',
                      isFuture && 'border-surface-300 bg-white text-surface-400'
                    )}
                    animate={
                      isCurrent
                        ? { scale: [1, 1.05, 1], boxShadow: ['0 0 0 0 rgba(22,101,52,0.4)', '0 0 0 8px rgba(22,101,52,0)', '0 0 0 0 rgba(22,101,52,0)'] }
                        : {}
                    }
                    transition={{ duration: 2, repeat: isCurrent ? Infinity : 0 }}
                  >
                    {isCompleted ? (
                      <Check size={20} strokeWidth={2.5} />
                    ) : (
                      <span className="text-sm font-semibold">{index + 1}</span>
                    )}
                  </motion.div>
                  <span
                    className={cn(
                      'mt-2 text-xs font-medium text-center max-w-[80px]',
                      isCurrent ? 'text-brand-700' : isCompleted ? 'text-surface-700' : 'text-surface-500'
                    )}
                  >
                    {CASE_STATUS_LABELS[status]}
                  </span>
                </motion.div>
                {index < STATUS_ORDER.length - 1 && (
                  <div
                    className={cn(
                      'mx-1 h-0.5 flex-1 min-w-[20px] rounded transition-colors',
                      isCompleted ? 'bg-brand-400' : 'bg-surface-200'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile: vertical */}
      <div className="md:hidden space-y-0">
        {STATUS_ORDER.map((status, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isFuture = index > currentIndex;

          return (
            <motion.div
              key={status}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex gap-4"
            >
              <div className="flex flex-col items-center">
                <motion.div
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                    isCompleted && 'bg-brand-500 border-brand-500 text-white',
                    isCurrent && 'bg-brand-500 border-brand-500 text-white ring-4 ring-brand-200',
                    isFuture && 'border-surface-300 bg-white text-surface-400'
                  )}
                >
                  {isCompleted ? (
                    <Check size={18} strokeWidth={2.5} />
                  ) : (
                    <span className="text-xs font-semibold">{index + 1}</span>
                  )}
                </motion.div>
                {index < STATUS_ORDER.length - 1 && (
                  <div
                    className={cn(
                      'w-0.5 flex-1 min-h-[24px] rounded',
                      isCompleted ? 'bg-brand-400' : 'bg-surface-200'
                    )}
                  />
                )}
              </div>
              <div className={cn('pb-6', isFuture && 'opacity-60')}>
                <span
                  className={cn(
                    'text-sm font-medium',
                    isCurrent ? 'text-brand-700' : isCompleted ? 'text-surface-700' : 'text-surface-500'
                  )}
                >
                  {CASE_STATUS_LABELS[status]}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
