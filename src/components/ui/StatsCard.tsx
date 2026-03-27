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
  variant?: 'default' | 'brand' | 'accent' | 'success' | 'warning';
  className?: string;
}

const variantStyles = {
  default: 'bg-white border-surface-200 [&_.stats-icon]:text-surface-500',
  brand: 'bg-brand-50/50 border-brand-200 [&_.stats-icon]:text-brand-600',
  accent: 'bg-accent-50/50 border-accent-200 [&_.stats-icon]:text-accent-600',
  success: 'bg-green-50/50 border-green-200 [&_.stats-icon]:text-green-600',
  warning: 'bg-amber-50/50 border-amber-200 [&_.stats-icon]:text-amber-600',
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
        <div className="stats-icon p-2 rounded-lg bg-white/80">
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
