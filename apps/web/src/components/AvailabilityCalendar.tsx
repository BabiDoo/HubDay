import { Button, Paper } from "@mui/material";
import { useEffect, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { availabilityResponse } from "@hubday/contracts";
import { apiFetch, qs } from "../lib/api";
import { todayInTimezone } from "../lib/format";

export function AvailabilityCalendar({ professionalId, serviceId, timezone, value, onChange, disabled = false }: {
  professionalId: string;
  serviceId: string;
  timezone: string;
  value: string;
  onChange: (date: string) => void;
  disabled?: boolean;
}) {
  const today = todayInTimezone(timezone);
  const [month, setMonth] = useState(() => (value || today).slice(0, 7));
  useEffect(() => { if (value) setMonth(value.slice(0, 7)); }, [value]);
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  const firstDay = new Date(Date.UTC(year, monthNumber - 1, 1));
  const days = Array.from({ length: new Date(Date.UTC(year, monthNumber, 0)).getUTCDate() },
    (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
  const enabled = Boolean(professionalId && serviceId);
  const queries = useQueries({ queries: days.map((date) => ({
    queryKey: ["availability", professionalId, serviceId, date],
    enabled: enabled && date >= today,
    staleTime: 30_000,
    queryFn: ({ signal }: { signal: AbortSignal }) => apiFetch(
      `/availability${qs({ professionalId, serviceId, date })}`,
      { schema: availabilityResponse, signal },
    ),
  })) });
  const loading = queries.some((q) => q.isFetching);
  const failed = queries.some((q, i) => (days[i] ?? "") >= today && q.isError);
  const hasOpenDay = queries.some((q, i) => (days[i] ?? "") >= today && !q.isError && (q.data?.slots.length ?? 0) > 0);
  function moveMonth(offset: number) {
    setMonth(new Date(Date.UTC(year, monthNumber - 1 + offset, 1)).toISOString().slice(0, 7));
  }

  return (
    <Paper component="section" variant="outlined" aria-label="Calendário de disponibilidade" title={`Fuso horário: ${timezone}`} className="availability-calendar">
      <div className="flex items-center justify-between gap-2">
        <Button type="button" aria-label="Mês anterior" disabled={disabled} onClick={() => moveMonth(-1)} className="rounded px-3 py-2 hover:bg-brand-surface disabled:opacity-30">←</Button>
        <span className="font-semibold text-brand-ink" aria-live="polite">
          {new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(firstDay)}
        </span>
        <Button type="button" aria-label="Próximo mês" disabled={disabled} onClick={() => moveMonth(1)} className="rounded px-3 py-2 hover:bg-brand-surface disabled:opacity-30">→</Button>
      </div>
      <div className="calendar-grid">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => <span key={day} className="py-1 text-xs text-brand-muted">{day}</span>)}
        {Array.from({ length: firstDay.getUTCDay() }, (_, i) => <span key={`empty-${i}`} />)}
        {days.map((date, i) => {
          const query = queries[i]!;
          const past = date < today;
          const available = !past && !query.isError && (query.data?.slots.length ?? 0) > 0;
          const unavailable = !past && enabled && query.isSuccess && !available;
          const status = past ? "Data passada" : !enabled ? "Selecione profissional e serviço" : query.isError ? "Falha na consulta" : query.isPending ? "Carregando" : available ? "Disponível" : "Sem horários disponíveis";
          return <Button key={date} type="button" aria-label={`${date}: ${status}`} data-availability={available ? "available" : unavailable ? "unavailable" : "unknown"} aria-pressed={value === date} aria-current={date === today ? "date" : undefined}
            disabled={disabled} onClick={() => onChange(date)}
            variant="text"
            sx={{ minWidth: 0, minHeight: 0, height: "100%", p: 0.5, display: "flex", flexDirection: "column", borderRadius: "10px",
              bgcolor: value === date ? "primary.dark" : available ? "success.light" : unavailable ? "#ffdfb5" : "transparent",
              color: value === date ? "#fff" : available ? "success.dark" : unavailable ? "#874000" : "text.secondary",
              border: "1px solid", borderColor: value === date || date === today ? "primary.main" : "transparent",
              boxShadow: value === date ? "inset 0 0 0 1px #68378d" : "none",
              "&:hover": { bgcolor: value === date ? "primary.dark" : available ? "#ddc6f4" : unavailable ? "#ffca89" : "action.hover" },
            }}>
            {i + 1}<span className="block h-2 text-[8px] leading-none" aria-hidden="true">{available ? "●" : ""}</span>
          </Button>;
        })}
      </div>
      <p className="calendar-legend text-xs text-brand-muted">Roxo: disponível · Laranja: sem vagas</p>
      <div aria-live="polite" className="calendar-status text-xs text-brand-muted">
        {!enabled ? "Selecione profissional e serviço para consultar as datas." : loading ? "Consultando datas…" : failed ? "Não foi possível consultar algumas datas." : !hasOpenDay ? "Sem vagas neste mês. Consulte outro mês." : "Selecione uma data para consultar os horários."}
      </div>
      {failed && <Button type="button" disabled={disabled || loading} className="text-sm font-medium text-brand-dark underline" onClick={() => { queries.forEach((q, i) => { if ((days[i] ?? "") >= today && q.isError) void q.refetch(); }); }}>Tentar novamente</Button>}
    </Paper>
  );
}

