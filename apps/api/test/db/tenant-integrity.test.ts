import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { runSeed } from '../../src/db/seed.js';
import { IDS } from '../../src/db/seed-data.js';
import { testDatabaseUrl } from './setup.js';
import { connectTestDb, sqlStateOf, insertAppointment, type Sql } from './helpers.js';

const FK_VIOLATION = '23503';
const CHECK_VIOLATION = '23514';

let sql: Sql;

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

describe('cross-tenant integrity (composite FKs)', () => {
  it('rejects an appointment whose professional belongs to another company', async () => {
    const state = await sqlStateOf(() =>
      insertAppointment(sql, {
        companyId: IDS.company.aurora,
        professionalId: IDS.professional.northwindOne, // belongs to Northwind
        serviceId: IDS.service.auroraShort,
        customerId: IDS.customer.auroraOne,
        startsAt: '2026-10-05T13:00:00.000Z',
        endsAt: '2026-10-05T13:30:00.000Z',
      }),
    );
    expect(state).toBe(FK_VIOLATION);
  });

  it('rejects an appointment whose service belongs to another company', async () => {
    const state = await sqlStateOf(() =>
      insertAppointment(sql, {
        companyId: IDS.company.aurora,
        professionalId: IDS.professional.auroraOne,
        serviceId: IDS.service.northwindShort, // belongs to Northwind
        customerId: IDS.customer.auroraOne,
        startsAt: '2026-10-05T13:00:00.000Z',
        endsAt: '2026-10-05T13:30:00.000Z',
      }),
    );
    expect(state).toBe(FK_VIOLATION);
  });

  it('rejects re-homing an existing appointment to another company', async () => {
    const id = await insertAppointment(sql, {
      companyId: IDS.company.aurora,
      professionalId: IDS.professional.auroraOne,
      serviceId: IDS.service.auroraShort,
      customerId: IDS.customer.auroraOne,
      startsAt: '2026-10-05T14:00:00.000Z',
      endsAt: '2026-10-05T14:30:00.000Z',
    });

    const state = await sqlStateOf(
      () => sql`UPDATE appointments SET company_id = ${IDS.company.northwind} WHERE id = ${id}`,
    );
    expect(state).toBe(FK_VIOLATION);

    const [still] = await sql<{ company_id: string }[]>`
      SELECT company_id FROM appointments WHERE id = ${id}`;
    expect(still!.company_id).toBe(IDS.company.aurora);
  });

  it('enforces starts_at < ends_at with a CHECK constraint', async () => {
    const state = await sqlStateOf(() =>
      insertAppointment(sql, {
        companyId: IDS.company.aurora,
        professionalId: IDS.professional.auroraOne,
        serviceId: IDS.service.auroraShort,
        customerId: IDS.customer.auroraOne,
        startsAt: '2026-10-05T15:00:00.000Z',
        endsAt: '2026-10-05T15:00:00.000Z', // zero-length
      }),
    );
    expect(state).toBe(CHECK_VIOLATION);
  });
});
