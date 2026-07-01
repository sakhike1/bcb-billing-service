/** Rounds a monetary amount to 2 decimal places, avoiding common floating point artefacts. */
export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Returns the length, in milliseconds, of the overlap between two half-open date ranges
 * [aStart, aEnd) and [bStart, bEnd). Returns 0 if they don't overlap.
 */
export function overlapMs(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  return Math.max(0, end - start);
}

/** Adds a number of whole days to a date, returning a new Date. */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}
