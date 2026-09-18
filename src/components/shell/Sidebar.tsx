'use client';

/**
 * The primary navigation rail.
 *
 * Links carry the current filters, so switching section keeps "Riverside, last
 * 30 days" rather than silently resetting it. Sections that are not built yet
 * are still links: they lead to a page that says what is coming, which is more
 * honest than a disabled item that does nothing when clicked.
 */

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { NAV_ITEMS } from '@/lib/nav';
import { cn } from '@/lib/cn';

export type SidebarProps = {
  /** Icons-only rail, used on medium screens and when the operator collapses it. */
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Mobile drawer state. */
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

export function Sidebar({ collapsed, onToggleCollapsed, mobileOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();

  const nav = (
    <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        const href = queryString ? `${item.href}?${queryString}` : item.href;
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={href}
            onClick={onCloseMobile}
            aria-current={active ? 'page' : undefined}
            title={collapsed ? item.label : undefined}
            className={cn(
              'group rounded-nx-sm relative flex items-center gap-3 px-2.5 py-2 text-sm transition-colors',
              active
                ? 'bg-raised text-content'
                : 'text-muted hover:bg-raised/60 hover:text-secondary',
              collapsed && 'justify-center px-0',
            )}
          >
            {active ? (
              <span
                className="bg-accent absolute top-1.5 bottom-1.5 -left-2 w-0.5 rounded-full"
                aria-hidden
              />
            ) : null}

            <Icon className="size-4 shrink-0" aria-hidden />

            {collapsed ? (
              <span className="sr-only">{item.label}</span>
            ) : (
              <>
                <span className="truncate">{item.label}</span>
                {!item.ready ? (
                  <span className="text-faint ml-auto text-[0.625rem] tracking-wide uppercase">
                    Soon
                  </span>
                ) : null}
              </>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <div
      className={cn(
        'border-line-subtle flex h-14 shrink-0 items-center border-b px-4',
        collapsed && 'justify-center px-0',
      )}
    >
      <span className="nx-numeric text-content text-sm font-semibold tracking-[0.3em]">
        {collapsed ? 'N' : 'NEXUS'}
      </span>
    </div>
  );

  return (
    <>
      {/* Desktop rail */}
      <aside
        className={cn(
          'bg-surface border-line-subtle hidden shrink-0 flex-col border-r transition-[width] duration-200 md:flex',
          collapsed ? 'w-14' : 'w-56',
        )}
      >
        {brand}
        {nav}
        <div className="border-line-subtle border-t p-2">
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            className={cn(
              'text-muted hover:bg-raised hover:text-secondary rounded-nx-sm flex w-full items-center gap-3 px-2.5 py-2 text-sm transition-colors',
              collapsed && 'justify-center px-0',
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" aria-hidden />
            ) : (
              <>
                <PanelLeftClose className="size-4" aria-hidden />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onCloseMobile}
            className="absolute inset-0 bg-black/60"
          />
          <aside className="bg-surface border-line-subtle absolute inset-y-0 left-0 flex w-60 flex-col border-r">
            <div className="border-line-subtle flex h-14 shrink-0 items-center justify-between border-b px-4">
              <span className="nx-numeric text-content text-sm font-semibold tracking-[0.3em]">
                NEXUS
              </span>
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Close navigation"
                className="text-muted hover:text-content"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      ) : null}
    </>
  );
}
