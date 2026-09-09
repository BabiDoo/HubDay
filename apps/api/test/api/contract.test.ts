import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { JwtService } from '@nestjs/jwt';
import { runSeed } from '../../src/db/seed.js';
import { IDS } from '../../src/db/seed-data.js';
import { testDatabaseUrl } from '../db/setup.js';
import { bearer, createTestApp, EMAIL, login } from './harness.js';

let app: NestFastifyApplication;
let token: string;

const VALID_CREATE = {
  professionalId: IDS.professional.auroraOne,
  serviceId: IDS.service.auroraLong,
  customerId: IDS.customer.auroraOne,
  startsAt: '2026-10-05T12:00:00.000Z',
};

// Anything that must never leak into an error body (ADR 005).
const LEAK = /\bstack\b|\bselect \b|\binsert into\b|\bupdate .* set\b|appointments_|23P01|pg_catalog|constraint "/i;

function assertErrorBody(raw: string): Record<string, unknown> {
  const body = JSON.parse(raw) as Record<string, unknown>;
  expect(typeof body.code).toBe('string');
  expect(typeof body.message).toBe('string');
  expect(typeof body.statusCode).toBe('number');
  expect(typeof body.requestId).toBe('string');
  expect('stack' in body).toBe(false);
  expect(LEAK.test(raw)).toBe(false);
  return body;
}

beforeAll(async () => {
  await runSeed(testDatabaseUrl());
  app = await createTestApp();
  token = (await login(app, EMAIL.auroraOwner)).token;
});

afterAll(async () => {
  await app.close();
});

describe('validation and error contract (Gate E)', () => {
  it('missing required fields -> 400 VALIDATION_ERROR with details[{path,message}]', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: bearer(token),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    const body = assertErrorBody(res.body);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.statusCode).toBe(400);
    const details = body.details as Array<{ path: string; message: string }>;
    expect(Array.isArray(details)).toBe(true);
    expect(details.length).toBeGreaterThan(0);
    for (const d of details) {
      expect(typeof d.path).toBe('string');
      expect(typeof d.message).toBe('string');
    }
  });

  it('an unknown extra key -> 400 (Zod strict)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: bearer(token),
      payload: { ...VALID_CREATE, surprise: 'nope' },
    });
    expect(res.statusCode).toBe(400);
    expect(assertErrorBody(res.body).code).toBe('VALIDATION_ERROR');
  });

  it('a malformed datetime -> 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: bearer(token),
      payload: { ...VALID_CREATE, startsAt: 'not-a-datetime' },
    });
    expect(res.statusCode).toBe(400);
    expect(assertErrorBody(res.body).code).toBe('VALIDATION_ERROR');
  });

  it('a garbage bearer token -> 401 UNAUTHENTICATED', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/appointments',
      headers: bearer('this.is.garbage'),
    });
    expect(res.statusCode).toBe(401);
    expect(assertErrorBody(res.body).code).toBe('UNAUTHENTICATED');
  });

  it('an expired bearer token -> 401 SESSION_EXPIRED', async () => {
    const jwt = app.get(JwtService);
    const expired = jwt.sign(
      { sub: IDS.user.auroraOwner, companyId: IDS.company.aurora, role: 'owner' },
      { expiresIn: -60 },
    );
    const res = await app.inject({
      method: 'GET',
      url: '/appointments',
      headers: bearer(expired),
    });
    expect(res.statusCode).toBe(401);
    expect(assertErrorBody(res.body).code).toBe('SESSION_EXPIRED');
  });

  it('every error response carries x-request-id that equals body.requestId', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/appointments/${IDS.customer.auroraTwo}`, // valid uuid, not an appointment
      headers: bearer(token),
    });
    expect(res.statusCode).toBe(404);
    const body = assertErrorBody(res.body);
    const header = res.headers['x-request-id'];
    expect(typeof header).toBe('string');
    expect(header).toBe(body.requestId);
  });

  it('GET /docs-json exposes the documented paths', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs-json' });
    expect(res.statusCode).toBe(200);
    const doc = JSON.parse(res.body) as { paths: Record<string, unknown> };
    for (const path of [
      '/auth/login',
      '/availability',
      '/appointments',
      '/appointments/{id}',
      '/appointments/{id}/cancel',
    ]) {
      expect(Object.keys(doc.paths)).toContain(path);
    }
  });
});
