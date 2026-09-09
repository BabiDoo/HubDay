import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { runSeed } from '../../src/db/seed.js';
import { IDS } from '../../src/db/seed-data.js';
import { testDatabaseUrl } from '../db/setup.js';
import { connectTestDb, type Sql } from '../db/helpers.js';
import { BOOKING_DATE, bearer, createTestApp, EMAIL, login } from './harness.js';

let app: NestFastifyApplication;
let sql: Sql;
let token: string;
let slots: Array<{ startsAt: string; endsAt: string }>;

const PRO = IDS.professional.auroraOne;
const SERVICE = IDS.service.auroraLong; // 60 min

async function loadSlots(): Promise<void> {
  const res = await app.inject({
    method: 'GET',
    url: `/availability?professionalId=${PRO}&serviceId=${SERVICE}&date=${BOOKING_DATE}`,
    headers: bearer(token),
  });
  expect(res.statusCode).toBe(200);
  slots = (JSON.parse(res.body) as { slots: typeof slots }).slots;
  expect(slots.length).toBeGreaterThan(2);
}

function post(customerId: string, startsAt: string) {
  return app.inject({
    method: 'POST',
    url: '/appointments',
    headers: bearer(token),
    payload: { professionalId: PRO, serviceId: SERVICE, customerId, startsAt },
  });
}

beforeAll(async () => {
  await runSeed(testDatabaseUrl());
  app = await createTestApp();
  sql = connectTestDb();
  token = (await login(app, EMAIL.auroraOwner)).token;
  await loadSlots();
});

afterAll(async () => {
  await sql.end({ timeout: 5 });
  await app.close();
});

beforeEach(async () => {
  await sql`DELETE FROM appointments`;
});

describe('concurrent booking (Gate C)', () => {
  it('two parallel POSTs for the same professional + slot -> one 201, one 409', async () => {
    const target = slots[0]!;

    const [a, b] = await Promise.all([
      post(IDS.customer.auroraOne, target.startsAt),
      post(IDS.customer.auroraTwo, target.startsAt),
    ]);

    const codes = [a.statusCode, b.statusCode].sort();
    expect(codes).toEqual([201, 409]);

    const conflict = a.statusCode === 409 ? a : b;
    expect((JSON.parse(conflict.body) as { code: string }).code).toBe('APPOINTMENT_CONFLICT');

    const rows = await sql<{ count: string }[]>`
      SELECT count(*)::text AS count
      FROM appointments
      WHERE professional_id = ${PRO}
        AND status = 'scheduled'
        AND starts_at = ${target.startsAt}`;
    expect(rows[0]!.count).toBe('1');
  });

  it('adjacent bookings where endsAt == next startsAt both succeed', async () => {
    const first = slots[0]!;
    const second = slots[1]!;
    expect(first.endsAt).toBe(second.startsAt);

    const a = await post(IDS.customer.auroraOne, first.startsAt);
    const b = await post(IDS.customer.auroraTwo, second.startsAt);

    expect(a.statusCode).toBe(201);
    expect(b.statusCode).toBe(201);

    const rows = await sql<{ count: string }[]>`
      SELECT count(*)::text AS count
      FROM appointments
      WHERE professional_id = ${PRO} AND status = 'scheduled'`;
    expect(rows[0]!.count).toBe('2');
  });
});
