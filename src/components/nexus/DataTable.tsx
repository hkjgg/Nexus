/**
 * A dense, typed table.
 *
 * Columns declare their own alignment and rendering, so a page describes what
 * it wants shown rather than assembling `<td>`s. Numeric columns get the
 * tabular-numeral treatment automatically, which is what makes a column of
 * figures scannable.
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { EmptyState } from './EmptyState';

export type Column<Row> = {
  /** Stable key, also used for the React key of the cell. */
  key: string;
  header: ReactNode;
  /** Cell contents for one row. */
  cell: (row: Row, index: number) => ReactNode;
  align?: 'left' | 'right' | 'center';
  /** Renders the cell with the mono, tabular-numeral treatment. */
  numeric?: boolean;
  /** Hides the column below the `sm` breakpoint. */
  hideOnMobile?: boolean;
  className?: string;
  width?: string;
};

export type DataTableProps<Row> = {
  columns: readonly Column<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row, index: number) => string;
  /** Marks a row for attention - an at-risk zone, a failing vehicle. */
  rowTone?: (row: Row) => 'default' | 'caution' | 'critical';
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
  caption?: string;
};

const ALIGN = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
} as const;

const ROW_TONE = {
  default: '',
  caution: 'bg-caution-surface/40',
  critical: 'bg-critical-surface/40',
} as const;

export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  rowTone,
  emptyTitle = 'Nothing to show',
  emptyDescription,
  className,
  caption,
}: DataTableProps<Row>) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full border-collapse text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="border-line-subtle border-b">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={column.width ? { width: column.width } : undefined}
                className={cn(
                  'text-faint px-3 py-2 text-[0.6875rem] font-medium tracking-wide uppercase',
                  ALIGN[column.align ?? 'left'],
                  column.hideOnMobile && 'hidden sm:table-cell',
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={rowKey(row, index)}
              className={cn(
                'border-line-subtle hover:bg-raised/60 border-b transition-colors last:border-b-0',
                ROW_TONE[rowTone?.(row) ?? 'default'],
              )}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    'text-secondary px-3 py-2.5',
                    ALIGN[column.align ?? 'left'],
                    column.numeric && 'nx-numeric text-content',
                    column.hideOnMobile && 'hidden sm:table-cell',
                    column.className,
                  )}
                >
                  {column.cell(row, index)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
