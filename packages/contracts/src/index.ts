import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

/** UTC ISO-8601 instant. `Z` only — offsets are rejected (ADR 004). */
export const isoDateTime = z.string().datetime();

/** Calendar date `YYYY-MM-DD`, interpreted in the Company timezone. */
export const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected date in YYYY-MM-DD format");

export const uuid = z.string().uuid();

/** IANA timezone name, loosely validated (`Area/Location`). */
export const ianaTimezone = z
  .string()
  .regex(/^[A-Za-z]+\/[A-Za-z0-9_+\-/]+$/, "Expected an IANA timezone name");

/* ------------------------------------------------------------------ */
/* Error contract (ADR 005)                                            */
/* ------------------------------------------------------------------ */

export const errorCode = z.enum([
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "SESSION_EXPIRED",
  "FORBIDDEN",
  "NOT_FOUND",
  "APPOINTMENT_CONFLICT",
  "OUTSIDE_AVAILABILITY",
  "APPOINTMENT_IN_PAST",
  "INVALID_STATE_TRANSITION",
  "CROSS_TENANT_REFERENCE",
  "DURATION_MISMATCH",
  "INTERNAL",
]);
export type ErrorCode = z.infer<typeof errorCode>;

export const apiErrorDetail = z.object({
  path: z.string(),
  message: z.string(),
});
export type ApiErrorDetail = z.infer<typeof apiErrorDetail>;

export const apiError = z.object({
  code: errorCode,
  message: z.string(),
  statusCode: z.number().int(),
  requestId: z.string(),
  details: z.array(apiErrorDetail).optional(),
});
export type ApiError = z.infer<typeof apiError>;

/* ------------------------------------------------------------------ */
/* Domain enums                                                        */
/* ------------------------------------------------------------------ */

export const appointmentStatus = z.enum(["scheduled", "cancelled", "completed"]);
export type AppointmentStatus = z.infer<typeof appointmentStatus>;

export const userRole = z.enum(["owner", "staff", "viewer"]);
export type UserRole = z.infer<typeof userRole>;

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export const loginRequest = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
  })
  .strict();
export type LoginRequest = z.infer<typeof loginRequest>;

export const companySummary = z.object({
  id: uuid,
  name: z.string(),
  timezone: ianaTimezone,
});
export type CompanySummary = z.infer<typeof companySummary>;

export const loginResponse = z.object({
  token: z.string(),
  expiresAt: isoDateTime,
  user: z.object({ id: uuid, email: z.string().email(), role: userRole }),
  company: companySummary,
});
export type LoginResponse = z.infer<typeof loginResponse>;

/* ------------------------------------------------------------------ */
/* Reference data (for populating forms)                               */
/* ------------------------------------------------------------------ */

export const professional = z.object({ id: uuid, name: z.string() });
export const service = z.object({
  id: uuid,
  name: z.string(),
  durationMinutes: z.number().int().positive(),
});
export const customer = z.object({
  id: uuid,
  name: z.string(),
  email: z.string().email().nullable(),
});
export type Professional = z.infer<typeof professional>;
export type Service = z.infer<typeof service>;
export type Customer = z.infer<typeof customer>;

/* ------------------------------------------------------------------ */
/* Availability (ADR 011)                                              */
/* ------------------------------------------------------------------ */

export const availabilityQuery = z
  .object({
    professionalId: uuid,
    serviceId: uuid,
    date: dateOnly,
  })
  .strict();
export type AvailabilityQuery = z.infer<typeof availabilityQuery>;

export const slot = z.object({
  startsAt: isoDateTime,
  endsAt: isoDateTime,
});
export type Slot = z.infer<typeof slot>;

export const availabilityResponse = z.object({
  date: dateOnly,
  timezone: ianaTimezone,
  serviceDurationMinutes: z.number().int().positive(),
  slots: z.array(slot),
});
export type AvailabilityResponse = z.infer<typeof availabilityResponse>;

/* ------------------------------------------------------------------ */
/* Appointments (ADR 006 / 011)                                        */
/* ------------------------------------------------------------------ */

export const createAppointmentRequest = z
  .object({
    professionalId: uuid,
    serviceId: uuid,
    customerId: uuid,
    startsAt: isoDateTime,
  })
  .strict();
export type CreateAppointmentRequest = z.infer<typeof createAppointmentRequest>;

export const rescheduleAppointmentRequest = z
  .object({
    startsAt: isoDateTime,
  })
  .strict();
export type RescheduleAppointmentRequest = z.infer<
  typeof rescheduleAppointmentRequest
>;

export const appointment = z.object({
  id: uuid,
  professionalId: uuid,
  professionalName: z.string(),
  serviceId: uuid,
  serviceName: z.string(),
  serviceDurationMinutes: z.number().int().positive(),
  customerId: uuid,
  customerName: z.string(),
  startsAt: isoDateTime,
  endsAt: isoDateTime,
  status: appointmentStatus,
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type Appointment = z.infer<typeof appointment>;

export const listAppointmentsQuery = z
  .object({
    status: appointmentStatus.optional(),
    professionalId: uuid.optional(),
    from: isoDateTime.optional(),
    to: isoDateTime.optional(),
  })
  .strict();
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuery>;

export const listAppointmentsResponse = z.object({
  appointments: z.array(appointment),
});
export type ListAppointmentsResponse = z.infer<typeof listAppointmentsResponse>;
