'use client';

import { useSyncExternalStore } from 'react';

/**
 * The operation's own clock.
 *
 * It shows the time where the drivers are, not where the browser is, because
 * "are we past the evening peak yet" is a question about Beirut and not about
 * whoever happens to be looking at the screen.
 *
 * The passing of time is an external store, not React state: the server has
 * no current second to render, so it renders a placeholder and the browser
 * takes over after hydration. That is what keeps the markup the server sent
 * and the markup the browser expects identical.
 */
const subscribe = (onChange: () => void): (() => void) => {
  const timer = setInterval(onChange, 1000);
  return () => clearInterval(timer);
};

// Bucketed to the second so a re-render only happens when the display would
// actually change.
const getSnapshot = (): number | null => Math.floor(Date.now() / 1000);
const getServerSnapshot = (): number | null => null;

export function LiveClock({ timezone }: { timezone: string }) {
  const seconds = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const now = seconds === null ? null : new Date(seconds * 1000);

  const time = now
    ? new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(now)
    : '--:--:--';

  const zoneAbbreviation = now
    ? (new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'short' })
        .formatToParts(now)
        .find((part) => part.type === 'timeZoneName')?.value ?? timezone)
    : timezone;

  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-ink font-mono text-sm tabular-nums" title={`Local time in ${timezone}`}>
        {time}
      </span>
      <span className="text-ink-faint font-mono text-[0.68rem]">{zoneAbbreviation}</span>
    </div>
  );
}
