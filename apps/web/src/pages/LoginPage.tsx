import { Brand } from "../components/Brand";
import { Input } from "../components/ui";
import { Button, Paper } from "@mui/material";
import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "../auth/AuthContext";
import { ApiClientError } from "../lib/api";
import { fieldErrors } from "../lib/forms";
import {
  Banner,
  Field,
  describeError,
} from "../components/ui";

const schema = z.object({
  email: z.string().trim().min(1, "Informe o e-mail").email("Informe um e-mail válido"),
  password: z.string().min(1, "Informe a senha"),
});

export function LoginPage() {
  const { session, sessionExpired, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (session) return <Navigate to="/" replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setServerError(null);
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setPending(true);
    try {
      await login(parsed.data.email, parsed.data.password);
    } catch (err) {
      setServerError(
        err instanceof ApiClientError && err.statusCode === 401
          ? "E-mail ou senha incorretos."
          : describeError(err),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="login-screen">
      <Paper variant="outlined" className="login-card">
        <div>
          <Brand />
          <h1 className="text-xl font-bold text-brand-ink">Hubday Agendamentos</h1>
          <p className="text-sm text-brand-muted">Entre para gerenciar seus agendamentos.</p>
        </div>

        {sessionExpired && (
          <Banner kind="info" title="Sessão encerrada">
            Entre novamente para continuar.
          </Banner>
        )}

        {serverError && (
          <Banner kind="error" title="Não foi possível entrar">
            {serverError}
          </Banner>
        )}

        <form onSubmit={onSubmit} noValidate className="login-form">
          <Field label="E-mail" htmlFor="email" error={errors.email}>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Field label="Senha" htmlFor="password" error={errors.password}>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "password-error" : undefined}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          <Button
            type="submit"
            variant="contained" fullWidth
            disabled={pending}
          >
            {pending ? "Entrando…" : "Entrar"}
          </Button>
        </form>

        <p className="demo-help text-xs text-brand-muted">
          Contas de demonstração usam a senha <code className="font-mono">hubday-dev</code>{" "}
          (owner@aurora.test ou owner@northwind.test).
        </p>
      </Paper>
    </div>
  );
}
