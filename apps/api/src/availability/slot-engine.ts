import { DateTime } from 'luxon';
import type { Slot } from '@hubday/contracts';

export interface RuleWindow {
  weekday: number; // 0=Sun..6=Sat (ADR 004)
  startMinute: number;
  endMinute: number;
}

export interface BusyInterval {
  startsAt: Date;
  endsAt: Date;
}

export interface GenerateSlotsInput {
  date: string; // YYYY-MM-DD in `timezone`
  timezone: string;
  durationMinutes: number;
  rules: RuleWindow[];
  busy: BusyInterval[];
  now: Date;
}

/** Luxon weekday (1=Mon..7=Sun) mapped to the repo convention (0=Sun..6=Sat). */
export function weekdayFor(date: string, timezone: string): number {
  const day = DateTime.fromISO(date, { zone: timezone }).startOf('day');
  if (!day.isValid) {
    throw new Error(`Invalid date/timezone: ${date} / ${timezone}`);
  }
  return day.weekday % 7;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * Backend slot generation (ADR 011). Half-open `[start, end)` slots stepped by
 * the service duration, clipped to each matching rule window, converted from the
 * Company-local wall clock to UTC, with past and busy-overlapping slots dropped.
 */
export function generateSlots(input: GenerateSlotsInput): Slot[] {
  const { date, timezone, durationMinutes, rules, busy, now } = input;
  const dayStart = DateTime.fromISO(date, { zone: timezone }).startOf('day');
  if (!dayStart.isValid) {
    throw new Error(`Invalid date/timezone: ${date} / ${timezone}`);
  }
  const weekday = dayStart.weekday % 7;
  const nowMs = now.getTime();

  const seen = new Set<string>();
  const slots: Slot[] = [];

  for (const rule of rules) {
    if (rule.weekday !== weekday) continue;
    for (
      let minute = rule.startMinute;
      minute + durationMinutes <= rule.endMinute;
      minute += durationMinutes
    ) {
      // Anchor to the wall-clock time (hour:minute) so a rule window stays put
      // across a DST transition instead of drifting by the offset change.
      const localStart = dayStart.set({
        hour: Math.floor(minute / 60),
        minute: minute % 60,
      });
      const localEnd = localStart.plus({ minutes: durationMinutes });
      const startDate = localStart.toUTC().toJSDate();
      const endDate = localEnd.toUTC().toJSDate();
      const startMs = startDate.getTime();
      const endMs = endDate.getTime();

      if (startMs <= nowMs) continue;
      if (busy.some((b) => overlaps(startMs, endMs, b.startsAt.getTime(), b.endsAt.getTime()))) {
        continue;
      }

      const startsAt = startDate.toISOString();
      if (seen.has(startsAt)) continue;
      seen.add(startsAt);
      slots.push({ startsAt, endsAt: endDate.toISOString() });
    }
  }

  slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return slots;
}

/**
 * Write-path revalidation (create / reschedule). True when `startsAt` for the
 * given duration falls entirely inside a matching rule window and is aligned to
 * the duration step from that window's start. Busy intervals are NOT considered
 * here — the PostgreSQL exclusion constraint is the arbiter of conflicts.
 */
export function isWithinRules(params: {
  startsAt: Date;
  timezone: string;
  durationMinutes: number;
  rules: RuleWindow[];
}): boolean {
  const { startsAt, timezone, durationMinutes, rules } = params;
  const local = DateTime.fromJSDate(startsAt, { zone: timezone });
  if (!local.isValid) return false;

  const dayStart = local.startOf('day');
  const weekday = dayStart.weekday % 7;
  // Wall-clock minutes since local midnight (matches how rules are stored and how
  // generateSlots anchors slots), DST-stable — not an absolute elapsed diff.
  const startMinute = local.hour * 60 + local.minute;
  const endMinute = startMinute + durationMinutes;

  return rules.some(
    (rule) =>
      rule.weekday === weekday &&
      startMinute >= rule.startMinute &&
      endMinute <= rule.endMinute &&
      (startMinute - rule.startMinute) % durationMinutes === 0,
  );
}
