import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { ZodValidationException, ZodSerializationException } from 'nestjs-zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ApiError, ApiErrorDetail, ErrorCode } from '@hubday/contracts';
import { DomainError } from './domain-error.js';

// Drizzle wraps driver errors (DrizzleQueryError) with the original PostgresError
// on `.cause`. Walk the cause chain to find a SQLSTATE-looking `code`.
function pgCode(err: unknown, depth = 0): string | undefined {
  if (!err || typeof err !== 'object' || depth > 5) return undefined;
  const code = (err as { code?: unknown }).code;
  if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
  return pgCode((err as { cause?: unknown }).cause, depth + 1);
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('AllExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest & { requestId?: string }>();
    const requestId = request?.requestId ?? 'unknown';

    const { code, statusCode, message, details } = this.resolve(exception);

    if (statusCode >= 500) {
      this.logger.error(
        `[${requestId}] ${code} ${statusCode}: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body: ApiError = { code, message, statusCode, requestId };
    if (details && details.length > 0) body.details = details;

    void response.status(statusCode).send(body);
  }

  private resolve(exception: unknown): {
    code: ErrorCode;
    statusCode: number;
    message: string;
    details?: ApiErrorDetail[];
  } {
    if (exception instanceof DomainError) {
      return {
        code: exception.code,
        statusCode: exception.statusCode,
        message: exception.message,
        details: exception.details,
      };
    }

    if (exception instanceof ZodValidationException) {
      const zerr = exception.getZodError() as {
        issues: Array<{ path: Array<string | number>; message: string }>;
      };
      const details: ApiErrorDetail[] = zerr.issues.map((i) => ({
        path: i.path.join('.') || '(root)',
        message: i.message,
      }));
      return {
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        message: 'Request validation failed',
        details,
      };
    }

    if (exception instanceof ZodSerializationException) {
      return { code: 'INTERNAL', statusCode: 500, message: 'Internal server error' };
    }

    const pg = pgCode(exception);
    if (pg === '23P01') {
      return {
        code: 'APPOINTMENT_CONFLICT',
        statusCode: 409,
        message: 'That time slot is no longer available',
      };
    }
    if (pg === '23503') {
      return {
        code: 'CROSS_TENANT_REFERENCE',
        statusCode: 422,
        message: 'Referenced entity does not belong to your company',
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const rawMessage =
        typeof res === 'string'
          ? res
          : ((res as { message?: unknown }).message ?? exception.message);
      const message = Array.isArray(rawMessage) ? rawMessage.join(', ') : String(rawMessage);
      return { code: this.mapStatus(status), statusCode: status, message };
    }

    return { code: 'INTERNAL', statusCode: 500, message: 'Internal server error' };
  }

  private mapStatus(status: number): ErrorCode {
    switch (status) {
      case 400:
        return 'VALIDATION_ERROR';
      case 401:
        return 'UNAUTHENTICATED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'APPOINTMENT_CONFLICT';
      case 422:
        return 'INVALID_STATE_TRANSITION';
      default:
        return status >= 500 ? 'INTERNAL' : 'VALIDATION_ERROR';
    }
  }
}
