import { useState } from "react";
import { Button, Paper, Tabs, Tab, Chip, TextField } from "@mui/material";
import type { Appointment, AppointmentStatus, CompanySummary } from "@hubday/contracts";
import { useAppointments, useAvailability, useCancelAppointment, useRescheduleAppointment } from "../api/hooks";
import { formatDateTime, todayInTimezone } from "../lib/format";
import { SlotPicker } from "./SlotPicker";
import { AvailabilityCalendar } from "./AvailabilityCalendar";
import { Banner, Spinner, describeError } from "./ui";

type Feedback = { kind: "success" | "error"; message: string };
const statusNames = { scheduled: "Agendado", cancelled: "Cancelado", completed: "Concluído" };

export function AppointmentsPanel({ company }: { company: CompanySummary }) {
  const [status, setStatus] = useState<AppointmentStatus | undefined>("scheduled");
  const [dateFilter, setDateFilter] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const appointments = useAppointments(status);
  const cancel = useCancelAppointment();
  const items = (appointments.data ?? []).filter((item) => !dateFilter || new Intl.DateTimeFormat("en-CA", { timeZone: company.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(item.startsAt)) === dateFilter);
  const currentPage = Math.min(page, Math.max(0, items.length - 1));
  const appt = items[currentPage];

  return (
    <Paper component="section" variant="outlined" aria-labelledby="appointments-heading" className="flow-panel">
      <header className="appointments-header">
      <h2 id="appointments-heading" className="text-lg font-semibold">{editing ? "Reagendar atendimento" : "Agendamentos"}</h2>
      {!editing && <div className="date-filter"><TextField label="Data" type="date" size="small" value={dateFilter} onChange={(event) => { setDateFilter(event.target.value); setPage(0); setFeedback(null); }} slotProps={{ inputLabel: { shrink: true }, htmlInput: { "aria-label": "Filtrar por data" } }} />
      {dateFilter && <Button size="small" aria-label="Limpar filtro de data" onClick={() => { setDateFilter(""); setPage(0); }}>Limpar</Button>}</div>}
      </header>
      {feedback && <Banner kind={feedback.kind} onDismiss={() => setFeedback(null)}>{feedback.message}</Banner>}
      {feedback ? <div className="flow-actions"><Button onClick={() => setFeedback(null)}>{editing ? "Escolher outro horário" : "Voltar aos agendamentos"}</Button></div> : editing ? <RescheduleForm key={editing.id} appt={editing} company={company} onDone={() => setEditing(null)} onFeedback={setFeedback} /> : <>
        <Tabs value={status ?? "all"} onChange={(_, next) => { setStatus(next === "all" ? undefined : next); setPage(0); setFeedback(null); }} aria-label="Filtrar por situação" variant="fullWidth">
          <Tab label="Agendados" value="scheduled" />
          <Tab label="Cancelados" value="cancelled" />
          <Tab label="Todos" value="all" />
        </Tabs>
        <div className="flow-body">
          {appointments.isPending ? <Spinner label="Carregando agendamentos…" /> : appointments.isError ? <Banner kind="error">{describeError(appointments.error)}</Banner> : !appt ? <Banner kind="info" title="Nenhum agendamento">{dateFilter ? "Não há agendamentos para esta data. Altere ou limpe o filtro." : "Use a aba Agendar para criar um atendimento."}</Banner> : <>
            <Paper component="article" variant="outlined" className="appointment-card" aria-label="Detalhes do agendamento">
              <Chip size="small" label={statusNames[appt.status]} color={appt.status === "scheduled" ? "primary" : "default"} />
              <h3 className="font-semibold">{appt.serviceName}</h3>
              <p>Profissional: {appt.professionalName}</p>
              <p>Cliente: {appt.customerName}</p>
              <p className="text-sm text-brand-muted">{formatDateTime(appt.startsAt, company.timezone)}</p>
              {appt.status === "scheduled" && <div className="flex gap-2">
                <Button disabled={cancel.isPending} onClick={() => { setEditing(appt); setFeedback(null); }}>Reagendar</Button>
                <Button disabled={cancel.isPending} onClick={() => cancel.mutate({ id: appt.id }, {
                  onSuccess: () => setFeedback({ kind: "success", message: "Agendamento cancelado. O horário está disponível novamente." }),
                  onError: (err) => setFeedback({ kind: "error", message: describeError(err) }),
                })}>{cancel.isPending ? "Cancelando…" : "Cancelar"}</Button>
              </div>}
            </Paper>
            <nav className="pager flow-actions" aria-label="Páginas de agendamentos">
              <Button disabled={currentPage === 0 || cancel.isPending} onClick={() => { setPage(currentPage - 1); setFeedback(null); }}>Anterior</Button>
              <span aria-live="polite">{currentPage + 1} de {items.length}</span>
              <Button disabled={currentPage === items.length - 1 || cancel.isPending} onClick={() => { setPage(currentPage + 1); setFeedback(null); }}>Próximo</Button>
            </nav>
          </>}
        </div>
      </>}
    </Paper>
  );
}

function RescheduleForm({ appt, company, onDone, onFeedback }: {
  appt: Appointment; company: CompanySummary; onDone: () => void; onFeedback: (feedback: Feedback) => void;
}) {
  const [step, setStep] = useState(0);
  const [date, setDate] = useState(() => todayInTimezone(company.timezone));
  const [slot, setSlot] = useState<string | null>(null);
  const reschedule = useRescheduleAppointment();
  const availability = useAvailability({ professionalId: appt.professionalId, serviceId: appt.serviceId, date });
  function submit() {
    if (!slot) return;
    reschedule.mutate({ id: appt.id, startsAt: slot }, {
      onSuccess: (updated) => { onFeedback({ kind: "success", message: `Reagendado para ${formatDateTime(updated.startsAt, company.timezone)}.` }); onDone(); },
      onError: (err) => { setSlot(null); onFeedback({ kind: "error", message: describeError(err) }); },
    });
  }
  return <div className="flow-body">
    <p className="flow-caption">Etapa {step + 1} de 2 · {step === 0 ? "Escolha a data" : "Escolha o horário"}</p>
    {step === 0 ? <AvailabilityCalendar professionalId={appt.professionalId} serviceId={appt.serviceId} timezone={company.timezone} value={date}
      onChange={(next) => { setDate(next); setSlot(null); setStep(1); }} disabled={reschedule.isPending} /> : <div className="slot-stage">
      <p className="text-sm">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))}</p>
      <SlotPicker key={date} query={availability} enabled timezone={company.timezone} value={slot} onChange={setSlot} disabled={reschedule.isPending} />
    </div>}
    <div className="flow-actions">
      <Button disabled={reschedule.isPending} onClick={() => step === 0 ? onDone() : setStep(0)}>{step === 0 ? "Voltar à lista" : "Voltar"}</Button>
      {step === 1 && <Button variant="contained" disabled={reschedule.isPending || !slot || availability.isFetching || !availability.data?.slots.some((item) => item.startsAt === slot)} onClick={submit}>{reschedule.isPending ? "Salvando…" : "Confirmar novo horário"}</Button>}
    </div>
  </div>;
}
