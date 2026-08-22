import { useEffect } from 'react';
import { type LucideIcon } from 'lucide-react';
import { motion, useSpring } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface StatsCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  /**
   * Tint role. The extra names match the mobile palette so a figure means the
   * same colour on both clients.
   */
  variant?:
    | 'default'
    | 'brand'
    | 'accent'
    | 'success'
    | 'warning'
    | 'sky'
    | 'violet'
    | 'teal'
    | 'rose';
  className?: string;
}

/*
 * The icon well carries the tint rather than sitting on `bg-white/80`.
 *
 * A white well on an already-pale card washed the icon out to nearly the same
 * value as the card, so the one element meant to identify the figure at a
 * glance was the faintest thing on it. Each variant now sets a well background
 * a step darker than the card and a foreground that reads against it.
 *
 * Eight roles rather than five, matching the mobile tints, so a dashboard of
 * four figures no longer repeats the same two colours.
 */
const variantStyles = {
  default:
    'bg-white border-surface-200 [&_.stats-icon]:bg-surface-100 [&_.stats-icon]:text-surface-600',
  brand:
    'bg-brand-50/60 border-brand-200 [&_.stats-icon]:bg-brand-100 [&_.stats-icon]:text-brand-700',
  accent:
    'bg-accent-50/60 border-accent-200 [&_.stats-icon]:bg-accent-100 [&_.stats-icon]:text-accent-700',
  success:
    'bg-emerald-50/60 border-emerald-200 [&_.stats-icon]:bg-emerald-100 [&_.stats-icon]:text-emerald-700',
  warning:
    'bg-amber-50/60 border-amber-200 [&_.stats-icon]:bg-amber-100 [&_.stats-icon]:text-amber-700',
  sky: 'bg-sky-50/60 border-sky-200 [&_.stats-icon]:bg-sky-100 [&_.stats-icon]:text-sky-700',
  violet:
    'bg-violet-50/60 border-violet-200 [&_.stats-icon]:bg-violet-100 [&_.stats-icon]:text-violet-700',
  teal: 'bg-teal-50/60 border-teal-200 [&_.stats-icon]:bg-teal-100 [&_.stats-icon]:text-teal-700',
  rose: 'bg-rose-50/60 border-rose-200 [&_.stats-icon]:bg-rose-100 [&_.stats-icon]:text-rose-700',
};

function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring(0, { stiffness: 75, damping: 15 });
  useEffect(() => {
    spring.set(value);
  }, [value, spring]);
  return <motion.span>{spring}</motion.span>;
}

export function StatsCard({
  icon: Icon,
  label,
  value,
  trend,
  variant = 'default',
  className,
}: StatsCardProps) {
  const displayValue =
    typeof value === 'number' ? (
      <AnimatedNumber value={value} />
    ) : (
      value
    );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-5 transition-shadow hover:shadow-md',
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="stats-icon rounded-lg p-2.5">
          <Icon size={24} strokeWidth={1.5} />
        </div>
        {trend && (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-sm font-medium',
              trend.direction === 'up' ? 'text-green-600' : 'text-accent-600'
            )}
          >
            {trend.direction === 'up' ? (
              <TrendingUp size={16} />
            ) : (
              <TrendingDown size={16} />
            )}
            {trend.value}%
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold text-surface-900">{displayValue}</p>
      <p className="mt-1 text-sm text-surface-500">{label}</p>
    </motion.div>
  );
}
