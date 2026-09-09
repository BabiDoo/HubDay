import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import type { UserRole } from '@hubday/contracts';
import { DomainError } from './domain-error.js';

export interface AuthContext {
  userId: string;
  companyId: string;
  role: UserRole;
}

export const CLS_AUTH_KEY = 'auth';

/**
 * Reads the trusted Company context (ADR 002 / EP03) out of the request-scoped
 * CLS store populated by JwtAuthGuard. `companyId` is NEVER taken from the body,
 * query, params, or a client header.
 */
@Injectable()
export class TenantContext {
  constructor(private readonly cls: ClsService) {}

  private get auth(): AuthContext {
    const auth = this.cls.get<AuthContext | undefined>(CLS_AUTH_KEY);
    if (!auth?.companyId) {
      throw DomainError.unauthenticated('No tenant context on this request');
    }
    return auth;
  }

  get companyId(): string {
    return this.auth.companyId;
  }

  get userId(): string {
    return this.auth.userId;
  }

  get role(): UserRole {
    return this.auth.role;
  }
}
