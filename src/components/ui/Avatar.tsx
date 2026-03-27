import { type HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  status?: 'online' | 'offline';
}

const sizeStyles = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

const statusSizes = {
  sm: 'h-2 w-2 bottom-0 right-0',
  md: 'h-2.5 w-2.5 bottom-0 right-0',
  lg: 'h-3 w-3 bottom-0 right-0',
};

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Avatar({
  className,
  src,
  alt,
  name = 'User',
  size = 'md',
  status,
  ...props
}: AvatarProps) {
  const initials = getInitials(name);

  return (
    <div
      className={cn('relative inline-flex shrink-0', className)}
      {...props}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-brand-100 text-brand-700 font-medium overflow-hidden',
          sizeStyles[size]
        )}
      >
        {src ? (
          <img
            src={src}
            alt={alt ?? name}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span aria-hidden>{initials}</span>
        )}
      </div>
      {status && (
        <span
          className={cn(
            'absolute rounded-full border-2 border-white',
            statusSizes[size],
            status === 'online' ? 'bg-green-500' : 'bg-surface-400'
          )}
          aria-hidden
        />
      )}
    </div>
  );
}
