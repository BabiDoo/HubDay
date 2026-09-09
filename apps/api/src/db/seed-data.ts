/**
 * Deterministic seed dataset (ADR 007 / EP02 / EP04).
 *
 * All identifiers are hard-coded so integration tests can import and assert
 * against known rows. Data is entirely fictitious. Every seeded user's password
 * is the documented dev password "hubday-dev"; PASSWORD_HASH is one bcrypt hash
 * of that string, reused across users (fine for a local seed).
 */

export const SEED_PASSWORD = 'hubday-dev';
// bcryptjs.hashSync('hubday-dev', 10) — regenerate with the same call if needed.
export const PASSWORD_HASH = '$2a$10$QYGdzCh.Dv238y3DdXgr8OEm0hoEUyTriZgLXv8fGNjbqXF4OIll2';

export const IDS = {
  company: {
    aurora: 'a0000000-0000-4000-8000-000000000001',
    northwind: 'b0000000-0000-4000-8000-000000000001',
  },
  user: {
    auroraOwner: 'a1000000-0000-4000-8000-000000000001',
    auroraStaff: 'a1000000-0000-4000-8000-000000000002',
    northwindOwner: 'b1000000-0000-4000-8000-000000000001',
    northwindStaff: 'b1000000-0000-4000-8000-000000000002',
  },
  professional: {
    auroraOne: 'a2000000-0000-4000-8000-000000000001',
    auroraTwo: 'a2000000-0000-4000-8000-000000000002',
    northwindOne: 'b2000000-0000-4000-8000-000000000001',
    northwindTwo: 'b2000000-0000-4000-8000-000000000002',
  },
  service: {
    auroraShort: 'a3000000-0000-4000-8000-000000000001',
    auroraLong: 'a3000000-0000-4000-8000-000000000002',
    northwindShort: 'b3000000-0000-4000-8000-000000000001',
    northwindLong: 'b3000000-0000-4000-8000-000000000002',
  },
  customer: {
    auroraOne: 'a4000000-0000-4000-8000-000000000001',
    auroraTwo: 'a4000000-0000-4000-8000-000000000002',
    northwindOne: 'b4000000-0000-4000-8000-000000000001',
    northwindTwo: 'b4000000-0000-4000-8000-000000000002',
  },
} as const;

export interface SeedCompany {
  id: string;
  name: string;
  timezone: string;
}
export interface SeedUser {
  id: string;
  companyId: string;
  email: string;
  passwordHash: string;
  role: 'owner' | 'staff' | 'viewer';
}
export interface SeedProfessional {
  id: string;
  companyId: string;
  name: string;
}
export interface SeedService {
  id: string;
  companyId: string;
  name: string;
  durationMinutes: number;
}
export interface SeedCustomer {
  id: string;
  companyId: string;
  name: string;
  email: string;
}
export interface SeedAvailabilityRule {
  companyId: string;
  professionalId: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
}

export const companiesSeed: SeedCompany[] = [
  { id: IDS.company.aurora, name: 'Aurora Estudio', timezone: 'America/Sao_Paulo' },
  { id: IDS.company.northwind, name: 'Northwind Clinic', timezone: 'America/New_York' },
];

export const usersSeed: SeedUser[] = [
  {
    id: IDS.user.auroraOwner,
    companyId: IDS.company.aurora,
    email: 'owner@aurora.test',
    passwordHash: PASSWORD_HASH,
    role: 'owner',
  },
  {
    id: IDS.user.auroraStaff,
    companyId: IDS.company.aurora,
    email: 'staff@aurora.test',
    passwordHash: PASSWORD_HASH,
    role: 'staff',
  },
  {
    id: IDS.user.northwindOwner,
    companyId: IDS.company.northwind,
    email: 'owner@northwind.test',
    passwordHash: PASSWORD_HASH,
    role: 'owner',
  },
  {
    id: IDS.user.northwindStaff,
    companyId: IDS.company.northwind,
    email: 'staff@northwind.test',
    passwordHash: PASSWORD_HASH,
    role: 'staff',
  },
];

export const professionalsSeed: SeedProfessional[] = [
  { id: IDS.professional.auroraOne, companyId: IDS.company.aurora, name: 'Alice Moreira' },
  { id: IDS.professional.auroraTwo, companyId: IDS.company.aurora, name: 'Bruno Tavares' },
  { id: IDS.professional.northwindOne, companyId: IDS.company.northwind, name: 'Dr. Carla North' },
  { id: IDS.professional.northwindTwo, companyId: IDS.company.northwind, name: 'Dr. David Wynn' },
];

export const servicesSeed: SeedService[] = [
  {
    id: IDS.service.auroraShort,
    companyId: IDS.company.aurora,
    name: 'Consulta rapida',
    durationMinutes: 30,
  },
  {
    id: IDS.service.auroraLong,
    companyId: IDS.company.aurora,
    name: 'Sessao completa',
    durationMinutes: 60,
  },
  {
    id: IDS.service.northwindShort,
    companyId: IDS.company.northwind,
    name: 'Quick check-up',
    durationMinutes: 30,
  },
  {
    id: IDS.service.northwindLong,
    companyId: IDS.company.northwind,
    name: 'Full consultation',
    durationMinutes: 60,
  },
];

export const customersSeed: SeedCustomer[] = [
  {
    id: IDS.customer.auroraOne,
    companyId: IDS.company.aurora,
    name: 'Cliente Aurora Um',
    email: 'cliente1@aurora.test',
  },
  {
    id: IDS.customer.auroraTwo,
    companyId: IDS.company.aurora,
    name: 'Cliente Aurora Dois',
    email: 'cliente2@aurora.test',
  },
  {
    id: IDS.customer.northwindOne,
    companyId: IDS.company.northwind,
    name: 'Northwind Patient One',
    email: 'patient1@northwind.test',
  },
  {
    id: IDS.customer.northwindTwo,
    companyId: IDS.company.northwind,
    name: 'Northwind Patient Two',
    email: 'patient2@northwind.test',
  },
];

// Monday-Friday 09:00-17:00 local wall-clock for every seeded professional.
const WEEKDAYS = [1, 2, 3, 4, 5];
const START_MINUTE = 9 * 60; // 540
const END_MINUTE = 17 * 60; // 1020

export const availabilityRulesSeed: SeedAvailabilityRule[] = [
  IDS.professional.auroraOne,
  IDS.professional.auroraTwo,
  IDS.professional.northwindOne,
  IDS.professional.northwindTwo,
].flatMap((professionalId) => {
  const companyId = professionalId.startsWith('a')
    ? IDS.company.aurora
    : IDS.company.northwind;
  return WEEKDAYS.map((weekday) => ({
    companyId,
    professionalId,
    weekday,
    startMinute: START_MINUTE,
    endMinute: END_MINUTE,
  }));
});
