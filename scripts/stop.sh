#!/usr/bin/env bash
# Stop the SeedStation web app and its isolated qBittorrent engine.
# Never touches a separately installed qBittorrent instance.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/common.sh
# shellcheck source=scripts/common.sh
. "$SCRIPT_DIR/common.sh"

load_env

if ! pid_alive "$DAPHNE_PID_FILE" && ! pid_alive "$QBIT_PID_FILE" \
    && { systemctl --user is-active seedstation-web.service >/dev/null 2>&1 \
        || systemctl --user is-active seedstation-qbittorrent.service >/dev/null 2>&1; }; then
    warn "SeedStation is managed by systemd. Use: systemctl --user stop seedstation.target"
    exit 1
fi

status=0
stop_pidfile "$DAPHNE_PID_FILE" "SeedStation web server" "config.asgi:application" 15 || status=1
stop_pidfile "$QBIT_PID_FILE" "SeedStation qBittorrent" ".qbittorrent" 20 || status=1

if [ "$status" -eq 0 ]; then
    ok "SeedStation stopped."
else
    warn "One or more processes were not stopped. Review the messages above."
fi
exit "$status"
