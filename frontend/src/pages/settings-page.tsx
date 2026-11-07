import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Copy,
  Cpu,
  Eye,
  EyeOff,
  FolderOpen,
  Gauge,
  Globe2,
  HardDrive,
  KeyRound,
  LoaderCircle,
  Monitor,
  Moon,
  Network,
  Palette,
  Plus,
  Save,
  ShieldCheck,
  Sun,
  Trash2,
  Wifi,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/page-header";
import { ErrorState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Hint, FieldError } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { usePatchSettings, useSettings } from "@/hooks/use-api";
import { ApiError, apiFetch } from "@/lib/api";
import { copyToClipboard } from "@/lib/clipboard";
import { formatBytes, formatPercent, formatUptime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/providers/theme-provider";
import type { AppSettings, ThemePreference } from "@/types/api";

const MIB = 1024 * 1024;

interface Draft {
  download_dir: string;
  extra_dirs: string[];
  max_download_speed: string;
  max_upload_speed: string;
  max_active_downloads: string;
  start_paused: boolean;
}

function speedInput(bytes: number): string {
  if (!bytes) return "0";
  return String(Number((bytes / MIB).toFixed(2)));
}

function draftFromSettings(settings: AppSettings): Draft {
  return {
    download_dir: settings.download_dir,
    extra_dirs: [...settings.extra_dirs],
    max_download_speed: speedInput(settings.max_download_speed),
    max_upload_speed: speedInput(settings.max_upload_speed),
    max_active_downloads: String(settings.max_active_downloads),
    start_paused: settings.start_paused,
  };
}

function canonicalDraft(draft: Draft): string {
  return JSON.stringify({
    download_dir: draft.download_dir.trim(),
    extra_dirs: draft.extra_dirs.map((item) => item.trim()).filter(Boolean),
    max_download_speed: draft.max_download_speed.trim(),
    max_upload_speed: draft.max_upload_speed.trim(),
    max_active_downloads: draft.max_active_downloads.trim(),
    start_paused: draft.start_paused,
  });
}

function firstMessage(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const message = firstMessage(item);
      if (message) return message;
    }
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      const message = firstMessage(item);
      if (message) return message;
    }
  }
  return null;
}

function fieldError(error: unknown, field: string): string | null {
  if (!(error instanceof ApiError)) return null;
  const payload = error.payload as { errors?: unknown } | null;
  const errors = payload?.errors;
  if (!errors || typeof errors !== "object" || Array.isArray(errors)) return null;
  return firstMessage((errors as Record<string, unknown>)[field]);
}

function mutationMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "The station could not save that change.";
}

function validateDraft(draft: Draft, maxSpeedMib: number, maxExtraDirs: number) {
  const errors: Record<string, string> = {};
  const primary = draft.download_dir.trim();

  if (!primary) {
    errors.download_dir = "Choose a download folder.";
  } else if (!primary.startsWith("/")) {
    errors.download_dir = "Use an absolute path, for example /home/you/Downloads.";
  }

  const extras = draft.extra_dirs.map((item) => item.trim()).filter(Boolean);
  if (extras.length > maxExtraDirs) {
    errors.extra_dirs = `You can add up to ${maxExtraDirs} extra folders.`;
  } else {
    const seen = new Set(primary ? [primary] : []);
    for (const extra of extras) {
      if (!extra.startsWith("/")) {
        errors.extra_dirs = `“${extra}” is not an absolute path.`;
        break;
      }
      if (seen.has(extra)) {
        errors.extra_dirs = "Each folder can only be listed once.";
        break;
      }
      seen.add(extra);
    }
  }

  for (const [field, label] of [
    ["max_download_speed", "download"],
    ["max_upload_speed", "upload"],
  ] as const) {
    const raw = draft[field].trim();
    if (!raw) {
      errors[field] = `Enter a ${label} limit. Use 0 for unlimited.`;
    } else if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
      errors[field] = "Use a number with up to two decimals.";
    } else if (Number(raw) > maxSpeedMib) {
      errors[field] = `Choose a limit up to ${maxSpeedMib.toFixed(0)} MB/s.`;
    }
  }

  const active = draft.max_active_downloads.trim();
  if (!/^\d+$/.test(active) || Number(active) < 1 || Number(active) > 50) {
    errors.max_active_downloads = "Choose between 1 and 50 active downloads.";
  }

  return errors;
}

function packageDraft(draft: Draft) {
  return {
    download_dir: draft.download_dir.trim(),
    extra_dirs: draft.extra_dirs.map((item) => item.trim()).filter(Boolean),
    max_download_speed: Math.round(Number(draft.max_download_speed) * MIB),
    max_upload_speed: Math.round(Number(draft.max_upload_speed) * MIB),
    max_active_downloads: Number(draft.max_active_downloads),
    start_paused: draft.start_paused,
  };
}

function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (await copyToClipboard(value)) {
      setCopied(true);
      toast.success(label);
      window.setTimeout(() => setCopied(false), 1800);
    } else {
      toast.error("Clipboard access was declined on this device.");
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={() => void copy()}
      className={cn("shrink-0", className)}
      aria-label={label}
    >
      {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

function Panel({
  icon: Icon,
  title,
  description,
  aside,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="panel overflow-hidden">
      <div className="flex items-start gap-3 border-b border-line px-4 py-4 sm:px-5">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md border border-line bg-background/45 text-primary">
          <Icon className="size-4" strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-foreground">{title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-faint">{description}</p>
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function Detail({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-2xs text-faint">{label}</dt>
      <dd
        className={cn(
          "min-w-0 text-right text-xs text-foreground",
          mono && "data text-[11px]",
        )}
      >
        {children}
      </dd>
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  disabled,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  disabled?: boolean;
  error?: string | null;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          className="pr-11"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center text-faint transition-colors hover:text-foreground"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          tabIndex={disabled ? -1 : 0}
        >
          {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}

function PasswordPanel() {
  const { session } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [validation, setValidation] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch<{ detail: string }>("/api/auth/password/", {
        method: "POST",
        body: { current_password: current, new_password: next },
        timeoutMs: 20_000,
      }),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setConfirm("");
      setValidation({});
      toast.success("Password updated. Keep it somewhere safe.");
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (!current) errors.current = "Enter your current password.";
    if (next.length < 10) errors.next = "Use at least 10 characters.";
    if (next && next === current) errors.next = "Choose a password different from the current one.";
    if (confirm !== next) errors.confirm = "The new passwords do not match.";
    setValidation(errors);
    if (Object.keys(errors).length === 0) mutation.mutate();
  };

  const serverError = mutation.error ? mutationMessage(mutation.error) : null;

  return (
    <Panel
      icon={KeyRound}
      title="Account & security"
      description={`Signed in as ${session?.user?.username ?? "station admin"}. The password protects every device on the LAN.`}
      aside={<Badge tone="neutral">Argon2</Badge>}
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <PasswordField
              id="current-password"
              label="Current password"
              value={current}
              onChange={(value) => {
                setCurrent(value);
                setValidation((errors) => ({ ...errors, current: "" }));
                if (mutation.isError) mutation.reset();
              }}
              autoComplete="current-password"
              disabled={mutation.isPending}
              error={validation.current}
            />
          </div>
          <PasswordField
            id="new-password"
            label="New password"
            value={next}
            onChange={(value) => {
              setNext(value);
              setValidation((errors) => ({ ...errors, next: "" }));
              if (mutation.isError) mutation.reset();
            }}
            autoComplete="new-password"
            disabled={mutation.isPending}
            error={validation.next}
          />
          <PasswordField
            id="confirm-password"
            label="Confirm new password"
            value={confirm}
            onChange={(value) => {
              setConfirm(value);
              setValidation((errors) => ({ ...errors, confirm: "" }));
              if (mutation.isError) mutation.reset();
            }}
            autoComplete="new-password"
            disabled={mutation.isPending}
            error={validation.confirm}
          />
        </div>

        <Hint>
          At least 10 characters, and not entirely numeric or a commonly used password.
          Your current session stays signed in.
        </Hint>

        {serverError ? (
          <p
            role="alert"
            className="rounded-md border border-danger/25 bg-danger/[0.06] px-3 py-2.5 text-xs leading-relaxed text-danger"
          >
            {serverError}
          </p>
        ) : null}

        <div className="flex justify-end border-t border-line pt-4">
          <Button
            type="submit"
            variant="outline"
            disabled={mutation.isPending || !current || !next || !confirm}
          >
            {mutation.isPending ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                Updating…
              </>
            ) : (
              <>
                <KeyRound className="size-4" />
                Update password
              </>
            )}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function SettingsSkeleton() {
  return (
    <>
      <PageHeader
        eyebrow="Station configuration"
        title="Tune the station."
        description="Theme, folders, transfer limits, and access — all kept on this machine."
      />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,.72fr)]">
        <div className="space-y-5">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="panel p-5">
              <div className="flex items-center gap-3">
                <Skeleton className="size-8" />
                <div className="space-y-2">
                  <Skeleton className="h-3.5 w-36" />
                  <Skeleton className="h-2.5 w-56 max-w-full" />
                </div>
              </div>
              <Skeleton className="mt-6 h-24 w-full" />
            </div>
          ))}
        </div>
        <div className="space-y-5">
          {[0, 1, 2].map((item) => (
            <div key={item} className="panel p-5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="mt-5 h-32 w-full" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function SettingsPage() {
  const { data, isPending, isError, error, refetch } = useSettings();
  const queryClient = useQueryClient();
  const { preference, setPreference } = useTheme();
  const saveMutation = usePatchSettings();
  const themeMutation = usePatchSettings();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [baseline, setBaseline] = useState<Draft | null>(null);
  const [validation, setValidation] = useState<Record<string, string>>({});
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!data || initialized.current) return;
    initialized.current = true;
    const next = draftFromSettings(data.settings);
    setDraft(next);
    setBaseline(next);
  }, [data]);

  const update = (patch: Partial<Draft>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
    setValidation({});
    if (saveMutation.isError) saveMutation.reset();
  };

  const dirty = Boolean(
    draft && baseline && canonicalDraft(draft) !== canonicalDraft(baseline),
  );

  if (isPending) return <SettingsSkeleton />;

  if (isError || !data || !draft || !baseline) {
    return (
      <>
        <PageHeader
          eyebrow="Station configuration"
          title="Tune the station."
          description="Theme, folders, transfer limits, and access — all kept on this machine."
        />
        <ErrorState
          title="Settings unavailable"
          message={
            error instanceof Error
              ? error.message
              : "The station could not load its configuration."
          }
          onRetry={() => refetch()}
        />
      </>
    );
  }

  const maxSpeedMib = data.limits.max_speed / MIB;
  const maxExtraDirs = data.limits.max_extra_dirs;
  const server = data.server;
  const engine = data.engine;
  const storage = data.storage;
  const themeSynced = data.settings.theme === preference;
  const downloadError =
    validation.download_dir || fieldError(saveMutation.error, "download_dir");
  const extraError =
    validation.extra_dirs || fieldError(saveMutation.error, "extra_dirs");
  const downloadSpeedError =
    validation.max_download_speed ||
    fieldError(saveMutation.error, "max_download_speed");
  const uploadSpeedError =
    validation.max_upload_speed || fieldError(saveMutation.error, "max_upload_speed");
  const activeError =
    validation.max_active_downloads ||
    fieldError(saveMutation.error, "max_active_downloads");
  const formError =
    saveMutation.error && !downloadError && !extraError ? mutationMessage(saveMutation.error) : null;

  const chooseTheme = async (theme: ThemePreference) => {
    if (theme === preference || themeMutation.isPending) return;
    const previous = preference;
    setPreference(theme);
    themeMutation.reset();
    try {
      await themeMutation.mutateAsync({ theme });
    } catch (themeError) {
      setPreference(previous);
      toast.error(mutationMessage(themeError));
    }
  };

  const discard = () => {
    setDraft(baseline);
    setValidation({});
    setSyncWarning(null);
    saveMutation.reset();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const errors = validateDraft(draft, maxSpeedMib, maxExtraDirs);
    setValidation(errors);
    if (Object.keys(errors).length > 0) return;
    try {
      const result = await saveMutation.mutateAsync(packageDraft(draft));
      const next = draftFromSettings(result.settings);
      setDraft(next);
      setBaseline(next);
      setValidation({});
      setSyncWarning(result.sync_warning);
      toast.success("Station preferences saved.");
      if (result.sync_warning) {
        toast.warning("The engine could not apply them yet.", {
          description: result.sync_warning,
        });
      }
      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({ queryKey: ["file-roots"] }),
        queryClient.invalidateQueries({ queryKey: ["files"] }),
      ]);
    } catch {
      // Field errors are rendered from the mutation error below.
    }
  };

  const themeOptions: Array<{
    value: ThemePreference;
    label: string;
    description: string;
    icon: LucideIcon;
    swatch: string;
  }> = [
    {
      value: "dark",
      label: "Dark",
      description: "Olive-black and low glare.",
      icon: Moon,
      swatch: "bg-[#0a0e09] border-[#3c4935]",
    },
    {
      value: "light",
      label: "Light",
      description: "Warm paper for daylight.",
      icon: Sun,
      swatch: "bg-[#edefe3] border-[#b6bfaa]",
    },
    {
      value: "system",
      label: "System",
      description: "Follow this device.",
      icon: Monitor,
      swatch: "bg-[linear-gradient(135deg,#edefe3_50%,#0a0e09_50%)] border-[#909b84]",
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Station configuration"
        title="Tune the station."
        description="Theme, folders, transfer limits, and access — all kept on this machine. Changes apply to every signed-in device."
        actions={
          <Badge tone={engine.online ? "signal" : "danger"} dot className="h-7 px-3">
            {engine.online ? "Engine online" : "Engine offline"}
          </Badge>
        }
      />

      <form id="station-preferences" onSubmit={submit} noValidate>
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,.72fr)]">
          <div className="space-y-5">
            <Panel
              icon={Palette}
              title="Appearance"
              description="A station should feel right on the screen you use most."
              aside={
                <Badge tone={themeSynced ? "signal" : "warning"} dot>
                  {themeMutation.isPending
                    ? "Saving"
                    : themeSynced
                      ? "Synced"
                      : "Not synced"}
                </Badge>
              }
            >
              <div
                role="radiogroup"
                aria-label="Theme"
                className="grid gap-2 sm:grid-cols-3"
              >
                {themeOptions.map((option) => {
                  const selected = option.value === preference;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => void chooseTheme(option.value)}
                      disabled={themeMutation.isPending}
                      className={cn(
                        "group relative rounded-lg border p-3 text-left transition-colors",
                        selected
                          ? "border-primary/45 bg-primary/[0.055]"
                          : "border-line bg-background/35 hover:border-line-strong",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "grid size-8 place-items-center rounded-md border text-foreground",
                            option.swatch,
                          )}
                        >
                          <option.icon
                            className={cn(
                              "size-3.5",
                              option.value === "light"
                                ? "text-[#172015]"
                                : option.value === "dark"
                                  ? "text-[#edf0e2]"
                                  : "text-[#53680b]",
                            )}
                            strokeWidth={1.8}
                          />
                        </span>
                        <span
                          className={cn(
                            "grid size-4 place-items-center rounded-full border transition-colors",
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-line-strong text-transparent",
                          )}
                        >
                          <Check className="size-2.5" strokeWidth={3} />
                        </span>
                      </div>
                      <p className="mt-3 text-xs font-medium text-foreground">
                        {option.label}
                      </p>
                      <p className="mt-0.5 text-2xs text-faint">{option.description}</p>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                <p className="text-2xs leading-relaxed text-faint">
                  The preference is stored on the station and mirrored to this browser.
                </p>
                {themeMutation.isError ? (
                  <p role="alert" className="text-2xs text-danger">
                    {mutationMessage(themeMutation.error)}
                  </p>
                ) : null}
              </div>
            </Panel>

            <Panel
              icon={HardDrive}
              title="Download folders"
              description="Only these locations can receive downloads or be browsed in the file manager."
              aside={
                <span className="data hidden text-2xs text-faint sm:block">
                  {formatBytes(storage.free)} free
                </span>
              }
            >
              <div>
                <Label htmlFor="download-dir">
                  Primary folder
                  <span className="data text-2xs font-normal text-faint">
                    {formatPercent(storage.percent, 0)} disk used
                  </span>
                </Label>
                <div className="relative">
                  <FolderOpen className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
                  <Input
                    id="download-dir"
                    value={draft.download_dir}
                    onChange={(event) => update({ download_dir: event.target.value })}
                    className="data pl-9 text-base pointer-fine:text-xs"
                    spellCheck={false}
                    autoCapitalize="none"
                    autoComplete="off"
                    disabled={saveMutation.isPending}
                    aria-invalid={Boolean(downloadError)}
                    placeholder="/home/you/Downloads"
                  />
                </div>
                {downloadError ? (
                  <FieldError>{downloadError}</FieldError>
                ) : (
                  <Hint>
                    New downloads land here by default. This disk has{" "}
                    {formatBytes(storage.free)} free of {formatBytes(storage.total)}.
                  </Hint>
                )}
              </div>

              <div className="mt-5 border-t border-line pt-5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <Label className="mb-0">Extra folders</Label>
                  <span className="text-2xs text-faint">
                    {draft.extra_dirs.filter((item) => item.trim()).length} of {maxExtraDirs}
                  </span>
                </div>

                {draft.extra_dirs.length === 0 ? (
                  <div className="rounded-md border border-dashed border-line-strong bg-background/25 px-3.5 py-4">
                    <p className="text-xs text-muted">
                      No extra folders. Add another library disk or a media folder.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {draft.extra_dirs.map((folder, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          value={folder}
                          onChange={(event) => {
                            const next = [...draft.extra_dirs];
                            next[index] = event.target.value;
                            update({ extra_dirs: next });
                          }}
                          className="data text-xs"
                          spellCheck={false}
                          autoCapitalize="none"
                          autoComplete="off"
                          disabled={saveMutation.isPending}
                          aria-label={`Extra download folder ${index + 1}`}
                          aria-invalid={Boolean(extraError)}
                          placeholder="/mnt/media"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() =>
                            update({
                              extra_dirs: draft.extra_dirs.filter((_, i) => i !== index),
                            })
                          }
                          disabled={saveMutation.isPending}
                          aria-label={`Remove folder ${index + 1}`}
                          className="shrink-0 text-faint hover:text-danger"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {extraError ? <FieldError>{extraError}</FieldError> : null}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <Hint className="mt-0">
                    Folders must already exist and be readable and writable by SeedStation.
                  </Hint>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => update({ extra_dirs: [...draft.extra_dirs, ""] })}
                    disabled={
                      saveMutation.isPending || draft.extra_dirs.length >= maxExtraDirs
                    }
                  >
                    <Plus className="size-3.5" />
                    Add folder
                  </Button>
                </div>
              </div>
            </Panel>

            <Panel
              icon={Gauge}
              title="Transfer limits"
              description="Keep the line usable for everything else on your network."
              aside={
                <Badge tone="neutral" className="hidden sm:inline-flex">
                  Applied to qBittorrent
                </Badge>
              }
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="download-speed">
                    <span className="flex items-center gap-1.5">
                      <ArrowDownToLine className="size-3.5 text-faint" />
                      Download limit
                    </span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="download-speed"
                      type="number"
                      min={0}
                      max={maxSpeedMib}
                      step="0.1"
                      inputMode="decimal"
                      value={draft.max_download_speed}
                      onChange={(event) =>
                        update({ max_download_speed: event.target.value })
                      }
                      className="pr-16"
                      disabled={saveMutation.isPending}
                      aria-invalid={Boolean(downloadSpeedError)}
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-2xs text-faint">
                      MB/s
                    </span>
                  </div>
                  {downloadSpeedError ? (
                    <FieldError>{downloadSpeedError}</FieldError>
                  ) : (
                    <Hint>0 = unlimited</Hint>
                  )}
                </div>

                <div>
                  <Label htmlFor="upload-speed">
                    <span className="flex items-center gap-1.5">
                      <ArrowUpFromLine className="size-3.5 text-faint" />
                      Upload limit
                    </span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="upload-speed"
                      type="number"
                      min={0}
                      max={maxSpeedMib}
                      step="0.1"
                      inputMode="decimal"
                      value={draft.max_upload_speed}
                      onChange={(event) => update({ max_upload_speed: event.target.value })}
                      className="pr-16"
                      disabled={saveMutation.isPending}
                      aria-invalid={Boolean(uploadSpeedError)}
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-2xs text-faint">
                      MB/s
                    </span>
                  </div>
                  {uploadSpeedError ? (
                    <FieldError>{uploadSpeedError}</FieldError>
                  ) : (
                    <Hint>0 = unlimited</Hint>
                  )}
                </div>

                <div>
                  <Label htmlFor="active-downloads">
                    <span className="flex items-center gap-1.5">
                      <Activity className="size-3.5 text-faint" />
                      Active downloads
                    </span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="active-downloads"
                      type="number"
                      min={1}
                      max={50}
                      step="1"
                      inputMode="numeric"
                      value={draft.max_active_downloads}
                      onChange={(event) =>
                        update({ max_active_downloads: event.target.value })
                      }
                      className="pr-16"
                      disabled={saveMutation.isPending}
                      aria-invalid={Boolean(activeError)}
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-2xs text-faint">
                      at once
                    </span>
                  </div>
                  {activeError ? (
                    <FieldError>{activeError}</FieldError>
                  ) : (
                    <Hint>Between 1 and 50</Hint>
                  )}
                </div>

                <div>
                  <Label htmlFor="start-paused-default">Default starting mode</Label>
                  <label
                    htmlFor="start-paused-default"
                    className="flex h-10 cursor-pointer items-center justify-between gap-3 rounded-md border border-line bg-background/45 px-3"
                  >
                    <span className="text-xs text-muted">Start new torrents paused</span>
                    <Switch
                      id="start-paused-default"
                      checked={draft.start_paused}
                      onCheckedChange={(checked) => update({ start_paused: checked })}
                      disabled={saveMutation.isPending}
                      aria-label="Start new downloads paused by default"
                    />
                  </label>
                  <Hint>You can still override this when adding a download.</Hint>
                </div>
              </div>

              {syncWarning || data.sync_warning ? (
                <div className="mt-5 flex items-start gap-2.5 rounded-md border border-warning/25 bg-warning/[0.055] px-3 py-2.5">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                  <p className="text-2xs leading-relaxed text-warning">
                    {syncWarning || data.sync_warning}
                  </p>
                </div>
              ) : null}

              {formError ? (
                <p
                  role="alert"
                  className="mt-4 rounded-md border border-danger/25 bg-danger/[0.06] px-3 py-2.5 text-xs leading-relaxed text-danger"
                >
                  {formError}
                </p>
              ) : null}
            </Panel>

            <PasswordPanel />
          </div>

          <aside className="space-y-5 xl:sticky xl:top-6 xl:max-h-[calc(100dvh-3rem)] xl:overflow-y-auto xl:pr-1">
            <section className="panel overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-4">
                <div className="flex items-center gap-2">
                  <Globe2 className="size-4 text-primary" strokeWidth={1.7} />
                  <h2 className="text-sm font-medium text-foreground">The station</h2>
                </div>
                <Badge tone={server.lan_only ? "signal" : "warning"} dot>
                  {server.lan_only ? "LAN only" : "Open"}
                </Badge>
              </div>
              <div className="px-4 py-2">
                <div className="flex items-center justify-between gap-2 border-b border-line/70 py-2.5">
                  <span className="text-2xs text-faint">Address</span>
                  <div className="flex min-w-0 items-center gap-1">
                    <a
                      href={server.lan_url}
                      className="data inline-flex min-h-11 items-center truncate text-[11px] text-foreground underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-primary pointer-fine:min-h-0"
                    >
                      {server.lan_url}
                    </a>
                    <CopyButton value={server.lan_url} label="LAN address copied" />
                  </div>
                </div>
                <dl className="divide-y divide-line/70">
                  <Detail label="Hostname" mono>
                    {server.hostname}
                  </Detail>
                  <Detail label="System">
                    <span className="line-clamp-2" title={`${server.os} · ${server.kernel}`}>
                      {server.os}
                    </span>
                  </Detail>
                  <Detail label="Kernel" mono>
                    <span className="break-all">{server.kernel}</span>
                  </Detail>
                  <Detail label="Time zone" mono>
                    {server.time_zone}
                  </Detail>
                  <Detail label="App uptime" mono>
                    {formatUptime(server.process_uptime_seconds)}
                  </Detail>
                  <Detail label="Server uptime" mono>
                    {formatUptime(server.server_uptime_seconds)}
                  </Detail>
                  <Detail label="Version" mono>
                    v{server.version} · Django {server.django_version}
                  </Detail>
                </dl>
              </div>
            </section>

            <section className="panel overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-4">
                <div className="flex items-center gap-2">
                  <Cpu className="size-4 text-primary" strokeWidth={1.7} />
                  <h2 className="text-sm font-medium text-foreground">Torrent engine</h2>
                </div>
                <Badge tone={engine.online ? "seeding" : "danger"} dot>
                  {engine.online ? "Online" : "Offline"}
                </Badge>
              </div>
              <div className="px-4 py-2">
                <dl className="divide-y divide-line/70">
                  <Detail label="Version" mono>
                    {engine.version ?? "—"}
                  </Detail>
                  <Detail label="API" mono>
                    {engine.api_version ?? "—"}
                  </Detail>
                  <Detail label="Web UI" mono>
                    <span className="break-all">{engine.webui_url ?? server.qbit_webui}</span>
                  </Detail>
                </dl>
                <p className="border-t border-line/70 py-3 text-2xs leading-relaxed text-faint">
                  The engine’s Web UI is bound to loopback and is not reachable from your
                  phone. SeedStation talks to it locally.
                </p>
                {!engine.online && engine.error ? (
                  <div className="mb-3 flex items-start gap-2 rounded-md border border-danger/25 bg-danger/[0.06] px-2.5 py-2">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-danger" />
                    <p className="text-2xs leading-relaxed text-danger">{engine.error}</p>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="panel overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-4">
                <div className="flex items-center gap-2">
                  <Wifi className="size-4 text-primary" strokeWidth={1.7} />
                  <h2 className="text-sm font-medium text-foreground">Network & firewall</h2>
                </div>
                <Badge tone="neutral" className="data">
                  :{server.port}
                </Badge>
              </div>
              <div className="space-y-4 p-4">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  <p className="text-2xs leading-relaxed text-muted">
                    {server.lan_only
                      ? "SeedStation rejects public hostnames and expects a private network address. Only devices on your LAN can sign in."
                      : "The LAN host check is disabled. Make sure a firewall still protects this port."}
                  </p>
                </div>

                <div className="border-t border-line pt-4">
                  <div className="flex items-center gap-2 text-2xs text-faint">
                    <Network className="size-3.5" />
                    Firewall guidance
                  </div>
                  {data.firewall_hint ? (
                    <div className="mt-2 rounded-md border border-line bg-background/55 p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <code className="data break-all text-[10px] leading-relaxed text-muted">
                          {data.firewall_hint}
                        </code>
                        <CopyButton
                          value={data.firewall_hint}
                          label="Firewall command copied"
                          className="-mr-1 -mt-1"
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-2xs leading-relaxed text-faint">
                      No supported firewall tool was detected. If you use one, allow TCP{" "}
                      {server.port} from your private network only.
                    </p>
                  )}
                </div>

                <div className="rounded-md border border-warning/25 bg-warning/[0.055] p-3">
                  <p className="flex items-center gap-2 text-2xs font-medium text-warning">
                    <AlertTriangle className="size-3.5" />
                    Check for a second qBittorrent Web UI
                  </p>
                  <p className="mt-1.5 text-2xs leading-relaxed text-muted">
                    A desktop qBittorrent instance may bind its Web UI to every interface,
                    often on port 8080. If one is running, close it or bind it to{" "}
                    <span className="data text-foreground">127.0.0.1</span>. Only
                    SeedStation’s engine on{" "}
                    <span className="data text-foreground">
                      {engine.webui_url ?? server.qbit_webui}
                    </span>{" "}
                    should be exposed — and even that should stay local.
                  </p>
                </div>
              </div>
            </section>

            <div className="rounded-xl border border-line bg-wash/40 p-4">
              <div className="flex items-center gap-2 text-xs text-muted">
                <FolderOpen className="size-3.5 text-primary" />
                Allowed library
              </div>
              <p className="mt-2 text-2xs leading-relaxed text-faint">
                {formatBytes(storage.library_bytes)} across{" "}
                {1 + data.settings.extra_dirs.length} configured{" "}
                {data.settings.extra_dirs.length === 0 ? "location" : "locations"}.
                File streaming and deletion are limited to these folders.
              </p>
            </div>
          </aside>
        </div>
      </form>

      {dirty ? (
        <div className="fixed inset-x-3 bottom-[calc(5.6rem+env(safe-area-inset-bottom))] z-40 lg:left-[16.75rem] lg:right-8 lg:bottom-5">
          <div className="panel-raised mx-auto flex max-w-[74rem] flex-col gap-3 px-4 py-3 shadow-float sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted">
              <span className="font-medium text-foreground">Unsaved changes.</span>{" "}
              Folder and transfer edits are applied together.
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={discard}
                disabled={saveMutation.isPending}
              >
                Discard
              </Button>
              <Button
                type="submit"
                size="sm"
                form="station-preferences"
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? (
                  <>
                    <LoaderCircle className="size-3.5 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="size-3.5" />
                    Save changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
