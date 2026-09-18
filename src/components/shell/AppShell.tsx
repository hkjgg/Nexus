'use client';

/**
 * The application frame: navigation rail, top bar, and the page itself.
 *
 * The only state it owns is how the navigation is displayed, which is a
 * presentation concern and belongs on the client. Everything the bar shows -
 * the company, the zones - is resolved on the server and handed down, so no
 * page has to fetch it again.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import type { ZoneOption } from './FilterControls';
import type { RangeKey } from '@/lib/filters';

export type AppShellProps = {
  companyName: string;
  timeZone: string;
  range: RangeKey;
  zone: string;
  zones: readonly ZoneOption[];
  children: ReactNode;
};

/** Below this the rail is icons-only unless the operator says otherwise. */
const NARROW = '(max-width: 1279px)';

export function AppShell({ companyName, timeZone, range, zone, zones, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [userSetCollapsed, setUserSetCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Collapse the rail on narrower screens, but stop once the operator has made
  // the choice themselves - their preference outlives a window resize.
  useEffect(() => {
    if (userSetCollapsed) return;
    const media = window.matchMedia(NARROW);
    const apply = () => setCollapsed(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [userSetCollapsed]);

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={() => {
          setUserSetCollapsed(true);
          setCollapsed((value) => !value);
        }}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          companyName={companyName}
          timeZone={timeZone}
          range={range}
          zone={zone}
          zones={zones}
          onOpenMobileNav={() => setMobileOpen(true)}
        />
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
