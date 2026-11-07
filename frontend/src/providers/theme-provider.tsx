import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useSettings } from "@/hooks/use-api";
import { useAuth } from "@/providers/auth-provider";
import type { ThemePreference } from "@/types/api";

const STORAGE_KEY = "seedstation.theme";

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: "dark" | "light";
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function initialPreference(): ThemePreference {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "dark";
}

function systemTheme(): "dark" | "light" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolvedTheme(preference: ThemePreference): "dark" | "light" {
  return preference === "system" ? systemTheme() : preference;
}

function applyTheme(resolved: "dark" | "light") {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.dataset.theme = resolved;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", resolved === "dark" ? "#0b0f0a" : "#edefe3");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const settingsQuery = useSettings({ enabled: isAuthenticated });
  const [preference, setPreferenceState] = useState<ThemePreference>(initialPreference);
  const [resolved, setResolved] = useState<"dark" | "light">(() =>
    resolvedTheme(initialPreference()),
  );
  const serverSynced = useRef(false);

  const setPreference = useCallback((value: ThemePreference) => {
    window.localStorage.setItem(STORAGE_KEY, value);
    setPreferenceState(value);
    const next = resolvedTheme(value);
    setResolved(next);
    applyTheme(next);
  }, []);

  // The station preference is the source of truth once per signed-in session,
  // so a theme chosen from the phone also follows the administrator to a
  // desktop browser. Later local changes are applied immediately without
  // waiting for a round trip.
  useEffect(() => {
    if (!isAuthenticated) {
      serverSynced.current = false;
      return;
    }
    const remote = settingsQuery.data?.settings.theme;
    if (!remote || serverSynced.current) return;
    serverSynced.current = true;
    if (remote !== preference) setPreference(remote);
  }, [isAuthenticated, preference, setPreference, settingsQuery.data?.settings.theme]);

  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  useEffect(() => {
    if (preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const change = () => {
      const next = systemTheme();
      setResolved(next);
      applyTheme(next);
    };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, [preference]);

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
