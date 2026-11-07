import { ArrowUpDown, Check, Search, X } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type TorrentFilter =
  | "all"
  | "downloading"
  | "seeding"
  | "complete"
  | "paused"
  | "error";

export type TorrentSort = "added" | "name" | "progress" | "size" | "speed";

export const filterLabels: Array<{ key: TorrentFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "downloading", label: "Downloading" },
  { key: "seeding", label: "Seeding" },
  { key: "complete", label: "Complete" },
  { key: "paused", label: "Paused" },
  { key: "error", label: "Attention" },
];

const sortLabels: Array<{ key: TorrentSort; label: string }> = [
  { key: "added", label: "Recently added" },
  { key: "name", label: "Name A–Z" },
  { key: "progress", label: "Least complete" },
  { key: "size", label: "Largest first" },
  { key: "speed", label: "Fastest now" },
];

export function FilterBar({
  filter,
  onFilterChange,
  counts,
  search,
  onSearchChange,
  sort,
  onSortChange,
}: {
  filter: TorrentFilter;
  onFilterChange: (filter: TorrentFilter) => void;
  counts: Record<TorrentFilter, number>;
  search: string;
  onSearchChange: (value: string) => void;
  sort: TorrentSort;
  onSortChange: (sort: TorrentSort) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-line px-3 py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-5 lg:px-4">
      <div
        className="no-scrollbar -mx-1 flex min-w-0 items-center gap-0.5 overflow-x-auto px-1"
        role="group"
        aria-label="Filter downloads"
      >
        {filterLabels.map((item) => {
          const active = filter === item.key;
          const count = counts[item.key];
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onFilterChange(item.key)}
              aria-pressed={active}
              className={cn(
                "relative min-h-11 shrink-0 rounded-sm px-3 py-2.5 text-xs transition-colors pointer-fine:min-h-0 pointer-fine:px-2.5 pointer-fine:py-2",
                active ? "text-foreground" : "text-faint hover:text-muted",
              )}
            >
              {item.label}
              <span className={cn("data ml-1.5 text-2xs", active ? "text-primary" : "text-faint/70")}>
                {count}
              </span>
              {active ? (
                <span className="absolute inset-x-1.5 -bottom-[13px] h-px bg-primary" />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 sm:w-60">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search name or hash"
            aria-label="Search downloads"
            className="h-11 pl-8 pr-11 text-base pointer-fine:h-9 pointer-fine:pr-8 pointer-fine:text-xs"
          />
          {search ? (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
              className="absolute right-0 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-sm text-faint hover:text-foreground pointer-fine:size-9"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex h-11 shrink-0 items-center justify-between gap-2 rounded-md border border-line px-3 text-sm text-muted transition-colors hover:border-line-strong hover:text-foreground pointer-fine:h-9 pointer-fine:text-xs"
              aria-label={`Sort downloads: ${sortLabels.find((item) => item.key === sort)?.label ?? "recently added"}`}
            >
              <ArrowUpDown className="size-3.5" />
              <span>{sortLabels.find((item) => item.key === sort)?.label}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Sort downloads</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {sortLabels.map((item) => (
              <DropdownMenuCheckboxItem
                key={item.key}
                checked={sort === item.key}
                onSelect={() => onSortChange(item.key)}
              >
                {item.label}
                {sort === item.key ? <Check className="ml-auto size-3.5" /> : null}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
