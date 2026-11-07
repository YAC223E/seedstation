import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CirclePause,
  Clock3,
  LoaderCircle,
  Radio,
  Search,
  Sprout,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { TorrentActivity, Torrent } from "@/types/api";

const activityMeta: Record<
  TorrentActivity,
  { label: string; tone: "neutral" | "signal" | "seeding" | "warning" | "danger" | "info"; icon: typeof ArrowDown }
> = {
  downloading: { label: "Downloading", tone: "signal", icon: ArrowDown },
  seeding: { label: "Seeding", tone: "seeding", icon: ArrowUp },
  paused: { label: "Paused", tone: "neutral", icon: CirclePause },
  checking: { label: "Checking", tone: "info", icon: LoaderCircle },
  metadata: { label: "Metadata", tone: "info", icon: Radio },
  error: { label: "Needs attention", tone: "danger", icon: AlertCircle },
  unknown: { label: "Waiting", tone: "neutral", icon: Clock3 },
};

export function TorrentStatus({ torrent }: { torrent: Torrent }) {
  if (torrent.is_complete && !torrent.is_paused && !torrent.is_error) {
    return (
      <Badge tone="seeding" dot>
        Seeding
      </Badge>
    );
  }
  const meta = activityMeta[torrent.activity] ?? activityMeta.unknown;
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
}

export function statusLabel(torrent: Torrent): string {
  if (torrent.is_complete && !torrent.is_paused && !torrent.is_error) return "Seeding";
  return activityMeta[torrent.activity]?.label ?? "Waiting";
}

export const activityIcons = {
  downloading: ArrowDown,
  seeding: Sprout,
  paused: CirclePause,
  checking: LoaderCircle,
  metadata: Search,
  error: AlertCircle,
  unknown: Clock3,
  complete: CheckCircle2,
};
