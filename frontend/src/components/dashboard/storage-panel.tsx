import { ArrowUpRight, FolderOpen } from "lucide-react";
import { Link } from "react-router-dom";

import { GrowthRings } from "@/components/common/growth-rings";
import { ProgressRing } from "@/components/common/progress-ring";
import { SectionHeading } from "@/components/common/page-header";
import { formatBytes, formatPercent } from "@/lib/format";
import type { Storage } from "@/types/api";

export function StoragePanel({ storage }: { storage: Storage }) {
  const usedPercent = Math.min(100, storage.percent || 0);
  const libraryPercent =
    storage.total > 0 ? Math.min(usedPercent, (storage.library_bytes / storage.total) * 100) : 0;
  const otherUsed = Math.max(0, storage.used - storage.library_bytes);

  return (
    <section className="panel relative flex flex-col overflow-hidden">
      <div className="pointer-events-none absolute -bottom-32 -right-28 size-80 text-primary opacity-[0.07]">
        <GrowthRings className="size-full" />
      </div>

      <div className="relative border-b border-line px-5 py-4">
        <SectionHeading
          title="Storage"
          meta={
            <span className="flex items-center gap-1.5">
              <FolderOpen className="size-3 text-faint" />
              <span className="max-w-32 truncate" title={storage.path}>
                {storage.path.split("/").filter(Boolean).pop() || "/"}
              </span>
            </span>
          }
        />
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center px-5 py-7">
        <ProgressRing value={usedPercent} size={158} stroke={5}>
          <span className="display text-[2.9rem] leading-none text-foreground">
            {formatPercent(usedPercent, 0)}
          </span>
          <span className="mt-1 text-2xs text-faint">of disk used</span>
        </ProgressRing>

        <div className="mt-6 w-full">
          <div className="flex h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <span
              className="h-full bg-primary"
              style={{ width: `${libraryPercent}%` }}
            />
            <span
              className="h-full bg-line-strong"
              style={{
                width: `${Math.max(0, usedPercent - libraryPercent)}%`,
              }}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-2xs text-faint">
                <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                Library
              </div>
              <p className="data mt-1 text-sm text-foreground">
                {formatBytes(storage.library_bytes)}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-2xs text-faint">
                <span className="size-1.5 rounded-full bg-line-strong" aria-hidden="true" />
                Other files
              </div>
              <p className="data mt-1 text-sm text-foreground">{formatBytes(otherUsed)}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex w-full items-end justify-between border-t border-line pt-4">
          <div>
            <p className="text-2xs text-faint">Room remaining</p>
            <p className="data mt-1 text-sm text-foreground">{formatBytes(storage.free)}</p>
          </div>
          <Link
            to="/files"
            className="inline-flex min-h-11 items-center gap-1.5 text-xs text-muted transition-colors hover:text-primary pointer-fine:min-h-0"
          >
            Open files
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
