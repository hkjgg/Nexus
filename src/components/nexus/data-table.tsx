import type { ReactNode } from 'react';
import { cn } from '@/lib/ui/cn';
import type { StatusTone } from './status-badge';

export type Column<T> = {
  /** Unique among the table's columns; also the React key. */
  key: string;
  header: string;
  /** Numeric columns are right-aligned and rendered mono and tabular. */
  numeric?: boolean;
  /** A tailwind width utility, e.g. `w-24`. Omit to let the column breathe. */
  width?: string;
  render: (row: T) => ReactNode;
  /** Hidden below `md`. Use for columns that are context, not the point. */
  secondary?: boolean;
};

type DataTableProps<T> = {
  columns: readonly Column<T>[];
  rows: readonly T[];
  getRowKey: (row: T) => string;
  /**
   * Paints a left rule on a row. Use it for state the row itself is in - an
   * at-risk zone, a vehicle overdue for service - never for rank.
   */
  getRowTone?: (row: T) => StatusTone | null;
  /** Rendered in place of the body when there are no rows. */
  empty?: ReactNode;
  /** Describes the table for screen readers. */
  caption: string;
  className?: string;
};

const ROW_TONE_CLASSES: Record<StatusTone, string> = {
  neutral: 'shadow-[inset_2px_0_0_var(--color-ink-faint)]',
  accent: 'shadow-[inset_2px_0_0_var(--color-accent)]',
  good: 'shadow-[inset_2px_0_0_var(--color-good)]',
  warn: 'shadow-[inset_2px_0_0_var(--color-warn)]',
  critical: 'shadow-[inset_2px_0_0_var(--color-critical)]',
};

/**
 * A dense, read-only table.
 *
 * Rows are separated by hairlines rather than fills, so a long table stays
 * quiet and the only strong marks in it are the numbers.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  getRowTone,
  empty,
  caption,
  className,
}: DataTableProps<T>) {
  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-line border-b">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  'text-ink-faint px-3 py-2 text-[0.68rem] font-medium tracking-wider uppercase',
                  column.numeric ? 'text-right' : 'text-left',
                  column.width,
                  column.secondary && 'hidden md:table-cell',
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const tone = getRowTone?.(row) ?? null;
            return (
              <tr
                key={getRowKey(row)}
                className={cn(
                  'border-line hover:bg-raised border-b last:border-b-0',
                  'transition-colors duration-150',
                  tone ? ROW_TONE_CLASSES[tone] : null,
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-3 py-2.5 align-middle',
                      column.numeric
                        ? 'text-ink text-right font-mono tabular-nums'
                        : 'text-ink-muted text-left',
                      column.secondary && 'hidden md:table-cell',
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
