import { motion } from 'framer-motion';
import { cn } from '@/utils/cn';

const METRICS = [
  { key: 'punctuality', label: 'Punctuality' },
  { key: 'professionalism', label: 'Professionalism' },
  { key: 'cleanliness', label: 'Cleanliness' },
  { key: 'integrity', label: 'Integrity' },
  { key: 'service_delivery', label: 'Service Delivery' },
] as const;

function getScoreColor(score: number): string {
  if (score >= 4) return 'bg-green-500';
  if (score >= 3) return 'bg-amber-500';
  return 'bg-accent-500';
}

function getOverallColor(score: number): string {
  if (score >= 4) return 'text-green-600';
  if (score >= 3) return 'text-amber-600';
  return 'text-accent-600';
}

export interface ScoreCardProps {
  scores: {
    punctuality?: number;
    professionalism?: number;
    cleanliness?: number;
    integrity?: number;
    service_delivery?: number;
  };
  overallScore?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ScoreCard({
  scores,
  overallScore,
  size = 'md',
  className,
}: ScoreCardProps) {
  const values = METRICS.map((m) => scores[m.key as keyof typeof scores] ?? 0);
  const overall =
    overallScore ??
    (values.reduce((a, b) => a + b, 0) / (values.length || 1));

  const circleSizes = {
    sm: 'w-16 h-16 text-lg',
    md: 'w-24 h-24 text-2xl',
    lg: 'w-32 h-32 text-3xl',
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn('rounded-xl border border-surface-200 bg-white p-4', className)}
    >
      <div className="flex flex-col md:flex-row gap-6">
        {/* Overall score circle */}
        <div className="flex flex-col items-center shrink-0">
          <div
            className={cn(
              'rounded-full border-4 flex items-center justify-center font-bold',
              circleSizes[size],
              getOverallColor(overall),
              'border-current'
            )}
          >
            {overall.toFixed(1)}
          </div>
          <p className="text-sm font-medium text-surface-700 mt-2">Overall</p>
        </div>

        {/* Metric bars */}
        <div className="flex-1 space-y-3">
          {METRICS.map((m, i) => {
            const value = values[i] ?? 0;
            const pct = (value / 5) * 100;
            return (
              <div key={m.key}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-surface-700">{m.label}</span>
                  <span className="font-medium text-surface-900">{value}/5</span>
                </div>
                <div className="h-2 rounded-full bg-surface-100 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, delay: i * 0.05 }}
                    className={cn('h-full rounded-full', getScoreColor(value))}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
