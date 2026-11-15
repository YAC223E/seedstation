import {
  Check,
  ChevronDown,
  Copy,
  FolderOpen,
  Pause,
  Play,
  RefreshCw,
  Square,
  SquareCheck,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FileTypeIcon } from "@/components/files/file-type-icon";
import { ErrorState } from "@/components/common/states";
import { TorrentStatus } from "@/components/common/torrent-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useSetTorrentFilePriority,
  useTorrentDetail,
  type TorrentFilePriority,
} from "@/hooks/use-api";
import {
  formatBytes,
  formatDateTime,
  formatEta,
  formatPercent,
  formatRelative,
  formatSpeed,
  shortHash,
  truncateMiddle,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FileCategory, Torrent, TorrentFile } from "@/types/api";
import type { PendingTorrentAction, TorrentAction } from "./torrent-row";

function fileCategory(file: TorrentFile): FileCategory {
  if (file.mime.startsWith("video/")) return "video";
  if (file.mime.startsWith("image/")) return "image";
  if (file.mime.startsWith("audio/")) return "audio";
  if (/\.(zip|rar|7z|tar|gz|bz2|xz|zst|iso)$/i.test(file.name)) return "archive";
  if (file.mime.startsWith("text/")) return "text";
  if (file.mime.includes("pdf") || file.mime.includes("epub")) return "document";
  return "other";
}

const FILE_PRIORITY_LABELS: Record<TorrentFilePriority, string> = {
  normal: "Normal",
  high: "High",
  max: "Max",
  skip: "Skip",
};

function filePriority(priority: number): TorrentFilePriority {
  if (priority === 0) return "skip";
  if (priority === 6) return "high";
  if (priority === 7) return "max";
  return "normal";
}

function trackerName(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return truncateMiddle(url, 34);
  }
}

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="border-line py-3 first:pl-0 [&:not(:first-child)]:border-l [&:not(:first-child)]:pl-4">
      <p className="text-2xs text-faint">{label}</p>
      <p className="data mt-1.5 text-xs text-foreground">{value}</p>
      {detail ? <p className="mt-1 text-2xs text-faint">{detail}</p> : null}
    </div>
  );
}

export function TorrentDetailSheet({
  hash,
  preview,
  pending,
  onClose,
  onAction,
  onDelete,
  onOpenFiles,
}: {
  hash: string | null;
  preview?: Torrent;
  pending: PendingTorrentAction | null;
  onClose: () => void;
  onAction: (torrent: Torrent, action: TorrentAction) => void;
  onDelete: (torrent: Torrent) => void;
  onOpenFiles: (path: string) => void;
}) {
  const detail = useTorrentDetail(hash);
  const priorityMutation = useSetTorrentFilePriority(hash);
  const [tab, setTab] = useState<"files" | "trackers">("files");
  const [copied, setCopied] = useState(false);

  const changePriority = (file: TorrentFile, priority: TorrentFilePriority) => {
    priorityMutation.mutate(
      { indexes: [file.index], priority },
      {
        onError: (error) =>
          toast.error(
            error instanceof Error ? error.message : "The priority could not be changed.",
          ),
      },
    );
  };

  useEffect(() => {
    setTab("files");
  }, [hash]);

  const torrent = detail.data ?? preview;
  const isPending = pending?.hash === hash;
  const copyHash = async () => {
    if (!hash) return;
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      toast.success("Info hash copied.");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Could not copy on this device.");
    }
  };

  return (
    <Sheet open={Boolean(hash)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-[36rem]">
        {!hash ? null : detail.isPending && !preview ? (
          <div className="space-y-5 p-6 pr-14" aria-busy="true">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-10 w-4/5" />
            <Skeleton className="h-2 w-full" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
            <Skeleton className="h-40 w-full" />
          </div>
        ) : detail.isError && !preview ? (
          <div className="p-6">
            <ErrorState
              title="Details unavailable"
              message={
                detail.error instanceof Error
                  ? detail.error.message
                  : "The engine did not return this torrent."
              }
              onRetry={() => detail.refetch()}
            />
          </div>
        ) : torrent ? (
          <>
            <div className="border-b border-line px-5 pb-5 pr-14 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <TorrentStatus torrent={torrent} />
                {torrent.is_private ? <Badge>Private</Badge> : null}
              </div>
              <SheetTitle className="mt-3 line-clamp-2 pr-1 font-display text-[2rem] leading-[1.1] text-foreground">
                {torrent.name}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Torrent details, files, and trackers
              </SheetDescription>
              <button
                type="button"
                onClick={copyHash}
                className="data mt-2 inline-flex min-h-11 items-center gap-1.5 text-2xs text-faint transition-colors hover:text-foreground pointer-fine:min-h-0"
                aria-label="Copy info hash"
              >
                {shortHash(torrent.hash)}
                {copied ? <Check className="size-3 text-primary" /> : <Copy className="size-3" />}
              </button>

              <div className="mt-5 flex flex-wrap gap-2">
                {torrent.is_paused ? (
                  <Button
                    size="sm"
                    onClick={() => onAction(torrent, "resume")}
                    disabled={isPending}
                  >
                    <Play className="size-3.5" />
                    Resume
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAction(torrent, "pause")}
                    disabled={isPending}
                  >
                    <Pause className="size-3.5" />
                    Pause
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAction(torrent, "recheck")}
                  disabled={isPending || torrent.activity === "checking"}
                >
                  <RefreshCw
                    className={cn("size-3.5", torrent.activity === "checking" && "animate-spin")}
                  />
                  Recheck
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDelete(torrent)}
                  disabled={isPending}
                  className="text-danger hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2 className="size-3.5" />
                  Remove
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain">
              <div className="border-b border-line px-5 py-5 sm:px-6">
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <p className="text-2xs text-faint">
                      {torrent.is_complete ? "Downloaded" : "Downloading"}
                    </p>
                    <p className="data mt-1 text-sm text-foreground">
                      {formatBytes(torrent.downloaded)}
                      <span className="text-faint"> / {formatBytes(torrent.size)}</span>
                    </p>
                  </div>
                  <span className="display text-2xl text-foreground">
                    {formatPercent(torrent.progress * 100, torrent.progress > 0 ? 1 : 0)}
                  </span>
                </div>
                <Progress
                  value={torrent.progress * 100}
                  className="mt-3"
                  indicatorClassName={
                    torrent.is_complete
                      ? "bg-seeding"
                      : torrent.is_error
                        ? "bg-danger"
                        : undefined
                  }
                  label="Torrent progress"
                />

                <div className="mt-4 grid grid-cols-2 gap-x-4 sm:grid-cols-4">
                  <Stat label="Down" value={formatSpeed(torrent.download_speed)} />
                  <Stat label="Up" value={formatSpeed(torrent.upload_speed)} />
                  <Stat
                    label="ETA"
                    value={
                      torrent.is_complete
                        ? "Complete"
                        : formatEta(torrent.eta_seconds)
                    }
                  />
                  <Stat label="Ratio" value={torrent.ratio.toFixed(2)} />
                  <Stat label="Peers" value={String(torrent.peers)} />
                  <Stat label="Seeds" value={String(torrent.seeds)} />
                  <Stat label="Added" value={formatRelative(torrent.added_on)} />
                  <Stat
                    label="Completed"
                    value={torrent.completed_on ? formatRelative(torrent.completed_on) : "—"}
                  />
                </div>

                {torrent.save_path ? (
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-line bg-background/40 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-2xs text-faint">Save location</p>
                      <p className="data mt-0.5 truncate text-2xs text-muted" title={torrent.save_path}>
                        {torrent.save_path}
                      </p>
                    </div>
                    {torrent.content_path ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onOpenFiles(torrent.content_path)}
                        aria-label="Open save location in files"
                        className="shrink-0"
                      >
                        <FolderOpen className="size-3.5" />
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex border-b border-line px-5 sm:px-6">
                {(
                  [
                    ["files", "Files", detail.data?.files.length],
                    ["trackers", "Trackers", detail.data?.trackers.length],
                  ] as const
                ).map(([key, label, count]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    aria-pressed={tab === key}
                    className={cn(
                      "relative -mb-px min-h-11 px-3 py-3 text-xs transition-colors pointer-fine:min-h-0",
                      tab === key ? "text-foreground" : "text-faint hover:text-muted",
                    )}
                  >
                    {label}
                    {typeof count === "number" ? (
                      <span className="data ml-1.5 text-2xs text-faint">{count}</span>
                    ) : null}
                    {tab === key ? (
                      <span className="absolute inset-x-2 bottom-0 h-px bg-primary" />
                    ) : null}
                  </button>
                ))}
              </div>

              <div className="px-5 py-4 sm:px-6">
                {!detail.data ? (
                  <div className="space-y-3 py-2" aria-busy="true">
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-3/4" />
                  </div>
                ) : tab === "files" ? (
                  detail.data.files.length ? (
                    <ul className="divide-y divide-line">
                      {detail.data.files.map((file) => {
                        const complete = file.progress >= 0.999;
                        const priority = filePriority(file.priority);
                        const skipped = priority === "skip";
                        const canChoose = !torrent.is_complete;
                        return (
                          <li key={file.index} className="flex items-start gap-3 py-3">
                            {canChoose ? (
                              <button
                                type="button"
                                role="checkbox"
                                aria-checked={!skipped}
                                aria-label={`${skipped ? "Download" : "Skip"} ${file.name}`}
                                onClick={() =>
                                  changePriority(file, skipped ? "normal" : "skip")
                                }
                                disabled={priorityMutation.isPending}
                                className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-md border border-line bg-background/40 text-faint transition-colors hover:border-line-strong hover:text-foreground disabled:opacity-50 pointer-fine:size-7"
                              >
                                {skipped ? (
                                  <Square className="size-3.5" />
                                ) : (
                                  <SquareCheck className="size-3.5 text-primary" />
                                )}
                              </button>
                            ) : (
                              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded border border-line bg-background/40">
                                <FileTypeIcon
                                  category={fileCategory(file)}
                                  className="size-3.5"
                                />
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              <p
                                className="truncate text-xs text-foreground"
                                title={file.name}
                              >
                                {file.name}
                              </p>
                              <div className="mt-1.5 flex items-center gap-3">
                                <Progress
                                  value={file.progress * 100}
                                  className="h-0.5 max-w-[12rem]"
                                  indicatorClassName={complete ? "bg-seeding" : undefined}
                                />
                                <span className="data text-2xs text-faint">
                                  {formatPercent(file.progress * 100)}
                                </span>
                              </div>
                              <p className="mt-1 text-2xs text-faint">
                                {formatBytes(file.size)}
                                {!complete && file.availability > 0
                                  ? ` · ${file.availability.toFixed(1)}× available`
                                  : ""}
                              </p>
                            </div>
                            {canChoose ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    disabled={priorityMutation.isPending}
                                    aria-label={`Priority for ${file.name}`}
                                    className="mt-0.5 inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md border border-line bg-background/40 px-2.5 text-2xs text-muted transition-colors hover:border-line-strong hover:text-foreground disabled:opacity-50 pointer-fine:min-h-8"
                                  >
                                    {FILE_PRIORITY_LABELS[priority]}
                                    <ChevronDown className="size-3 text-faint" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  <DropdownMenuLabel>Download priority</DropdownMenuLabel>
                                  {(["normal", "high", "max"] as const).map((option) => (
                                    <DropdownMenuCheckboxItem
                                      key={option}
                                      checked={priority === option}
                                      onSelect={() => changePriority(file, option)}
                                    >
                                      {FILE_PRIORITY_LABELS[option]}
                                    </DropdownMenuCheckboxItem>
                                  ))}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuCheckboxItem
                                    checked={skipped}
                                    onSelect={() => changePriority(file, "skip")}
                                  >
                                    Don't download
                                  </DropdownMenuCheckboxItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="py-6 text-center text-xs text-faint">
                      Files are still being read from the engine.
                    </p>
                  )
                ) : detail.data.trackers.length ? (
                  <ul className="divide-y divide-line">
                    {detail.data.trackers.map((tracker) => (
                      <li key={`${tracker.tier}-${tracker.url}`} className="py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              tracker.status === 2
                                ? "bg-seeding"
                                : tracker.status === 4
                                  ? "bg-danger"
                                  : "bg-faint",
                            )}
                            aria-hidden="true"
                          />
                          <p className="truncate text-xs text-foreground" title={tracker.url}>
                            {trackerName(tracker.url)}
                          </p>
                          <span className="ml-auto shrink-0 text-2xs text-faint">
                            {tracker.status_label}
                          </span>
                        </div>
                        <div className="mt-1.5 flex gap-3 pl-3.5 text-2xs text-faint">
                          <span>{tracker.seeds} seeds</span>
                          <span>{tracker.peers} peers</span>
                          {tracker.message ? (
                            <span className="truncate text-danger/80">{tracker.message}</span>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="py-6 text-center text-xs text-faint">No trackers reported.</p>
                )}
              </div>

              <div className="flex items-center gap-3 border-t border-line px-5 py-3 text-2xs text-faint sm:px-6">
                <span>Added {formatDateTime(torrent.added_on)}</span>
                <span className="ml-auto data">{torrent.state}</span>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
