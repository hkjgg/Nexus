import { Construction } from 'lucide-react';
import { Card, EmptyState } from '@/components/nexus';
import { NAV_ITEMS } from './nav';

/**
 * The stub every unbuilt section renders.
 *
 * It says what the section will do rather than "coming soon", because a
 * placeholder that describes the plan is still worth reading, and because
 * the eight-item sidebar is a promise about the shape of the product.
 */
export function ComingNext({ href }: { href: string }) {
  const item = NAV_ITEMS.find((candidate) => candidate.href === href);
  const built = NAV_ITEMS.filter((candidate) => candidate.ready).length;

  return (
    <div className="p-4">
      <Card className="mx-auto max-w-2xl">
        <EmptyState
          icon={Construction}
          title={item ? `${item.label} is coming next` : 'Coming next'}
          description={
            item
              ? `${item.summary} The data behind it is already in the database - this screen is what is still to be built.`
              : 'This section is still to be built.'
          }
        />
        <p className="text-ink-faint border-line border-t px-6 py-3 text-center text-[0.68rem]">
          {built} of {NAV_ITEMS.length} sections built. Command Center is live now.
        </p>
      </Card>
    </div>
  );
}
