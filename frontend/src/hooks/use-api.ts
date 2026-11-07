import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api";
import type {
  FileListing,
  FileRoot,
  History,
  SettingsPayload,
  TextPreview,
  TorrentDetail,
} from "@/types/api";

export function useSettings(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => apiFetch<SettingsPayload>("/api/settings/"),
    staleTime: 20_000,
    enabled: options.enabled ?? true,
  });
}

export function usePatchSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      apiFetch<SettingsPayload>("/api/settings/", {
        method: "PATCH",
        body: patch,
        timeoutMs: 30_000,
      }),
    onSuccess: (payload) => {
      queryClient.setQueryData(["settings"], payload);
    },
  });
}

export function useHistory(hours: number) {
  return useQuery({
    queryKey: ["history", hours],
    queryFn: () => apiFetch<History>(`/api/dashboard/history/?hours=${hours}`),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

export function useFileRoots() {
  return useQuery({
    queryKey: ["file-roots"],
    queryFn: async () => {
      const data = await apiFetch<{ roots: FileRoot[] }>("/api/files/roots/");
      return data.roots;
    },
    staleTime: 30_000,
  });
}

export function useFileListing(path: string | null) {
  return useQuery({
    queryKey: ["files", path],
    queryFn: () => apiFetch<FileListing>(`/api/files/?path=${encodeURIComponent(path || "")}`),
    enabled: Boolean(path),
    placeholderData: keepPreviousData,
    staleTime: 5_000,
    retry: (count, error) =>
      error instanceof ApiError && error.status >= 500 && count < 2,
  });
}

export function useTorrentDetail(hash: string | null) {
  return useQuery({
    queryKey: ["torrent", hash],
    queryFn: () => apiFetch<TorrentDetail>(`/api/torrents/${hash}/`),
    enabled: Boolean(hash),
    staleTime: 2_000,
    retry: 1,
  });
}

export function useTextPreview(path: string | null) {
  return useQuery({
    queryKey: ["file-text", path],
    queryFn: () => apiFetch<TextPreview>(`/api/files/text/?path=${encodeURIComponent(path || "")}`),
    enabled: Boolean(path),
    staleTime: 30_000,
    retry: false,
  });
}
