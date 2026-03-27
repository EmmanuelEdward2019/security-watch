import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { motion } from 'framer-motion';
import { Loader2, type LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: LucideIcon;
}

const variantStyles = {
  primary:
    'bg-brand-500 text-white hover:bg-brand-600 focus-visible:ring-brand-500/50',
  secondary:
    'bg-surface-200 text-surface-900 hover:bg-surface-300 focus-visible:ring-surface-400/50',
  danger:
    'bg-accent-500 text-white hover:bg-accent-600 focus-visible:ring-accent-500/50',
  ghost:
    'bg-transparent text-surface-700 hover:bg-surface-100 focus-visible:ring-surface-300/50',
  outline:
    'border-2 border-brand-500 text-brand-600 bg-transparent hover:bg-brand-50 focus-visible:ring-brand-500/50',
};

const sizeStyles = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2.5',
};

const iconSizes = {
  sm: 14,
  md: 16,
  lg: 20,
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      icon: Icon,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <motion.div
        className="inline-flex"
        whileHover={!isDisabled ? { scale: 1.02 } : undefined}
        whileTap={!isDisabled ? { scale: 0.98 } : undefined}
      >
        <button
          ref={ref}
          type="button"
          disabled={isDisabled}
          className={cn(
            'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
            variantStyles[variant],
            sizeStyles[size],
            className
          )}
          {...props}
        >
          {loading ? (
            <Loader2
              className="animate-spin shrink-0"
              size={iconSizes[size]}
              aria-hidden
            />
          ) : Icon ? (
            <Icon className="shrink-0" size={iconSizes[size]} aria-hidden />
          ) : null}
          {children}
        </button>
      </motion.div>
    );
  }
);

Button.displayName = 'Button';
