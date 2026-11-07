import { useLive } from "@/providers/live-provider";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function LiveIndicator({ compact = false }: { compact?: boolean }) {
  const { connection, snapshot } = useLive();
  const engineOnline = snapshot?.engine.online ?? false;
  const isLive = connection === "live";
  const label = isLive ? "Live" : connection === "connecting" ? "Connecting" : "Polling";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-2 text-2xs text-muted",
            compact && "gap-1.5",
          )}
          role="status"
          aria-label={
            engineOnline
              ? `Engine online, updates ${label.toLowerCase()}`
              : "Torrent engine offline"
          }
        >
          <span className="live-dot" data-offline={!engineOnline} />
          {!compact ? <span>{label}</span> : null}
          {!compact && snapshot?.engine.version ? (
            <span className="data text-faint">qB {snapshot.engine.version}</span>
          ) : null}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {engineOnline
          ? `${label} updates${snapshot?.engine.version ? ` · qBittorrent ${snapshot.engine.version}` : ""}`
          : snapshot?.engine.error || "The torrent engine is not reachable."}
      </TooltipContent>
    </Tooltip>
  );
}

export function ConnectionBadge() {
  const { connection, snapshot } = useLive();
  const engineOnline = snapshot?.engine.online ?? false;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="live-dot" data-offline={!engineOnline} />
      <span className="text-xs text-muted">
        {engineOnline
          ? connection === "live"
            ? "Engine live"
            : "Engine online"
          : "Engine offline"}
      </span>
    </span>
  );
}
