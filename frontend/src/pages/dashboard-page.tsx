import { Plus, RotateCw } from "lucide-react";
import { Link } from "react-router-dom";

import { ErrorState } from "@/components/common/states";
import { PageHeader } from "@/components/common/page-header";
import { ActiveTransfers } from "@/components/dashboard/active-transfers";
import { RecentlyLanded } from "@/components/dashboard/recently-landed";
import { StationNotes } from "@/components/dashboard/station-notes";
import { StatsBand } from "@/components/dashboard/stats-band";
import { StoragePanel } from "@/components/dashboard/storage-panel";
import { ThroughputChart } from "@/components/dashboard/throughput-chart";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateShort, greeting, pluralize } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import { useLive } from "@/providers/live-provider";

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading station overview">
      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-line xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="border-line p-5 not-last:border-r [&:nth-child(-n+2)]:border-b xl:[&:nth-child(-n+2)]:border-b-0"
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-5 h-9 w-32" />
            <Skeleton className="mt-4 h-2.5 w-24" />
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(19rem,.75fr)]">
        <Skeleton className="h-[22rem] rounded-xl" />
        <Skeleton className="h-[22rem] rounded-xl" />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(19rem,.75fr)]">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { session } = useAuth();
  const { snapshot, isLoading, error, refetch } = useLive();
  const username = session?.user?.username ?? "station admin";

  const summary = snapshot?.summary;
  const description = snapshot
    ? snapshot.engine.online
      ? summary && summary.downloading > 0
        ? `${pluralize(summary.downloading, "download")} on the way in. ${pluralize(
            summary.seeding,
            "file",
          )} seeding back out to the network.`
        : summary && summary.seeding > 0
          ? `The line is quiet. ${pluralize(
              summary.seeding,
              "file",
            )} is seeding back out to the network.`
          : "Everything is still. The engine is online and listening for the next handoff."
      : "qBittorrent is not answering. The station is up, and its files are still reachable."
    : "Reading the station…";

  return (
    <>
      <PageHeader
        eyebrow={formatDateShort(new Date())}
        title={`${greeting()}, ${username}.`}
        description={
          summary?.errored
            ? `${description} ${pluralize(summary.errored, "torrent")} need attention.`
            : description
        }
        actions={
          <Button asChild className="w-full sm:w-auto">
            <Link to="/downloads/add">
              <Plus className="size-4" />
              Add download
            </Link>
          </Button>
        }
      />

      {isLoading && !snapshot ? (
        <DashboardSkeleton />
      ) : !snapshot ? (
        <ErrorState
          message={
            error?.message ||
            "The station did not return an overview. It may still be waking up."
          }
          onRetry={refetch}
        />
      ) : (
        <>
          {!snapshot.engine.online ? (
            <div
              role="alert"
              className="mb-5 flex flex-col gap-3 rounded-lg border border-warning/25 bg-warning/[0.055] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-foreground">
                  The torrent engine is offline.
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  {snapshot.engine.error ||
                    "SeedStation is running, but qBittorrent cannot be reached. Your library remains available."}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={refetch} className="shrink-0">
                <RotateCw className="size-3.5" />
                Check again
              </Button>
            </div>
          ) : null}

          <StatsBand snapshot={snapshot} />

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(19rem,.75fr)]">
            <ThroughputChart />
            <StoragePanel storage={snapshot.storage} />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(19rem,.75fr)]">
            <ActiveTransfers torrents={snapshot.torrents} />
            <RecentlyLanded torrents={snapshot.recent} />
          </div>

          <StationNotes snapshot={snapshot} />
        </>
      )}
    </>
  );
}
