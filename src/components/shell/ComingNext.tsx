/**
 * The placeholder for a section that is planned but not built.
 *
 * It states what the section will do and what is already in place for it, so a
 * visitor can tell the difference between "not built yet" and "broken".
 */

import { EmptyState, Card, SectionHeader, StatusBadge } from '@/components/nexus';
import { navItemByHref } from '@/lib/nav';

export type ComingNextProps = {
  /** Route of the section, used to look up its label and summary. */
  href: string;
  /** What already exists for this section, one line each. */
  groundwork?: readonly string[];
};

export function ComingNext({ href, groundwork }: ComingNextProps) {
  const item = navItemByHref(href);
  if (!item) return null;

  return (
    <div className="mx-auto w-full max-w-3xl p-3 sm:p-4 lg:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SectionHeader as="h1" title={item.label} description={item.summary} />
        <StatusBadge tone="neutral">Coming next</StatusBadge>
      </div>

      <Card flush>
        <EmptyState
          icon={item.icon}
          title={`${item.label} is not built yet`}
          description="Week 1 ships the Command Center. This section is next in the plan."
        />

        {groundwork && groundwork.length > 0 ? (
          <div className="border-line-subtle border-t px-6 py-4">
            <p className="text-faint mb-2 text-[0.6875rem] tracking-wide uppercase">
              Already in place
            </p>
            <ul className="text-muted space-y-1.5 text-xs">
              {groundwork.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="text-faint" aria-hidden>
                    &middot;
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
