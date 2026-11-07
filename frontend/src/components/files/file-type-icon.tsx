import {
  File,
  FileArchive,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Folder,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { FileCategory } from "@/types/api";

const icons = {
  folder: Folder,
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  archive: FileArchive,
  document: FileText,
  text: FileText,
  other: File,
} as const;

const colors = {
  folder: "text-primary",
  image: "text-[#d4a76a]",
  video: "text-info",
  audio: "text-seeding",
  archive: "text-warning",
  document: "text-[#b7b0d8]",
  text: "text-muted",
  other: "text-faint",
} as const;

export function FileTypeIcon({
  category,
  className,
}: {
  category: FileCategory;
  className?: string;
}) {
  const Icon = icons[category] || File;
  return <Icon className={cn("size-4", colors[category], className)} strokeWidth={1.7} />;
}
