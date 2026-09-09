import './config/load-env.js';
import 'reflect-metadata';

import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ZodValidationPipe, cleanupOpenApiDoc } from 'nestjs-zod';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';

async function bootstrap(): Promise<void> {
  const env = loadEnv();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onRequest', (request, reply, done) => {
    const incoming = request.headers['x-request-id'];
    const id = typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();
    (request as { requestId?: string }).requestId = id;
    void reply.header('x-request-id', id);
    done();
  });

  app.enableCors({
    origin: env.WEB_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean),
    // Match the API's actual method surface. Without an explicit list the
    // Fastify adapter advertises only GET,HEAD,POST, so a browser blocks the
    // preflight for `PATCH /appointments/:id` (reschedule). See ADR 018.
    methods: ['GET', 'HEAD', 'POST', 'PATCH'],
    // No cookies are used (auth is a Bearer token), so credentials stay off.
    credentials: false,
  });

  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Hubday API')
    .setDescription('Multi-tenant scheduling API (EP03/EP05/EP06/EP08)')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = cleanupOpenApiDoc(SwaggerModule.createDocument(app, swaggerConfig));
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
  });

  await app.listen(env.API_PORT, env.API_HOST);
  // eslint-disable-next-line no-console
  console.log(`hubday api listening on http://${env.API_HOST}:${env.API_PORT}`);
}

void bootstrap();
