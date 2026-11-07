import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArrowLeft,
  ChevronRight,
  FolderOpen,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState, ErrorState } from "@/components/common/states";
import { FilePreviewDialog } from "@/components/files/file-preview-dialog";
import { FileRow } from "@/components/files/file-row";
import { FileTypeIcon } from "@/components/files/file-type-icon";
import { RootChips, RootsList } from "@/components/files/roots-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useFileListing, useFileRoots } from "@/hooks/use-api";
import { ApiError, archiveUrl, apiFetch } from "@/lib/api";
import { formatBytes, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FileEntry } from "@/types/api";

function rootForPath(
  roots: Array<{ path: string }>,
  path: string | null,
): string | null {
  if (!path) return null;
  return (
    roots.find((root) => path === root.path || path.startsWith(`${root.path}/`))?.path ??
    null
  );
}

function parentWithinRoot(filePath: string, rootPath: string): string {
  const trimmed = filePath.replace(/\/+$/, "");
  const parts = trimmed.split("/");
  parts.pop();
  const parent = parts.join("/") || "/";
  return parent.length >= rootPath.length ? parent : rootPath;
}

function FileListSkeleton() {
  return (
    <div className="divide-y divide-line" aria-busy="true" aria-label="Loading files">
      {Array.from({ length: 7 }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 px-4 py-3.5">
          <Skeleton className="size-8 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2 w-1/4 sm:hidden" />
          </div>
          <Skeleton className="hidden h-2.5 w-16 sm:block" />
          <Skeleton className="hidden h-2.5 w-20 sm:block" />
          <Skeleton className="size-7" />
        </div>
      ))}
    </div>
  );
}

export function FilesPage() {
  const rootsQuery = useFileRoots();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<FileEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FileEntry | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const autoOpened = useRef<string | null>(null);
  const queryClient = useQueryClient();

  const roots = useMemo(() => rootsQuery.data ?? [], [rootsQuery.data]);
  const pathParam = searchParams.get("path");
  const activePath = pathParam || roots[0]?.path || null;

  const setPath = (path: string, options?: { replace?: boolean }) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("path", path);
        return next;
      },
      { replace: options?.replace ?? false },
    );
  };

  useEffect(() => {
    if (!pathParam && roots.length) {
      setPath(roots[0].path, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathParam, roots]);

  useEffect(() => {
    setSearch("");
    setPreview(null);
  }, [activePath]);

  const listing = useFileListing(activePath);
  const listingData = listing.data?.path === activePath ? listing.data : undefined;
  const fileLinkError =
    listing.error instanceof ApiError && listing.error.code === "not_a_directory";

  // A link from the dashboard can point directly to a completed single-file
  // torrent. Open its containing folder, then surface the preview immediately.
  useEffect(() => {
    if (!fileLinkError || !activePath || !pathParam) return;
    if (autoOpened.current === activePath) return;
    autoOpened.current = activePath;
    const root = rootForPath(roots, activePath);
    if (!root) return;
    setPendingPreview(activePath);
    setPath(parentWithinRoot(activePath, root), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileLinkError, activePath, pathParam, roots]);

  useEffect(() => {
    if (!pendingPreview || !listingData) return;
    const match = listingData.entries.find((entry) => entry.path === pendingPreview);
    if (match) setPreview(match);
    setPendingPreview(null);
  }, [pendingPreview, listingData]);

  const deleteMutation = useMutation({
    mutationFn: (entry: FileEntry) =>
      apiFetch<void>("/api/files/delete/", {
        method: "POST",
        body: { path: entry.path, confirm: "DELETE", recursive: entry.is_dir },
      }),
    onSuccess: (_data, entry) => {
      toast.success(`${entry.is_dir ? "Folder" : "File"} deleted.`);
      setDeleteTarget(null);
      setDeleteError(null);
      setPreview((current) =>
        current && (current.path === entry.path || current.path.startsWith(`${entry.path}/`))
          ? null
          : current,
      );
      void queryClient.invalidateQueries({ queryKey: ["files"] });
      void queryClient.invalidateQueries({ queryKey: ["file-roots"] });
      void queryClient.invalidateQueries({ queryKey: ["file-text"] });
    },
    onError: (error) => {
      setDeleteError(
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "The file could not be deleted.",
      );
    },
  });

  const filtered = useMemo(() => {
    if (!listingData) return [];
    const needle = search.trim().toLowerCase();
    if (!needle) return listingData.entries;
    return listingData.entries.filter((entry) => entry.name.toLowerCase().includes(needle));
  }, [listingData, search]);

  const openEntry = (entry: FileEntry) => {
    if (entry.is_dir) {
      setPath(entry.path);
      return;
    }
    setPreview(entry);
  };

  const description = listingData
    ? `${pluralize(listingData.directory_count, "folder")}, ${pluralize(
        listingData.file_count,
        "file",
      )} in ${listingData.root.name}.`
    : fileLinkError
      ? "Opening the containing folder…"
      : listing.isPending
        ? "Walking the library…"
        : "Browse downloaded files, preview media, and pull folders down as ZIPs.";

  return (
    <>
      <PageHeader title="The library." description={description} />

      <RootChips roots={roots} activePath={activePath} onSelect={setPath} />

      <div className="mt-3 grid items-start gap-5 xl:mt-0 xl:grid-cols-[15.5rem_minmax(0,1fr)]">
        {rootsQuery.isPending ? (
          <Skeleton className="hidden h-80 rounded-xl xl:block" />
        ) : rootsQuery.isError ? null : (
          <RootsList roots={roots} activePath={activePath} onSelect={setPath} />
        )}

        {rootsQuery.isError ? (
          <ErrorState
            title="Locations unavailable"
            message={
              rootsQuery.error instanceof Error
                ? rootsQuery.error.message
                : "The allowed download folders could not be loaded."
            }
            onRetry={() => rootsQuery.refetch()}
          />
        ) : rootsQuery.isSuccess && roots.length === 0 ? (
          <section className="panel">
            <EmptyState
              icon={FolderOpen}
              title="No locations configured"
              description="Add a download directory in Settings. SeedStation only serves files from folders you explicitly allow."
              action={
                <Button asChild size="sm">
                  <Link to="/settings">Open settings</Link>
                </Button>
              }
            />
          </section>
        ) : (
          <section className="panel min-w-0 overflow-hidden">
            <div className="border-b border-line">
              <div className="flex min-w-0 items-center gap-1.5 px-3 py-2.5 sm:px-4">
                {listingData?.parent ? (
                  <button
                    type="button"
                    onClick={() => setPath(listingData.parent!)}
                    className="mr-1 grid size-11 shrink-0 place-items-center rounded-md text-faint transition-colors hover:bg-raised hover:text-foreground pointer-fine:size-7"
                    aria-label="Go to parent folder"
                  >
                    <ArrowLeft className="size-3.5" />
                  </button>
                ) : null}
                {listingData ? (
                  <nav
                    aria-label="Breadcrumb"
                    className="no-scrollbar flex min-w-0 items-center gap-0.5 overflow-x-auto"
                  >
                    {listingData.breadcrumbs.map((crumb, index) => {
                      const last = index === listingData.breadcrumbs.length - 1;
                      return (
                        <span key={crumb.path} className="flex shrink-0 items-center">
                          {index > 0 ? (
                            <ChevronRight className="mx-0.5 size-3 text-faint/60" />
                          ) : null}
                          <button
                            type="button"
                            onClick={() => !last && setPath(crumb.path)}
                            aria-current={last ? "page" : undefined}
                            className={cn(
                              "inline-flex min-h-11 max-w-[8rem] items-center truncate rounded-sm px-1.5 py-2.5 text-xs transition-colors sm:max-w-[10rem] pointer-fine:min-h-0 pointer-fine:px-1 pointer-fine:py-1",
                              last
                                ? "text-foreground"
                                : "text-faint hover:text-foreground",
                            )}
                            title={crumb.path}
                          >
                            {crumb.name}
                          </button>
                        </span>
                      );
                    })}
                  </nav>
                ) : (
                  <Skeleton className="h-4 w-40" />
                )}
                {listingData ? (
                  <span className="ml-auto hidden shrink-0 text-2xs text-faint sm:block">
                    {pluralize(listingData.file_count, "file")} ·{" "}
                    {pluralize(listingData.directory_count, "folder")}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2 px-3 pb-3 sm:px-4">
                <div className="relative min-w-0 flex-1 sm:max-w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Find in this folder"
                    aria-label="Search this folder"
                    className="h-11 pl-8 pr-11 text-base pointer-fine:h-9 pointer-fine:pr-8 pointer-fine:text-xs"
                    disabled={!listingData}
                  />
                  {search ? (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-0 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-sm text-faint hover:text-foreground pointer-fine:size-9"
                      aria-label="Clear search"
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : null}
                </div>

                <div className="ml-auto flex items-center gap-1.5">
                  {listingData ? (
                    <Button asChild variant="outline" size="sm">
                      <a href={archiveUrl(listingData.path)}>
                        <Archive className="size-3.5" />
                        <span className="hidden sm:inline">ZIP folder</span>
                        <span className="sm:hidden">ZIP</span>
                      </a>
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="pointer-fine:size-9"
                    onClick={() => listing.refetch()}
                    disabled={listing.isFetching || !activePath}
                    aria-label="Refresh folder"
                  >
                    <RefreshCw
                      className={cn("size-3.5", listing.isFetching && "animate-spin")}
                    />
                  </Button>
                </div>
              </div>
            </div>

            {listing.isPending && !listingData ? (
              <FileListSkeleton />
            ) : listing.isError && !fileLinkError ? (
              <div className="p-4 sm:p-5">
                <ErrorState
                  title="Folder unavailable"
                  message={
                    listing.error instanceof Error
                      ? listing.error.message
                      : "This folder could not be read."
                  }
                  onRetry={() => listing.refetch()}
                />
              </div>
            ) : !listingData ? (
              <FileListSkeleton />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={search ? Search : FolderOpen}
                title={search ? "Nothing matches" : "This folder is empty"}
                description={
                  search
                    ? `No files or folders match “${search}”.`
                    : "Completed downloads will appear here as qBittorrent finishes them."
                }
                action={
                  search ? (
                    <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                      Clear search
                    </Button>
                  ) : (
                    <Button asChild variant="outline" size="sm">
                      <Link to="/downloads/add">Add a download</Link>
                    </Button>
                  )
                }
              />
            ) : (
              <>
                <div className="hidden grid-cols-[2rem_minmax(0,1fr)_7rem_9rem_2.25rem] gap-4 border-b border-line px-4 py-2 text-2xs text-faint sm:grid">
                  <span aria-hidden="true" />
                  <span>Name</span>
                  <span className="text-right">Size</span>
                  <span className="text-right">Modified</span>
                  <span aria-hidden="true" />
                </div>
                <div>
                  {filtered.map((entry) => (
                    <FileRow
                      key={entry.path}
                      entry={entry}
                      onOpen={openEntry}
                      onDelete={(target) => {
                        setDeleteError(null);
                        setDeleteTarget(target);
                      }}
                    />
                  ))}
                </div>
              </>
            )}

            {listingData ? (
              <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-2xs text-faint">
                <span>
                  {search
                    ? `${filtered.length} of ${listingData.entries.length} entries`
                    : `${listingData.entries.length} entries`}
                </span>
                <span>{formatBytes(listingData.disk.free)} free on this disk</span>
              </div>
            ) : null}
          </section>
        )}
      </div>

      <FilePreviewDialog entry={preview} onOpenChange={(open) => !open && setPreview(null)} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
        title={deleteTarget?.is_dir ? "Delete this folder?" : "Delete this file?"}
        description={
          deleteTarget
            ? deleteTarget.is_dir
              ? `“${deleteTarget.name}” and everything inside it will be permanently deleted from the server. This cannot be undone.`
              : `“${deleteTarget.name}” will be permanently deleted from the server. This cannot be undone.`
            : ""
        }
        confirmLabel={deleteTarget?.is_dir ? "Delete folder" : "Delete file"}
        busy={deleteMutation.isPending}
        error={deleteError}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget);
        }}
      >
        {deleteTarget ? (
          <div className="flex min-w-0 items-center gap-2.5 rounded-md border border-line bg-background/40 px-3 py-2.5">
            <FileTypeIcon category={deleteTarget.category} />
            <p className="data min-w-0 truncate text-2xs text-faint" title={deleteTarget.path}>
              {deleteTarget.path}
            </p>
          </div>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
