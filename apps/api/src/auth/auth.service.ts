import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import type { LoginRequest, LoginResponse } from '@hubday/contracts';
import { DRIZZLE } from '../database/database.module.js';
import type { Database } from '../db/client.js';
import { companies, users } from '../schema/index.js';
import { DomainError } from '../common/domain-error.js';
import { AUTH_TOKEN_TTL_SECONDS } from '../config/env.js';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly jwt: JwtService,
  ) {}

  async login(input: LoginRequest): Promise<LoginResponse> {
    // Pre-auth lookup: unscoped by design, the token does not exist yet.
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);

    const invalid = DomainError.unauthenticated('Invalid email or password');
    if (!user) {
      // Compare against a throwaway hash to blunt timing differences.
      await bcrypt.compare(input.password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin');
      throw invalid;
    }

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw invalid;

    const [company] = await this.db
      .select()
      .from(companies)
      .where(eq(companies.id, user.companyId))
      .limit(1);
    if (!company) throw invalid;

    const token = await this.jwt.signAsync({
      sub: user.id,
      companyId: user.companyId,
      role: user.role,
    });
    const expiresAt = new Date(Date.now() + AUTH_TOKEN_TTL_SECONDS * 1000).toISOString();

    return {
      token,
      expiresAt,
      user: { id: user.id, email: user.email, role: user.role },
      company: { id: company.id, name: company.name, timezone: company.timezone },
    };
  }
}
