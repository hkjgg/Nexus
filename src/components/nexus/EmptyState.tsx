/**
 * What a panel shows when it has nothing to show.
 *
 * An empty panel should say why it is empty and what would fill it, otherwise
 * it is indistinguishable from a panel that is broken.
 */

import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  action?: ReactNode;
  className?: string;
  /** `panel` fills a card; `inline` is for an empty region inside one. */
  size?: 'panel' | 'inline';
};

export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  className,
  size = 'panel',
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        size === 'panel' ? 'gap-2 px-6 py-12' : 'gap-1.5 px-4 py-6',
        className,
      )}
    >
      {Icon ? (
        <span className="bg-raised text-faint mb-1 grid size-9 place-items-center rounded-full">
          <Icon className="size-4" />
        </span>
      ) : null}
      <p className="text-secondary text-sm font-medium">{title}</p>
      {description ? <p className="text-muted max-w-sm text-xs">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
