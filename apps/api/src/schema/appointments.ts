import {
  pgTable,
  pgEnum,
  uuid,
  timestamp,
  index,
  foreignKey,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { companies } from './companies.js';
import { professionals } from './professionals.js';
import { services } from './services.js';
import { customers } from './customers.js';

export const appointmentStatuses = ['scheduled', 'cancelled', 'completed'] as const;
export type AppointmentStatus = (typeof appointmentStatuses)[number];

export const appointmentStatus = pgEnum('appointment_status', appointmentStatuses);

export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'restrict' }),
    professionalId: uuid('professional_id').notNull(),
    serviceId: uuid('service_id').notNull(),
    customerId: uuid('customer_id').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    status: appointmentStatus('status').notNull().default('scheduled'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Composite tenant FKs (ADR 006): children cannot reference another tenant's rows.
    foreignKey({
      name: 'appointments_professional_company_fk',
      columns: [t.professionalId, t.companyId],
      foreignColumns: [professionals.id, professionals.companyId],
    }).onDelete('restrict'),
    foreignKey({
      name: 'appointments_service_company_fk',
      columns: [t.serviceId, t.companyId],
      foreignColumns: [services.id, services.companyId],
    }).onDelete('restrict'),
    foreignKey({
      name: 'appointments_customer_company_fk',
      columns: [t.customerId, t.companyId],
      foreignColumns: [customers.id, customers.companyId],
    }).onDelete('restrict'),
    check('appointments_time_order_check', sql`${t.startsAt} < ${t.endsAt}`),
    index('appointments_company_professional_starts_at_idx').on(
      t.companyId,
      t.professionalId,
      t.startsAt,
    ),
    index('appointments_company_customer_idx').on(t.companyId, t.customerId),
    // NOTE: the ADR 003 partial GiST exclusion constraint
    //   EXCLUDE USING gist (company_id WITH =, professional_id WITH =,
    //     tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE (status = 'scheduled')
    // cannot be expressed in Drizzle; it is hand-written in the SQL migration.
  ],
);
