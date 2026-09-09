import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import {
  generateSlots,
  isWithinRules,
  weekdayFor,
  type RuleWindow,
} from '../../src/availability/slot-engine.js';

const PAST_NOW = new Date('2020-01-01T00:00:00.000Z');

function rule(weekday: number, startHour: number, endHour: number): RuleWindow {
  return { weekday, startMinute: startHour * 60, endMinute: endHour * 60 };
}

/** local wall-clock instant in `tz` -> JS Date, for building busy intervals. */
function at(date: string, tz: string, hour: number, minute = 0): Date {
  return DateTime.fromISO(date, { zone: tz })
    .startOf('day')
    .plus({ hours: hour, minutes: minute })
    .toUTC()
    .toJSDate();
}

function assertContiguous(slots: Array<{ startsAt: string; endsAt: string }>): void {
  for (let i = 1; i < slots.length; i++) {
    expect(slots[i]!.startsAt).toBe(slots[i - 1]!.endsAt);
  }
}

describe('slot-engine.generateSlots (EP05 / ADR 004 / ADR 011)', () => {
  const TZ = 'America/Sao_Paulo';
  const WEEKDAY_DATE = '2026-10-05'; // Monday

  it('09:00-17:00 rule, 60-min service on a weekday -> 8 contiguous slots from 12:00Z', () => {
    const wd = weekdayFor(WEEKDAY_DATE, TZ);
    const slots = generateSlots({
      date: WEEKDAY_DATE,
      timezone: TZ,
      durationMinutes: 60,
      rules: [rule(wd, 9, 17)],
      busy: [],
      now: PAST_NOW,
    });

    expect(slots).toHaveLength(8);
    expect(slots[0]!.startsAt).toBe('2026-10-05T12:00:00.000Z');
    expect(slots[0]!.endsAt).toBe('2026-10-05T13:00:00.000Z');
    assertContiguous(slots);
  });

  it('30-min service -> 16 slots', () => {
    const wd = weekdayFor(WEEKDAY_DATE, TZ);
    const slots = generateSlots({
      date: WEEKDAY_DATE,
      timezone: TZ,
      durationMinutes: 30,
      rules: [rule(wd, 9, 17)],
      busy: [],
      now: PAST_NOW,
    });
    expect(slots).toHaveLength(16);
    assertContiguous(slots);
  });

  it('a busy range at 10:00 local removes exactly that slot', () => {
    const wd = weekdayFor(WEEKDAY_DATE, TZ);
    const slots = generateSlots({
      date: WEEKDAY_DATE,
      timezone: TZ,
      durationMinutes: 60,
      rules: [rule(wd, 9, 17)],
      busy: [{ startsAt: at(WEEKDAY_DATE, TZ, 10), endsAt: at(WEEKDAY_DATE, TZ, 11) }],
      now: PAST_NOW,
    });

    expect(slots).toHaveLength(7);
    const starts = slots.map((s) => s.startsAt);
    expect(starts).not.toContain('2026-10-05T13:00:00.000Z'); // 10:00 local
    expect(starts).toContain('2026-10-05T12:00:00.000Z'); // 09:00 local
    expect(starts).toContain('2026-10-05T14:00:00.000Z'); // 11:00 local
  });

  it('a non-working weekday yields 0 slots', () => {
    const sunday = '2026-10-04';
    const slots = generateSlots({
      date: sunday,
      timezone: TZ,
      durationMinutes: 60,
      rules: [rule(1, 9, 17), rule(2, 9, 17), rule(3, 9, 17), rule(4, 9, 17), rule(5, 9, 17)],
      busy: [],
      now: PAST_NOW,
    });
    expect(slots).toHaveLength(0);
  });

  it('a DST-transition date does not throw and yields sane contiguous slots', () => {
    // ADR 011: DST-boundary local times are left to Luxon's forward shift and
    // documented as a known edge, not specially engineered. The contract here is
    // only "no throw + sane, contiguous, in-day slots".
    const tz = 'America/New_York';
    const dstDate = '2026-03-08'; // US spring-forward Sunday
    const wd = weekdayFor(dstDate, tz);
    let slots!: Array<{ startsAt: string; endsAt: string }>;
    expect(() => {
      slots = generateSlots({
        date: dstDate,
        timezone: tz,
        durationMinutes: 60,
        rules: [rule(wd, 9, 17)],
        busy: [],
        now: PAST_NOW,
      });
    }).not.toThrow();

    expect(slots.length).toBeGreaterThanOrEqual(7);
    expect(slots.length).toBeLessThanOrEqual(8);
    assertContiguous(slots);
    for (const s of slots) {
      expect(s.startsAt.startsWith('2026-03-08')).toBe(true);
      expect(new Date(s.endsAt).getTime() - new Date(s.startsAt).getTime()).toBe(60 * 60_000);
    }
  });
});

describe('slot-engine.isWithinRules (write-path revalidation)', () => {
  const TZ = 'America/Sao_Paulo';

  it('accepts a duration-aligned start inside the window', () => {
    const ok = isWithinRules({
      startsAt: new Date('2026-10-05T13:00:00.000Z'), // 10:00 local
      timezone: TZ,
      durationMinutes: 60,
      rules: [rule(weekdayFor('2026-10-05', TZ), 9, 17)],
    });
    expect(ok).toBe(true);
  });

  it('rejects a start before the window', () => {
    const ok = isWithinRules({
      startsAt: new Date('2026-10-05T11:00:00.000Z'), // 08:00 local
      timezone: TZ,
      durationMinutes: 60,
      rules: [rule(weekdayFor('2026-10-05', TZ), 9, 17)],
    });
    expect(ok).toBe(false);
  });

  it('rejects a start whose end spills past the window', () => {
    const ok = isWithinRules({
      startsAt: new Date('2026-10-05T19:30:00.000Z'), // 16:30 local, 60-min -> 17:30
      timezone: TZ,
      durationMinutes: 60,
      rules: [rule(weekdayFor('2026-10-05', TZ), 9, 17)],
    });
    expect(ok).toBe(false);
  });
});
