import {
  pgTable,
  uuid,
  integer,
  timestamp,
  index,
  foreignKey,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { companies } from './companies.js';
import { professionals } from './professionals.js';

// Local wall-clock windows (ADR 004 / 011): weekday 0-6, minutes since local midnight.
export const availabilityRules = pgTable(
  'availability_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'restrict' }),
    professionalId: uuid('professional_id').notNull(),
    weekday: integer('weekday').notNull(),
    startMinute: integer('start_minute').notNull(),
    endMinute: integer('end_minute').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Composite tenant FK: a rule can never point at another tenant's professional (ADR 006).
    foreignKey({
      name: 'availability_rules_professional_company_fk',
      columns: [t.professionalId, t.companyId],
      foreignColumns: [professionals.id, professionals.companyId],
    }).onDelete('cascade'),
    check('availability_rules_minute_order_check', sql`${t.startMinute} < ${t.endMinute}`),
    check('availability_rules_weekday_check', sql`${t.weekday} between 0 and 6`),
    index('availability_rules_company_professional_weekday_idx').on(
      t.companyId,
      t.professionalId,
      t.weekday,
    ),
  ],
);
