'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/ui/cn';
import { NAV_ITEMS } from './nav';

/**
 * The product's spine.
 *
 * Above `lg` it is always there and the page sits beside it. Below `lg` it
 * becomes a drawer behind a button, because on a phone the map and the
 * numbers need every pixel of width.
 *
 * Links carry the current filters with them, so moving between sections does
 * not silently reset the range and zone the operator chose.
 */
export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const queryString = searchParams.toString();
  const withFilters = (href: string) => (queryString ? `${href}?${queryString}` : href);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="nexus-sidebar"
        className={cn(
          'border-line bg-surface text-ink-muted hover:text-ink fixed top-3 left-3 z-50 rounded-md border p-2',
          'lg:hidden',
        )}
      >
        {open ? <X className="size-4" /> : <Menu className="size-4" />}
        <span className="sr-only">{open ? 'Close navigation' : 'Open navigation'}</span>
      </button>

      {/* Scrim: tapping anywhere outside the drawer closes it. */}
      {open ? (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      ) : null}

      <nav
        id="nexus-sidebar"
        aria-label="Sections"
        className={cn(
          'border-line bg-surface fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r',
          'transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0',
        )}
      >
        <div className="border-line flex h-14 shrink-0 items-center gap-2 border-b px-4 pl-14 lg:pl-4">
          <span className="text-ink font-mono text-sm font-bold tracking-[0.3em]">NEXUS</span>
        </div>

        <ul className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={withFilters(item.href)}
                  aria-current={active ? 'page' : undefined}
                  // Following a link is the drawer's whole job on a phone.
                  onClick={() => setOpen(false)}
                  className={cn(
                    'group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm',
                    'transition-colors duration-150',
                    active
                      ? 'bg-accent-wash text-ink'
                      : 'text-ink-muted hover:bg-raised hover:text-ink',
                  )}
                >
                  <Icon
                    className={cn('size-4 shrink-0', active ? 'text-accent' : 'text-ink-faint')}
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  {!item.ready ? (
                    <span className="text-ink-faint text-[0.6rem] tracking-wider uppercase">
                      Soon
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="border-line text-ink-faint border-t p-3 text-[0.68rem] leading-relaxed">
          <p className="font-mono">Week 1 · Command Center</p>
          <p className="mt-0.5">Seven sections still to build.</p>
        </div>
      </nav>
    </>
  );
}
