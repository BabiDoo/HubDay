import postgres from 'postgres';
import { testDatabaseUrl } from './setup.js';

export type Sql = ReturnType<typeof postgres>;

export function connectTestDb(): Sql {
  return postgres(testDatabaseUrl(), { max: 4, onnotice: () => {} });
}

/** Runs a thunk and returns the PostgreSQL SQLSTATE it raised, or throws if it did not fail. */
export async function sqlStateOf(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (!code) throw err;
    return code;
  }
  throw new Error('expected the statement to raise a database error, but it succeeded');
}

export async function insertAppointment(
  sql: Sql,
  row: {
    companyId: string;
    professionalId: string;
    serviceId: string;
    customerId: string;
    startsAt: string;
    endsAt: string;
    status?: 'scheduled' | 'cancelled' | 'completed';
  },
): Promise<string> {
  const [created] = await sql<{ id: string }[]>`
    INSERT INTO appointments
      (company_id, professional_id, service_id, customer_id, starts_at, ends_at, status)
    VALUES
      (${row.companyId}, ${row.professionalId}, ${row.serviceId}, ${row.customerId},
       ${row.startsAt}, ${row.endsAt}, ${row.status ?? 'scheduled'})
    RETURNING id`;
  return created!.id;
}
