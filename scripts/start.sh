#!/usr/bin/env bash
# Start SeedStation's isolated qBittorrent engine and the Django/Uvicorn web app.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/common.sh
# shellcheck source=scripts/common.sh
. "$SCRIPT_DIR/common.sh"

load_env
require_executable "$VENV/bin/python" || die "Python environment missing. Run ./scripts/setup.sh first."
require_file "$ROOT/frontend/dist/index.html" || die "Frontend build missing. Run ./scripts/setup.sh first."
mkdir -p "$RUN_DIR" "$ROOT/storage/downloads"
[ -n "${SEEDSTATION_DOWNLOAD_DIR:-}" ] && mkdir -p "$SEEDSTATION_DOWNLOAD_DIR"

if systemctl --user is-active seedstation-web.service >/dev/null 2>&1 \
    || systemctl --user is-active seedstation-qbittorrent.service >/dev/null 2>&1; then
    die "SeedStation is managed by systemd. Use:
  systemctl --user restart seedstation.target
  systemctl --user status seedstation.target"
fi

PORT="${SEEDSTATION_PORT:-8000}"
QBIT_PORT="${SEEDSTATION_QBIT_PORT:-8081}"
TORRENT_PORT="${SEEDSTATION_QBIT_TORRENT_PORT:-6881}"

log "Applying database migrations..."
(cd "$ROOT/backend" && "$VENV/bin/python" manage.py migrate --noinput >/dev/null)

# --- qBittorrent ----------------------------------------------------------
if pid_alive "$QBIT_PID_FILE"; then
    qpid="$(read_pid "$QBIT_PID_FILE")"
    if pid_matches "$qpid" ".qbittorrent"; then
        ok "qBittorrent already running (PID $qpid)."
    else
        die "PID file $QBIT_PID_FILE points to PID $qpid, which is not SeedStation's engine.
Remove the stale PID file and retry."
    fi
else
    rm -f "$QBIT_PID_FILE"
    if port_in_use "$QBIT_PORT"; then
        die "Port $QBIT_PORT is already in use. Refusing to touch another qBittorrent instance.
Stop the process using that port or set SEEDSTATION_QBIT_PORT to a free port."
    fi
    QBIT_BIN="$(find_qbit_binary)" || die "qbittorrent-nox not found. Run ./scripts/setup.sh first."
    log "Starting qBittorrent ($QBIT_BIN)..."
    nohup "$QBIT_BIN" \
        --profile="$QBIT_PROFILE" \
        --webui-port="$QBIT_PORT" \
        --torrenting-port="$TORRENT_PORT" \
        --confirm-legal-notice \
        >>"$RUN_DIR/qbittorrent.log" 2>&1 &
    qpid=$!
    echo "$qpid" >"$QBIT_PID_FILE"
    if ! wait_for_http "http://127.0.0.1:$QBIT_PORT/" 30; then
        tail_log "$RUN_DIR/qbittorrent.log"
        kill "$qpid" 2>/dev/null || true
        rm -f "$QBIT_PID_FILE"
        die "qBittorrent did not start. Check $RUN_DIR/qbittorrent.log."
    fi
    ok "qBittorrent is listening on 127.0.0.1:$QBIT_PORT (PID $qpid)."
fi

log "Synchronizing download settings with qBittorrent..."
if ! (cd "$ROOT/backend" && "$VENV/bin/python" manage.py sync_engine); then
    warn "Could not synchronize qBittorrent preferences; the web app will still start."
fi

# --- Uvicorn --------------------------------------------------------------
if pid_alive "$WEB_PID_FILE"; then
    dpid="$(read_pid "$WEB_PID_FILE")"
    if pid_matches "$dpid" "config.asgi:application"; then
        ok "SeedStation web server already running (PID $dpid)."
    else
        die "PID file $WEB_PID_FILE points to PID $dpid, which is not SeedStation's web server.
Remove the stale PID file and retry."
    fi
else
    rm -f "$WEB_PID_FILE"
    if port_in_use "$PORT"; then
        die "Port $PORT is already in use. Stop that service or change SEEDSTATION_PORT."
    fi
    log "Starting the web server on 0.0.0.0:$PORT..."
    cd "$ROOT/backend"
    nohup "$VENV/bin/uvicorn" config.asgi:application --host 0.0.0.0 --port "$PORT" \
        --ws websockets-sansio >>"$RUN_DIR/uvicorn.log" 2>&1 &
    dpid=$!
    cd "$ROOT"
    echo "$dpid" >"$WEB_PID_FILE"
    if ! wait_for_http "http://127.0.0.1:$PORT/api/health/" 30; then
        tail_log "$RUN_DIR/uvicorn.log"
        kill "$dpid" 2>/dev/null || true
        rm -f "$WEB_PID_FILE"
        die "The web server did not become healthy. Check $RUN_DIR/uvicorn.log."
    fi
    ok "SeedStation is healthy (PID $dpid)."
fi

IP="$(lan_ip || true)"
printf '\n%sSeedStation is running.%s\n' "$C_BOLD" "$C_RESET"
printf '  Local:   http://127.0.0.1:%s\n' "$PORT"
if [ -n "$IP" ]; then
    printf '  Network: http://%s:%s\n' "$IP" "$PORT"
fi
printf '  Engine:  http://127.0.0.1:%s (loopback only)\n' "$QBIT_PORT"
printf '  Logs:    %s\n' "$RUN_DIR/uvicorn.log"
printf '           %s\n' "$RUN_DIR/qbittorrent.log"
printf '  Stop:    ./scripts/stop.sh\n'
