import { pgTable, uuid, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { companies } from './companies.js';

export const customers = pgTable(
  'customers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    email: text('email').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('customers_id_company_id_key').on(t.id, t.companyId)],
);
