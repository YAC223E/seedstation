import { FolderOpen, HardDrive, Settings2 } from "lucide-react";
import { Link } from "react-router-dom";

import { Progress } from "@/components/ui/progress";
import { formatBytes, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FileRoot } from "@/types/api";

export function RootsList({
  roots,
  activePath,
  onSelect,
}: {
  roots: FileRoot[];
  activePath: string | null;
  onSelect: (path: string) => void;
}) {
  return (
    <aside className="panel hidden overflow-hidden xl:block">
      <div className="border-b border-line px-4 py-4">
        <h2 className="text-sm font-medium text-foreground">Locations</h2>
        <p className="mt-1 text-2xs text-faint">Folders this station can serve</p>
      </div>
      <div className="p-2">
        {roots.map((root) => {
          const active = activePath === root.path;
          return (
            <button
              key={root.path}
              type="button"
              onClick={() => onSelect(root.path)}
              className={cn(
                "relative w-full rounded-md p-2.5 text-left transition-colors",
                active ? "bg-raised" : "hover:bg-raised/60",
              )}
            >
              {active ? (
                <span className="absolute inset-y-2.5 left-0 w-[2px] rounded-full bg-primary" />
              ) : null}
              <div className="flex items-center gap-2">
                <FolderOpen
                  className={cn("size-3.5", active ? "text-primary" : "text-faint")}
                  strokeWidth={1.7}
                />
                <span className="truncate text-xs font-medium text-foreground">
                  {root.name}
                </span>
              </div>
              <p className="data mt-1.5 truncate pl-5.5 text-2xs text-faint" title={root.path}>
                {root.path}
              </p>
              <div className="mt-2.5 flex items-center gap-2 pl-5.5">
                <Progress
                  value={root.percent}
                  className="h-0.5 flex-1"
                  indicatorClassName={root.percent > 90 ? "bg-danger" : undefined}
                  label={`${root.name} disk usage`}
                />
                <span className="data text-2xs text-faint">
                  {formatPercent(root.percent, 0)}
                </span>
              </div>
              <p className="mt-1.5 pl-5.5 text-2xs text-faint">
                {formatBytes(root.free)} free of {formatBytes(root.total)}
              </p>
            </button>
          );
        })}
      </div>
      <div className="border-t border-line p-3">
        <Link
          to="/settings"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-2xs text-faint transition-colors hover:bg-raised hover:text-foreground"
        >
          <Settings2 className="size-3.5" />
          Manage locations
        </Link>
      </div>
    </aside>
  );
}

export function RootChips({
  roots,
  activePath,
  onSelect,
}: {
  roots: FileRoot[];
  activePath: string | null;
  onSelect: (path: string) => void;
}) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 xl:hidden">
      {roots.map((root) => {
        const active = activePath === root.path;
        return (
          <button
            key={root.path}
            type="button"
            onClick={() => onSelect(root.path)}
            aria-pressed={active}
            className={cn(
              "flex min-h-11 shrink-0 items-center gap-2 rounded-md border px-3 py-2.5 text-xs transition-colors",
              active
                ? "border-primary/30 bg-primary/[0.07] text-foreground"
                : "border-line bg-surface text-muted hover:border-line-strong",
            )}
          >
            <HardDrive className={cn("size-3.5", active ? "text-primary" : "text-faint")} />
            {root.name}
            <span className="data text-2xs text-muted">{formatBytes(root.free)} free</span>
          </button>
        );
      })}
    </div>
  );
}
