import { AlertTriangle, ArrowRight, Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-5 py-14 text-center sm:py-20",
        className,
      )}
    >
      <div className="relative mb-5 grid size-12 place-items-center rounded-full border border-line-strong bg-raised text-muted">
        <Icon className="size-5" strokeWidth={1.6} />
        <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-primary/70" />
      </div>
      <h2 className="text-sm font-medium text-foreground">{title}</h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "That didn’t come through",
  message,
  onRetry,
  className,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-3 rounded-lg border border-danger/25 bg-danger/[0.06] p-5 sm:flex-row sm:items-center",
        className,
      )}
    >
      <AlertTriangle className="size-5 shrink-0 text-danger" strokeWidth={1.8} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">{message}</p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function InlineLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="link-quiet inline-flex items-center gap-1.5 text-sm text-foreground"
    >
      {children}
      <ArrowRight className="size-3.5" />
    </button>
  );
}
