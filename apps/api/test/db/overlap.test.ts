import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { runSeed } from '../../src/db/seed.js';
import { IDS } from '../../src/db/seed-data.js';
import { testDatabaseUrl } from './setup.js';
import { connectTestDb, sqlStateOf, insertAppointment, type Sql } from './helpers.js';

const EXCLUSION_VIOLATION = '23P01';

let sql: Sql;

const base = {
  companyId: IDS.company.aurora,
  professionalId: IDS.professional.auroraOne,
  serviceId: IDS.service.auroraLong,
  customerId: IDS.customer.auroraOne,
};

async function scheduledCount(): Promise<string> {
  const rows = await sql<{ count: string }[]>`
    SELECT count(*)::text AS count FROM appointments WHERE status = 'scheduled'`;
  return rows[0]!.count;
}

beforeAll(async () => {
  await runSeed(testDatabaseUrl());
  sql = connectTestDb();
});

afterAll(async () => {
  await sql.end({ timeout: 5 });
});

beforeEach(async () => {
  await sql`DELETE FROM appointments`;
});

describe('appointments exclusion constraint (ADR 003)', () => {
  it('rejects a second scheduled appointment that overlaps the same professional', async () => {
    await insertAppointment(sql, {
      ...base,
      startsAt: '2026-10-06T13:00:00.000Z',
      endsAt: '2026-10-06T14:00:00.000Z',
    });

    const state = await sqlStateOf(() =>
      insertAppointment(sql, {
        ...base,
        customerId: IDS.customer.auroraTwo,
        startsAt: '2026-10-06T13:30:00.000Z',
        endsAt: '2026-10-06T14:30:00.000Z',
      }),
    );
    expect(state).toBe(EXCLUSION_VIOLATION);
    expect(await scheduledCount()).toBe('1');
  });

  it('allows adjacent appointments where one ends exactly when the next begins', async () => {
    await insertAppointment(sql, {
      ...base,
      startsAt: '2026-10-06T13:00:00.000Z',
      endsAt: '2026-10-06T14:00:00.000Z',
    });

    await expect(
      insertAppointment(sql, {
        ...base,
        customerId: IDS.customer.auroraTwo,
        startsAt: '2026-10-06T14:00:00.000Z',
        endsAt: '2026-10-06T15:00:00.000Z',
      }),
    ).resolves.toBeTypeOf('string');

    expect(await scheduledCount()).toBe('2');
  });

  it('frees the interval once an overlapping appointment is cancelled', async () => {
    const id = await insertAppointment(sql, {
      ...base,
      startsAt: '2026-10-06T16:00:00.000Z',
      endsAt: '2026-10-06T17:00:00.000Z',
    });

    await sql`UPDATE appointments SET status = 'cancelled' WHERE id = ${id}`;

    await expect(
      insertAppointment(sql, {
        ...base,
        customerId: IDS.customer.auroraTwo,
        startsAt: '2026-10-06T16:30:00.000Z',
        endsAt: '2026-10-06T17:30:00.000Z',
      }),
    ).resolves.toBeTypeOf('string');
  });

  it('under two simultaneous transactions, exactly one overlapping insert wins', async () => {
    const attempt = (customerId: string) =>
      sql
        .begin(async (tx) => {
          await tx`
            INSERT INTO appointments
              (company_id, professional_id, service_id, customer_id, starts_at, ends_at, status)
            VALUES
              (${base.companyId}, ${base.professionalId}, ${base.serviceId}, ${customerId},
               '2026-10-07T09:00:00.000Z', '2026-10-07T10:00:00.000Z', 'scheduled')`;
        })
        .then(
          () => ({ ok: true as const, code: undefined as string | undefined }),
          (err: { code?: string }) => ({ ok: false as const, code: err.code }),
        );

    const results = await Promise.all([
      attempt(IDS.customer.auroraOne),
      attempt(IDS.customer.auroraTwo),
    ]);

    const wins = results.filter((r) => r.ok);
    const losses = results.filter((r) => !r.ok);
    expect(wins).toHaveLength(1);
    expect(losses).toHaveLength(1);
    expect(losses[0]!.code).toBe(EXCLUSION_VIOLATION);
    expect(await scheduledCount()).toBe('1');
  });

  it('does not conflict across different professionals at the same time', async () => {
    await insertAppointment(sql, {
      ...base,
      startsAt: '2026-10-06T18:00:00.000Z',
      endsAt: '2026-10-06T19:00:00.000Z',
    });

    await expect(
      insertAppointment(sql, {
        ...base,
        professionalId: IDS.professional.auroraTwo,
        customerId: IDS.customer.auroraTwo,
        startsAt: '2026-10-06T18:00:00.000Z',
        endsAt: '2026-10-06T19:00:00.000Z',
      }),
    ).resolves.toBeTypeOf('string');
  });
});
