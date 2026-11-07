export class ApiError extends Error {
  status: number;
  code: string;
  payload: unknown;

  constructor(
    message: string,
    status: number,
    code = "request_failed",
    payload: unknown = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

let csrfFallback = "";

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const cookie = part.trim();
    if (cookie.startsWith(prefix)) {
      return decodeURIComponent(cookie.slice(prefix.length));
    }
  }
  return null;
}

export function setCsrfToken(token: string | null | undefined) {
  if (token) csrfFallback = token;
}

export function getCsrfToken(): string {
  return (
    readCookie("seedstation_csrf") ||
    csrfFallback ||
    document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ||
    ""
  );
}

async function ensureCsrf(): Promise<string> {
  const existing = getCsrfToken();
  if (existing) return existing;
  const response = await fetch("/api/auth/session/", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (response.ok) {
    const data = (await response.json()) as { csrfToken?: string };
    setCsrfToken(data.csrfToken);
  }
  return getCsrfToken();
}

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: BodyInit | Record<string, unknown> | null;
  timeoutMs?: number;
}

export async function apiFetch<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { body, headers: providedHeaders, timeoutMs = 30_000, ...init } = options;
  const method = (init.method || "GET").toUpperCase();
  const headers = new Headers(providedHeaders);
  headers.set("Accept", "application/json");

  let requestBody: BodyInit | undefined;
  if (body !== undefined && body !== null) {
    if (
      body instanceof FormData ||
      body instanceof Blob ||
      body instanceof URLSearchParams ||
      typeof body === "string"
    ) {
      requestBody = body;
    } else {
      headers.set("Content-Type", "application/json");
      requestBody = JSON.stringify(body);
    }
  }

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers.set("X-CSRFToken", await ensureCsrf());
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      method,
      headers,
      body: requestBody,
      credentials: "same-origin",
      signal: init.signal ?? controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("The request took too long. Is the station awake?", 0, "timeout");
    }
    throw new ApiError(
      "SeedStation could not reach the server. Check your connection.",
      0,
      "network_error",
    );
  } finally {
    window.clearTimeout(timeout);
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "");

  if (!response.ok) {
    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent("seedstation:unauthorized"));
    }
    const payload = data as { detail?: string; code?: string; errors?: unknown } | null;
    throw new ApiError(
      payload?.detail || `The request failed (${response.status}).`,
      response.status,
      payload?.code || "request_failed",
      data,
    );
  }

  return data as T;
}

export function downloadUrl(path: string, inline = false): string {
  return `/api/files/download/?path=${encodeURIComponent(path)}${inline ? "&inline=1" : ""}`;
}

export function archiveUrl(path: string): string {
  return `/api/files/archive/?path=${encodeURIComponent(path)}`;
}

export function textPreviewUrl(path: string): string {
  return `/api/files/text/?path=${encodeURIComponent(path)}`;
}
