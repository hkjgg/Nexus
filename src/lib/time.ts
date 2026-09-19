/**
 * Time-zone helpers.
 *
 * NEXUS stores every instant as UTC and presents it in the company's own time
 * zone (`companies.timezone`), so "today" means the operator's today, not the
 * server's. These two helpers are all that is needed for that, and they use
 * `Intl` rather than pulling in a date library.
 */

/**
 * Offset of `instant` in `timeZone`, in milliseconds, as
 * `localWallClock - utc`. Positive east of Greenwich.
 */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);

  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');

  // `hour` comes back as 24 at midnight under hour12: false in some runtimes.
  const hour = read('hour') % 24;

  const asIfUtc = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    hour,
    read('minute'),
    read('second'),
  );

  // Instants carry milliseconds the formatter drops; ignore them so the offset
  // comes out as the whole number of minutes it always is.
  return asIfUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The instant at which the calendar day containing `instant` began in `timeZone`. */
export function startOfDayInZone(instant: Date, timeZone: string): Date {
  const offset = zoneOffsetMs(instant, timeZone);

  const wallClock = new Date(instant.getTime() + offset);
  wallClock.setUTCHours(0, 0, 0, 0);

  const firstGuess = new Date(wallClock.getTime() - offset);

  // Across a DST boundary the offset at midnight differs from the offset now;
  // one correction always lands on the right instant.
  const offsetAtMidnight = zoneOffsetMs(firstGuess, timeZone);
  return offsetAtMidnight === offset
    ? firstGuess
    : new Date(wallClock.getTime() - offsetAtMidnight);
}

/** Shifts `instant` by whole days and snaps to the start of that day. */
export function startOfDayOffset(instant: Date, days: number, timeZone: string): Date {
  return startOfDayInZone(new Date(instant.getTime() + days * 86_400_000), timeZone);
}
