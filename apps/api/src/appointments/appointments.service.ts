import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gte, lte, type SQL } from 'drizzle-orm';
import type {
  Appointment,
  CreateAppointmentRequest,
  ListAppointmentsQuery,
  ListAppointmentsResponse,
  RescheduleAppointmentRequest,
} from '@hubday/contracts';
import { DRIZZLE } from '../database/database.module.js';
import type { Database } from '../db/client.js';
import {
  appointments,
  availabilityRules,
  companies,
  customers,
  professionals,
  services,
} from '../schema/index.js';
import { TenantContext } from '../common/tenant-context.service.js';
import { DomainError } from '../common/domain-error.js';
import { isWithinRules, type RuleWindow } from '../availability/slot-engine.js';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
type Executor = Database | Tx;

const ROW = {
  id: appointments.id,
  professionalId: appointments.professionalId,
  professionalName: professionals.name,
  serviceId: appointments.serviceId,
  serviceName: services.name,
  serviceDurationMinutes: services.durationMinutes,
  customerId: appointments.customerId,
  customerName: customers.name,
  startsAt: appointments.startsAt,
  endsAt: appointments.endsAt,
  status: appointments.status,
  createdAt: appointments.createdAt,
  updatedAt: appointments.updatedAt,
};

interface RawRow {
  id: string;
  professionalId: string;
  professionalName: string;
  serviceId: string;
  serviceName: string;
  serviceDurationMinutes: number;
  customerId: string;
  customerName: string;
  startsAt: Date;
  endsAt: Date;
  status: 'scheduled' | 'cancelled' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

function serialize(row: RawRow): Appointment {
  return {
    id: row.id,
    professionalId: row.professionalId,
    professionalName: row.professionalName,
    serviceId: row.serviceId,
    serviceName: row.serviceName,
    serviceDurationMinutes: row.serviceDurationMinutes,
    customerId: row.customerId,
    customerName: row.customerName,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// Drizzle wraps driver errors; the PostgresError (with SQLSTATE `code`) sits on
// the `.cause` chain.
function isPgCode(err: unknown, code: string, depth = 0): boolean {
  if (!err || typeof err !== 'object' || depth > 5) return false;
  if ((err as { code?: unknown }).code === code) return true;
  return isPgCode((err as { cause?: unknown }).cause, code, depth + 1);
}

@Injectable()
export class AppointmentsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly tenant: TenantContext,
  ) {}

  async list(query: ListAppointmentsQuery): Promise<ListAppointmentsResponse> {
    const companyId = this.tenant.companyId;
    const conditions: SQL[] = [eq(appointments.companyId, companyId)];
    if (query.status) conditions.push(eq(appointments.status, query.status));
    if (query.professionalId) conditions.push(eq(appointments.professionalId, query.professionalId));
    if (query.from) conditions.push(gte(appointments.startsAt, new Date(query.from)));
    if (query.to) conditions.push(lte(appointments.startsAt, new Date(query.to)));

    const rows = (await this.baseQuery(this.db)
      .where(and(...conditions))
      .orderBy(asc(appointments.startsAt))) as RawRow[];

    return { appointments: rows.map(serialize) };
  }

  async getById(id: string): Promise<Appointment> {
    const row = await this.loadOne(this.db, this.tenant.companyId, id);
    if (!row) throw DomainError.notFound('Appointment');
    return serialize(row);
  }

  async create(input: CreateAppointmentRequest): Promise<Appointment> {
    const companyId = this.tenant.companyId;

    const created = await this.db.transaction(async (tx) => {
      const [professional] = await tx
        .select({ id: professionals.id })
        .from(professionals)
        .where(and(eq(professionals.id, input.professionalId), eq(professionals.companyId, companyId)))
        .limit(1);
      if (!professional) throw DomainError.notFound('Professional');

      const [service] = await tx
        .select({ id: services.id, durationMinutes: services.durationMinutes })
        .from(services)
        .where(and(eq(services.id, input.serviceId), eq(services.companyId, companyId)))
        .limit(1);
      if (!service) throw DomainError.notFound('Service');

      const [customer] = await tx
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.id, input.customerId), eq(customers.companyId, companyId)))
        .limit(1);
      if (!customer) throw DomainError.notFound('Customer');

      const startsAt = new Date(input.startsAt);
      if (startsAt.getTime() <= Date.now()) {
        throw new DomainError('APPOINTMENT_IN_PAST', 422, 'Appointment cannot start in the past');
      }
      const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);

      await this.assertWithinRules(tx, companyId, input.professionalId, startsAt, endsAt, service.durationMinutes);

      try {
        const inserted = await tx
          .insert(appointments)
          .values({
            companyId,
            professionalId: input.professionalId,
            serviceId: input.serviceId,
            customerId: input.customerId,
            startsAt,
            endsAt,
            status: 'scheduled',
          })
          .returning({ id: appointments.id });
        const newId = inserted[0]!.id;
        return this.loadOne(tx, companyId, newId);
      } catch (err) {
        if (isPgCode(err, '23P01')) {
          throw new DomainError('APPOINTMENT_CONFLICT', 409, 'That time slot is no longer available');
        }
        throw err;
      }
    });

    if (!created) throw new DomainError('INTERNAL', 500, 'Failed to load created appointment');
    return serialize(created);
  }

  async reschedule(id: string, input: RescheduleAppointmentRequest): Promise<Appointment> {
    const companyId = this.tenant.companyId;

    const updated = await this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({
          id: appointments.id,
          status: appointments.status,
          serviceId: appointments.serviceId,
          professionalId: appointments.professionalId,
        })
        .from(appointments)
        .where(and(eq(appointments.id, id), eq(appointments.companyId, companyId)))
        .limit(1);
      if (!existing) throw DomainError.notFound('Appointment');
      if (existing.status !== 'scheduled') {
        throw new DomainError(
          'INVALID_STATE_TRANSITION',
          422,
          `Cannot reschedule an appointment that is ${existing.status}`,
        );
      }

      const [service] = await tx
        .select({ durationMinutes: services.durationMinutes })
        .from(services)
        .where(and(eq(services.id, existing.serviceId), eq(services.companyId, companyId)))
        .limit(1);
      if (!service) throw DomainError.notFound('Service');

      const startsAt = new Date(input.startsAt);
      if (startsAt.getTime() <= Date.now()) {
        throw new DomainError('APPOINTMENT_IN_PAST', 422, 'Appointment cannot start in the past');
      }
      const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);

      await this.assertWithinRules(
        tx,
        companyId,
        existing.professionalId,
        startsAt,
        endsAt,
        service.durationMinutes,
      );

      try {
        const rows = await tx
          .update(appointments)
          .set({ startsAt, endsAt, updatedAt: new Date() })
          .where(
            and(
              eq(appointments.id, id),
              eq(appointments.companyId, companyId),
              eq(appointments.status, 'scheduled'),
            ),
          )
          .returning({ id: appointments.id });
        if (rows.length === 0) throw DomainError.notFound('Appointment');
        return this.loadOne(tx, companyId, id);
      } catch (err) {
        if (isPgCode(err, '23P01')) {
          throw new DomainError('APPOINTMENT_CONFLICT', 409, 'That time slot is no longer available');
        }
        throw err;
      }
    });

    if (!updated) throw DomainError.notFound('Appointment');
    return serialize(updated);
  }

  async cancel(id: string): Promise<Appointment> {
    const companyId = this.tenant.companyId;

    const [existing] = await this.db
      .select({ status: appointments.status })
      .from(appointments)
      .where(and(eq(appointments.id, id), eq(appointments.companyId, companyId)))
      .limit(1);
    if (!existing) throw DomainError.notFound('Appointment');
    if (existing.status !== 'scheduled') {
      throw new DomainError(
        'INVALID_STATE_TRANSITION',
        422,
        `Cannot cancel an appointment that is ${existing.status}`,
      );
    }

    const rows = await this.db
      .update(appointments)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(
        and(
          eq(appointments.id, id),
          eq(appointments.companyId, companyId),
          eq(appointments.status, 'scheduled'),
        ),
      )
      .returning({ id: appointments.id });
    if (rows.length === 0) throw DomainError.notFound('Appointment');

    const row = await this.loadOne(this.db, companyId, id);
    if (!row) throw DomainError.notFound('Appointment');
    return serialize(row);
  }

  private baseQuery(exec: Executor) {
    return exec
      .select(ROW)
      .from(appointments)
      .innerJoin(
        professionals,
        and(
          eq(professionals.id, appointments.professionalId),
          eq(professionals.companyId, appointments.companyId),
        ),
      )
      .innerJoin(
        services,
        and(eq(services.id, appointments.serviceId), eq(services.companyId, appointments.companyId)),
      )
      .innerJoin(
        customers,
        and(
          eq(customers.id, appointments.customerId),
          eq(customers.companyId, appointments.companyId),
        ),
      );
  }

  private async loadOne(
    exec: Executor,
    companyId: string,
    id: string,
  ): Promise<RawRow | undefined> {
    const rows = (await this.baseQuery(exec)
      .where(and(eq(appointments.id, id), eq(appointments.companyId, companyId)))
      .limit(1)) as RawRow[];
    return rows[0];
  }

  private async assertWithinRules(
    exec: Executor,
    companyId: string,
    professionalId: string,
    startsAt: Date,
    endsAt: Date,
    durationMinutes: number,
  ): Promise<void> {
    const [company] = await exec
      .select({ timezone: companies.timezone })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);
    if (!company) throw DomainError.unauthenticated('Unknown company on token');

    const ruleRows = await exec
      .select({
        weekday: availabilityRules.weekday,
        startMinute: availabilityRules.startMinute,
        endMinute: availabilityRules.endMinute,
      })
      .from(availabilityRules)
      .where(
        and(
          eq(availabilityRules.companyId, companyId),
          eq(availabilityRules.professionalId, professionalId),
        ),
      );

    const rules: RuleWindow[] = ruleRows.map((r) => ({
      weekday: r.weekday,
      startMinute: r.startMinute,
      endMinute: r.endMinute,
    }));

    const ok = isWithinRules({
      startsAt,
      timezone: company.timezone,
      durationMinutes,
      rules,
    });
    // endsAt is derived from duration; guard kept for clarity of intent.
    if (!ok || endsAt.getTime() - startsAt.getTime() !== durationMinutes * 60_000) {
      throw new DomainError(
        'OUTSIDE_AVAILABILITY',
        422,
        'Requested time is outside the professional availability',
      );
    }
  }
}
