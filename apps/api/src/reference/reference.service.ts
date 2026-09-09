import { Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import type { Customer, Professional, Service } from '@hubday/contracts';
import { DRIZZLE } from '../database/database.module.js';
import type { Database } from '../db/client.js';
import { customers, professionals, services } from '../schema/index.js';
import { TenantContext } from '../common/tenant-context.service.js';

@Injectable()
export class ReferenceService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly tenant: TenantContext,
  ) {}

  async listProfessionals(): Promise<Professional[]> {
    const rows = await this.db
      .select({ id: professionals.id, name: professionals.name })
      .from(professionals)
      .where(eq(professionals.companyId, this.tenant.companyId))
      .orderBy(asc(professionals.name));
    return rows;
  }

  async listServices(): Promise<Service[]> {
    const rows = await this.db
      .select({
        id: services.id,
        name: services.name,
        durationMinutes: services.durationMinutes,
      })
      .from(services)
      .where(eq(services.companyId, this.tenant.companyId))
      .orderBy(asc(services.name));
    return rows;
  }

  async listCustomers(): Promise<Customer[]> {
    const rows = await this.db
      .select({ id: customers.id, name: customers.name, email: customers.email })
      .from(customers)
      .where(eq(customers.companyId, this.tenant.companyId))
      .orderBy(asc(customers.name));
    return rows;
  }
}
