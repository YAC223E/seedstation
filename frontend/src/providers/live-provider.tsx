import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import type { LiveSnapshot } from "@/types/api";

export type LiveConnection = "connecting" | "live" | "polling" | "offline";

interface LiveContextValue {
  snapshot: LiveSnapshot | null;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  connection: LiveConnection;
  refetch: () => void;
}

const LiveContext = createContext<LiveContextValue | null>(null);
const LIVE_KEY = ["live"] as const;

interface SocketMessage {
  type: string;
  data?: LiveSnapshot;
  detail?: string;
}

export function LiveProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [connection, setConnection] = useState<LiveConnection>("connecting");
  const socketRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const query = useQuery({
    queryKey: LIVE_KEY,
    queryFn: () => apiFetch<LiveSnapshot>("/api/live/", { timeoutMs: 20_000 }),
    enabled: isAuthenticated,
    staleTime: 1_000,
    retry: 2,
    refetchInterval: connection === "live" ? 20_000 : isAuthenticated ? 5_000 : false,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      setConnection("offline");
      return;
    }

    let disposed = false;

    const scheduleReconnect = (code?: number) => {
      if (disposed || code === 4401 || code === 4403) return;
      retryRef.current += 1;
      setConnection("polling");
      const delay = Math.min(750 * 2 ** Math.min(retryRef.current, 4), 12_000);
      timerRef.current = window.setTimeout(connect, delay);
    };

    function connect() {
      if (disposed) return;
      const existing = socketRef.current;
      if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
        return;
      }
      setConnection((current) => (current === "live" ? current : "connecting"));
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(`${protocol}//${window.location.host}/ws/live/`);
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        retryRef.current = 0;
        setConnection("live");
      });

      socket.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(String(event.data)) as SocketMessage;
          if (message.type === "snapshot" && message.data) {
            queryClient.setQueryData(LIVE_KEY, message.data);
            setConnection("live");
          }
        } catch {
          // A malformed frame is not fatal; REST polling remains active.
        }
      });

      socket.addEventListener("close", (event) => {
        socketRef.current = null;
        scheduleReconnect(event.code);
      });

      socket.addEventListener("error", () => {
        socket.close();
      });
    }

    connect();

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (!socketRef.current || socketRef.current.readyState === WebSocket.CLOSED) {
        if (timerRef.current) window.clearTimeout(timerRef.current);
        retryRef.current = 0;
        connect();
      }
    };
    const onOnline = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      retryRef.current = 0;
      connect();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);

    return () => {
      disposed = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [isAuthenticated, queryClient]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (query.isError && !query.data) setConnection("offline");
    else if (query.data && connection === "connecting") setConnection("polling");
  }, [query.isError, query.data, isAuthenticated, connection]);

  const value = useMemo<LiveContextValue>(
    () => ({
      snapshot: query.data ?? null,
      isLoading: query.isPending,
      isFetching: query.isFetching,
      error: (query.error as Error | null) ?? null,
      connection,
      refetch: () => {
        void query.refetch();
      },
    }),
    [query.data, query.isPending, query.isFetching, query.error, query.refetch, connection],
  );

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive() {
  const context = useContext(LiveContext);
  if (!context) throw new Error("useLive must be used inside LiveProvider");
  return context;
}
