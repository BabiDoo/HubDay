import { Inject, Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { and, eq, gt, lt } from 'drizzle-orm';
import type { AvailabilityQuery, AvailabilityResponse } from '@hubday/contracts';
import { DRIZZLE } from '../database/database.module.js';
import type { Database } from '../db/client.js';
import { appointments, availabilityRules, companies, professionals, services } from '../schema/index.js';
import { TenantContext } from '../common/tenant-context.service.js';
import { DomainError } from '../common/domain-error.js';
import { generateSlots, weekdayFor, type RuleWindow } from './slot-engine.js';

@Injectable()
export class AvailabilityService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly tenant: TenantContext,
  ) {}

  async getAvailability(query: AvailabilityQuery): Promise<AvailabilityResponse> {
    const companyId = this.tenant.companyId;

    const [company] = await this.db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);
    if (!company) throw DomainError.unauthenticated('Unknown company on token');

    const [professional] = await this.db
      .select({ id: professionals.id })
      .from(professionals)
      .where(and(eq(professionals.id, query.professionalId), eq(professionals.companyId, companyId)))
      .limit(1);
    if (!professional) throw DomainError.notFound('Professional');

    const [service] = await this.db
      .select({ id: services.id, durationMinutes: services.durationMinutes })
      .from(services)
      .where(and(eq(services.id, query.serviceId), eq(services.companyId, companyId)))
      .limit(1);
    if (!service) throw DomainError.notFound('Service');

    const weekday = weekdayFor(query.date, company.timezone);

    const ruleRows = await this.db
      .select({
        weekday: availabilityRules.weekday,
        startMinute: availabilityRules.startMinute,
        endMinute: availabilityRules.endMinute,
      })
      .from(availabilityRules)
      .where(
        and(
          eq(availabilityRules.companyId, companyId),
          eq(availabilityRules.professionalId, query.professionalId),
          eq(availabilityRules.weekday, weekday),
        ),
      );

    const dayStart = DateTime.fromISO(query.date, { zone: company.timezone }).startOf('day');
    const dayStartUtc = dayStart.toUTC().toJSDate();
    const dayEndUtc = dayStart.plus({ days: 1 }).toUTC().toJSDate();

    const busy = await this.db
      .select({ startsAt: appointments.startsAt, endsAt: appointments.endsAt })
      .from(appointments)
      .where(
        and(
          eq(appointments.companyId, companyId),
          eq(appointments.professionalId, query.professionalId),
          eq(appointments.status, 'scheduled'),
          lt(appointments.startsAt, dayEndUtc),
          gt(appointments.endsAt, dayStartUtc),
        ),
      );

    const rules: RuleWindow[] = ruleRows.map((r) => ({
      weekday: r.weekday,
      startMinute: r.startMinute,
      endMinute: r.endMinute,
    }));

    const slots = generateSlots({
      date: query.date,
      timezone: company.timezone,
      durationMinutes: service.durationMinutes,
      rules,
      busy,
      now: new Date(),
    });

    return {
      date: query.date,
      timezone: company.timezone,
      serviceDurationMinutes: service.durationMinutes,
      slots,
    };
  }
}
