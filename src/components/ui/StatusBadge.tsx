import { type HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export type StatusType =
  | 'pending'
  | 'active'
  | 'verified'
  | 'rejected'
  | 'closed'
  | 'in-progress'
  | 'completed'
  | 'cancelled';

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status: StatusType | string;
  dot?: boolean;
}

const statusConfig: Record<
  string,
  { label: string; className: string }
> = {
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-800 [&>.status-dot]:bg-amber-500' },
  active: { label: 'Active', className: 'bg-brand-100 text-brand-700 [&>.status-dot]:bg-brand-500' },
  verified: { label: 'Verified', className: 'bg-green-100 text-green-700 [&>.status-dot]:bg-green-500' },
  rejected: { label: 'Rejected', className: 'bg-accent-100 text-accent-700 [&>.status-dot]:bg-accent-500' },
  closed: { label: 'Closed', className: 'bg-surface-200 text-surface-600 [&>.status-dot]:bg-surface-500' },
  'in-progress': { label: 'In Progress', className: 'bg-sky-100 text-sky-700 [&>.status-dot]:bg-sky-500' },
  completed: { label: 'Completed', className: 'bg-brand-100 text-brand-700 [&>.status-dot]:bg-brand-500' },
  cancelled: { label: 'Cancelled', className: 'bg-surface-200 text-surface-600 [&>.status-dot]:bg-surface-500' },
};

function getStatusConfig(status: string) {
  const normalized = status.toLowerCase().replace(/\s+/g, '-');
  return (
    statusConfig[normalized] ?? {
      label: status.replace(/-/g, ' '),
      className: 'bg-surface-200 text-surface-700 [&>.status-dot]:bg-surface-500',
    }
  );
}

export function StatusBadge({
  className,
  status,
  dot = true,
  ...props
}: StatusBadgeProps) {
  const config = getStatusConfig(status);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 text-sm font-medium rounded-full',
        config.className,
        className
      )}
      {...props}
    >
      {dot && (
        <span className="status-dot w-2 h-2 rounded-full shrink-0" aria-hidden />
      )}
      {config.label}
    </span>
  );
}
