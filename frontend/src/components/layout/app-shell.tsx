import {
  ArrowDownToLine,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Plus,
  Settings2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { LiveIndicator } from "@/components/common/live-indicator";
import { Logo, SeedMark } from "@/components/common/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatBytes, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useLive } from "@/providers/live-provider";

const primaryNav = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/downloads", label: "Downloads", icon: ArrowDownToLine },
  { to: "/files", label: "Files", icon: FolderOpen },
];

const mobileNav = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/downloads", label: "Downloads", icon: ArrowDownToLine },
  { to: "/downloads/add", label: "Add", icon: Plus, featured: true },
  { to: "/files", label: "Files", icon: FolderOpen },
  { to: "/settings", label: "Settings", icon: Settings2 },
];

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "auto" });
}

export function AppShell() {
  const location = useLocation();

  useEffect(() => {
    scrollToTop();
  }, [location.pathname]);

  return (
    <div className="grain min-h-dvh bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:border focus:border-line-strong focus:bg-surface focus:px-4 focus:py-3 focus:text-sm focus:text-foreground focus:shadow-float"
      >
        Skip to content
      </a>
      <Sidebar />
      <MobileHeader />
      <div className="lg:pl-[15.75rem]">
        <main
          id="main-content"
          className="mx-auto w-full max-w-[91rem] px-4 pb-safe-nav pt-5 sm:px-6 lg:px-10 lg:pb-14 lg:pt-10"
        >
          <div key={location.pathname} className="page-shell">
            <Outlet />
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

function Sidebar() {
  const { snapshot } = useLive();
  const storage = snapshot?.storage;
  const percent = storage ? Math.min(100, storage.percent) : 0;

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[15.75rem] flex-col border-r border-line bg-surface/75 lg:flex">
      <div className="flex h-[4.75rem] items-center px-5">
        <Logo />
      </div>

      <div className="px-3 pb-5">
        <Button asChild className="h-10 w-full justify-between text-[13px]">
          <Link to="/downloads/add">
            Add download
            <Plus className="size-4" />
          </Link>
        </Button>
      </div>

      <nav aria-label="Primary" className="px-3">
        <p className="mb-2 px-2.5 text-2xs text-faint">Station</p>
        <div className="space-y-0.5">
          {primaryNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "group relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors",
                  isActive
                    ? "bg-raised text-foreground shadow-[inset_0_0_0_1px_var(--line)]"
                    : "text-muted hover:bg-raised/60 hover:text-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      "absolute -left-3 h-4 w-[2px] rounded-full bg-primary transition-opacity",
                      isActive ? "opacity-100" : "opacity-0",
                    )}
                    aria-hidden="true"
                  />
                  <item.icon
                    className={cn("size-4", isActive ? "text-primary" : "text-faint")}
                    strokeWidth={1.8}
                  />
                  {item.label}
                  {item.label === "Downloads" && snapshot?.summary.downloading ? (
                    <span className="data ml-auto text-2xs text-faint">
                      {snapshot.summary.downloading}
                    </span>
                  ) : null}
                </>
              )}
            </NavLink>
          ))}
        </div>

        <p className="mb-2 mt-6 px-2.5 text-2xs text-faint">Control</p>
        <div className="space-y-0.5">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                "group relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors",
                isActive
                  ? "bg-raised text-foreground shadow-[inset_0_0_0_1px_var(--line)]"
                  : "text-muted hover:bg-raised/60 hover:text-foreground",
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    "absolute -left-3 h-4 w-[2px] rounded-full bg-primary transition-opacity",
                    isActive ? "opacity-100" : "opacity-0",
                  )}
                  aria-hidden="true"
                />
                <Settings2
                  className={cn("size-4", isActive ? "text-primary" : "text-faint")}
                  strokeWidth={1.8}
                />
                Settings
              </>
            )}
          </NavLink>
        </div>
      </nav>

      <div className="mt-auto space-y-5 border-t border-line p-4">
        <div>
          <div className="flex items-center justify-between gap-2">
            <LiveIndicator />
            <Badge tone={snapshot?.engine.online ? "signal" : "danger"} className="h-5 px-2">
              {snapshot?.engine.online ? "Online" : "Offline"}
            </Badge>
          </div>
          {snapshot?.engine.error ? (
            <p className="mt-2 line-clamp-2 text-2xs leading-relaxed text-danger/90">
              {snapshot.engine.error}
            </p>
          ) : null}
        </div>

        <div>
          <div className="flex items-center justify-between text-2xs text-faint">
            <span>Disk</span>
            <span className="data">{formatPercent(percent, 1)} used</span>
          </div>
          <div className="mt-2 flex h-6 items-end gap-[2px]" aria-hidden="true">
            {Array.from({ length: 28 }).map((_, index) => {
              const threshold = ((index + 1) / 28) * 100;
              const filled = percent >= threshold;
              return (
                <span
                  key={index}
                  className={cn(
                    "h-full flex-1 rounded-[1px]",
                    filled
                      ? threshold > 90
                        ? "bg-danger/70"
                        : "bg-primary/70"
                      : "bg-line",
                  )}
                  style={{ height: `${40 + (index % 5) * 10}%` }}
                />
              );
            })}
          </div>
          <p className="mt-2 text-2xs text-muted">
            {storage ? `${formatBytes(storage.free)} free` : "Reading disk…"}
          </p>
        </div>

        <UserMenu />
      </div>
    </aside>
  );
}

function MobileHeader() {
  return (
    <header className="safe-top sticky top-0 z-30 border-b border-line bg-background/95 px-4 pb-2.5 backdrop-blur-sm lg:hidden">
      <div className="flex items-center justify-between gap-3">
        <Logo className="min-h-11" />
        <div className="flex items-center gap-3">
          <LiveIndicator compact />
          <UserMenu compact />
        </div>
      </div>
    </header>
  );
}

function MobileNav() {
  return (
    <nav
      aria-label="Primary"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface px-1.5 pt-1.5 lg:hidden"
    >
      <div className="grid grid-cols-5">
        {mobileNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "group flex min-h-12 flex-col items-center justify-center gap-1 rounded-md px-1 text-[10px] transition-colors",
                isActive ? "text-foreground" : "text-faint hover:text-muted",
              )
            }
            aria-label={item.label === "Add" ? "Add download" : item.label}
          >
            {({ isActive }) => (
              <>
                {item.featured ? (
                  <span
                    className={cn(
                      "-mt-4 grid size-10 place-items-center rounded-full border-4 border-background transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-raised text-primary",
                    )}
                  >
                    <item.icon className="size-4.5" strokeWidth={2} />
                  </span>
                ) : (
                  <item.icon
                    className={cn("size-[18px]", isActive && "text-primary")}
                    strokeWidth={1.8}
                  />
                )}
                <span className={cn(item.featured && "mt-0")}>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function UserMenu({ compact = false }: { compact?: boolean }) {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const user = session?.user;
  const initial = user?.username?.slice(0, 1).toUpperCase() || "S";

  const signOut = async () => {
    setBusy(true);
    try {
      await logout();
      navigate("/login", { replace: true });
      toast.success("Signed out.");
    } catch {
      toast.error("Could not sign out. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Account menu for ${user?.username || "station user"}`}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md text-left transition-colors",
            compact
              ? "size-11 justify-center rounded-full border border-line-strong bg-raised text-xs"
              : "p-1.5 hover:bg-raised",
          )}
        >
          {!compact ? (
            <>
              <span className="grid size-8 place-items-center rounded-full border border-line-strong bg-raised text-xs text-foreground">
                {initial}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-foreground">
                  {user?.username}
                </span>
                <span className="block truncate text-2xs text-faint">Station admin</span>
              </span>
            </>
          ) : (
            <SeedMark className="size-4" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-56">
        <DropdownMenuLabel>
          <span className="block text-[13px] font-medium text-foreground">{user?.username}</span>
          <span className="mt-0.5 block truncate text-2xs font-normal text-faint">
            {user?.email || "SeedStation"}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings">
            <Settings2 className="size-4 text-faint" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            void signOut();
          }}
          disabled={busy}
          danger
        >
          <LogOut className="size-4" />
          {busy ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
