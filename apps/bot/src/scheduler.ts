/** Milliseconds until the next occurrence of hour:minute in the given IANA timezone (today if not yet passed, else tomorrow). */
export function msUntilNextLocalTime(hour: number, minute: number, timeZone: string, now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const nowSecondsOfDay = get("hour") * 3600 + get("minute") * 60 + get("second");
  const targetSecondsOfDay = hour * 3600 + minute * 60;

  let deltaSeconds = targetSecondsOfDay - nowSecondsOfDay;
  if (deltaSeconds <= 0) deltaSeconds += 24 * 3600;
  return deltaSeconds * 1000;
}

/** Runs `fn` once daily at hour:minute local time in `timeZone`. Recomputes the delay after every run instead of a
 *  flat 24h interval, so DST shifts self-correct rather than accumulate drift. */
export function scheduleDaily(hour: number, minute: number, timeZone: string, fn: () => void | Promise<void>): void {
  const run = async () => {
    try {
      await fn();
    } catch (err) {
      console.error("Planlagt daglig opgave fejlede:", err);
    }
    setTimeout(run, msUntilNextLocalTime(hour, minute, timeZone));
  };
  setTimeout(run, msUntilNextLocalTime(hour, minute, timeZone));
}
