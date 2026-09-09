import type { ApiErrorDetail, ErrorCode } from '@hubday/contracts';

/**
 * The single exception type the API throws for expected conditions. The global
 * filter serialises it into the ADR 005 error body. `code` is one of the shared
 * `@hubday/contracts` error codes; `statusCode` is the HTTP status.
 */
export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly statusCode: number,
    message: string,
    readonly details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = 'DomainError';
  }

  static notFound(what = 'Resource'): DomainError {
    return new DomainError('NOT_FOUND', 404, `${what} not found`);
  }

  static unauthenticated(message = 'Authentication required'): DomainError {
    return new DomainError('UNAUTHENTICATED', 401, message);
  }

  static sessionExpired(): DomainError {
    return new DomainError('SESSION_EXPIRED', 401, 'Session expired, sign in again');
  }
}
