import { useMutation } from "@tanstack/react-query";
import { ArrowDownToLine, Plus, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState, ErrorState } from "@/components/common/states";
import { FilterBar, type TorrentFilter, type TorrentSort } from "@/components/downloads/filter-bar";
import { TorrentDetailSheet } from "@/components/downloads/torrent-detail-sheet";
import {
  TorrentRow,
  type PendingTorrentAction,
  type TorrentAction,
} from "@/components/downloads/torrent-row";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useLive } from "@/providers/live-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, apiFetch } from "@/lib/api";
import { formatDateShort, greeting, pluralize } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import type { Torrent } from "@/types/api";

const validFilters: TorrentFilter[] = [
  "all",
  "downloading",
  "seeding",
  "complete",
  "paused",
  "error",
];
const validSorts: TorrentSort[] = ["added", "name", "progress", "size", "speed"];

function formatError(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : error instanceof Error
      ? error.message
      : "The engine could not complete that request.";
}

function actionLabel(action: TorrentAction) {
  if (action === "pause") return "paused";
  if (action === "resume") return "resumed";
  return "queued for recheck";
}

export function DownloadsPage() {
  const { session } = useAuth();
  const { snapshot, isLoading, error, refetch } = useLive();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Torrent | null>(null);
  const [deleteFiles, setDeleteFiles] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const rawFilter = searchParams.get("filter") as TorrentFilter | null;
  const rawSort = searchParams.get("sort") as TorrentSort | null;
  const filter: TorrentFilter = rawFilter && validFilters.includes(rawFilter) ? rawFilter : "all";
  const sort: TorrentSort = rawSort && validSorts.includes(rawSort) ? rawSort : "added";
  const openHash = searchParams.get("torrent");

  const torrents = snapshot?.torrents ?? [];

  const counts = useMemo<Record<TorrentFilter, number>>(
    () => ({
      all: torrents.length,
      downloading: torrents.filter((torrent) => torrent.is_downloading).length,
      seeding: torrents.filter((torrent) => torrent.is_seeding).length,
      complete: torrents.filter((torrent) => torrent.is_complete).length,
      paused: torrents.filter((torrent) => torrent.is_paused).length,
      error: torrents.filter((torrent) => torrent.is_error).length,
    }),
    [torrents],
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = torrents.filter((torrent) => {
      if (filter === "downloading" && !torrent.is_downloading) return false;
      if (filter === "seeding" && !torrent.is_seeding) return false;
      if (filter === "complete" && !torrent.is_complete) return false;
      if (filter === "paused" && !torrent.is_paused) return false;
      if (filter === "error" && !torrent.is_error) return false;
      if (
        needle &&
        !torrent.name.toLowerCase().includes(needle) &&
        !torrent.hash.toLowerCase().includes(needle)
      ) {
        return false;
      }
      return true;
    });

    return filtered.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "progress") return a.progress - b.progress;
      if (sort === "size") return b.size - a.size;
      if (sort === "speed") {
        return (
          Math.max(b.download_speed, b.upload_speed) -
          Math.max(a.download_speed, a.upload_speed)
        );
      }
      return (b.added_on ?? "").localeCompare(a.added_on ?? "");
    });
  }, [torrents, filter, search, sort]);

  const setParam = (key: string, value: string | null) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };

  const actionMutation = useMutation({
    mutationFn: ({ torrent, action }: { torrent: Torrent; action: TorrentAction }) =>
      apiFetch<{ detail: string }>(`/api/torrents/${torrent.hash}/${action}/`, {
        method: "POST",
      }),
    onSuccess: (_data, variables) => {
      toast.success(`${variables.torrent.name} ${actionLabel(variables.action)}.`);
      refetch();
    },
    onError: (mutationError) => {
      toast.error(formatError(mutationError));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ torrent, files }: { torrent: Torrent; files: boolean }) =>
      apiFetch<void>(`/api/torrents/${torrent.hash}/`, {
        method: "DELETE",
        body: { confirm: "DELETE", delete_files: files },
      }),
    onSuccess: (_data, variables) => {
      toast.success(`Removed ${variables.torrent.name}.`);
      setDeleteTarget(null);
      setDeleteFiles(false);
      setDeleteError(null);
      if (openHash === variables.torrent.hash) setParam("torrent", null);
      refetch();
    },
    onError: (mutationError) => {
      setDeleteError(formatError(mutationError));
    },
  });

  const pending: PendingTorrentAction | null = actionMutation.isPending
    ? actionMutation.variables
      ? {
          hash: actionMutation.variables.torrent.hash,
          action: actionMutation.variables.action,
        }
      : null
    : deleteMutation.isPending && deleteMutation.variables
      ? {
          hash: deleteMutation.variables.torrent.hash,
          action: "delete",
        }
      : null;

  const openTorrent = (torrent: Torrent) => setParam("torrent", torrent.hash);
  const openFiles = (path: string) => navigate(`/files?path=${encodeURIComponent(path)}`);
  const askDelete = (torrent: Torrent) => {
    setParam("torrent", null);
    setDeleteFiles(false);
    setDeleteError(null);
    setDeleteTarget(torrent);
  };

  const summaryText = snapshot
    ? snapshot.engine.online
      ? torrents.length
        ? `${pluralize(counts.downloading, "download")} active, ${pluralize(
            counts.seeding,
            "seeding",
          )}, and ${pluralize(counts.complete, "finished torrent")} in the library.`
        : "The transfer list is empty. Add a magnet link or a .torrent file to get started."
      : "The torrent engine is offline. The list below may be out of date."
    : "Reading the transfer list…";

  const preview = torrents.find((torrent) => torrent.hash === openHash);

  return (
    <>
      <PageHeader
        eyebrow={formatDateShort(new Date())}
        title={`${greeting()}, ${session?.user?.username ?? "station admin"}.`}
        description={summaryText}
        actions={
          <Button asChild>
            <Link to="/downloads/add">
              <Plus className="size-4" />
              Add download
            </Link>
          </Button>
        }
      />

      {snapshot && !snapshot.engine.online ? (
        <div
          role="alert"
          className="mb-5 flex flex-col gap-3 rounded-lg border border-warning/25 bg-warning/[0.055] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-sm font-medium text-foreground">Engine offline</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {snapshot.engine.error || "qBittorrent is not reachable right now."}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refetch}>
            <RefreshCw className="size-3.5" />
            Retry
          </Button>
        </div>
      ) : null}

      {isLoading && !snapshot ? (
        <div className="panel overflow-hidden" aria-busy="true" aria-label="Loading downloads">
          <div className="border-b border-line p-3">
            <Skeleton className="h-8 w-full max-w-xl" />
          </div>
          <div className="divide-y divide-line">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex gap-3 p-4">
                <Skeleton className="size-9 shrink-0" />
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-1 w-full" />
                  <Skeleton className="h-2.5 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : !snapshot ? (
        <ErrorState
          message={error?.message || "The transfer list could not be loaded."}
          onRetry={refetch}
        />
      ) : (
        <section className="panel overflow-hidden">
          <FilterBar
            filter={filter}
            onFilterChange={(value) => setParam("filter", value === "all" ? null : value)}
            counts={counts}
            search={search}
            onSearchChange={setSearch}
            sort={sort}
            onSortChange={(value) => setParam("sort", value === "added" ? null : value)}
          />

          {visible.length === 0 ? (
            <EmptyState
              icon={counts.all === 0 ? ArrowDownToLine : ArrowDownToLine}
              title={
                counts.all === 0
                  ? "The transfer list is empty"
                  : search
                    ? "No matching downloads"
                    : "Nothing in this view"
              }
              description={
                counts.all === 0
                  ? "Start with a magnet link, or drop in a .torrent file. SeedStation hands it to qBittorrent and keeps an eye on the rest."
                  : search
                    ? `Nothing matches “${search}”. Try a different name or info hash.`
                    : "No transfers match the selected filter right now."
              }
              action={
                counts.all === 0 ? (
                  <Button asChild size="sm">
                    <Link to="/downloads/add">
                      <Plus className="size-3.5" />
                      Add download
                    </Link>
                  </Button>
                ) : search ? (
                  <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                    Clear search
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setParam("filter", null);
                      setParam("sort", null);
                    }}
                  >
                    Show all
                  </Button>
                )
              }
            />
          ) : (
            <div>
              {visible.map((torrent) => (
                <TorrentRow
                  key={torrent.hash}
                  torrent={torrent}
                  pending={pending}
                  onOpen={() => openTorrent(torrent)}
                  onAction={(target, action) =>
                    actionMutation.mutate({ torrent: target, action })
                  }
                  onDelete={askDelete}
                />
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-2xs text-faint">
            <span>
              Showing {visible.length} of {torrents.length} transfers
            </span>
            <span>Updated live from qBittorrent</span>
          </div>
        </section>
      )}

      <TorrentDetailSheet
        hash={openHash}
        preview={preview}
        pending={pending}
        onClose={() => setParam("torrent", null)}
        onAction={(torrent, action) => actionMutation.mutate({ torrent, action })}
        onDelete={askDelete}
        onOpenFiles={openFiles}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteError(null);
            setDeleteFiles(false);
          }
        }}
        title="Remove this torrent?"
        description={
          deleteTarget
            ? `“${deleteTarget.name}” will be removed from the transfer list. The downloaded files stay on disk unless you choose otherwise.`
            : ""
        }
        confirmLabel={deleteFiles ? "Remove and delete" : "Remove torrent"}
        busy={deleteMutation.isPending}
        error={deleteError}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate({ torrent: deleteTarget, files: deleteFiles });
          }
        }}
      >
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-line bg-background/40 p-3.5">
          <Switch
            checked={deleteFiles}
            onCheckedChange={setDeleteFiles}
            aria-label="Also delete downloaded files"
            className="mt-0.5"
          />
          <span>
            <span className="block text-xs font-medium text-foreground">
              Also delete downloaded files
            </span>
            <span className="mt-1 block text-2xs leading-relaxed text-faint">
              This removes the torrent’s files from the download directory. It cannot be
              undone. Files outside the allowed download roots are never deleted.
            </span>
          </span>
        </label>
      </ConfirmDialog>
    </>
  );
}
