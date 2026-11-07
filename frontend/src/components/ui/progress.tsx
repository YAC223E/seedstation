import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number;
  className?: string;
  indicatorClassName?: string;
  label?: string;
}

export function Progress({ value, className, indicatorClassName, label }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-line/80", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={label}
    >
      <div
        className={cn(
          "h-full rounded-full bg-primary transition-[width] duration-700 ease-out",
          indicatorClassName,
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
