/**
 * The heading above a panel or a page section.
 *
 * Keeping the title, the optional explanation and the right-hand controls in
 * one component is what makes every panel line up on the same baseline.
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type SectionHeaderProps = {
  title: string;
  /** One line under the title. Anything longer belongs in the panel body. */
  description?: string;
  /** Controls or a legend, aligned right. */
  actions?: ReactNode;
  as?: 'h1' | 'h2' | 'h3';
  className?: string;
};

export function SectionHeader({
  title,
  description,
  actions,
  as: Tag = 'h2',
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <Tag
          className={cn(
            'text-content truncate font-semibold',
            Tag === 'h1' ? 'text-lg' : 'text-[0.9375rem]',
          )}
        >
          {title}
        </Tag>
        {description ? <p className="text-muted mt-0.5 text-xs">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
