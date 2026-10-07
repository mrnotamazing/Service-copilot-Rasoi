// Restaurant time is India Standard Time, whatever timezone the server or device is set to.

export const TIME_ZONE = 'Asia/Kolkata'
const IST_OFFSET_MS = 5.5 * 60 * 60_000 // IST has no daylight saving

/** "8:24 pm" in IST. */
export function istClock(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-IN', { timeZone: TIME_ZONE, hour: 'numeric', minute: '2-digit', hour12: true })
}

/** Today's service start (19:00 IST) for the day that contains `now`. */
export function istServiceStart(now: number, hour = 19): number {
  const ist = new Date(now + IST_OFFSET_MS)
  return Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), hour) - IST_OFFSET_MS
}

/** Hour of day (0–23) in IST, for "Friday after 8pm" style patterns. */
export function istHour(ms: number): number {
  return new Date(ms + IST_OFFSET_MS).getUTCHours()
}
