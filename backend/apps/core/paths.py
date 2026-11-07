"""Path allow-listing for the file manager.

Every filesystem request is resolved and checked against explicitly configured
download roots. Symlinks are followed during resolution, so a symlink that
points outside a root is rejected instead of leaking the target.
"""

from __future__ import annotations

import os
from pathlib import Path

from django.conf import settings

from .models import AppSettings


class PathGuardError(Exception):
    status_code = 400
    code = "invalid_path"

    def __init__(self, message: str, *, code: str | None = None):
        super().__init__(message)
        if code:
            self.code = code


class PathNotAllowed(PathGuardError):
    status_code = 403
    code = "path_not_allowed"


class PathNotFound(PathGuardError):
    status_code = 404
    code = "path_not_found"


class PathInvalid(PathGuardError):
    status_code = 400
    code = "invalid_path"


class DeleteRejected(PathGuardError):
    status_code = 403
    code = "delete_rejected"


def configured_roots() -> list[Path]:
    station = AppSettings.get_solo()
    raw_roots = [station.download_dir, *station.extra_dirs]
    roots: list[Path] = []
    seen: set[str] = set()
    for raw in raw_roots:
        if not raw:
            continue
        candidate = Path(raw).expanduser()
        if not candidate.is_absolute():
            continue
        try:
            resolved = candidate.resolve(strict=False)
        except (OSError, RuntimeError):
            continue
        key = str(resolved)
        if key not in seen:
            seen.add(key)
            roots.append(resolved)
    return roots


def existing_roots() -> list[Path]:
    return [root for root in configured_roots() if root.is_dir()]


def is_within(path: Path, root: Path) -> bool:
    return path == root or root in path.parents


def validate_configured_directory(raw: str) -> Path:
    """Validate a directory chosen by an authenticated administrator."""
    if not isinstance(raw, str) or not raw.strip():
        raise PathInvalid("A directory path is required.")
    if len(raw) > 1024:
        raise PathInvalid("That path is too long.")
    if "\x00" in raw or "\n" in raw or "\r" in raw:
        raise PathInvalid("That path contains invalid characters.")
    path = Path(raw).expanduser()
    if not path.is_absolute():
        raise PathInvalid("Use an absolute path, for example /home/you/Downloads.")
    try:
        resolved = path.resolve(strict=True)
    except FileNotFoundError as exc:
        raise PathInvalid(f"Directory does not exist: {raw}") from exc
    except (OSError, RuntimeError) as exc:
        raise PathInvalid("That directory cannot be resolved.") from exc

    protected = {
        Path("/"),
        Path("/home"),
        Path("/root"),
        Path("/usr"),
        Path("/etc"),
        Path("/var"),
        Path("/boot"),
        Path("/bin"),
        Path("/sbin"),
        Path("/lib"),
        Path("/opt"),
        Path("/srv"),
        Path("/tmp"),
        Path.home().resolve(),
    }
    if resolved in protected:
        raise PathInvalid(
            "Choose a specific download folder, not the filesystem root, a system "
            "directory, or your whole home directory."
        )
    if not resolved.is_dir():
        raise PathInvalid("The download destination must be a directory.")
    if not os.access(resolved, os.R_OK | os.W_OK | os.X_OK):
        raise PathInvalid("SeedStation does not have read/write access to that directory.")
    return resolved


def resolve_path(raw_path: str, *, must_exist: bool = True) -> tuple[Path, Path]:
    """Resolve a user-supplied absolute path inside a configured root.

    Returns ``(resolved_path, root)``. Raises a PathGuardError otherwise.
    """
    if not isinstance(raw_path, str) or not raw_path:
        raise PathInvalid("A path is required.")
    if len(raw_path) > 4096:
        raise PathInvalid("That path is too long.")
    if "\x00" in raw_path or "\n" in raw_path or "\r" in raw_path:
        raise PathInvalid("That path contains invalid characters.")
    candidate = Path(raw_path).expanduser()
    if not candidate.is_absolute():
        raise PathInvalid("Paths must be absolute.")
    try:
        resolved = candidate.resolve(strict=must_exist)
    except FileNotFoundError as exc:
        raise PathNotFound("The requested file or folder no longer exists.") from exc
    except (OSError, RuntimeError) as exc:
        raise PathInvalid("That path cannot be resolved.") from exc

    roots = configured_roots()
    for root in roots:
        if is_within(resolved, root):
            return resolved, root
    raise PathNotAllowed(
        "That path is outside the configured download directories.",
        code="path_outside_roots",
    )


def validate_save_path(raw_path: str | None) -> Path:
    """Validate a torrent destination, defaulting to the configured directory."""
    station = AppSettings.get_solo()
    target = raw_path or station.download_dir
    resolved, _ = resolve_path(target)
    if not resolved.is_dir():
        raise PathInvalid("The download destination must be an existing directory.")
    if not os.access(resolved, os.W_OK | os.X_OK):
        raise PathInvalid("SeedStation cannot write to that download destination.")
    return resolved


def display_path(path: Path) -> str:
    try:
        return str(path.relative_to(Path.home()))
    except ValueError:
        return str(path)


__all__ = [
    "DeleteRejected",
    "PathGuardError",
    "PathInvalid",
    "PathNotAllowed",
    "PathNotFound",
    "configured_roots",
    "display_path",
    "existing_roots",
    "is_within",
    "resolve_path",
    "validate_configured_directory",
    "validate_save_path",
]
