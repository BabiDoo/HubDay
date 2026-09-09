import { z, type ZodType } from "zod";
import {
  apiError,
  type ApiError,
  type ApiErrorDetail,
  type ErrorCode,
} from "@hubday/contracts";
import { API_URL } from "./env";

/**
 * Typed error thrown by {@link apiFetch} for every non-2xx response (and for
 * network failures). Carries the parsed ADR-005 error body.
 */
export class ApiClientError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly requestId: string;
  readonly details?: ApiErrorDetail[];

  constructor(
    readonly payload: ApiError,
    readonly httpStatus: number,
  ) {
    super(payload.message);
    this.name = "ApiClientError";
    this.code = payload.code;
    this.statusCode = payload.statusCode;
    this.requestId = payload.requestId;
    this.details = payload.details;
  }
}

/** True for errors the UI must not silently retry. */
export function isTerminalApiError(err: unknown): err is ApiClientError {
  return (
    err instanceof ApiClientError &&
    [400, 401, 403, 404, 409, 422].includes(err.httpStatus)
  );
}

/* ------------------------------------------------------------------ */
/* Auth token + 401 handling (wired by the AuthProvider)              */
/* ------------------------------------------------------------------ */

let authToken: string | null = null;
export function setAuthToken(token: string | null): void {
  authToken = token;
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

/* ------------------------------------------------------------------ */
/* Fetch client                                                       */
/* ------------------------------------------------------------------ */

interface RequestOptions<T> {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  schema: ZodType<T>;
  signal?: AbortSignal;
}

export async function apiFetch<T>(
  path: string,
  opts: RequestOptions<T>,
): Promise<T> {
  const hasBody = opts.body !== undefined;
  const headers: Record<string, string> = {};
  // Only declare a JSON content-type when a body is actually sent. Fastify
  // rejects an empty payload that carries `Content-Type: application/json`
  // ("Body cannot be empty…"), which broke the bodyless POST cancel call.
  if (hasBody) headers["Content-Type"] = "application/json";
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: hasBody ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch {
    throw new ApiClientError(
      {
        code: "INTERNAL",
        message: "Não foi possível conectar ao servidor.",
        statusCode: 0,
        requestId: "",
      },
      0,
    );
  }

  const raw = await res.text();
  let json: unknown;
  try {
    json = raw ? JSON.parse(raw) : undefined;
  } catch {
    json = undefined;
  }

  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/auth/login")) {
      onUnauthorized?.();
    }
    const parsed = apiError.safeParse(json);
    const payload: ApiError = parsed.success
      ? parsed.data
      : {
          code: "INTERNAL",
          message:
            res.status >= 500
              ? "Não foi possível processar a solicitação."
              : `Falha na solicitação (HTTP ${res.status}).`,
          statusCode: res.status,
          requestId: "",
        };
    throw new ApiClientError(payload, res.status);
  }

  return opts.schema.parse(json);
}

/** Small helper for building query strings without `undefined` entries. */
export function qs(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(
    (e): e is [string, string] => e[1] !== undefined && e[1] !== "",
  );
  return entries.length
    ? `?${new URLSearchParams(entries).toString()}`
    : "";
}

export { z };
