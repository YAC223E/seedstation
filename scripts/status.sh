#!/usr/bin/env bash
# Report SeedStation and torrent engine health.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/common.sh
# shellcheck source=scripts/common.sh
. "$SCRIPT_DIR/common.sh"

load_env

PORT="${SEEDSTATION_PORT:-8000}"
QBIT_PORT="${SEEDSTATION_QBIT_PORT:-8081}"
FAILED=0

web_pid=""
qbit_pid=""
if pid_alive "$WEB_PID_FILE"; then
    candidate="$(read_pid "$WEB_PID_FILE")"
    pid_matches "$candidate" "config.asgi:application" && web_pid="$candidate"
fi
if pid_alive "$QBIT_PID_FILE"; then
    candidate="$(read_pid "$QBIT_PID_FILE")"
    pid_matches "$candidate" ".qbittorrent" && qbit_pid="$candidate"
fi

printf '%sSeedStation status%s\n' "$C_BOLD" "$C_RESET"
printf '  Project:  %s\n' "$ROOT"

if [ -n "$web_pid" ]; then
    if wait_for_http "http://127.0.0.1:$PORT/api/health/" 3; then
        printf '  Web:      %srunning%s (PID %s) · http://127.0.0.1:%s\n' "$C_GREEN" "$C_RESET" "$web_pid" "$PORT"
    else
        printf '  Web:      %sunhealthy%s (PID %s) · port %s\n' "$C_RED" "$C_RESET" "$web_pid" "$PORT"
        FAILED=1
    fi
else
    systemd_state="$(systemctl --user is-active seedstation-web.service 2>/dev/null || true)"
    if [ "$systemd_state" = "active" ]; then
        printf '  Web:      %srunning%s (systemd user unit) · http://127.0.0.1:%s\n' "$C_GREEN" "$C_RESET" "$PORT"
    else
        printf '  Web:      %sstopped%s\n' "$C_YELLOW" "$C_RESET"
        FAILED=1
    fi
fi

if [ -n "$qbit_pid" ]; then
    code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:$QBIT_PORT/" 2>/dev/null || true)"
    if [ "$code" = "200" ]; then
        printf '  Engine:   %srunning%s (PID %s) · WebUI loopback %s\n' "$C_GREEN" "$C_RESET" "$qbit_pid" "$QBIT_PORT"
    else
        printf '  Engine:   %sstarting/unreachable%s (PID %s) · HTTP %s\n' "$C_RED" "$C_RESET" "$qbit_pid" "${code:-none}"
        FAILED=1
    fi
else
    systemd_state="$(systemctl --user is-active seedstation-qbittorrent.service 2>/dev/null || true)"
    if [ "$systemd_state" = "active" ]; then
        printf '  Engine:   %srunning%s (systemd user unit) · WebUI loopback %s\n' "$C_GREEN" "$C_RESET" "$QBIT_PORT"
    else
        printf '  Engine:   %sstopped%s\n' "$C_YELLOW" "$C_RESET"
        FAILED=1
    fi
fi

IP="$(lan_ip || true)"
[ -n "$IP" ] && printf '  Network:  http://%s:%s\n' "$IP" "$PORT"
MDNS_NAME="${SEEDSTATION_MDNS_NAME:-seedstation.local}"
if systemctl --user is-active seedstation-mdns.service >/dev/null 2>&1; then
    printf '  mDNS:     http://%s:%s\n' "$MDNS_NAME" "$PORT"
fi
printf '  Downloads: %s\n' "${SEEDSTATION_DOWNLOAD_DIR:-$ROOT/storage/downloads}"
if [ -d "${SEEDSTATION_DOWNLOAD_DIR:-/nonexistent}" ]; then
    df -h "${SEEDSTATION_DOWNLOAD_DIR}" | awk 'NR==2 {printf "  Disk:      %s free of %s (%s used)\n", $4, $2, $5}'
else
    printf '  Disk:      %sdownload directory missing%s\n' "$C_RED" "$C_RESET"
    FAILED=1
fi

qbit_bind="$(ss -ltnH "sport = :$QBIT_PORT" 2>/dev/null | awk '{print $4}' | head -n1 || true)"
if [ -n "$qbit_bind" ] && ! printf '%s' "$qbit_bind" | grep -qE '^(127\.0\.0\.1|\[::1\]):'; then
    printf '  %sWarning:%s qBittorrent WebUI listens on %s, not loopback.\n' "$C_YELLOW" "$C_RESET" "$qbit_bind"
fi

# The stock qBittorrent GUI defaults to a WebUI on all interfaces (:8080).
# SeedStation never changes that process, but users should know it is exposed.
exposed_8080="$(ss -ltnH "sport = :8080" 2>/dev/null | awk '{print $4}' | grep -vE '^(127\.0\.0\.1|\[::1\]):' || true)"
if [ -n "$exposed_8080" ]; then
    printf '  %sWarning:%s a WebUI on port 8080 is listening on %s, not loopback.\n' "$C_YELLOW" "$C_RESET" "$(printf '%s' "$exposed_8080" | paste -sd ', ' -)"
    printf '           If that is the qBittorrent GUI, bind it to 127.0.0.1 in Tools → Options → Web UI.\n'
fi

if [ "$FAILED" -eq 0 ]; then
    printf '  %sAll services healthy.%s\n' "$C_GREEN" "$C_RESET"
else
    printf '  %sSome services need attention. Logs: %s%s\n' "$C_YELLOW" "$C_RESET" "$RUN_DIR"
fi
exit "$FAILED"
