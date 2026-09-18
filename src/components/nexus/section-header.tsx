import type { ReactNode } from 'react';
import { cn } from '@/lib/ui/cn';

type SectionHeaderProps = {
  title: string;
  /** One line of context. Anything longer belongs in the section itself. */
  description?: string;
  /** Filters, links or a legend, aligned to the trailing edge. */
  actions?: ReactNode;
  className?: string;
};

/**
 * The label above a card's content. Titles are small and uppercase so they
 * read as chrome, leaving the figures below them as the only loud thing on
 * the page.
 */
export function SectionHeader({ title, description, actions, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h2 className="text-ink text-[0.7rem] font-semibold tracking-[0.14em] uppercase">
          {title}
        </h2>
        {description ? <p className="text-ink-faint mt-1 text-xs">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
