import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/lib/ui/cn';

type EmptyStateProps = {
  /** A lucide icon component. */
  icon?: ComponentType<{ className?: string }>;
  title: string;
  /** What to do about it. An empty state that only says "nothing here" wastes
   *  the moment the operator is actually looking. */
  description?: string;
  action?: ReactNode;
  className?: string;
  /** `inline` fits inside a table or a small panel; `block` fills a card. */
  size?: 'inline' | 'block';
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  size = 'block',
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        size === 'block' ? 'gap-2 px-6 py-12' : 'gap-1.5 px-4 py-8',
        className,
      )}
    >
      {Icon ? (
        <div className="border-line bg-inset mb-1 rounded-md border p-2">
          <Icon className="text-ink-faint size-4" />
        </div>
      ) : null}
      <p className="text-ink text-sm font-medium">{title}</p>
      {description ? (
        <p className="text-ink-faint max-w-sm text-xs leading-relaxed">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
