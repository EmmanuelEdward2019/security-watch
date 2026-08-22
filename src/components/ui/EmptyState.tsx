import { type ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';
import { EMPTY_TINTS, type EmptyTint } from './tints';


export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  /**
   * Colour of the illustrated halo. Worth setting per screen: an empty case
   * list and an empty earnings list are different absences, and a consistent
   * colour per area tells someone where they are before they read anything.
   */
  tint?: EmptyTint;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  tint = 'slate',
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-6 text-center',
        className
      )}
    >
      {Icon && (
        /*
          Two nested discs rather than one flat grey circle. The outer sits back
          at reduced opacity, the inner carries the icon at full tint — enough to
          read as an illustration without shipping an asset for every empty
          screen, and there are dozens. The old grey-on-grey version looked more
          like a rendering failure than a deliberate "nothing here yet".
        */
        <div
          className={cn(
            'mb-5 flex h-28 w-28 items-center justify-center rounded-full opacity-60',
            EMPTY_TINTS[tint]
          )}
          aria-hidden="true"
        >
          <div
            className={cn(
              'flex h-20 w-20 items-center justify-center rounded-full',
              EMPTY_TINTS[tint]
            )}
          >
            <Icon size={40} strokeWidth={1.5} />
          </div>
        </div>
      )}
      <h3 className="text-lg font-semibold text-surface-900">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-surface-500">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
