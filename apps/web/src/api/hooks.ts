import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  appointment,
  availabilityResponse,
  customer,
  listAppointmentsResponse,
  professional,
  service,
  type Appointment,
  type AppointmentStatus,
  type AvailabilityResponse,
  type Customer,
  type Professional,
  type Service,
} from "@hubday/contracts";
import { apiFetch, ApiClientError, qs, z } from "../lib/api";

/* ------------------------------------------------------------------ */
/* Reference data                                                     */
/* ------------------------------------------------------------------ */

export function useProfessionals(): UseQueryResult<Professional[], Error> {
  return useQuery({
    queryKey: ["professionals"],
    queryFn: ({ signal }) =>
      apiFetch("/professionals", { schema: z.array(professional), signal }),
  });
}

export function useServices(): UseQueryResult<Service[], Error> {
  return useQuery({
    queryKey: ["services"],
    queryFn: ({ signal }) =>
      apiFetch("/services", { schema: z.array(service), signal }),
  });
}

export function useCustomers(): UseQueryResult<Customer[], Error> {
  return useQuery({
    queryKey: ["customers"],
    queryFn: ({ signal }) =>
      apiFetch("/customers", { schema: z.array(customer), signal }),
  });
}

/* ------------------------------------------------------------------ */
/* Availability                                                       */
/* ------------------------------------------------------------------ */

export interface AvailabilityArgs {
  professionalId?: string;
  serviceId?: string;
  date?: string;
}

export function useAvailability(
  args: AvailabilityArgs,
): UseQueryResult<AvailabilityResponse, Error> {
  const enabled = Boolean(args.professionalId && args.serviceId && args.date);
  return useQuery({
    queryKey: ["availability", args.professionalId, args.serviceId, args.date],
    enabled,
    queryFn: ({ signal }) =>
      apiFetch(
        `/availability${qs({
          professionalId: args.professionalId,
          serviceId: args.serviceId,
          date: args.date,
        })}`,
        { schema: availabilityResponse, signal },
      ),
  });
}

/* ------------------------------------------------------------------ */
/* Appointments                                                       */
/* ------------------------------------------------------------------ */

export function useAppointments(
  status?: AppointmentStatus,
): UseQueryResult<Appointment[], Error> {
  return useQuery({
    queryKey: ["appointments", status ?? "all"],
    queryFn: ({ signal }) =>
      apiFetch(`/appointments${qs({ status })}`, {
        schema: listAppointmentsResponse,
        signal,
      }).then((r) => r.appointments),
  });
}

function invalidateSchedule(qc: ReturnType<typeof useQueryClient>): void {
  void qc.invalidateQueries({ queryKey: ["appointments"] });
  void qc.invalidateQueries({ queryKey: ["availability"] });
}

export function useCreateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      professionalId: string;
      serviceId: string;
      customerId: string;
      startsAt: string;
    }) => apiFetch("/appointments", { method: "POST", body, schema: appointment }),
    onSuccess: () => invalidateSchedule(qc),
    onError: (err) => {
      if (err instanceof ApiClientError && err.code === "APPOINTMENT_CONFLICT") {
        void qc.invalidateQueries({ queryKey: ["availability"] });
      }
    },
  });
}

export function useRescheduleAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, startsAt }: { id: string; startsAt: string }) =>
      apiFetch(`/appointments/${id}`, {
        method: "PATCH",
        body: { startsAt },
        schema: appointment,
      }),
    onSuccess: () => invalidateSchedule(qc),
    onError: (err) => {
      if (err instanceof ApiClientError && err.code === "APPOINTMENT_CONFLICT") {
        void qc.invalidateQueries({ queryKey: ["availability"] });
      }
    },
  });
}

export function useCancelAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) =>
      apiFetch(`/appointments/${id}/cancel`, {
        method: "POST",
        schema: appointment,
      }),
    onSuccess: () => invalidateSchedule(qc),
  });
}
