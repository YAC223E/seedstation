import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";

import { apiFetch, setCsrfToken } from "@/lib/api";
import type { Session } from "@/types/api";

const SESSION_KEY = ["session"] as const;

interface AuthContextValue {
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: Error | null;
  login: (username: string, password: string) => Promise<Session>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchSession(): Promise<Session> {
  const session = await apiFetch<Session>("/api/auth/session/", { timeoutMs: 12_000 });
  setCsrfToken(session.csrfToken);
  return session;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const sessionQuery = useQuery({
    queryKey: SESSION_KEY,
    queryFn: fetchSession,
    retry: 1,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const unauthorized = () => {
      queryClient.setQueryData<Session | null>(SESSION_KEY, (current) =>
        current
          ? { ...current, authenticated: false, user: null }
          : {
              authenticated: false,
              user: null,
              csrfToken: "",
              serverTime: new Date().toISOString(),
            },
      );
      void queryClient.cancelQueries({ predicate: (query) => query.queryKey[0] !== "session" });
    };
    window.addEventListener("seedstation:unauthorized", unauthorized);
    return () => window.removeEventListener("seedstation:unauthorized", unauthorized);
  }, [queryClient]);

  const login = useCallback(
    async (username: string, password: string) => {
      const session = await apiFetch<Session>("/api/auth/login/", {
        method: "POST",
        body: { username, password },
        timeoutMs: 20_000,
      });
      setCsrfToken(session.csrfToken);
      queryClient.setQueryData(SESSION_KEY, session);
      await queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== "session" });
      return session;
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      const session = await apiFetch<Session>("/api/auth/logout/", { method: "POST" });
      setCsrfToken(session.csrfToken);
      queryClient.setQueryData(SESSION_KEY, session);
    } finally {
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "session" });
    }
  }, [queryClient]);

  const refresh = useCallback(async () => {
    const session = await fetchSession();
    queryClient.setQueryData(SESSION_KEY, session);
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(() => {
    const session = sessionQuery.data ?? null;
    return {
      session,
      isLoading: sessionQuery.isPending,
      isAuthenticated: Boolean(session?.authenticated && session.user),
      error: (sessionQuery.error as Error | null) ?? null,
      login,
      logout,
      refresh,
    };
  }, [sessionQuery.data, sessionQuery.isPending, sessionQuery.error, login, logout, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
