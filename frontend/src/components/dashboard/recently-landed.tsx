import { ArrowUpRight, PackageCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { SectionHeading } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/states";
import { formatBytes, formatRelative } from "@/lib/format";
import type { Torrent } from "@/types/api";

export function RecentlyLanded({ torrents }: { torrents: Torrent[] }) {
  return (
    <section className="panel flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-4 sm:px-5">
        <SectionHeading title="Recently landed" />
        <Link
          to="/files"
          className="inline-flex min-h-11 items-center gap-1.5 text-xs text-muted transition-colors hover:text-primary pointer-fine:min-h-0"
        >
          Library
          <ArrowUpRight className="size-3.5" />
        </Link>
      </div>

      {torrents.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Nothing landed yet"
          description="Completed downloads will gather here, ready to open or share across your network."
          className="py-12"
        />
      ) : (
        <div className="divide-y divide-line">
          {torrents.slice(0, 4).map((torrent) => {
            const target = torrent.content_path
              ? `/files?path=${encodeURIComponent(torrent.content_path)}`
              : "/files";
            return (
              <Link
                key={torrent.hash}
                to={target}
                className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-raised/50 sm:px-5"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-md border border-line bg-background/40 text-faint transition-colors group-hover:text-primary">
                  <PackageCheck className="size-3.5" strokeWidth={1.7} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-foreground">{torrent.name}</p>
                  <p className="mt-0.5 text-2xs text-faint">
                    {formatBytes(torrent.size)} · {formatRelative(torrent.completed_on)}
                  </p>
                </div>
                <ArrowUpRight className="size-3.5 shrink-0 text-faint transition-colors group-hover:text-primary" />
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-auto border-t border-line px-4 py-2.5 sm:px-5">
        <p className="text-2xs text-faint">
          Files are served directly from this station. No third-party cloud.
        </p>
      </div>
    </section>
  );
}
