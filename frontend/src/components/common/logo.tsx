import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

export function SeedMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={cn("size-7", className)}
    >
      <path
        d="M32 10c12.3 8.4 19 16.5 19 26.2C51 47.3 43 54 32 54S13 47.3 13 36.2C13 26.5 19.7 18.4 32 10Z"
        stroke="currentColor"
        strokeWidth="3"
        className="text-primary"
      />
      <path
        d="M32 20v25M32 30.7c-4.8 0-7.9-3-7.9-7.4 4.8 0 7.9 2.4 7.9 7.4ZM32 39c5.4 0 8.8-3.4 8.8-8.3-5.4 0-8.8 2.8-8.8 8.3Z"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        className="text-foreground"
      />
    </svg>
  );
}

export function Logo({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      to="/"
      aria-label="SeedStation home"
      className={cn(
        "group inline-flex items-center gap-2.5 rounded-sm text-foreground",
        className,
      )}
    >
      <span className="grid size-8 place-items-center rounded-[7px] border border-line-strong/80 bg-raised transition-colors group-hover:border-primary/40">
        <SeedMark className="size-5" />
      </span>
      {!compact ? (
        <span className="font-display text-[1.32rem] leading-none tracking-[-0.015em]">
          SeedStation
        </span>
      ) : null}
    </Link>
  );
}
