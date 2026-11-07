import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ClipboardPaste,
  FileUp,
  Gauge,
  HardDrive,
  Info,
  LoaderCircle,
  PauseCircle,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label, Hint, FieldError } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useFileRoots, useSettings } from "@/hooks/use-api";
import { ApiError, apiFetch } from "@/lib/api";
import { formatBytes, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useLive } from "@/providers/live-provider";
import type { AddTorrentResult } from "@/types/api";

type SourceMode = "magnet" | "file";

const MAX_TORRENT_BYTES = 10 * 1024 * 1024;

function validateMagnet(value: string): string | null {
  const magnet = value.trim();
  if (!magnet) return "Paste a magnet link first.";
  if (!magnet.toLowerCase().startsWith("magnet:?")) {
    return "Magnet links start with magnet:?.";
  }
  if (!/[?&]xt=urn:btih:[a-z0-9]{32,40}/i.test(magnet)) {
    return "That link does not include a BitTorrent info hash.";
  }
  return null;
}

export function AddDownloadPage() {
  const navigate = useNavigate();
  const { snapshot } = useLive();
  const rootsQuery = useFileRoots();
  const settingsQuery = useSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<SourceMode>("magnet");
  const [magnet, setMagnet] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [selectedPath, setSelectedPath] = useState("");
  const [startPaused, setStartPaused] = useState(false);
  const [touchedStartPaused, setTouchedStartPaused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [validation, setValidation] = useState<string | null>(null);

  const roots = rootsQuery.data ?? [];
  const settings = settingsQuery.data?.settings;
  const engineOnline = snapshot?.engine.online ?? false;

  useEffect(() => {
    if (!selectedPath && roots.length) {
      const primary = settings?.download_dir;
      const matched = roots.find((root) => root.path === primary);
      setSelectedPath(matched?.path ?? roots[0].path);
    }
  }, [roots, selectedPath, settings?.download_dir]);

  useEffect(() => {
    if (!touchedStartPaused && settings) {
      setStartPaused(settings.start_paused);
    }
  }, [settings, touchedStartPaused]);

  const selectedRoot = roots.find((root) => root.path === selectedPath);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedPath) throw new Error("Choose a destination folder.");
      if (mode === "magnet") {
        return apiFetch<AddTorrentResult>("/api/torrents/add-magnet/", {
          method: "POST",
          body: { magnet: magnet.trim(), save_path: selectedPath, start_paused: startPaused },
          timeoutMs: 40_000,
        });
      }
      if (!file) throw new Error("Choose a .torrent file first.");
      const form = new FormData();
      form.append("file", file);
      form.append("save_path", selectedPath);
      form.append("start_paused", startPaused ? "true" : "false");
      return apiFetch<AddTorrentResult>("/api/torrents/upload/", {
        method: "POST",
        body: form,
        timeoutMs: 60_000,
      });
    },
    onSuccess: (result) => {
      toast.success(`${result.torrent.name} added to the station.`);
      navigate("/downloads");
    },
    onError: (error) => {
      setValidation(
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "The torrent could not be added.",
      );
    },
  });

  const handleFile = (candidate: File | undefined | null) => {
    setValidation(null);
    if (!candidate) return;
    if (candidate.size > MAX_TORRENT_BYTES) {
      setValidation("Torrent files must be smaller than 10 MB.");
      return;
    }
    setFile(candidate);
    setMode("file");
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    handleFile(event.dataTransfer.files?.[0]);
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setMagnet(text);
      setValidation(validateMagnet(text));
    } catch {
      setValidation("Clipboard access was declined. Paste the link into the field.");
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setValidation(null);
    if (mode === "magnet") {
      const message = validateMagnet(magnet);
      if (message) {
        setValidation(message);
        return;
      }
    } else if (!file) {
      setValidation("Choose a .torrent file first.");
      return;
    }
    if (!selectedPath) {
      setValidation("Choose a destination folder.");
      return;
    }
    mutation.mutate();
  };

  const rootError =
    rootsQuery.error instanceof ApiError
      ? rootsQuery.error.message
      : rootsQuery.error
        ? "The destinations could not be loaded."
        : null;

  return (
    <>
      <PageHeader
        title="Bring something home."
        description="Paste a magnet link or drop in a .torrent. SeedStation hands it to qBittorrent and keeps the files on this machine."
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link to="/downloads">
              <ArrowLeft className="size-3.5" />
              Back to downloads
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(19rem,.72fr)]">
        <form onSubmit={submit} noValidate className="panel min-w-0 overflow-hidden">
          <div className="border-b border-line px-4 py-4 sm:px-6 sm:py-5">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-sm font-medium text-foreground">New handoff</h2>
                <p className="mt-1 text-xs text-faint">
                  Choose where this transfer begins.
                </p>
              </div>
              <div
                className="flex rounded-md border border-line bg-background/50 p-0.5"
                role="group"
                aria-label="Torrent source"
              >
                <button
                  type="button"
                  onClick={() => {
                    setMode("magnet");
                    setValidation(null);
                  }}
                  aria-pressed={mode === "magnet"}
                  className={cn(
                    "min-h-11 rounded-[4px] px-3 text-xs transition-colors pointer-fine:h-7 pointer-fine:min-h-0 pointer-fine:px-2.5",
                    mode === "magnet"
                      ? "bg-raised text-foreground shadow-[inset_0_0_0_1px_var(--line-strong)]"
                      : "text-faint hover:text-muted",
                  )}
                >
                  Magnet
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("file");
                    setValidation(null);
                  }}
                  aria-pressed={mode === "file"}
                  className={cn(
                    "min-h-11 rounded-[4px] px-3 text-xs transition-colors pointer-fine:h-7 pointer-fine:min-h-0 pointer-fine:px-2.5",
                    mode === "file"
                      ? "bg-raised text-foreground shadow-[inset_0_0_0_1px_var(--line-strong)]"
                      : "text-faint hover:text-muted",
                  )}
                >
                  .torrent
                </button>
              </div>
            </div>

            {mode === "magnet" ? (
              <div>
                <Label htmlFor="magnet">Magnet link</Label>
                <div className="relative">
                  <Textarea
                    id="magnet"
                    value={magnet}
                    onChange={(event) => {
                      setMagnet(event.target.value);
                      if (validation) setValidation(null);
                    }}
                    placeholder="magnet:?xt=urn:btih:…&dn=…"
                    className="min-h-[8.5rem] pb-12 font-mono text-base leading-relaxed pointer-fine:text-xs"
                    spellCheck={false}
                    disabled={mutation.isPending}
                  />
                  <div className="absolute inset-x-2.5 bottom-2.5 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={pasteFromClipboard}
                      disabled={mutation.isPending}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-sm py-2 text-2xs text-faint transition-colors hover:text-foreground"
                    >
                      <ClipboardPaste className="size-3" />
                      Paste from clipboard
                    </button>
                    <span className="text-2xs text-faint">Info hash required</span>
                  </div>
                </div>
                <Hint>
                  The link is passed straight to your qBittorrent engine. SeedStation
                  never contacts the swarm itself.
                </Hint>
              </div>
            ) : (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".torrent,application/x-bittorrent"
                  className="sr-only"
                  onChange={(event) => handleFile(event.target.files?.[0])}
                  aria-label="Choose a torrent file"
                  disabled={mutation.isPending}
                />
                {file ? (
                  <div className="flex items-center gap-3 rounded-lg border border-line bg-background/40 p-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-md border border-primary/25 bg-primary/[0.07] text-primary">
                      <FileUp className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{file.name}</p>
                      <p className="mt-0.5 text-2xs text-faint">
                        {formatBytes(file.size)} · ready to hand off
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      aria-label="Remove selected torrent file"
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    className={cn(
                      "relative flex min-h-[11rem] flex-col items-center justify-center rounded-lg border border-dashed px-5 py-8 text-center transition-colors",
                      dragging
                        ? "border-primary bg-primary/[0.06]"
                        : "border-line-strong bg-background/35 hover:border-faint",
                    )}
                  >
                    <span className="mb-3 grid size-11 place-items-center rounded-full border border-line-strong bg-raised text-muted">
                      <FileUp className="size-5" strokeWidth={1.6} />
                    </span>
                    <p className="text-sm text-foreground">
                      Drop a .torrent here, or{" "}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="link-quiet inline-flex min-h-11 items-center font-medium"
                      >
                        browse files
                      </button>
                    </p>
                    <p className="mt-1.5 text-2xs text-faint">Up to 10 MB</p>
                  </div>
                )}
                <Hint>
                  The file is read on the server, checked for an info hash, then passed
                  to the engine. Nothing is saved in the web layer.
                </Hint>
              </div>
            )}
          </div>

          <div className="border-b border-line px-4 py-5 sm:px-6">
            <div className="grid grid-cols-[minmax(0,1fr)] gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="destination">Landing folder</Label>
                {rootsQuery.isPending ? (
                  <Skeleton className="h-11 w-full sm:h-10" />
                ) : rootsQuery.isError ? (
                  <p className="rounded-md border border-danger/25 bg-danger/[0.06] px-3 py-2.5 text-xs text-danger">
                    {rootError}
                  </p>
                ) : roots.length === 0 ? (
                  <p className="rounded-md border border-warning/25 bg-warning/[0.06] px-3 py-2.5 text-xs text-warning">
                    No download folders are configured. Add one in Settings first.
                  </p>
                ) : (
                  <Select
                    value={selectedPath}
                    onValueChange={(value) => {
                      setSelectedPath(value);
                      setValidation(null);
                    }}
                    disabled={mutation.isPending}
                  >
                    <SelectTrigger id="destination">
                      <SelectValue placeholder="Choose a destination" />
                    </SelectTrigger>
                    <SelectContent>
                      {roots.map((root) => (
                        <SelectItem key={root.path} value={root.path}>
                          <span className="flex items-center gap-2">
                            <span>{root.name}</span>
                            <span className="text-2xs text-faint">
                              {formatBytes(root.free)} free
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {selectedRoot ? (
                  <div className="mt-2.5 flex items-start gap-1.5 text-2xs leading-relaxed text-faint">
                    <HardDrive className="mt-0.5 size-3 shrink-0" />
                    <span className="min-w-0" title={selectedRoot.path}>
                      <span className="data block truncate">{selectedRoot.path}</span>
                      <span className="mt-0.5 block">
                        {formatBytes(selectedRoot.free)} free ·{" "}
                        {formatPercent(selectedRoot.percent, 1)} used
                      </span>
                    </span>
                  </div>
                ) : null}
              </div>

              <div>
                <Label htmlFor="start-paused">Starting mode</Label>
                <label
                  htmlFor="start-paused"
                  className="flex h-12 cursor-pointer items-center justify-between gap-3 rounded-md border border-line bg-background/45 px-3 pointer-fine:h-10"
                >
                  <span className="flex items-center gap-2 text-xs text-muted">
                    <PauseCircle className="size-3.5 text-faint" />
                    Start paused
                  </span>
                  <Switch
                    id="start-paused"
                    checked={startPaused}
                    onCheckedChange={(checked) => {
                      setStartPaused(checked);
                      setTouchedStartPaused(true);
                    }}
                    disabled={mutation.isPending}
                    aria-label="Start this torrent paused"
                  />
                </label>
                <Hint>
                  Turn this on to queue metadata and files without starting the
                  transfer. You can resume it from Downloads.
                </Hint>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="min-w-0">
              {validation ? (
                <FieldError>{validation}</FieldError>
              ) : (
                <p className="flex items-center gap-2 text-2xs text-faint">
                  <ShieldCheck className="size-3.5 text-primary/80" />
                  Only add content you have the right to download and share.
                </p>
              )}
            </div>
            <Button
              type="submit"
              className="shrink-0 px-5"
              disabled={
                mutation.isPending ||
                rootsQuery.isPending ||
                roots.length === 0 ||
                !engineOnline
              }
            >
              {mutation.isPending ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Handing off…
                </>
              ) : (
                <>
                  Add to station
                  <ArrowUpRight className="size-4" />
                </>
              )}
            </Button>
          </div>
        </form>

        <aside className="space-y-5">
          <section className="panel overflow-hidden">
            <div className="border-b border-line px-4 py-4">
              <h2 className="text-sm font-medium text-foreground">At the station</h2>
            </div>
            <div className="space-y-4 p-4">
              {snapshot ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-xs text-muted">
                      <span className="live-dot" data-offline={!engineOnline} />
                      qBittorrent
                    </span>
                    <Badge tone={engineOnline ? "seeding" : "danger"}>
                      {engineOnline ? "Online" : "Offline"}
                    </Badge>
                  </div>
                  {engineOnline ? (
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-md border border-line bg-background/40 p-3">
                        <p className="text-2xs text-faint">Engine</p>
                        <p className="data mt-1 text-foreground">
                          {snapshot.engine.version ?? "Unknown"}
                        </p>
                      </div>
                      <div className="rounded-md border border-line bg-background/40 p-3">
                        <p className="text-2xs text-faint">In motion</p>
                        <p className="data mt-1 text-foreground">
                          {snapshot.summary.active}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs leading-relaxed text-muted">
                      {snapshot.engine.error ||
                        "The engine is not reachable. Start qBittorrent before adding a download."}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-3 border-t border-line pt-4 text-2xs text-faint">
                    <span className="flex items-center gap-1.5">
                      <Gauge className="size-3.5" />
                      {snapshot.transfer.connection_label}
                    </span>
                    <span>{snapshot.transfer.dht_nodes} DHT nodes</span>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              )}
            </div>
          </section>

          <section className="panel p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground">
              <Info className="size-3.5 text-primary" />
              After the handoff
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              qBittorrent fetches metadata first, then the files. SeedStation picks up
              progress as it happens. Completed files appear in your library
              immediately, ready to stream or download over the LAN.
            </p>
            <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-2xs text-faint">
              <span>{snapshot ? `${snapshot.summary.total} transfers on record` : "—"}</span>
              <Link to="/settings" className="link-quiet">
                Change defaults
              </Link>
            </div>
          </section>

          <section className="rounded-xl border border-line bg-wash/40 p-4">
            <p className="flex items-center gap-2 text-xs text-muted">
              <Check className="size-3.5 text-primary" />
              Private by default
            </p>
            <p className="mt-2 text-2xs leading-relaxed text-faint">
              SeedStation is reachable only from your local network. qBittorrent’s Web
              UI stays bound to loopback and is never exposed to this page.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
