import { Database, Download, Upload, Waves } from "lucide-react";
import type { LiveSnapshot } from "@/types/api";
import { formatBytes, formatBytesParts, formatSpeedParts, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";

function StatCell({
  label,
  amount,
  unit,
  detail,
  icon: Icon,
  accent = false,
}: {
  label: string;
  amount: string;
  unit: string;
  detail: string;
  icon: typeof Download;
  accent?: boolean;
}) {
  return (
    <div className="relative flex min-w-0 flex-col gap-4 px-4 py-5 sm:px-5 lg:py-6">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted">{label}</span>
        <Icon
          className={cn("size-3.5", accent ? "text-primary" : "text-faint")}
          strokeWidth={1.8}
        />
      </div>
      <div className="flex items-baseline gap-1.5 min-w-0">
        <span
          className={cn(
            "display truncate text-[2rem] leading-none tracking-[-0.03em] sm:text-[2.5rem]",
            accent ? "text-primary" : "text-foreground",
          )}
        >
          {amount}
        </span>
        <span className="shrink-0 text-xs text-faint">{unit}</span>
      </div>
      <p className="truncate text-2xs text-faint" title={detail}>
        {detail}
      </p>
    </div>
  );
}

export function StatsBand({ snapshot }: { snapshot: LiveSnapshot }) {
  const down = formatSpeedParts(snapshot.transfer.download_speed);
  const up = formatSpeedParts(snapshot.transfer.upload_speed);
  const library = formatBytesParts(snapshot.summary.library_bytes);
  const motion =
    snapshot.summary.downloading + snapshot.summary.seeding;

  return (
    <section
      aria-label="Station totals"
      className="grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-surface/80 xl:grid-cols-4"
    >
      <StatCell
        label="Downstream"
        amount={down.amount}
        unit={down.unit}
        detail={`${formatBytes(snapshot.transfer.downloaded_session)} this session`}
        icon={Download}
        accent
      />
      <StatCell
        label="Upstream"
        amount={up.amount}
        unit={up.unit}
        detail={`${formatBytes(snapshot.transfer.uploaded_session)} this session`}
        icon={Upload}
      />
      <StatCell
        label="In motion"
        amount={String(motion)}
        unit={motion === 1 ? "route" : "routes"}
        detail={`${pluralize(snapshot.summary.downloading, "download")}, ${pluralize(
          snapshot.summary.seeding,
          "seed",
        )}`}
        icon={Waves}
      />
      <StatCell
        label="Library"
        amount={library.amount}
        unit={library.unit}
        detail={`${pluralize(snapshot.summary.completed, "complete torrent")} on disk`}
        icon={Database}
      />
    </section>
  );
}
