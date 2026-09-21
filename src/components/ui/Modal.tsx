import { useEffect, useId, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  className?: string;
  /** Hides the X and ignores backdrop/Escape. For a step the user must finish. */
  dismissible?: boolean;
  /**
   * Pinned below the scrolling body. Decisions belong here: a reviewer should
   * be able to read to the bottom of a document and still have Approve and
   * Reject in the same place they were at the top.
   */
  footer?: ReactNode;
}

const sizeStyles = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
  '2xl': 'max-w-4xl',
  '3xl': 'max-w-5xl',
  '4xl': 'max-w-6xl',
};

/**
 * A dialog that fits on the screen.
 *
 * Three faults, which together made the review modals unusable rather than
 * merely awkward:
 *
 *   1. NO HEIGHT LIMIT, AND `overflow-hidden`. The panel grew to whatever its
 *      content needed and was then clipped with no way to scroll. Anything
 *      below the fold was unreachable.
 *
 *   2. THE CLOSE BUTTON WENT OFF-SCREEN. The panel is centred in a
 *      `fixed inset-0` flex container, so a tall one overflows equally in both
 *      directions — the header, and with it the X, ended up above the top of
 *      the viewport. With no Escape handler either, the KYC reviewer had no
 *      way out but a page reload.
 *
 *   3. `lg` AND `xl` WERE TOO NARROW. They capped at 512px and 576px, which
 *      is a phone-width column for a screen showing identity documents,
 *      guarantors and service records side by side.
 *
 * Now: the panel is capped at the viewport minus its margin, the header and
 * footer area stay put, and only the body scrolls. The scroll container is the
 * body rather than the page, so the close button is always reachable.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  className,
  dismissible = true,
  footer,
}: ModalProps) {
  // `useId` rather than a constant: two modals mounted at once both claimed
  // id="modal-title", so aria-labelledby resolved to whichever rendered first.
  const titleId = useId();

  useEffect(() => {
    if (!isOpen || !dismissible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, dismissible, onClose]);

  // Without this the page behind scrolls when the pointer leaves the panel,
  // which on a long admin table means losing your place every time you open a
  // row.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-surface-900/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={dismissible ? onClose : undefined}
            aria-hidden
          />
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
          >
            <motion.div
              className={cn(
                // `max-h` plus `flex-col` is what keeps the header on screen:
                // the panel can never outgrow the viewport, so only the body
                // below needs to scroll.
                'flex w-full max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)] flex-col',
                'rounded-xl border border-surface-200 bg-white shadow-xl',
                sizeStyles[size],
                className
              )}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between gap-4 rounded-t-xl border-b border-surface-100 bg-white px-6 py-4">
                {title ? (
                  <h2 id={titleId} className="truncate text-lg font-semibold text-surface-900">
                    {title}
                  </h2>
                ) : (
                  <span />
                )}
                {dismissible && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="-m-2 shrink-0 rounded-lg p-2 text-surface-500 transition-colors hover:bg-surface-100 hover:text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                    aria-label="Close modal"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>

              {/* The only scrolling region. overscroll-contain stops a flick at
                  the end of the list from scrolling the page behind it. */}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
                {children}
              </div>

              {footer && (
                <div className="shrink-0 rounded-b-xl border-t border-surface-100 bg-white px-6 py-4">
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
