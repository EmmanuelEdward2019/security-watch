import { type HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
  dot?: boolean;
}

const variantStyles = {
  default:
    'bg-surface-200 text-surface-700 [&>.badge-dot]:bg-surface-500',
  success:
    'bg-brand-100 text-brand-700 [&>.badge-dot]:bg-brand-500',
  warning:
    'bg-amber-100 text-amber-800 [&>.badge-dot]:bg-amber-500',
  danger:
    'bg-accent-100 text-accent-700 [&>.badge-dot]:bg-accent-500',
  info:
    'bg-sky-100 text-sky-700 [&>.badge-dot]:bg-sky-500',
};

const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-2.5 py-1 text-sm gap-1.5',
};

const dotSizes = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
};

export function Badge({
  className,
  variant = 'default',
  size = 'md',
  dot = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn('badge-dot rounded-full shrink-0', dotSizes[size])}
          aria-hidden
        />
      )}
      {children}
    </span>
  );
}
