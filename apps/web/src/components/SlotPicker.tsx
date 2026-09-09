import { useEffect, useRef, useState } from "react";
import { Button } from "@mui/material";
import type { UseQueryResult } from "@tanstack/react-query";
import type { AvailabilityResponse } from "@hubday/contracts";
import { formatTime } from "../lib/format";
import { Banner, Spinner, describeError } from "./ui";

export function SlotPicker({
  query,
  enabled,
  timezone,
  value,
  onChange,
  disabled,
}: {
  query: UseQueryResult<AvailabilityResponse, Error>;
  enabled: boolean;
  timezone: string;
  value: string | null;
  onChange: (startsAt: string) => void;
  disabled?: boolean;
}) {
  const [page, setPage] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ columns: 2, pageSize: 6 });
  const pageSize = layout.pageSize;
  const slotCount = query.data?.slots.length ?? 0;
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry || entry.contentRect.width === 0) return;
      const columns = Math.max(1, Math.min(4, Math.floor((entry.contentRect.width + 8) / 140)));
      const rows = Math.max(1, Math.floor((entry.contentRect.height - 48) / 64));
      setLayout({ columns, pageSize: columns * rows });
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [enabled, slotCount, query.isFetching]);
  if (!enabled) {
    return (
      <p className="text-sm text-brand-muted">
        Selecione profissional, serviço e data para consultar os horários.
      </p>
    );
  }

  if (query.isPending || query.isFetching) {
    return <Spinner label="Carregando horários…" />;
  }

  if (query.isError) {
    return (
      <Banner kind="error" title="Não foi possível consultar a disponibilidade">
        {describeError(query.error)}
      </Banner>
    );
  }

  const slots = query.data?.slots ?? [];
  if (slots.length === 0) {
    return (
      <Banner kind="info" title="Sem horários disponíveis">
        Não há horários nesta data. Selecione outro dia.
      </Banner>
    );
  }

  const pages = Math.ceil(slots.length / pageSize);
  const currentPage = Math.min(page, pages - 1);
  return (
    <div className="slot-picker" ref={container}>
    <div
      role="radiogroup"
      aria-label="Horários disponíveis"
      className="slot-grid" style={{ gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))` }}
    >
      {slots.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map((slot) => {
        const selected = value === slot.startsAt;
        return (
          <Button
            key={slot.startsAt}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(slot.startsAt)}
            variant={selected ? "contained" : "outlined"}
            sx={{ minWidth: 0, height: "100%", borderRadius: "12px", whiteSpace: "nowrap" }}
          >
            {formatTime(slot.startsAt, timezone)}
            {" – "}
            {formatTime(slot.endsAt, timezone)}
          </Button>
        );
      })}
    </div>
    {pages > 1 && <nav className="pager" aria-label="Páginas de horários">
      <Button type="button" disabled={disabled || currentPage === 0} onClick={() => setPage(currentPage - 1)}>Anteriores</Button>
      <span aria-live="polite">{currentPage + 1} de {pages}</span>
      <Button type="button" disabled={disabled || currentPage === pages - 1} onClick={() => setPage(currentPage + 1)}>Próximos</Button>
    </nav>}
    </div>
  );
}
