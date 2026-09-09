import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  loginResponse,
  type CompanySummary,
  type LoginResponse,
} from "@hubday/contracts";
import {
  apiFetch,
  setAuthToken,
  setUnauthorizedHandler,
} from "../lib/api";
import { queryClient } from "../lib/queryClient";

type Session = {
  token: string;
  expiresAt: string;
  user: LoginResponse["user"];
  company: CompanySummary;
};

const STORAGE_KEY = "hubday.session";

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = loginResponse.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    if (new Date(parsed.data.expiresAt).getTime() <= Date.now()) return null;
    const { token, expiresAt, user, company } = parsed.data;
    return { token, expiresAt, user, company };
  } catch {
    return null;
  }
}

function persistSession(session: Session | null): void {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode / storage disabled — tolerate */
  }
}

interface AuthContextValue {
  session: Session | null;
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [sessionExpired, setSessionExpired] = useState(false);

  // Keep the fetch client's bearer token in sync with the session.
  useEffect(() => {
    setAuthToken(session?.token ?? null);
  }, [session]);

  // Any 401 from a query/mutation clears the session and bounces to login.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setSession((current) => {
        if (current) {
          persistSession(null);
          setSessionExpired(true);
        }
        return null;
      });
      queryClient.clear();
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: { email, password },
      schema: loginResponse,
    });
    const next: Session = {
      token: res.token,
      expiresAt: res.expiresAt,
      user: res.user,
      company: res.company,
    };
    setAuthToken(next.token);
    persistSession(next);
    setSessionExpired(false);
    queryClient.clear();
    setSession(next);
  }, []);

  const logout = useCallback(() => {
    setAuthToken(null);
    persistSession(null);
    setSessionExpired(false);
    queryClient.clear();
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, sessionExpired, login, logout }),
    [session, sessionExpired, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
