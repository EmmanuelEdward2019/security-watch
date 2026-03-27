import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Spinner } from './Spinner';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  id: string;
  header: string;
  accessor?: keyof T | ((row: T) => unknown);
  render?: (value: unknown, row: T) => ReactNode;
  sortable?: boolean;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (columnId: string) => void;
  className?: string;
}

function getCellValue<T>(row: T, column: Column<T>): unknown {
  if (column.accessor === undefined) return null;
  if (typeof column.accessor === 'function') return column.accessor(row);
  return row[column.accessor];
}

export function DataTable<T extends object>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No data found',
  page = 1,
  pageSize = 10,
  total,
  onPageChange,
  sortColumn,
  sortDirection,
  onSort,
  className,
}: DataTableProps<T>) {
  const totalPages = total !== undefined ? Math.ceil(total / pageSize) : 1;
  const hasPagination = total !== undefined && total > pageSize;

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full min-w-[600px] border-collapse">
        <thead>
          <tr className="border-b border-surface-200 bg-surface-50/80">
            {columns.map((col) => (
              <th
                key={col.id}
                className={cn(
                  'px-4 py-3 text-left text-sm font-semibold text-surface-700',
                  col.sortable && 'cursor-pointer select-none hover:text-surface-900'
                )}
                onClick={() => col.sortable && onSort?.(col.id)}
              >
                <span className="inline-flex items-center gap-1">
                  {col.header}
                  {col.sortable && sortColumn === col.id && (
                    <span className="text-brand-500">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center">
                <div className="flex justify-center">
                  <Spinner size="lg" />
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                <EmptyState title={emptyMessage} />
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <motion.tr
                key={index}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.02 }}
                className="border-b border-surface-100 hover:bg-surface-50/50 transition-colors"
              >
                {columns.map((col) => {
                  const value = getCellValue(row, col);
                  const content = col.render
                    ? col.render(value, row)
                    : String(value ?? '');
                  return (
                    <td
                      key={col.id}
                      className="px-4 py-3 text-sm text-surface-700"
                    >
                      {content}
                    </td>
                  );
                })}
              </motion.tr>
            ))
          )}
        </tbody>
      </table>

      {hasPagination && !loading && data.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-surface-200">
          <p className="text-sm text-surface-500">
            Page {page} of {totalPages} ({total} total)
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPageChange?.(page - 1)}
              disabled={page <= 1}
              className="p-2 rounded-lg text-surface-600 hover:bg-surface-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => onPageChange?.(page + 1)}
              disabled={page >= totalPages}
              className="p-2 rounded-lg text-surface-600 hover:bg-surface-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
