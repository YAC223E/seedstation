#!/usr/bin/env bash
# shellcheck disable=SC2034  # shared variables are consumed by the sourcing scripts
# Shared helpers for the SeedStation lifecycle scripts.
# This file is sourced by setup/start/stop/status and never executed directly.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC2034  # consumed by the scripts that source this file
ENV_FILE="$ROOT/.env"
RUN_DIR="$ROOT/.run"
VENV="$ROOT/.venv"
QBIT_PROFILE="$ROOT/.qbittorrent"
QBIT_BINARY="$ROOT/tools/qbittorrent-nox"
WEB_PID_FILE="$RUN_DIR/web.pid"
QBIT_PID_FILE="$RUN_DIR/qbittorrent.pid"

if [ -t 1 ]; then
    C_RESET=$'\033[0m'
    C_DIM=$'\033[2m'
    C_BOLD=$'\033[1m'
    C_GREEN=$'\033[32m'
    C_YELLOW=$'\033[33m'
    C_RED=$'\033[31m'
    C_CYAN=$'\033[36m'
else
    C_RESET=""
    C_DIM=""
    C_BOLD=""
    C_GREEN=""
    C_YELLOW=""
    C_RED=""
    C_CYAN=""
fi

log() {
    printf '%s==>%s %s\n' "$C_CYAN" "$C_RESET" "$*"
}

ok() {
    printf '%s  ok%s %s\n' "$C_GREEN" "$C_RESET" "$*"
}

warn() {
    printf '%swarn%s %s\n' "$C_YELLOW" "$C_RESET" "$*" >&2
}

die() {
    printf '%serror%s %s\n' "$C_RED" "$C_RESET" "$*" >&2
    exit 1
}

load_env() {
    [ -f "$ENV_FILE" ] || die "No .env found at $ENV_FILE. Run ./scripts/setup.sh first."
    set -a
    # shellcheck disable=SC1090
    . "$ENV_FILE"
    set +a
}

require_file() {
    [ -f "$1" ] || die "Missing required file: $1"
}

require_executable() {
    [ -x "$1" ] || die "Missing required executable: $1"
}

pid_alive() {
    local pid_file="$1"
    [ -f "$pid_file" ] || return 1
    local pid
    pid="$(tr -d '[:space:]' < "$pid_file")"
    case "$pid" in
        ''|*[!0-9]*) return 1 ;;
    esac
    kill -0 "$pid" 2>/dev/null
}

read_pid() {
    tr -d '[:space:]' < "$1"
}

# Check that a PID's command line contains a required fragment before acting on
# it. This prevents a stale PID file from targeting an unrelated process.
pid_matches() {
    local pid="$1"
    local needle="$2"
    [ -r "/proc/$pid/cmdline" ] || return 1
    tr '\0' ' ' < "/proc/$pid/cmdline" | grep -Fq -- "$needle"
}

port_in_use() {
    local port="$1"
    command -v ss >/dev/null 2>&1 || return 1
    ss -ltnH "sport = :$port" 2>/dev/null | grep -q .
}

wait_for_http() {
    local url="$1"
    local seconds="${2:-20}"
    local waited=0
    while [ "$waited" -lt "$seconds" ]; do
        if curl -fsS -o /dev/null --max-time 2 "$url" 2>/dev/null; then
            return 0
        fi
        sleep 1
        waited=$((waited + 1))
    done
    return 1
}

lan_ip() {
    if command -v ip >/dev/null 2>&1; then
        local addr
        addr="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '
            /dev tailscale/ { next }
            { for (i = 1; i <= NF; i++) if ($i == "src") { print $(i + 1); exit } }')"
        if [ -n "$addr" ]; then
            printf '%s\n' "$addr"
            return 0
        fi
        ip -4 addr show scope global 2>/dev/null \
            | awk '/inet / {print $2}' \
            | cut -d/ -f1 \
            | grep -vE '^(127\.|100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\.)' \
            | head -n1
        return 0
    fi
    hostname -I 2>/dev/null | awk '{print $1}'
}

find_qbit_binary() {
    if [ -x "$QBIT_BINARY" ]; then
        printf '%s\n' "$QBIT_BINARY"
        return 0
    fi
    if command -v qbittorrent-nox >/dev/null 2>&1; then
        command -v qbittorrent-nox
        return 0
    fi
    return 1
}

tail_log() {
    local path="$1"
    [ -f "$path" ] || return 0
    printf '%s--- last lines of %s ---%s\n' "$C_DIM" "$path" "$C_RESET" >&2
    tail -n 20 "$path" >&2 || true
}

# Stop a verified PID from a PID file, escalating to SIGKILL after a timeout.
stop_pidfile() {
    local pid_file="$1"
    local label="$2"
    local needle="$3"
    local timeout="${4:-15}"

    if ! pid_alive "$pid_file"; then
        rm -f "$pid_file"
        ok "$label is not running"
        return 0
    fi

    local pid
    pid="$(read_pid "$pid_file")"
    if ! pid_matches "$pid" "$needle"; then
        warn "Refusing to stop PID $pid ($label): command line does not contain '$needle'."
        warn "Remove $pid_file manually if it is stale."
        return 1
    fi

    log "Stopping $label (PID $pid)..."
    kill -TERM "$pid" 2>/dev/null || true
    local waited=0
    while kill -0 "$pid" 2>/dev/null && [ "$waited" -lt "$timeout" ]; do
        sleep 1
        waited=$((waited + 1))
    done
    if kill -0 "$pid" 2>/dev/null; then
        warn "$label did not exit after ${timeout}s; sending SIGKILL."
        kill -KILL "$pid" 2>/dev/null || true
        sleep 1
    fi
    rm -f "$pid_file"
    ok "$label stopped"
}
