import { Download, FileQuestion, LoaderCircle, Music2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { FileTypeIcon } from "@/components/files/file-type-icon";
import { ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useTextPreview } from "@/hooks/use-api";
import { downloadUrl } from "@/lib/api";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FileEntry } from "@/types/api";

function PreviewFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex min-h-[18rem] items-center justify-center overflow-hidden bg-[#070b06]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function FilePreviewDialog({
  entry,
  onOpenChange,
}: {
  entry: FileEntry | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [imageError, setImageError] = useState(false);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const downloadGuard = useRef(false);
  const text = useTextPreview(entry?.category === "text" ? entry.path : null);
  const url = entry ? downloadUrl(entry.path, true) : "";

  useEffect(() => {
    setImageError(false);
    setDownloadStarted(false);
    downloadGuard.current = false;
  }, [entry?.path]);

  const download = entry ? downloadUrl(entry.path) : "#";

  const notifyDownload = () => {
    if (!entry || downloadGuard.current) return;
    downloadGuard.current = true;
    setDownloadStarted(true);
    toast.success("Download started.", { description: entry.name });
    window.setTimeout(() => {
      downloadGuard.current = false;
      setDownloadStarted(false);
    }, 1200);
  };

  return (
    <Dialog open={Boolean(entry)} onOpenChange={onOpenChange}>
      {entry ? (
        <DialogContent
          className="max-w-6xl gap-0 overflow-x-hidden border-line-strong bg-surface p-0 pb-0 sm:p-0"
          showClose={false}
        >
          <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-surface px-4 py-3 pr-2 sm:px-5">
            <FileTypeIcon category={entry.category} className="size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate font-sans text-[13px] font-medium text-foreground">
                {entry.name}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-2xs text-faint">
                {entry.is_dir ? "Folder" : formatBytes(entry.size)}
                {entry.category !== "other" && !entry.is_dir ? ` · ${entry.category}` : ""}
              </DialogDescription>
            </div>
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
              <a href={download} onClick={notifyDownload} aria-label={`Download ${entry.name}`}>
                <Download className="size-3.5" />
                Download
              </a>
            </Button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="grid size-11 shrink-0 place-items-center rounded-md text-faint transition-colors hover:bg-raised hover:text-foreground pointer-fine:size-8"
              aria-label="Close preview"
            >
              <X className="size-4" />
            </button>
          </div>

          {entry.category === "image" ? (
            <PreviewFrame className="max-h-[72dvh] min-h-[16rem] bg-checker">
              {imageError ? (
                <div className="flex max-w-sm flex-col items-center px-6 text-center">
                  <FileQuestion className="size-8 text-faint" />
                  <p className="mt-3 text-sm text-foreground">This image can’t be shown here.</p>
                  <p className="mt-1 text-xs text-muted">
                    The browser may not support this format. Download it to open in another
                    app.
                  </p>
                  <Button asChild size="sm" className="mt-4">
                    <a
                      href={download}
                      onClick={notifyDownload}
                      aria-label={`Download ${entry.name}`}
                    >
                      <Download className="size-3.5" />
                      Download file
                    </a>
                  </Button>
                </div>
              ) : (
                <img
                  key={entry.path}
                  src={url}
                  alt={entry.name}
                  onError={() => setImageError(true)}
                  className="max-h-[72dvh] max-w-full object-contain"
                />
              )}
            </PreviewFrame>
          ) : entry.category === "video" ? (
            <PreviewFrame>
              <video
                key={entry.path}
                src={url}
                controls
                playsInline
                preload="metadata"
                className="max-h-[72dvh] w-full bg-black"
              >
                Your browser does not support video playback.
              </video>
            </PreviewFrame>
          ) : entry.category === "audio" ? (
            <PreviewFrame className="min-h-[13rem]">
              <div className="w-full max-w-md px-6">
                <div className="mb-6 flex items-center gap-4">
                  <span className="grid size-12 place-items-center rounded-full border border-seeding/20 bg-seeding/[0.07] text-seeding">
                    <Music2 className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{entry.name}</p>
                    <p className="mt-1 text-2xs text-faint">{formatBytes(entry.size)}</p>
                  </div>
                </div>
                <audio key={entry.path} src={url} controls className="w-full">
                  Your browser does not support audio playback.
                </audio>
              </div>
            </PreviewFrame>
          ) : entry.category === "text" ? (
            <PreviewFrame className="block min-h-[18rem] overflow-auto bg-surface">
              {text.isPending ? (
                <div className="space-y-3 p-5" aria-busy="true">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ) : text.isError ? (
                <div className="p-5">
                  <ErrorState
                    title="Preview unavailable"
                    message={
                      text.error instanceof Error
                        ? text.error.message
                        : "This file could not be read as text."
                    }
                    onRetry={() => text.refetch()}
                  />
                </div>
              ) : (
                <pre className="whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed text-muted sm:p-5">
                  {text.data?.content}
                </pre>
              )}
              {text.data?.truncated ? (
                <p className="border-t border-line px-4 py-2 text-2xs text-faint">
                  Preview truncated to the first 512 KB.
                </p>
              ) : null}
            </PreviewFrame>
          ) : entry.category === "document" && entry.mime === "application/pdf" ? (
            <iframe
              key={entry.path}
              src={url}
              title={`Preview of ${entry.name}`}
              className="h-[58dvh] w-full bg-white sm:h-[72dvh]"
            />
          ) : (
            <PreviewFrame className="min-h-[18rem]">
              <div className="flex max-w-sm flex-col items-center px-6 text-center">
                <span className="grid size-12 place-items-center rounded-full border border-line-strong bg-raised">
                  <FileQuestion className="size-5 text-faint" />
                </span>
                <p className="mt-4 text-sm text-foreground">No preview for this file.</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">
                  Download it to open with an app that supports {entry.extension || "this"} files.
                </p>
                <Button asChild size="sm" className="mt-4">
                  <a href={download}>
                    <Download className="size-3.5" />
                    Download file
                  </a>
                </Button>
              </div>
            </PreviewFrame>
          )}

          <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t border-line bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:pb-3">
            <p className="data min-w-0 flex-1 truncate text-2xs text-faint" title={entry.path}>
              {entry.path}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              {text.isFetching ? <LoaderCircle className="size-3.5 animate-spin text-faint" /> : null}
              <Button asChild size="sm" className="sm:hidden" aria-busy={downloadStarted}>
                <a
                  href={download}
                  onClick={notifyDownload}
                  aria-label={`Download ${entry.name}`}
                  aria-disabled={downloadStarted}
                  className={downloadStarted ? "pointer-events-none opacity-70" : undefined}
                >
                  {downloadStarted ? (
                    <LoaderCircle className="size-3.5 animate-spin" />
                  ) : (
                    <Download className="size-3.5" />
                  )}
                  {downloadStarted ? "Starting…" : "Download"}
                </a>
              </Button>
            </div>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
