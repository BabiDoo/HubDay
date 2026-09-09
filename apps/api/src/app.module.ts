import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ClsModule } from 'nestjs-cls';
import type { FastifyRequest } from 'fastify';
import { DatabaseModule } from './database/database.module.js';
import { CommonModule } from './common/common.module.js';
import { AuthModule } from './auth/auth.module.js';
import { HealthModule } from './health/health.module.js';
import { ReferenceModule } from './reference/reference.module.js';
import { AvailabilityModule } from './availability/availability.module.js';
import { AppointmentsModule } from './appointments/appointments.module.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      // Middleware (not guard) so the CLS store exists before the global
      // JwtAuthGuard runs and writes the auth context into it.
      middleware: {
        mount: true,
        generateId: true,
        idGenerator: (req: FastifyRequest & { requestId?: string }) =>
          req?.requestId ?? randomUUID(),
      },
    }),
    DatabaseModule,
    CommonModule,
    AuthModule,
    HealthModule,
    ReferenceModule,
    AvailabilityModule,
    AppointmentsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
