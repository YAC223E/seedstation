const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB", "PB"];

export function formatBytes(value: number, precision?: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const exponent = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    BYTE_UNITS.length - 1,
  );
  const scaled = value / 1024 ** exponent;
  const digits =
    precision ?? (exponent === 0 ? 0 : scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2);
  return `${scaled.toFixed(digits)} ${BYTE_UNITS[exponent]}`;
}

export function formatSpeed(value: number): string {
  return `${formatBytes(value)}/s`;
}

export function formatBytesParts(value: number): { amount: string; unit: string } {
  if (!Number.isFinite(value) || value <= 0) return { amount: "0", unit: "B" };
  const exponent = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    BYTE_UNITS.length - 1,
  );
  const scaled = value / 1024 ** exponent;
  const digits = exponent === 0 ? 0 : scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  return { amount: scaled.toFixed(digits), unit: BYTE_UNITS[exponent] };
}

export function formatSpeedParts(value: number): { amount: string; unit: string } {
  const parts = formatBytesParts(value);
  return { amount: parts.amount, unit: `${parts.unit}/s` };
}

export function formatPercent(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.min(100, Math.max(0, value)).toFixed(digits)}%`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || seconds < 0) return "—";
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (minutes < 60) {
    return remainingSeconds > 0 && minutes < 10
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

export function formatUptime(seconds: number | null | undefined): string {
  return formatDuration(seconds ?? null);
}

export function formatEta(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "Unknown";
  if (seconds >= 604800) return "More than a week";
  return formatDuration(seconds);
}

export function shortHash(hash: string): string {
  if (hash.length <= 13) return hash;
  return `${hash.slice(0, 7)}…${hash.slice(-4)}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatRelative(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const ranges: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
    ["second", 1],
  ];
  for (const [unit, unitSeconds] of ranges) {
    if (Math.abs(seconds) >= unitSeconds || unit === "second") {
      return formatter.format(Math.round(seconds / unitSeconds), unit);
    }
  }
  return formatter.format(seconds, "second");
}

export function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : plural || `${singular}s`}`;
}

export function basename(path: string): string {
  const clean = path.replace(/\/+$/, "");
  return clean.split("/").pop() || path;
}

export function truncateMiddle(value: string, max = 48): string {
  if (value.length <= max) return value;
  const half = Math.floor((max - 1) / 2);
  return `${value.slice(0, half)}…${value.slice(-half)}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

export function percentOf(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.min(100, Math.max(0, (part / total) * 100));
}

export function formatDateShort(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}
