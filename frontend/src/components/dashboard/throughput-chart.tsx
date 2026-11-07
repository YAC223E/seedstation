import { useId, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps } from "recharts";

import { SectionHeading } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useHistory } from "@/hooks/use-api";
import { formatBytes, formatDateTime, formatSpeed } from "@/lib/format";
import { cn } from "@/lib/utils";

const ranges = [
  { hours: 6, label: "6h" },
  { hours: 24, label: "24h" },
  { hours: 168, label: "7d" },
];

function tickLabel(timestamp: string, hours: number) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: hours <= 24 ? "numeric" : undefined,
    minute: hours <= 6 ? "2-digit" : undefined,
    weekday: hours > 24 ? "short" : undefined,
  }).format(date);
}

function ChartTooltip({ active, payload }: Partial<TooltipContentProps<number, string>>) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as { timestamp?: string } | undefined;
  return (
    <div className="rounded-md border border-line-strong bg-raised px-3 py-2.5 shadow-float">
      {point?.timestamp ? (
        <p className="mb-1.5 text-2xs text-faint">{formatDateTime(point.timestamp)}</p>
      ) : null}
      <div className="space-y-1">
        {payload.map((item) => (
          <div key={String(item.dataKey)} className="flex items-center gap-2 text-xs">
            <span
              className="size-1.5 rounded-full"
              style={{ backgroundColor: item.color }}
              aria-hidden="true"
            />
            <span className="text-muted">{item.name}</span>
            <span className="data ml-auto pl-4 text-foreground">
              {formatSpeed(Number(item.value ?? 0))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ThroughputChart() {
  const [hours, setHours] = useState(6);
  const history = useHistory(hours);
  const gradientId = useId().replace(/:/g, "");
  const points = history.data?.points ?? [];
  const hasData = points.length > 0;

  return (
    <section className="panel flex min-w-0 flex-col overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <SectionHeading
          title="Throughput"
          meta={
            <span className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
              Down
              <span className="ml-1 size-1.5 rounded-full bg-seeding" aria-hidden="true" />
              Up
            </span>
          }
        />
        <div
          className="flex w-fit items-center gap-0.5 rounded-md border border-line bg-background/60 p-0.5"
          role="group"
          aria-label="Chart time range"
        >
          {ranges.map((range) => (
            <button
              key={range.hours}
              type="button"
              onClick={() => setHours(range.hours)}
              aria-pressed={hours === range.hours}
              className={cn(
                "data h-11 min-w-11 justify-center rounded-[4px] px-2.5 text-[10px] transition-colors pointer-fine:h-6 pointer-fine:min-w-0",
                hours === range.hours
                  ? "bg-raised text-foreground shadow-[inset_0_0_0_1px_var(--line-strong)]"
                  : "text-faint hover:text-muted",
              )}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className={cn(
          "relative h-[15.5rem] px-1 pb-1 pt-4 transition-opacity sm:h-[18rem]",
          history.isFetching && !history.isPending ? "opacity-80" : "",
        )}
      >
        {history.isPending ? (
          <div className="flex h-full items-end gap-2 px-4 pb-9">
            {[36, 52, 44, 68, 58, 72, 49, 61, 42, 55, 47, 65].map((height, index) => (
              <Skeleton
                key={index}
                className="w-full rounded-t-sm"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        ) : history.isError ? (
          <div className="flex h-full flex-col items-center justify-center px-5 text-center">
            <p className="text-sm font-medium text-foreground">No signal to draw</p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted">
              The telemetry history could not be loaded. Live transfer totals are still
              available above.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => history.refetch()}>
              Reload the trace
            </Button>
          </div>
        ) : !hasData ? (
          <div className="flex h-full flex-col items-center justify-center px-5 text-center">
            <svg
              viewBox="0 0 220 44"
              className="mb-4 w-40 text-line-strong"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2 30c12 0 12-14 25-14s13 21 26 21 13-29 26-29 13 17 26 17 13-7 26-7 13 15 26 15 13-10 26-10 13 7 26 7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray="3 6"
              />
            </svg>
            <p className="text-sm font-medium text-foreground">The trace is still filling.</p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted">
              SeedStation records a real sample every 20 seconds while it is running.
              Leave this open while the station works.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 18, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`down-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="var(--line)"
                strokeDasharray="2 6"
              />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(value: string) => tickLabel(value, hours)}
                axisLine={false}
                tickLine={false}
                minTickGap={36}
                tick={{ fill: "var(--faint)", fontSize: 10 }}
                tickMargin={12}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={54}
                tick={{ fill: "var(--faint)", fontSize: 10 }}
                tickFormatter={(value: number) => formatBytes(value, 0)}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ stroke: "var(--line-strong)", strokeDasharray: "3 4" }}
              />
              <Area
                type="monotone"
                dataKey="download_speed"
                name="Downstream"
                stroke="var(--primary)"
                strokeWidth={1.7}
                fill={`url(#down-${gradientId})`}
                isAnimationActive={false}
                activeDot={{ r: 3, fill: "var(--primary)", stroke: "var(--background)" }}
              />
              <Area
                type="monotone"
                dataKey="upload_speed"
                name="Upstream"
                stroke="var(--seeding)"
                strokeWidth={1.2}
                fill="transparent"
                isAnimationActive={false}
                activeDot={{ r: 3, fill: "var(--seeding)", stroke: "var(--background)" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 sm:px-5">
        <p className="text-2xs text-faint">A real sample every 20 seconds.</p>
        {history.data ? (
          <p className="data text-2xs text-faint">{history.data.sampled} samples</p>
        ) : null}
      </div>
    </section>
  );
}
