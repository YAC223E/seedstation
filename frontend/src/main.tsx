import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";

import { TooltipProvider } from "@/components/ui/tooltip";
import { ApiError } from "@/lib/api";
import { AuthProvider } from "@/providers/auth-provider";
import { LiveProvider } from "@/providers/live-provider";
import { ThemeProvider, useTheme } from "@/providers/theme-provider";

import { App } from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof ApiError) {
          if ([401, 403, 404].includes(error.status)) return false;
          if (error.status === 0) return failureCount < 3;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      retry: 0,
    },
  },
});

function ThemedToaster() {
  const { resolved } = useTheme();
  return (
    <Toaster
      theme={resolved}
      position="bottom-right"
      closeButton
      duration={4200}
      offset={{ bottom: 20, right: 20 }}
      mobileOffset={{
        bottom: "calc(88px + env(safe-area-inset-bottom))",
        left: 12,
        right: 12,
      }}
      toastOptions={{
        className: "font-sans",
        style: {
          background: "var(--surface)",
          color: "var(--foreground)",
          border: "1px solid var(--line-strong)",
          borderRadius: "10px",
          boxShadow: "0 18px 55px -18px rgb(0 0 0 / 0.55)",
          fontSize: "13px",
          padding: "12px 14px",
        },
      }}
    />
  );
}

function Root() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <TooltipProvider delayDuration={180} skipDelayDuration={350}>
              <LiveProvider>
                <App />
                <ThemedToaster />
              </LiveProvider>
            </TooltipProvider>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

const container = document.getElementById("root");
if (!container) throw new Error("SeedStation could not find its root element.");

createRoot(container).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
