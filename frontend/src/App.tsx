import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";

import { SeedMark } from "@/components/common/logo";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { AddDownloadPage } from "@/pages/add-download-page";
import { DashboardPage } from "@/pages/dashboard-page";
import { DownloadsPage } from "@/pages/downloads-page";
import { FilesPage } from "@/pages/files-page";
import { LoginPage } from "@/pages/login-page";
import { SettingsPage } from "@/pages/settings-page";
import { useAuth } from "@/providers/auth-provider";

function StationBoot({ label = "Waking the station…" }: { label?: string }) {
  return (
    <div className="grain grid min-h-dvh place-items-center bg-background px-6">
      <div className="flex flex-col items-center text-center" role="status" aria-live="polite">
        <span className="grid size-14 place-items-center rounded-xl border border-line-strong bg-surface shadow-float">
          <SeedMark className="size-8 animate-pulse" />
        </span>
        <p className="mt-5 font-display text-2xl text-foreground">SeedStation</p>
        <p className="mt-1.5 text-xs text-faint">{label}</p>
        <span className="mt-5 flex gap-1" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="size-1 rounded-full bg-primary animate-pulse"
              style={{ animationDelay: `${index * 160}ms` }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children?: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <StationBoot />;
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: { pathname: location.pathname, search: location.search } }}
      />
    );
  }
  return children ? <>{children}</> : <Outlet />;
}

function NotFoundPage() {
  return (
    <div className="flex min-h-[62dvh] flex-col items-center justify-center px-4 text-center">
      <p className="micro">404 · off the path</p>
      <h1 className="mt-5 max-w-[13ch] font-display text-[clamp(3.2rem,8vw,6.2rem)] leading-[0.9] tracking-[-0.04em] text-foreground">
        Nothing grows here.
      </h1>
      <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted">
        This corner of the station does not exist. The library, transfers, and settings
        are still where you left them.
      </p>
      <Button asChild className="mt-6">
        <Link to="/">
          <ArrowLeft className="size-4" />
          Back to the overview
        </Link>
      </Button>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="downloads" element={<DownloadsPage />} />
          <Route path="downloads/add" element={<AddDownloadPage />} />
          <Route path="files" element={<FilesPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
