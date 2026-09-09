import { Brand } from "../components/Brand";
import { useState } from "react";
import { Button, Tabs, Tab } from "@mui/material";
import { useAuth } from "../auth/AuthContext";
import { BookingForm } from "../components/BookingForm";
import { AppointmentsPanel } from "../components/AppointmentsPanel";

export function SchedulePage() {
  const { session, logout } = useAuth();
  const [view, setView] = useState("book");
  if (!session) return null;
  const { company, user } = session;
  const roles = { owner: "Administrador", staff: "Colaborador", viewer: "Observador" };
  return (
    <main className="app-screen">
      <aside className="brand-sidebar" aria-label="Identidade do aplicativo"><Brand /><p>Seu tempo, bem organizado.</p><span className="sidebar-caption">AGENDAMENTOS</span></aside>
      <header className="app-header">
        <div className="min-w-0">
          <h1 className="font-bold text-lg truncate" title={company.name}>{company.name}</h1>
          <p className="account-info text-xs text-brand-muted truncate" title={`${user.email} · ${roles[user.role]}`}>
            {user.email} · {roles[user.role]}
          </p>
        </div>
        <Button onClick={logout}>Sair</Button>
      </header>
      <Tabs value={view} onChange={(_, next) => setView(next)} aria-label="Navegação principal" variant="fullWidth">
        <Tab id="tab-book" aria-controls="panel-book" value="book" label="Agendar" />
        <Tab id="tab-list" aria-controls="panel-list" value="list" label="Agendamentos" />
      </Tabs>
      <div id="panel-book" role="tabpanel" aria-labelledby="tab-book" hidden={view !== "book"} className="screen-panel">
        <BookingForm company={company} />
      </div>
      <div id="panel-list" role="tabpanel" aria-labelledby="tab-list" hidden={view !== "list"} className="screen-panel">
        <AppointmentsPanel company={company} />
      </div>
    </main>
  );
}
