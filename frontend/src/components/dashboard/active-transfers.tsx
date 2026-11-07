import { ArrowUpRight, Plus, Radio } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";

import { activityIcons, statusLabel } from "@/components/common/torrent-status";
import { EmptyState } from "@/components/common/states";
import { SectionHeading } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  formatBytes,
  formatEta,
  formatPercent,
  formatSpeed,
  pluralize,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Torrent } from "@/types/api";

const activityPriority: Record<string, number> = {
  downloading: 0,
  metadata: 1,
  checking: 2,
  seeding: 3,
  unknown: 4,
  paused: 5,
  error: 6,
};

export function ActiveTransfers({ torrents }: { torrents: Torrent[] }) {
  const active = useMemo(
    () =>
      torrents
        .filter((torrent) => torrent.is_downloading || torrent.is_seeding)
        .sort((a, b) => {
          const priority =
            (activityPriority[a.activity] ?? 9) - (activityPriority[b.activity] ?? 9);
          if (priority !== 0) return priority;
          return b.added_on?.localeCompare(a.added_on ?? "") ?? 0;
        })
        .slice(0, 4),
    [torrents],
  );

  return (
    <section className="panel flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-4 sm:px-5">
        <SectionHeading
          title="In motion"
          meta={active.length ? pluralize(active.length, "transfer") : undefined}
        />
        <Link
          to="/downloads"
          className="inline-flex min-h-11 items-center gap-1.5 text-xs text-muted transition-colors hover:text-primary pointer-fine:min-h-0"
        >
          All downloads
          <ArrowUpRight className="size-3.5" />
        </Link>
      </div>

      {active.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="Nothing in motion"
          description="The station is quiet. Add a magnet link or a .torrent file and it will show up here."
          action={
            <Button asChild size="sm">
              <Link to="/downloads/add">
                <Plus className="size-3.5" />
                Add a download
              </Link>
            </Button>
          }
          className="py-12"
        />
      ) : (
        <div className="divide-y divide-line">
          {active.map((torrent) => {
            const Icon = activityIcons[torrent.activity] ?? activityIcons.unknown;
            const seeding = torrent.is_seeding;
            const speed = seeding ? torrent.upload_speed : torrent.download_speed;
            return (
              <Link
                key={torrent.hash}
                to={`/downloads?torrent=${torrent.hash}`}
                className="group grid gap-3 px-4 py-3.5 transition-colors hover:bg-raised/50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-5 sm:px-5"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 grid size-8 shrink-0 place-items-center rounded-md border",
                      seeding
                        ? "border-seeding/20 bg-seeding/[0.07] text-seeding"
                        : "border-primary/20 bg-primary/[0.07] text-primary",
                    )}
                  >
                    <Icon className="size-3.5" strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-[13px] font-medium text-foreground">
                        {torrent.name}
                      </p>
                      <span className="data shrink-0 text-2xs text-faint">
                        {formatPercent(torrent.progress * 100)}
                      </span>
                    </div>
                    <Progress
                      value={torrent.progress * 100}
                      className="mt-2 h-1"
                      indicatorClassName={seeding ? "bg-seeding" : undefined}
                      label={`${torrent.name} progress`}
                    />
                    <div className="mt-2 flex items-center justify-between gap-3 text-2xs text-faint">
                      <span>{statusLabel(torrent)}</span>
                      <span className="data">
                        {seeding
                          ? `${formatBytes(torrent.size)} on disk`
                          : `${formatBytes(torrent.amount_left)} left`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-5 pl-11 sm:block sm:min-w-[6.5rem] sm:pl-0 sm:text-right">
                  <p className="data text-xs text-foreground">{formatSpeed(speed)}</p>
                  <p className="text-2xs text-faint sm:mt-1.5">
                    {seeding ? "Seeding" : `ETA ${formatEta(torrent.eta_seconds)}`}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
