export type ThemePreference = "dark" | "light" | "system";

export interface User {
  id: number;
  username: string;
  email: string;
  is_staff: boolean;
  last_login: string | null;
  date_joined?: string | null;
}

export interface Session {
  authenticated: boolean;
  user: User | null;
  csrfToken: string;
  serverTime: string;
  version?: string;
}

export interface EngineInfo {
  online: boolean;
  version: string | null;
  api_version: string | null;
  error: string | null;
  webui_url?: string;
}

export type TorrentActivity =
  | "downloading"
  | "seeding"
  | "paused"
  | "checking"
  | "metadata"
  | "error"
  | "unknown";

export interface Torrent {
  hash: string;
  name: string;
  state: string;
  status: string;
  activity: TorrentActivity;
  is_complete: boolean;
  is_paused: boolean;
  is_error: boolean;
  is_downloading: boolean;
  is_seeding: boolean;
  progress: number;
  size: number;
  downloaded: number;
  amount_left: number;
  download_speed: number;
  upload_speed: number;
  downloaded_session: number;
  uploaded: number;
  uploaded_session: number;
  eta_seconds: number | null;
  ratio: number;
  seeds: number;
  peers: number;
  swarm_seeds: number;
  swarm_peers: number;
  save_path: string;
  content_path: string;
  magnet: string;
  tracker: string;
  category: string;
  tags: string[];
  added_on: string | null;
  completed_on: string | null;
  last_activity: string | null;
  time_active: number;
  seeding_time: number;
  priority: number;
  is_private: boolean;
}

export interface TorrentFile {
  index: number;
  name: string;
  size: number;
  progress: number;
  priority: number;
  is_seed: boolean;
  piece_range: number[];
  availability: number;
  mime: string;
}

export interface TorrentTracker {
  url: string;
  status: number;
  status_label: string;
  tier: number;
  peers: number;
  seeds: number;
  leeches: number;
  message: string;
}

export interface TorrentDetail extends Torrent {
  files: TorrentFile[];
  trackers: TorrentTracker[];
}

export interface Transfer {
  download_speed: number;
  upload_speed: number;
  downloaded_session: number;
  uploaded_session: number;
  download_limit: number;
  upload_limit: number;
  connection_status: string;
  connection_label: string;
  dht_nodes: number;
  queueing: boolean;
  error?: string;
}

export interface Summary {
  total: number;
  active: number;
  downloading: number;
  seeding: number;
  completed: number;
  paused: number;
  errored: number;
  library_bytes: number;
}

export interface Storage {
  path: string;
  total: number;
  used: number;
  free: number;
  percent: number;
  library_bytes: number;
  library_percent: number;
}

export interface ServerInfo {
  hostname: string;
  lan_ip: string;
  port: number;
  lan_url: string;
  current_url: string;
  scheme: string;
  os: string;
  kernel: string;
  python_version: string;
  django_version: string;
  version: string;
  time_zone: string;
  server_uptime_seconds: number | null;
  process_uptime_seconds: number;
  pid: number;
  lan_only: boolean;
  qbit_webui: string;
  time: string;
}

export interface LiveSnapshot {
  timestamp: string;
  engine: EngineInfo;
  transfer: Transfer;
  torrents: Torrent[];
  summary: Summary;
  storage: Storage;
  recent: Torrent[];
  server: ServerInfo;
}

export interface HistoryPoint {
  timestamp: string;
  engine_online: boolean;
  download_speed: number;
  upload_speed: number;
  active_downloads: number;
  active_torrents: number;
  total_torrents: number;
  library_bytes: number;
  storage_free: number;
}

export interface History {
  hours: number;
  points: HistoryPoint[];
  sampled: number;
  start: string;
}

export interface AppSettings {
  download_dir: string;
  extra_dirs: string[];
  max_download_speed: number;
  max_upload_speed: number;
  max_active_downloads: number;
  start_paused: boolean;
  theme: ThemePreference;
  updated_at: string;
}

export interface SettingsPayload {
  settings: AppSettings;
  engine: EngineInfo;
  server: ServerInfo;
  storage: Storage;
  summary: Summary;
  firewall_hint: string | null;
  sync_warning: string | null;
  limits: {
    max_speed: number;
    max_extra_dirs: number;
  };
}

export type FileCategory =
  | "folder"
  | "image"
  | "video"
  | "audio"
  | "archive"
  | "document"
  | "text"
  | "other";

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: string | null;
  extension: string;
  mime: string;
  category: FileCategory;
}

export interface FileRoot {
  name: string;
  path: string;
  exists: boolean;
  total: number;
  used: number;
  free: number;
  percent: number;
}

export interface Breadcrumb {
  name: string;
  path: string;
}

export interface FileListing {
  path: string;
  root: {
    name: string;
    path: string;
  };
  breadcrumbs: Breadcrumb[];
  parent: string | null;
  entries: FileEntry[];
  file_count: number;
  directory_count: number;
  disk: Storage;
}

export interface TextPreview {
  path: string;
  name: string;
  mime: string;
  size: number;
  content: string;
  truncated: boolean;
}

export interface AddTorrentResult {
  detail: string;
  torrent: {
    hash: string;
    name: string;
    save_path: string;
    started_paused: boolean;
  };
}
