import {
  Ellipsis,
  FolderOpen,
  Info,
  Pause,
  Play,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { activityIcons, TorrentStatus } from "@/components/common/torrent-status";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  formatBytes,
  formatEta,
  formatPercent,
  formatSpeed,
  shortHash,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Torrent } from "@/types/api";

export type TorrentAction = "pause" | "resume" | "recheck";

export interface PendingTorrentAction {
  hash: string;
  action: TorrentAction | "delete";
}

export function TorrentRow({
  torrent,
  pending,
  onOpen,
  onAction,
  onDelete,
}: {
  torrent: Torrent;
  pending?: PendingTorrentAction | null;
  onOpen: () => void;
  onAction: (torrent: Torrent, action: TorrentAction) => void;
  onDelete: (torrent: Torrent) => void;
}) {
  const navigate = useNavigate();
  const Icon = activityIcons[torrent.activity] ?? activityIcons.unknown;
  const isPending = pending?.hash === torrent.hash;
  const isChecking = torrent.activity === "checking";
  const progress = torrent.progress * 100;
  const seeding = torrent.is_seeding;
  const canPause = !torrent.is_paused;
  const canResume = torrent.is_paused || torrent.is_error;
  const controlsLocked = isPending;

  const openFiles = () => {
    if (torrent.content_path) {
      navigate(`/files?path=${encodeURIComponent(torrent.content_path)}`);
    } else {
      navigate("/files");
    }
  };

  return (
    <article
      className={cn(
        "group relative border-b border-line transition-colors last:border-b-0 hover:bg-raised/40",
        isPending && "bg-raised/30",
      )}
    >
      <div className="flex items-start gap-1.5 p-3.5 sm:gap-3 sm:p-4">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 rounded-sm text-left focus-visible:outline-offset-4"
        >
          <span className="sr-only">View details: </span>
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 grid size-9 shrink-0 place-items-center rounded-md border",
                torrent.is_error
                  ? "border-danger/20 bg-danger/[0.07] text-danger"
                  : seeding
                    ? "border-seeding/20 bg-seeding/[0.07] text-seeding"
                    : torrent.is_paused
                      ? "border-line bg-background/50 text-faint"
                      : "border-primary/20 bg-primary/[0.07] text-primary",
              )}
            >
              <Icon
                className={cn(
                  "size-4",
                  torrent.activity === "checking" && "animate-spin",
                )}
                strokeWidth={1.8}
              />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                <h3 className="line-clamp-2 max-w-full text-[13px] font-medium leading-snug text-foreground sm:line-clamp-1">
                  {torrent.name}
                </h3>
                <TorrentStatus torrent={torrent} />
                {torrent.is_private ? (
                  <span className="text-2xs text-faint">Private</span>
                ) : null}
              </div>

              <div className="mt-2 flex items-center gap-2">
                <Progress
                  value={progress}
                  className="h-1 max-w-lg"
                  indicatorClassName={
                    torrent.is_error
                      ? "bg-danger"
                      : seeding
                        ? "bg-seeding"
                        : torrent.is_paused
                          ? "bg-faint"
                          : undefined
                  }
                  label={`${torrent.name} progress`}
                />
                <span className="data shrink-0 text-2xs text-faint">
                  {formatPercent(progress, progress > 0 && progress < 100 ? 1 : 0)}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-faint">
                <span className="data hidden sm:inline">{shortHash(torrent.hash)}</span>
                <span className="data">
                  {formatBytes(torrent.downloaded)} of {formatBytes(torrent.size)}
                </span>
                <span className="data inline-flex items-center gap-1">
                  <span className="text-primary/80">↓</span>
                  {formatSpeed(torrent.download_speed)}
                </span>
                <span className="data inline-flex items-center gap-1">
                  <span className="text-seeding/80">↑</span>
                  {formatSpeed(torrent.upload_speed)}
                </span>
                <span className="data">
                  {seeding
                    ? `Ratio ${torrent.ratio.toFixed(2)}`
                    : torrent.eta_seconds != null
                      ? `ETA ${formatEta(torrent.eta_seconds)}`
                      : torrent.is_paused
                        ? "Paused"
                        : "Waiting"}
                </span>
              </div>
            </div>
          </div>
        </button>

        <div className="flex items-center gap-1">
          {canPause ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="hidden size-8 place-items-center rounded-md text-faint transition-colors hover:bg-surface hover:text-foreground disabled:opacity-40 sm:grid pointer-coarse:size-11"
                  aria-label={`Pause ${torrent.name}`}
                  disabled={controlsLocked}
                  onClick={() => onAction(torrent, "pause")}
                >
                  <Pause className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Pause</TooltipContent>
            </Tooltip>
          ) : canResume ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="hidden size-8 place-items-center rounded-md text-faint transition-colors hover:bg-surface hover:text-primary disabled:opacity-40 sm:grid pointer-coarse:size-11"
                  aria-label={`Resume ${torrent.name}`}
                  disabled={controlsLocked}
                  onClick={() => onAction(torrent, "resume")}
                >
                  <Play className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Resume</TooltipContent>
            </Tooltip>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="grid size-11 place-items-center rounded-md text-faint transition-colors hover:bg-surface hover:text-foreground pointer-fine:size-8"
                aria-label={`Actions for ${torrent.name}`}
              >
                <Ellipsis className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>{torrent.name}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onOpen}>
                <Info className="size-4 text-faint" />
                View details
              </DropdownMenuItem>
              {torrent.content_path ? (
                <DropdownMenuItem onSelect={openFiles}>
                  <FolderOpen className="size-4 text-faint" />
                  Open in files
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              {canPause ? (
                <DropdownMenuItem
                  disabled={controlsLocked}
                  onSelect={() => onAction(torrent, "pause")}
                >
                  <Pause className="size-4 text-faint" />
                  Pause
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  disabled={controlsLocked}
                  onSelect={() => onAction(torrent, "resume")}
                >
                  <Play className="size-4 text-faint" />
                  Resume
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                disabled={controlsLocked || isChecking}
                onSelect={() => onAction(torrent, "recheck")}
              >
                <RefreshCw className={cn("size-4 text-faint", isChecking && "animate-spin")} />
                Recheck files
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                danger
                disabled={controlsLocked}
                onSelect={() => onDelete(torrent)}
              >
                <Trash2 className="size-4" />
                Remove torrent…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {isPending ? (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px overflow-hidden">
          <span className="block h-full w-1/3 animate-pulse bg-primary" />
        </span>
      ) : null}
    </article>
  );
}
