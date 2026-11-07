import type { FileCategory } from "@/types/api";

const video = new Set(["mp4", "mkv", "webm", "mov", "m4v", "avi", "wmv", "mpeg", "mpg"]);
const image = new Set(["jpg", "jpeg", "png", "gif", "webp", "avif", "heic", "bmp", "svg"]);
const audio = new Set(["mp3", "flac", "m4a", "aac", "ogg", "opus", "wav", "wma"]);
const archive = new Set(["zip", "rar", "7z", "tar", "gz", "bz2", "xz", "zst", "iso"]);
const document = new Set(["pdf", "epub", "doc", "docx", "odt", "xls", "xlsx", "ppt", "pptx"]);
const text = new Set(["txt", "md", "json", "xml", "csv", "log", "srt", "vtt", "nfo", "yml", "yaml"]);

export function guessFileCategory(name: string): FileCategory {
  const extension = name.includes(".") ? name.split(".").pop()?.toLowerCase() : undefined;
  if (!extension) return "other";
  if (video.has(extension)) return "video";
  if (image.has(extension)) return "image";
  if (audio.has(extension)) return "audio";
  if (archive.has(extension)) return "archive";
  if (document.has(extension)) return "document";
  if (text.has(extension)) return "text";
  return "other";
}

export function extensionOf(name: string): string {
  return name.includes(".") ? (name.split(".").pop()?.toLowerCase() ?? "") : "";
}
