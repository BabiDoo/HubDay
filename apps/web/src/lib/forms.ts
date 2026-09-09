import { z } from "zod";

/** Collapse a ZodError into a `{ fieldName: firstMessage }` map. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (key != null && !(String(key) in out)) {
      out[String(key)] = issue.message;
    }
  }
  return out;
}

export const bookingFormSchema = z.object({
  professionalId: z.string().uuid("Selecione um profissional"),
  serviceId: z.string().uuid("Selecione um serviço"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Selecione uma data"),
  customerId: z.string().uuid("Selecione um cliente"),
  startsAt: z
    .string()
    .datetime({ offset: true, message: "Selecione um horário disponível" }),
});

export const rescheduleFormSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Selecione uma data"),
  startsAt: z
    .string()
    .datetime({ offset: true, message: "Selecione um novo horário" }),
});
