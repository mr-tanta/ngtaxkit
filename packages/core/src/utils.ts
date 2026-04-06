// ─── Utility Functions ────────────────────────────────────────────────────────
// Pure functions, zero dependencies. Used across all calculation modules.

/**
 * Banker's rounding (round-half-even) to 2 decimal places.
 * When the value is exactly halfway (0.5), rounds to the nearest even number.
 * This avoids systematic rounding bias in monetary calculations.
 */
export function bankersRound(value: number): number {
  // Shift to work in integer-ish space to avoid floating-point drift
  const shifted = value * 100;
  const floored = Math.floor(shifted);
  const remainder = shifted - floored;

  // Use a small epsilon to handle floating-point representation issues
  const epsilon = 1e-9;

  if (Math.abs(remainder - 0.5) < epsilon) {
    // Exactly halfway — round to even
    return (floored % 2 === 0 ? floored : floored + 1) / 100;
  }

  // Standard rounding for non-halfway cases
  return Math.round(shifted) / 100;
}

// ─── Nigerian Public Holidays ────────────────────────────────────────────────

/**
 * Nigerian public holidays for 2026.
 * Fixed dates plus approximate Islamic holidays (dates shift yearly based on lunar calendar).
 * Format: 'YYYY-MM-DD'
 */
const NIGERIAN_PUBLIC_HOLIDAYS_2026: ReadonlySet<string> = new Set([
  // Fixed public holidays
  '2026-01-01', // New Year's Day
  '2026-05-01', // Workers' Day
  '2026-06-12', // Democracy Day
  '2026-10-01', // Independence Day
  '2026-12-25', // Christmas Day
  '2026-12-26', // Boxing Day

  // Approximate Islamic holidays for 2026 (lunar calendar — dates are estimates)
  '2026-03-20', // Eid al-Fitr (end of Ramadan) — approx
  '2026-03-21', // Eid al-Fitr Day 2
  '2026-05-27', // Eid al-Adha (Feast of Sacrifice) — approx
  '2026-05-28', // Eid al-Adha Day 2
  '2026-06-17', // Eid al-Maulud (Prophet's Birthday) — approx
]);

/**
 * Returns true if the given ISO date string falls on a Nigerian public holiday.
 */
export function isPublicHoliday(dateStr: string): boolean {
  return NIGERIAN_PUBLIC_HOLIDAYS_2026.has(dateStr);
}

/**
 * Returns true if the given ISO date string falls on a weekend (Saturday or Sunday).
 */
export function isWeekend(dateStr: string): boolean {
  const day = parseDateUTC(dateStr).getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Returns true if the given date is a non-working day (weekend or public holiday).
 */
export function isNonWorkingDay(dateStr: string): boolean {
  return isWeekend(dateStr) || isPublicHoliday(dateStr);
}

// ─── Date Utilities ──────────────────────────────────────────────────────────

/**
 * Parse an ISO date string (YYYY-MM-DD) into a UTC Date object.
 * Avoids timezone issues by using UTC methods throughout.
 */
function parseDateUTC(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Format a UTC Date object as an ISO date string (YYYY-MM-DD).
 */
function formatDateISO(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Advance a date to the next working day if it falls on a weekend or public holiday.
 */
export function nextWorkingDay(dateStr: string): string {
  let current = parseDateUTC(dateStr);
  let currentStr = formatDateISO(current);

  while (isNonWorkingDay(currentStr)) {
    current = new Date(current.getTime() + 86_400_000); // +1 day
    currentStr = formatDateISO(current);
  }

  return currentStr;
}

/**
 * Add N working days to a start date, skipping weekends and Nigerian public holidays.
 * Returns an ISO date string (YYYY-MM-DD).
 *
 * Day counting starts the day after startDate. For example, addWorkingDays('2026-01-05', 1)
 * returns '2026-01-06' (the next working day after Jan 5).
 */
export function addWorkingDays(startDate: string, days: number): string {
  let current = parseDateUTC(startDate);
  let remaining = days;

  while (remaining > 0) {
    current = new Date(current.getTime() + 86_400_000); // +1 day
    const currentStr = formatDateISO(current);
    if (!isNonWorkingDay(currentStr)) {
      remaining--;
    }
  }

  return formatDateISO(current);
}

/**
 * Calculate a remittance deadline: the Nth day of the month following the payment date.
 * If that day falls on a weekend or public holiday, moves forward to the next working day.
 *
 * Common usage:
 * - WHT: dayOfMonth = 21 (21st of following month)
 * - PAYE: dayOfMonth = 10 (10th of following month)
 * - Pension: use addWorkingDays(paymentDate, 7) instead
 *
 * @param paymentDate ISO date string of the payment (YYYY-MM-DD)
 * @param dayOfMonth The target day of the following month (e.g. 21 for WHT)
 * @returns ISO date string of the remittance deadline
 */
export function getRemittanceDeadline(paymentDate: string, dayOfMonth: number): string {
  const date = parseDateUTC(paymentDate);
  let year = date.getUTCFullYear();
  let month = date.getUTCMonth() + 2; // +1 for 0-index, +1 for "following month"

  if (month > 12) {
    month = 1;
    year++;
  }

  // Clamp dayOfMonth to the last day of the target month
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const clampedDay = Math.min(dayOfMonth, lastDay);

  const deadlineStr = `${year}-${String(month).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;

  return nextWorkingDay(deadlineStr);
}
