#!/usr/bin/env bash
# Install SeedStation as systemd user services (optional).
# Data, downloads and .env are left untouched by --remove.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/common.sh
# shellcheck source=scripts/common.sh
. "$SCRIPT_DIR/common.sh"

REMOVE=0
for arg in "$@"; do
    case "$arg" in
        --remove) REMOVE=1 ;;
        -h|--help)
            echo "Usage: ./scripts/install-systemd.sh [--remove]"
            exit 0
            ;;
        *) die "Unknown option: $arg" ;;
    esac
done

command -v systemctl >/dev/null 2>&1 || die "systemd is required for this optional installer."
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
mkdir -p "$UNIT_DIR"

if [ "$REMOVE" -eq 1 ]; then
    log "Removing SeedStation systemd user units..."
    systemctl --user disable --now seedstation.target 2>/dev/null || true
    systemctl --user stop seedstation-web.service seedstation-qbittorrent.service seedstation-mdns.service 2>/dev/null || true
    rm -f \
        "$UNIT_DIR/seedstation.target" \
        "$UNIT_DIR/seedstation-web.service" \
        "$UNIT_DIR/seedstation-qbittorrent.service" \
        "$UNIT_DIR/seedstation-mdns.service"
    systemctl --user daemon-reload
    ok "Systemd units removed. Data, downloads and .env were kept."
    exit 0
fi

load_env
require_executable "$VENV/bin/python" || die "Run ./scripts/setup.sh first."
require_file "$ROOT/frontend/dist/index.html" || die "Run ./scripts/setup.sh first."
QBIT_BIN="$(find_qbit_binary)" || die "qbittorrent-nox not found."

if pid_alive "$DAPHNE_PID_FILE" || pid_alive "$QBIT_PID_FILE"; then
    die "SeedStation is running from ./scripts/start.sh. Run ./scripts/stop.sh first,
then install the systemd units. This avoids two engines fighting over the same ports."
fi

PORT="${SEEDSTATION_PORT:-8000}"
QBIT_PORT="${SEEDSTATION_QBIT_PORT:-8081}"
TORRENT_PORT="${SEEDSTATION_QBIT_TORRENT_PORT:-6881}"
MDNS_NAME="${SEEDSTATION_MDNS_NAME:-seedstation.local}"

log "Rendering systemd units into $UNIT_DIR..."
env ROOT="$ROOT" HOME_DIR="$HOME" QBIT_BIN="$QBIT_BIN" PORT="$PORT" \
QBIT_PORT="$QBIT_PORT" TORRENT_PORT="$TORRENT_PORT" MDNS_NAME="$MDNS_NAME" \
UNIT_DIR="$UNIT_DIR" \
TEMPLATE_DIR="$ROOT/deploy/systemd" python3 - <<'PY'
import os
from pathlib import Path

root = os.environ["ROOT"]
home = os.environ["HOME_DIR"]
qbit = os.environ["QBIT_BIN"]
unit_dir = Path(os.environ["UNIT_DIR"])
templates = Path(os.environ["TEMPLATE_DIR"])

# Escape percent signs so systemd does not expand paths as specifiers.
values = {
    "@ROOT@": root.replace("%", "%%"),
    "@HOME@": home.replace("%", "%%"),
    "@VENV@": f"{root}/.venv".replace("%", "%%"),
    "@QBIT_BIN@": qbit.replace("%", "%%"),
    "@PORT@": os.environ["PORT"],
    "@QBIT_PORT@": os.environ["QBIT_PORT"],
    "@TORRENT_PORT@": os.environ["TORRENT_PORT"],
    "@MDNS_NAME@": os.environ["MDNS_NAME"],
}

for name in ("seedstation.target", "seedstation-qbittorrent.service", "seedstation-web.service", "seedstation-mdns.service"):
    text = (templates / f"{name}.in").read_text(encoding="utf-8")
    for key, value in values.items():
        text = text.replace(key, value)
    (unit_dir / name).write_text(text, encoding="utf-8")
    print(f"  wrote {unit_dir / name}")
PY

log "Enabling and starting SeedStation services..."
systemctl --user daemon-reload
systemctl --user enable seedstation.target seedstation-qbittorrent.service seedstation-web.service seedstation-mdns.service >/dev/null
systemctl --user restart seedstation-qbittorrent.service
systemctl --user restart seedstation-web.service
systemctl --user restart seedstation-mdns.service
systemctl --user start seedstation.target
sleep 3
systemctl --user --no-pager --lines=0 status seedstation.target seedstation-qbittorrent.service seedstation-web.service seedstation-mdns.service || true

ok "SeedStation systemd user services are installed."
printf '  Start:   systemctl --user start seedstation.target\n'
printf '  Stop:    systemctl --user stop seedstation.target\n'
printf '  Status:  systemctl --user status seedstation.target\n'
printf '  Logs:    journalctl --user -u seedstation-web -u seedstation-qbittorrent -u seedstation-mdns -f\n'

LINGER="$(loginctl show-user "$USER" -p Linger --value 2>/dev/null || true)"
if [ "$LINGER" != "yes" ]; then
    printf '\nTo keep SeedStation running after logout and start it at boot:\n'
    printf '  loginctl enable-linger %s\n' "$USER"
fi
