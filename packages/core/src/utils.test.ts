import { describe, it, expect } from 'vitest';
import {
  bankersRound,
  isPublicHoliday,
  isWeekend,
  isNonWorkingDay,
  nextWorkingDay,
  addWorkingDays,
  getRemittanceDeadline,
} from './utils';

// ─── bankersRound ────────────────────────────────────────────────────────────

describe('bankersRound', () => {
  it('rounds normal values to 2 decimal places', () => {
    expect(bankersRound(1.234)).toBe(1.23);
    expect(bankersRound(1.236)).toBe(1.24);
    expect(bankersRound(100.999)).toBe(101.0);
  });

  it('rounds halfway values to nearest even (round-half-even)', () => {
    // 0.005 → 0.00 (even)
    expect(bankersRound(0.005)).toBe(0.0);
    // 0.015 → 0.02 (even)
    expect(bankersRound(0.015)).toBe(0.02);
    // 0.025 → 0.02 (even)
    expect(bankersRound(0.025)).toBe(0.02);
    // 0.035 → 0.04 (even)
    expect(bankersRound(0.035)).toBe(0.04);
    // 0.045 → 0.04 (even)
    expect(bankersRound(0.045)).toBe(0.04);
    // 0.055 → 0.06 (even)
    expect(bankersRound(0.055)).toBe(0.06);
    // 2.5 kobo → round to even
    expect(bankersRound(1.125)).toBe(1.12);
    expect(bankersRound(1.135)).toBe(1.14);
  });

  it('handles zero', () => {
    expect(bankersRound(0)).toBe(0);
  });

  it('handles large monetary values', () => {
    expect(bankersRound(1_000_000.125)).toBe(1_000_000.12);
    expect(bankersRound(999_999.999)).toBe(1_000_000.0);
  });

  it('handles negative values', () => {
    expect(bankersRound(-1.234)).toBe(-1.23);
    expect(bankersRound(-1.236)).toBe(-1.24);
  });

  it('preserves already-rounded values', () => {
    expect(bankersRound(10.50)).toBe(10.50);
    expect(bankersRound(42.00)).toBe(42.00);
  });
});

// ─── Date classification ─────────────────────────────────────────────────────

describe('isPublicHoliday', () => {
  it('returns true for fixed Nigerian public holidays', () => {
    expect(isPublicHoliday('2026-01-01')).toBe(true); // New Year
    expect(isPublicHoliday('2026-05-01')).toBe(true); // Workers' Day
    expect(isPublicHoliday('2026-06-12')).toBe(true); // Democracy Day
    expect(isPublicHoliday('2026-10-01')).toBe(true); // Independence Day
    expect(isPublicHoliday('2026-12-25')).toBe(true); // Christmas
    expect(isPublicHoliday('2026-12-26')).toBe(true); // Boxing Day
  });

  it('returns true for approximate Islamic holidays', () => {
    expect(isPublicHoliday('2026-03-20')).toBe(true); // Eid al-Fitr
    expect(isPublicHoliday('2026-05-27')).toBe(true); // Eid al-Adha
  });

  it('returns false for regular working days', () => {
    expect(isPublicHoliday('2026-01-05')).toBe(false);
    expect(isPublicHoliday('2026-07-15')).toBe(false);
  });
});

describe('isWeekend', () => {
  it('returns true for Saturday and Sunday', () => {
    expect(isWeekend('2026-01-03')).toBe(true); // Saturday
    expect(isWeekend('2026-01-04')).toBe(true); // Sunday
  });

  it('returns false for weekdays', () => {
    expect(isWeekend('2026-01-05')).toBe(false); // Monday
    expect(isWeekend('2026-01-06')).toBe(false); // Tuesday
    expect(isWeekend('2026-01-09')).toBe(false); // Friday
  });
});

describe('isNonWorkingDay', () => {
  it('returns true for weekends', () => {
    expect(isNonWorkingDay('2026-01-03')).toBe(true); // Saturday
  });

  it('returns true for public holidays on weekdays', () => {
    expect(isNonWorkingDay('2026-05-01')).toBe(true); // Workers' Day (Friday)
  });

  it('returns false for regular weekdays', () => {
    expect(isNonWorkingDay('2026-01-05')).toBe(false); // Monday
  });
});

// ─── nextWorkingDay ──────────────────────────────────────────────────────────

describe('nextWorkingDay', () => {
  it('returns the same date if already a working day', () => {
    expect(nextWorkingDay('2026-01-05')).toBe('2026-01-05'); // Monday
  });

  it('skips Saturday to Monday', () => {
    expect(nextWorkingDay('2026-01-03')).toBe('2026-01-05'); // Sat → Mon
  });

  it('skips Sunday to Monday', () => {
    expect(nextWorkingDay('2026-01-04')).toBe('2026-01-05'); // Sun → Mon
  });

  it('skips public holidays', () => {
    // Jan 1 2026 is Thursday (public holiday) → Jan 2 is Friday (working day)
    expect(nextWorkingDay('2026-01-01')).toBe('2026-01-02');
  });

  it('skips consecutive non-working days', () => {
    // Dec 25 (Fri, Christmas) → Dec 26 (Sat, Boxing Day) → Dec 27 (Sun) → Dec 28 (Mon)
    // Wait, let me check: Dec 25 2026 is Friday
    expect(nextWorkingDay('2026-12-25')).toBe('2026-12-28');
  });
});

// ─── addWorkingDays ──────────────────────────────────────────────────────────

describe('addWorkingDays', () => {
  it('adds 1 working day (simple case)', () => {
    // Mon Jan 5 + 1 working day = Tue Jan 6
    expect(addWorkingDays('2026-01-05', 1)).toBe('2026-01-06');
  });

  it('skips weekends when adding days', () => {
    // Fri Jan 9 + 1 working day = Mon Jan 12
    expect(addWorkingDays('2026-01-09', 1)).toBe('2026-01-12');
  });

  it('adds 5 working days (full week)', () => {
    // Mon Jan 5 + 5 working days = Mon Jan 12
    expect(addWorkingDays('2026-01-05', 5)).toBe('2026-01-12');
  });

  it('skips public holidays', () => {
    // Thu Dec 24 + 1 working day → Dec 25 Fri (Christmas, skip) → Dec 26 Sat (Boxing Day + weekend, skip) → Dec 27 Sun (skip) → Dec 28 Mon (working day)
    expect(addWorkingDays('2026-12-24', 1)).toBe('2026-12-28');
  });

  it('adds 7 working days for pension deadline', () => {
    // Mon Jan 5 + 7 working days = Wed Jan 14
    expect(addWorkingDays('2026-01-05', 7)).toBe('2026-01-14');
  });

  it('returns start date when days is 0', () => {
    expect(addWorkingDays('2026-01-05', 0)).toBe('2026-01-05');
  });
});

// ─── getRemittanceDeadline ───────────────────────────────────────────────────

describe('getRemittanceDeadline', () => {
  it('returns 21st of following month for WHT', () => {
    // Payment Jan 15 → deadline Feb 21 (Saturday) → Mon Feb 23
    expect(getRemittanceDeadline('2026-01-15', 21)).toBe('2026-02-23');
  });

  it('returns 10th of following month for PAYE', () => {
    // Payment Jan 15 → deadline Feb 10 (Tuesday)
    expect(getRemittanceDeadline('2026-01-15', 10)).toBe('2026-02-10');
  });

  it('rolls over to next year for December payments', () => {
    // Payment Dec 15 → deadline Jan 21 2027
    expect(getRemittanceDeadline('2026-12-15', 21)).toBe('2027-01-21');
  });

  it('adjusts weekend deadlines to next working day', () => {
    // Payment Feb 15 → deadline Mar 21 (Saturday) → Mon Mar 23
    expect(getRemittanceDeadline('2026-02-15', 21)).toBe('2026-03-23');
  });

  it('clamps day to last day of month for short months', () => {
    // Payment Jan 15, dayOfMonth=31 → Feb has 28 days → Feb 28 (Saturday) → Mar 2 (Monday)
    expect(getRemittanceDeadline('2026-01-15', 31)).toBe('2026-03-02');
  });
});
