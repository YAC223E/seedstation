import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: {
  title: string;
  description?: string;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 pb-7 sm:flex-row sm:items-end sm:justify-between sm:gap-8",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? <div className="mb-2.5 text-xs text-faint">{eyebrow}</div> : null}
        <h1 className="font-display text-[2.15rem] leading-[1.02] tracking-[-0.025em] text-foreground sm:text-[2.75rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2 sm:pb-0.5">{actions}</div>
      ) : null}
    </header>
  );
}

export function SectionHeading({
  title,
  meta,
  action,
  className,
}: {
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <div className="flex min-w-0 items-baseline gap-3">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        {meta ? <span className="text-xs text-faint">{meta}</span> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
