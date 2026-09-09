import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import { Public } from '../common/public.decorator.js';
import { DRIZZLE } from '../database/database.module.js';
import type { Database } from '../db/client.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness probe with a database round-trip' })
  async check(): Promise<{ status: 'ok'; db: 'up' }> {
    await this.db.execute(sql`select 1`);
    return { status: 'ok', db: 'up' };
  }
}
