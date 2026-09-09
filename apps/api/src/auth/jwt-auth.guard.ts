import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import { ClsService } from 'nestjs-cls';
import type { FastifyRequest } from 'fastify';
import { DomainError } from '../common/domain-error.js';
import { IS_PUBLIC_KEY } from '../common/public.decorator.js';
import { CLS_AUTH_KEY, type AuthContext } from '../common/tenant-context.service.js';

interface JwtClaims {
  sub: string;
  companyId: string;
  role: AuthContext['role'];
}

/**
 * Global guard (ADR 002). Verifies the bearer token, then writes
 * `{ userId, companyId, role }` into CLS for TenantContext. Runs after the
 * nestjs-cls guard so the store exists.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly cls: ClsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const header = request.headers['authorization'];
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
      throw DomainError.unauthenticated('Missing bearer token');
    }
    const token = header.slice('Bearer '.length).trim();

    let claims: JwtClaims;
    try {
      claims = this.jwt.verify<JwtClaims>(token);
    } catch (err) {
      if (err instanceof TokenExpiredError) throw DomainError.sessionExpired();
      throw DomainError.unauthenticated('Invalid token');
    }

    if (!claims.sub || !claims.companyId || !claims.role) {
      throw DomainError.unauthenticated('Malformed token');
    }

    const auth: AuthContext = {
      userId: claims.sub,
      companyId: claims.companyId,
      role: claims.role,
    };
    this.cls.set(CLS_AUTH_KEY, auth);
    return true;
  }
}
