import {
  Archive,
  Download,
  Ellipsis,
  Eye,
  FolderOpen,
  Link2,
  Trash2,
} from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

import { FileTypeIcon } from "@/components/files/file-type-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { archiveUrl, downloadUrl } from "@/lib/api";
import { formatBytes, formatDate } from "@/lib/format";
import type { FileEntry } from "@/types/api";

function triggerDownload(url: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function FileRow({
  entry,
  onOpen,
  onDelete,
}: {
  entry: FileEntry;
  onOpen: (entry: FileEntry) => void;
  onDelete: (entry: FileEntry) => void;
}) {
  const copyPath = async () => {
    try {
      await navigator.clipboard.writeText(entry.path);
      toast.success("Path copied.");
    } catch {
      toast.error("Could not copy path on this device.");
    }
  };

  const lastDownload = useRef(0);
  const download = () => {
    const now = Date.now();
    if (now - lastDownload.current < 1200) return;
    lastDownload.current = now;
    triggerDownload(entry.is_dir ? archiveUrl(entry.path) : downloadUrl(entry.path));
    toast.success(entry.is_dir ? "ZIP download started." : "Download started.", {
      description: entry.name,
    });
  };

  return (
    <article className="group flex min-w-0 items-center gap-1 border-b border-line transition-colors last:border-b-0 hover:bg-raised/40">
      <button
        type="button"
        onClick={() => onOpen(entry)}
        className="grid min-w-0 flex-1 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left focus-visible:outline-offset-[-2px] sm:grid-cols-[2rem_minmax(0,1fr)_7rem_9rem] sm:gap-4"
      >
        <span className="sr-only">{entry.is_dir ? "Open folder: " : "Preview: "}</span>
        <span className="grid size-8 place-items-center rounded-md border border-line bg-background/40">
          <FileTypeIcon category={entry.category} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] text-foreground" title={entry.name}>
            {entry.name}
          </span>
          <span className="mt-0.5 flex items-center gap-2 text-2xs text-faint sm:hidden">
            <span>{entry.is_dir ? "Folder" : formatBytes(entry.size)}</span>
            <span aria-hidden="true">·</span>
            <span>{formatDate(entry.modified)}</span>
          </span>
        </span>
        <span className="hidden text-right text-2xs text-faint sm:block">
          {entry.is_dir ? "Folder" : formatBytes(entry.size)}
        </span>
        <span className="hidden text-right text-2xs text-faint sm:block">
          {formatDate(entry.modified)}
        </span>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="mr-0.5 grid size-11 shrink-0 place-items-center rounded-md text-faint transition-colors hover:bg-surface hover:text-foreground sm:mr-1 pointer-fine:size-8"
            aria-label={`Actions for ${entry.name}`}
          >
            <Ellipsis className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="truncate">{entry.name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onOpen(entry)}>
            {entry.is_dir ? (
              <FolderOpen className="size-4 text-faint" />
            ) : (
              <Eye className="size-4 text-faint" />
            )}
            {entry.is_dir ? "Open folder" : "Preview"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={download}>
            {entry.is_dir ? (
              <Archive className="size-4 text-faint" />
            ) : (
              <Download className="size-4 text-faint" />
            )}
            {entry.is_dir ? "Download as ZIP" : "Download"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={copyPath}>
            <Link2 className="size-4 text-faint" />
            Copy path
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem danger onSelect={() => onDelete(entry)}>
            <Trash2 className="size-4" />
            Delete{entry.is_dir ? " folder" : " file"}…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </article>
  );
}
