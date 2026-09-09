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

const PRO = IDS.professional.auroraOne;
const SERVICE = IDS.service.auroraLong; // 60 min
const CUST = IDS.customer.auroraOne;

interface Slot {
  startsAt: string;
  endsAt: string;
}

async function slots(): Promise<Slot[]> {
  const res = await app.inject({
    method: 'GET',
    url: `/availability?professionalId=${PRO}&serviceId=${SERVICE}&date=${BOOKING_DATE}`,
    headers: bearer(token),
  });
  expect(res.statusCode).toBe(200);
  return (JSON.parse(res.body) as { slots: Slot[] }).slots;
}

function create(startsAt: string, customerId: string = CUST) {
  return app.inject({
    method: 'POST',
    url: '/appointments',
    headers: bearer(token),
    payload: { professionalId: PRO, serviceId: SERVICE, customerId, startsAt },
  });
}

function reschedule(id: string, startsAt: string) {
  return app.inject({
    method: 'PATCH',
    url: `/appointments/${id}`,
    headers: bearer(token),
    payload: { startsAt },
  });
}

function cancel(id: string) {
  return app.inject({ method: 'POST', url: `/appointments/${id}/cancel`, headers: bearer(token) });
}

function getOne(id: string) {
  return app.inject({ method: 'GET', url: `/appointments/${id}`, headers: bearer(token) });
}

beforeAll(async () => {
  await runSeed(testDatabaseUrl());
  app = await createTestApp();
  sql = connectTestDb();
  token = (await login(app, EMAIL.auroraOwner)).token;
});

afterAll(async () => {
  await sql.end({ timeout: 5 });
  await app.close();
});

beforeEach(async () => {
  await sql`DELETE FROM appointments`;
});

describe('appointment lifecycle preserves availability (Gate D)', () => {
  it('create shows in the list and removes the slot from availability', async () => {
    const target = (await slots())[0]!;
    const res = await create(target.startsAt);
    expect(res.statusCode).toBe(201);
    const id = (JSON.parse(res.body) as { id: string }).id;

    const list = await app.inject({
      method: 'GET',
      url: '/appointments',
      headers: bearer(token),
    });
    const ids = (JSON.parse(list.body) as { appointments: Array<{ id: string }> }).appointments.map(
      (a) => a.id,
    );
    expect(ids).toContain(id);

    const after = await slots();
    expect(after.map((s) => s.startsAt)).not.toContain(target.startsAt);
  });

  it('reschedule frees the old slot, consumes the new one, keeps id and status', async () => {
    const initial = await slots();
    const from = initial[0]!;
    const to = initial[3]!;

    const created = await create(from.startsAt);
    const id = (JSON.parse(created.body) as { id: string }).id;

    const moved = await reschedule(id, to.startsAt);
    expect(moved.statusCode).toBe(200);
    const body = JSON.parse(moved.body) as { id: string; status: string; startsAt: string };
    expect(body.id).toBe(id);
    expect(body.status).toBe('scheduled');
    expect(body.startsAt).toBe(to.startsAt);

    const after = (await slots()).map((s) => s.startsAt);
    expect(after).toContain(from.startsAt);
    expect(after).not.toContain(to.startsAt);
  });

  it('reschedule into a slot held by another appointment -> 409, original unchanged', async () => {
    const all = await slots();
    const mine = all[0]!;
    const takenByOther = all[2]!;

    const created = await create(mine.startsAt, IDS.customer.auroraOne);
    const id = (JSON.parse(created.body) as { id: string }).id;
    const other = await create(takenByOther.startsAt, IDS.customer.auroraTwo);
    expect(other.statusCode).toBe(201);

    const clash = await reschedule(id, takenByOther.startsAt);
    expect(clash.statusCode).toBe(409);
    expect((JSON.parse(clash.body) as { code: string }).code).toBe('APPOINTMENT_CONFLICT');

    const still = JSON.parse((await getOne(id)).body) as { startsAt: string; status: string };
    expect(still.startsAt).toBe(mine.startsAt);
    expect(still.status).toBe('scheduled');
  });

  it('reschedule of a cancelled appointment -> 422 INVALID_STATE_TRANSITION', async () => {
    const target = (await slots())[0]!;
    const id = (JSON.parse((await create(target.startsAt)).body) as { id: string }).id;
    expect((await cancel(id)).statusCode).toBe(200);

    const res = await reschedule(id, (await slots())[1]!.startsAt);
    expect(res.statusCode).toBe(422);
    expect((JSON.parse(res.body) as { code: string }).code).toBe('INVALID_STATE_TRANSITION');
  });

  it('cancel sets status cancelled, releases the slot; a second cancel -> 422', async () => {
    const target = (await slots())[0]!;
    const id = (JSON.parse((await create(target.startsAt)).body) as { id: string }).id;

    const first = await cancel(id);
    expect(first.statusCode).toBe(200);
    expect((JSON.parse(first.body) as { status: string }).status).toBe('cancelled');

    expect((await slots()).map((s) => s.startsAt)).toContain(target.startsAt);

    const second = await cancel(id);
    expect([422, 404]).toContain(second.statusCode);
  });

  it('create with startsAt in the past -> 422 APPOINTMENT_IN_PAST', async () => {
    const res = await create('2020-01-06T12:00:00.000Z');
    expect(res.statusCode).toBe(422);
    expect((JSON.parse(res.body) as { code: string }).code).toBe('APPOINTMENT_IN_PAST');
  });

  it('create outside the availability window -> 422 OUTSIDE_AVAILABILITY', async () => {
    // 11:00Z == 08:00 America/Sao_Paulo, one hour before the 09:00 rule start.
    const res = await create('2026-10-05T11:00:00.000Z');
    expect(res.statusCode).toBe(422);
    expect((JSON.parse(res.body) as { code: string }).code).toBe('OUTSIDE_AVAILABILITY');
  });
});
