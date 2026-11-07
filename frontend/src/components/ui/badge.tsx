import * as React from "react";

import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "signal" | "seeding" | "warning" | "danger" | "info";

const tones: Record<BadgeTone, string> = {
  neutral: "border-line-strong/70 bg-raised text-muted",
  signal:
    "border-primary/25 bg-primary/10 text-foreground [--dot:var(--primary)]",
  seeding:
    "border-seeding/25 bg-seeding/10 text-seeding [--dot:var(--seeding)]",
  warning: "border-warning/25 bg-warning/10 text-warning [--dot:var(--warning)]",
  danger: "border-danger/25 bg-danger/10 text-danger [--dot:var(--danger)]",
  info: "border-info/25 bg-info/10 text-info [--dot:var(--info)]",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
}

export function Badge({ className, tone = "neutral", dot, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-2xs font-medium leading-none",
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot ? (
        <span className="size-1.5 rounded-full bg-[var(--dot,var(--faint))]" aria-hidden="true" />
      ) : null}
      {children}
    </span>
  );
}
