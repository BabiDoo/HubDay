import { pgTable, uuid, text, timestamp, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { companies } from './companies.js';

// role in ('owner','staff','viewer') — RBAC enforcement is EP12/P1 (ADR 006).
export const userRoles = ['owner', 'staff', 'viewer'] as const;
export type UserRole = (typeof userRoles)[number];

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'restrict' }),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    role: text('role', { enum: userRoles }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('users_company_id_idx').on(t.companyId),
    check('users_role_check', sql`${t.role} in ('owner', 'staff', 'viewer')`),
  ],
);
