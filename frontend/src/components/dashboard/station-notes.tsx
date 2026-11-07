import { Check, Copy, Cpu, Gauge, Globe2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/format";
import type { LiveSnapshot } from "@/types/api";

function Note({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Cpu;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface/75 p-4 sm:p-5">
      <div className="flex items-center gap-2 text-2xs text-faint">
        <Icon className="size-3.5" strokeWidth={1.7} />
        {label}
      </div>
      <div className="mt-3 space-y-1.5">{children}</div>
    </div>
  );
}

export function StationNotes({ snapshot }: { snapshot: LiveSnapshot }) {
  const [copied, setCopied] = useState(false);
  const { server, engine, transfer } = snapshot;

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(server.lan_url);
      setCopied(true);
      toast.success("LAN address copied.");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy the address on this device.");
    }
  };

  return (
    <section className="mt-5 overflow-hidden rounded-xl border border-line bg-line">
      <div className="grid gap-px sm:grid-cols-2 xl:grid-cols-4">
        <Note icon={Globe2} label="Station address">
          <div className="flex items-center justify-between gap-2">
            <p className="data truncate text-xs text-foreground">{server.lan_url}</p>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={copyAddress}
              aria-label="Copy LAN address"
              className="shrink-0"
            >
              {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
            </Button>
          </div>
          <p className="text-2xs text-faint">
            {server.lan_only ? "Reachable on private networks only" : "LAN restriction disabled"}
          </p>
        </Note>

        <Note icon={Gauge} label="Torrent engine">
          <div className="flex items-center gap-2">
            <span className="live-dot" data-offline={!engine.online} />
            <p className="text-xs text-foreground">
              {engine.online ? `qBittorrent ${engine.version ?? ""}` : "Offline"}
            </p>
          </div>
          <p className="text-2xs text-faint">
            {engine.online
              ? `API ${engine.api_version ?? "unknown"} · ${transfer.connection_label}`
              : engine.error || "Waiting for the engine to return."}
          </p>
        </Note>

        <Note icon={Cpu} label="Host">
          <p className="truncate text-xs text-foreground">{server.hostname}</p>
          <p className="line-clamp-1 text-2xs text-faint" title={server.os}>
            {server.os} on {server.kernel}
          </p>
        </Note>

        <Note icon={Gauge} label="Time at the station">
          <div className="flex items-center gap-2">
            <p className="data text-xs text-foreground">
              {formatDuration(server.process_uptime_seconds)}
            </p>
            <Badge tone="neutral" className="h-5 px-2">
              app uptime
            </Badge>
          </div>
          <p className="text-2xs text-faint">
            Server up {formatDuration(server.server_uptime_seconds)}
          </p>
        </Note>
      </div>
    </section>
  );
}
