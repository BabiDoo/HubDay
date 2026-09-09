import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes } from "react";
import { Alert, AlertTitle, CircularProgress, FormControl, FormLabel, FormHelperText, OutlinedInput, NativeSelect, Stack } from "@mui/material";
import type { ErrorCode } from "@hubday/contracts";
import { ApiClientError } from "../lib/api";

export function Spinner({ label = "Carregando…" }: { label?: string }) {
  return <Stack direction="row" spacing={1} sx={{alignItems: "center"}} role="status"><CircularProgress size={18} /><span>{label}</span></Stack>;
}
export type BannerKind = "info" | "success" | "error" | "conflict";
export function Banner({kind, title, children, onDismiss}: {kind: BannerKind; title?: string; children?: ReactNode; onDismiss?: () => void}) {
  return <Alert severity={kind === "conflict" ? "warning" : kind} role={kind === "success" || kind === "info" ? "status" : "alert"} onClose={onDismiss} closeText="Fechar mensagem">
    {title && <AlertTitle>{title}</AlertTitle>}{children && <div>{children}</div>}
  </Alert>;
}
const errorMessages: Record<ErrorCode, string> = {
  VALIDATION_ERROR: "Revise os dados informados e tente novamente.",
  UNAUTHENTICATED: "Entre na sua conta para continuar.",
  SESSION_EXPIRED: "Sua sessão expirou. Entre novamente.",
  FORBIDDEN: "Você não tem permissão para realizar esta ação.",
  NOT_FOUND: "O registro solicitado não foi encontrado.",
  APPOINTMENT_CONFLICT: "Esse horário acabou de ser ocupado. Escolha outro horário.",
  OUTSIDE_AVAILABILITY: "O horário está fora da disponibilidade do profissional.",
  APPOINTMENT_IN_PAST: "Não é possível agendar uma data ou um horário passado.",
  INVALID_STATE_TRANSITION: "Este agendamento não permite essa alteração.",
  CROSS_TENANT_REFERENCE: "Selecione um registro da sua empresa.",
  DURATION_MISMATCH: "A duração do horário não corresponde ao serviço.",
  INTERNAL: "Não foi possível concluir a operação. Tente novamente.",
};
export function describeError(err: unknown): string {
  if (err instanceof ApiClientError) {
    return err.statusCode === 0 ? "Não foi possível conectar ao servidor. Tente novamente." : errorMessages[err.code];
  }
  return "Não foi possível concluir a operação. Tente novamente.";
}
export function Field({label, htmlFor, error, children, hint}: {label: string; htmlFor: string; error?: string; hint?: string; children: ReactNode}) {
  return <FormControl fullWidth error={Boolean(error)} sx={{gap: 1}}>
    <FormLabel htmlFor={htmlFor}>{label}</FormLabel>{children}
    {(error || hint) && <FormHelperText id={`${htmlFor}-${error ? "error" : "hint"}`} sx={{m:0}}>{error || hint}</FormHelperText>}
  </FormControl>;
}
export function Input({onChange, value, disabled, type, ...props}: InputHTMLAttributes<HTMLInputElement>) {
  return <OutlinedInput fullWidth size="small" type={type} value={value} disabled={disabled} onChange={onChange} inputProps={props} />;
}
export function Select({children, onChange, value, disabled, ...props}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <NativeSelect fullWidth value={value} disabled={disabled} onChange={onChange} input={<OutlinedInput size="small" />} inputProps={props}>{children}</NativeSelect>;
}
