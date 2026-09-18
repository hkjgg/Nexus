'use client';

/**
 * The clock in the top bar, in the company's time zone.
 *
 * A control tower is a room where everyone reads the same clock, so the
 * operation's local time is on screen at all times rather than the visitor's.
 *
 * The tick is an external store rather than component state: one interval
 * serves every clock on the page, and the server snapshot is deliberately null
 * so the markup does not contain a time that is already stale by the moment it
 * hydrates.
 */

import { useSyncExternalStore } from 'react';

let currentTick = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);

  if (timer === undefined) {
    currentTick = Date.now();
    timer = setInterval(() => {
      currentTick = Date.now();
      for (const listener of listeners) listener();
    }, 1000);
  }

  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

const getSnapshot = (): number => currentTick;
const getServerSnapshot = (): null => null;

export type LiveClockProps = {
  timeZone: string;
  /** Rendered next to the time, e.g. "Beirut". */
  label?: string;
};

export function LiveClock({ timeZone, label }: LiveClockProps) {
  const tick = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const time =
    tick === null
      ? '--:--:--'
      : new Intl.DateTimeFormat('en-GB', {
          timeZone,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).format(tick);

  return (
    <div className="flex items-center gap-2" aria-live="off">
      <span className="bg-positive size-1.5 shrink-0 rounded-full" aria-hidden />
      <span className="nx-numeric text-secondary text-xs" suppressHydrationWarning>
        {time}
      </span>
      {label ? <span className="text-faint hidden text-xs sm:inline">{label}</span> : null}
    </div>
  );
}
