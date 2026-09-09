import { pgTable, uuid, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { companies } from './companies.js';

export const professionals = pgTable(
  'professionals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Target of the composite tenant FKs from availability_rules and appointments (ADR 006).
    unique('professionals_id_company_id_key').on(t.id, t.companyId),
  ],
);
