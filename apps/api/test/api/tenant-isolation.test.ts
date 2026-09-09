import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { runSeed } from '../../src/db/seed.js';
import { IDS } from '../../src/db/seed-data.js';
import { testDatabaseUrl } from '../db/setup.js';
import { connectTestDb, type Sql } from '../db/helpers.js';
import { BOOKING_DATE, bearer, createTestApp, EMAIL, login } from './harness.js';

let app: NestFastifyApplication;
let sql: Sql;
let auroraToken: string;
let northwindToken: string;

async function firstSlot(token: string, professionalId: string, serviceId: string): Promise<string> {
  const res = await app.inject({
    method: 'GET',
    url: `/availability?professionalId=${professionalId}&serviceId=${serviceId}&date=${BOOKING_DATE}`,
    headers: bearer(token),
  });
  expect(res.statusCode).toBe(200);
  const body = JSON.parse(res.body) as { slots: Array<{ startsAt: string }> };
  return body.slots[0]!.startsAt;
}

beforeAll(async () => {
  await runSeed(testDatabaseUrl());
  app = await createTestApp();
  sql = connectTestDb();
  auroraToken = (await login(app, EMAIL.auroraOwner)).token;
  northwindToken = (await login(app, EMAIL.northwindOwner)).token;
});

afterAll(async () => {
  await sql.end({ timeout: 5 });
  await app.close();
});

beforeEach(async () => {
  await sql`DELETE FROM appointments`;
});

describe('tenant isolation at the API boundary (Gate B)', () => {
  async function createAurora(): Promise<string> {
    const startsAt = await firstSlot(auroraToken, IDS.professional.auroraOne, IDS.service.auroraLong);
    const res = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: bearer(auroraToken),
      payload: {
        professionalId: IDS.professional.auroraOne,
        serviceId: IDS.service.auroraLong,
        customerId: IDS.customer.auroraOne,
        startsAt,
      },
    });
    expect(res.statusCode).toBe(201);
    return (JSON.parse(res.body) as { id: string }).id;
  }

  async function createNorthwind(): Promise<string> {
    const startsAt = await firstSlot(
      northwindToken,
      IDS.professional.northwindOne,
      IDS.service.northwindLong,
    );
    const res = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: bearer(northwindToken),
      payload: {
        professionalId: IDS.professional.northwindOne,
        serviceId: IDS.service.northwindLong,
        customerId: IDS.customer.northwindOne,
        startsAt,
      },
    });
    expect(res.statusCode).toBe(201);
    return (JSON.parse(res.body) as { id: string }).id;
  }

  it('Aurora GET /appointments never returns a Northwind row', async () => {
    const auroraId = await createAurora();
    const northwindId = await createNorthwind();

    const res = await app.inject({
      method: 'GET',
      url: '/appointments',
      headers: bearer(auroraToken),
    });
    expect(res.statusCode).toBe(200);
    const { appointments } = JSON.parse(res.body) as { appointments: Array<{ id: string }> };
    const ids = appointments.map((a) => a.id);
    expect(ids).toContain(auroraId);
    expect(ids).not.toContain(northwindId);
  });

  it('Northwind cannot GET, PATCH, or cancel an Aurora appointment (404, row untouched)', async () => {
    const auroraId = await createAurora();

    const get = await app.inject({
      method: 'GET',
      url: `/appointments/${auroraId}`,
      headers: bearer(northwindToken),
    });
    expect(get.statusCode).toBe(404);
    expect((JSON.parse(get.body) as { code: string }).code).toBe('NOT_FOUND');

    const patch = await app.inject({
      method: 'PATCH',
      url: `/appointments/${auroraId}`,
      headers: bearer(northwindToken),
      payload: { startsAt: '2026-10-05T15:00:00.000Z' },
    });
    expect(patch.statusCode).toBe(404);

    const cancel = await app.inject({
      method: 'POST',
      url: `/appointments/${auroraId}/cancel`,
      headers: bearer(northwindToken),
    });
    expect(cancel.statusCode).toBe(404);

    const [row] = await sql<{ status: string; starts_at: Date; company_id: string }[]>`
      SELECT status, starts_at, company_id FROM appointments WHERE id = ${auroraId}`;
    expect(row!.status).toBe('scheduled');
    expect(row!.company_id).toBe(IDS.company.aurora);
  });

  it('POST /appointments as Northwind with Aurora relations -> 404 and creates nothing', async () => {
    const startsAt = await firstSlot(
      northwindToken,
      IDS.professional.northwindOne,
      IDS.service.northwindLong,
    );
    const res = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: bearer(northwindToken),
      payload: {
        professionalId: IDS.professional.auroraOne,
        serviceId: IDS.service.auroraLong,
        customerId: IDS.customer.auroraOne,
        startsAt,
      },
    });
    expect([404, 422]).toContain(res.statusCode);

    const rows = await sql<{ count: string }[]>`
      SELECT count(*)::text AS count FROM appointments WHERE company_id = ${IDS.company.northwind}`;
    expect(rows[0]!.count).toBe('0');
  });

  it('no Authorization header -> 401 with the apiError shape', async () => {
    const res = await app.inject({ method: 'GET', url: '/appointments' });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body) as Record<string, unknown>;
    expect(body.code).toBe('UNAUTHENTICATED');
    expect(typeof body.message).toBe('string');
    expect(body.statusCode).toBe(401);
    expect(typeof body.requestId).toBe('string');
  });

  it('the token, not the request body, decides the owning company', async () => {
    // createAppointmentRequest is Zod `.strict()` (ADR 005), so a `companyId` key
    // in the body is rejected outright rather than silently ignored -- strictly
    // safer than "ignored". Authority still comes only from the bearer token.
    const startsAt = await firstSlot(auroraToken, IDS.professional.auroraOne, IDS.service.auroraLong);
    const spoof = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: bearer(auroraToken),
      payload: {
        professionalId: IDS.professional.auroraOne,
        serviceId: IDS.service.auroraLong,
        customerId: IDS.customer.auroraOne,
        startsAt,
        companyId: IDS.company.northwind,
      },
    });
    expect(spoof.statusCode).toBe(400);

    const clean = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: bearer(auroraToken),
      payload: {
        professionalId: IDS.professional.auroraOne,
        serviceId: IDS.service.auroraLong,
        customerId: IDS.customer.auroraOne,
        startsAt,
      },
    });
    expect(clean.statusCode).toBe(201);
    const id = (JSON.parse(clean.body) as { id: string }).id;
    const [row] = await sql<{ company_id: string }[]>`
      SELECT company_id FROM appointments WHERE id = ${id}`;
    expect(row!.company_id).toBe(IDS.company.aurora);
  });
});
