import { Select } from "./ui";
import { Button, Paper } from "@mui/material";
import { useEffect, useState, type FormEvent } from "react";
import type { CompanySummary } from "@hubday/contracts";
import {
  useAvailability,
  useCreateAppointment,
  useCustomers,
  useProfessionals,
  useServices,
} from "../api/hooks";
import { ApiClientError } from "../lib/api";
import { bookingFormSchema, fieldErrors } from "../lib/forms";
import { todayInTimezone, formatDateTime } from "../lib/format";
import { SlotPicker } from "./SlotPicker";
import { AvailabilityCalendar } from "./AvailabilityCalendar";
import {
  Banner,
  Field,
  Spinner,
  describeError,
} from "./ui";

type Feedback =
  | { kind: "success"; message: string }
  | { kind: "conflict"; message: string }
  | { kind: "error"; message: string };

export function BookingForm({ company }: { company: CompanySummary }) {
  const professionals = useProfessionals();
  const services = useServices();
  const customers = useCustomers();
  const create = useCreateAppointment();

  const [step, setStep] = useState(0);
  const [chosenProfessional, setProfessionalId] = useState("");
  const professionalId = chosenProfessional || professionals.data?.[0]?.id || "";
  const [chosenService, setServiceId] = useState("");
  const serviceId = chosenService || services.data?.[0]?.id || "";
  const [customerId, setCustomerId] = useState("");
  const [date, setDate] = useState(() => todayInTimezone(company.timezone));
  const [slot, setSlot] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const availability = useAvailability({ professionalId, serviceId, date });
  const availabilityEnabled = Boolean(professionalId && serviceId && date);

  // A slot only makes sense for the current professional/service/date triple.
  useEffect(() => {
    setSlot(null);
  }, [professionalId, serviceId, date]);

  const refDataError =
    professionals.error ?? services.error ?? customers.error ?? null;
  const refDataLoading =
    professionals.isPending || services.isPending || customers.isPending;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFeedback(null);

    const candidate = {
      professionalId,
      serviceId,
      customerId,
      date,
      startsAt: slot ?? "",
    };
    const parsed = bookingFormSchema.safeParse(candidate);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});

    create.mutate(
      {
        professionalId,
        serviceId,
        customerId,
        startsAt: parsed.data.startsAt,
      },
      {
        onSuccess: (appt) => {
          setSlot(null);
          setFeedback({
            kind: "success",
            message: `Agendado: ${appt.serviceName}, ${appt.professionalName}, ${appt.customerName}, ${formatDateTime(
              appt.startsAt,
              company.timezone,
            )}.`,
          });
        },
        onError: (err) => {
          if (
            err instanceof ApiClientError &&
            err.code === "APPOINTMENT_CONFLICT"
          ) {
            setSlot(null);
            void availability.refetch();
            setFeedback({
              kind: "conflict",
              message:
                "Esse horário acabou de ser ocupado. Selecione outro horário.",
            });
            return;
          }
          setFeedback({ kind: "error", message: describeError(err) });
        },
      },
    );
  }

  return (
    <Paper component="section" variant="outlined" aria-labelledby="booking-heading" className="flow-panel">
      <h2 id="booking-heading" className="text-lg font-semibold text-brand-ink">
        {step === 0 ? "Calendário" : "Novo agendamento"}
      </h2>

      {refDataError && (
        <Banner kind="error" title="Não foi possível carregar as opções">
          {describeError(refDataError)}
        </Banner>
      )}

      {feedback && (
        <Banner
          kind={feedback.kind}
          title={
            feedback.kind === "success"
              ? "Agendamento confirmado"
              : feedback.kind === "conflict"
                ? "Horário indisponível"
                : "Não foi possível agendar"
          }
          onDismiss={() => setFeedback(null)}
        >
          {feedback.message}
        </Banner>
      )}

      <form onSubmit={(event) => { if (step === 1) onSubmit(event); else event.preventDefault(); }} noValidate className="flow-body">
        {feedback ? <div className="flow-actions"><Button type="button" variant="contained" onClick={() => { if (feedback.kind === "success") setStep(0); setFeedback(null); }}>{feedback.kind === "success" ? "Novo agendamento" : "Escolher outro horário"}</Button></div> : <>
        {step === 0 && <div className="calendar-filters">
        <Field label="Profissional" htmlFor="professionalId" error={errors.professionalId}>
          <Select
            id="professionalId"
            value={professionalId}
            disabled={refDataLoading}
            aria-invalid={Boolean(errors.professionalId)}
            aria-describedby={errors.professionalId ? "professionalId-error" : undefined}
            onChange={(e) => setProfessionalId(e.target.value)}
          >
            <option value="">Selecione um profissional…</option>
            {professionals.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Serviço" htmlFor="serviceId" error={errors.serviceId}>
          <Select
            id="serviceId"
            value={serviceId}
            disabled={refDataLoading}
            aria-invalid={Boolean(errors.serviceId)}
            aria-describedby={errors.serviceId ? "serviceId-error" : undefined}
            onChange={(e) => setServiceId(e.target.value)}
          >
            <option value="">Selecione um serviço…</option>
            {services.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.durationMinutes} min)
              </option>
            ))}
          </Select>
        </Field>



        </div>}

        {step === 0 &&

        <AvailabilityCalendar
          professionalId={professionalId}
          serviceId={serviceId}
          timezone={company.timezone}
          value={date}
          onChange={(nextDate) => { setDate(nextDate); setSlot(null); setStep(1); }}
          disabled={create.isPending}
        />}

        {step === 1 && <div className="slot-stage">
        <Field label="Cliente" htmlFor="customerId" error={errors.customerId}>
          <Select
            id="customerId"
            value={customerId}
            disabled={refDataLoading}
            aria-invalid={Boolean(errors.customerId)}
            aria-describedby={errors.customerId ? "customerId-error" : undefined}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">Selecione um cliente…</option>
            {customers.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.email ? ` — ${c.email}` : ""}
              </option>
            ))}
          </Select>
        </Field>
          <p className="text-sm font-medium">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))}</p>

          {refDataLoading ? (
            <Spinner label="Carregando opções…" />
          ) : (
            <SlotPicker
              query={availability}
              enabled={availabilityEnabled}
              timezone={company.timezone}
              value={slot}
              onChange={setSlot}
              disabled={create.isPending}
            />
          )}
          {errors.startsAt && (
            <p className="text-xs font-medium text-red-600">{errors.startsAt}</p>
          )}
        </div>}

        {step === 1 && <div className="flow-actions">
        <Button type="button" disabled={create.isPending} onClick={() => { setStep(step - 1); setFeedback(null); }}>Voltar ao calendário</Button>
        <Button
          type="submit" variant="contained"
          disabled={create.isPending || !customerId || !slot || availability.isFetching || !availability.data?.slots.some((item) => item.startsAt === slot)}
        >
          {create.isPending ? "Agendando…" : "Confirmar agendamento"}
        </Button>
        </div>}
        </>}
      </form>
    </Paper>
  );
}
