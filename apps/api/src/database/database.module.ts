import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { createDbClient, resolveDatabaseUrl, type Database } from '../db/client.js';

export const DB_CLIENT = 'HUBDAY_DB_CLIENT';
export const DRIZZLE = 'HUBDAY_DRIZZLE';

type DbClient = ReturnType<typeof createDbClient>;

const clientProvider = {
  provide: DB_CLIENT,
  useFactory: (): DbClient => createDbClient(resolveDatabaseUrl()),
};

const drizzleProvider = {
  provide: DRIZZLE,
  useFactory: (client: DbClient): Database => client.db,
  inject: [DB_CLIENT],
};

/**
 * Global provider for the Drizzle client (ADR 007). Importing src/db/client.js
 * does not open a connection; the factory does. Tests override DB_CLIENT (or set
 * DATABASE_URL to the test URL before creating the module).
 */
@Global()
@Module({
  providers: [clientProvider, drizzleProvider],
  exports: [DRIZZLE, DB_CLIENT],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject(DB_CLIENT) private readonly client: DbClient) {}

  async onModuleDestroy(): Promise<void> {
    await this.client.sql.end({ timeout: 5 });
  }
}
