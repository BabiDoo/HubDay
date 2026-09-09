import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ZodValidationPipe, cleanupOpenApiDoc } from 'nestjs-zod';
import type { LoginResponse } from '@hubday/contracts';
import { testDatabaseUrl } from '../db/setup.js';
import { AppModule } from '../../src/app.module.js';
import { AllExceptionsFilter } from '../../src/common/all-exceptions.filter.js';

// API integration tests hit the ephemeral test PostgreSQL (port 5433). The Nest
// DatabaseModule factory reads process.env.DATABASE_URL at DI instantiation time
// (importing src/db/client.js never opens a connection), so pointing it at the
// test URL before `.compile()` is enough.
process.env.DATABASE_URL = testDatabaseUrl();

/**
 * Boots the real AppModule on a Fastify adapter and replicates the non-DI
 * bootstrap wiring from src/main.ts that `Test.createTestingModule` does not run:
 * the x-request-id onRequest hook, the global Zod pipe, the global exception
 * filter, and the Swagger document at /docs-json.
 */
export async function createTestApp(): Promise<NestFastifyApplication> {
  process.env.DATABASE_URL = testDatabaseUrl();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
    logger: false,
  });

  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onRequest', (request, reply, done) => {
    const incoming = request.headers['x-request-id'];
    const id = typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();
    (request as { requestId?: string }).requestId = id;
    void reply.header('x-request-id', id);
    done();
  });

  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Hubday API')
    .setDescription('test')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = cleanupOpenApiDoc(SwaggerModule.createDocument(app, swaggerConfig));
  SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'docs-json' });

  await app.init();
  await fastify.ready();
  return app;
}

export const SEED_PASSWORD = 'hubday-dev';

export async function login(
  app: NestFastifyApplication,
  email: string,
  password: string = SEED_PASSWORD,
): Promise<LoginResponse> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email, password },
  });
  if (res.statusCode !== 200) {
    throw new Error(`login failed for ${email}: ${res.statusCode} ${res.body}`);
  }
  return JSON.parse(res.body) as LoginResponse;
}

export function bearer(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

export const EMAIL = {
  auroraOwner: 'owner@aurora.test',
  auroraStaff: 'staff@aurora.test',
  northwindOwner: 'owner@northwind.test',
  northwindStaff: 'staff@northwind.test',
} as const;

// A far-future Monday: every seeded professional works Mon-Fri 09:00-17:00 local,
// and no slot is ever in the past, so availability for this date is deterministic.
export const BOOKING_DATE = '2026-10-05';
