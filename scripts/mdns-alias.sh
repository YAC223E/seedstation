#!/usr/bin/env bash
# Publish a stable mDNS alias (default: seedstation.local) for SeedStation.
# The address follows the active default route, so the name keeps working when
# the laptop switches between Ethernet and Wi-Fi.
set -Eeuo pipefail

NAME="${1:-${SEEDSTATION_MDNS_NAME:-seedstation.local}}"
INTERVAL="${SEEDSTATION_MDNS_INTERVAL:-2}"

for cmd in avahi-publish ip; do
    command -v "$cmd" >/dev/null 2>&1 || {
        printf 'error: %s is required for the SeedStation mDNS alias.\n' "$cmd" >&2
        exit 1
    }
done

publisher_pid=""
current_ip=""

stop_publisher() {
    if [ -n "$publisher_pid" ] && kill -0 "$publisher_pid" 2>/dev/null; then
        kill "$publisher_pid" 2>/dev/null || true
        wait "$publisher_pid" 2>/dev/null || true
    fi
    publisher_pid=""
}

cleanup() {
    stop_publisher
}
trap cleanup EXIT
trap 'cleanup; exit 0' INT TERM

route_ip() {
    ip -4 route get 1.1.1.1 2>/dev/null | awk '
        { for (i = 1; i <= NF; i++) if ($i == "src") { print $(i + 1); exit } }'
}

fallback_ip() {
    ip -4 -o addr show scope global 2>/dev/null | awk '
        $2 !~ /^(docker|br-|veth|tailscale)/ {
            split($4, parts, "/")
            print parts[1]
            exit
        }'
}

publish() {
    local address="$1"
    printf 'Publishing %s -> %s\n' "$NAME" "$address"
    avahi-publish -a -R "$NAME" "$address" &
    publisher_pid=$!
}

while :; do
    address="$(route_ip || true)"
    [ -n "$address" ] || address="$(fallback_ip || true)"

    if [ -z "$address" ]; then
        if [ -n "$current_ip" ]; then
            stop_publisher
            current_ip=""
        fi
    elif [ "$address" != "$current_ip" ] \
        || [ -z "$publisher_pid" ] \
        || ! kill -0 "$publisher_pid" 2>/dev/null; then
        stop_publisher
        publish "$address"
        current_ip="$address"
    fi

    sleep "$INTERVAL"
done
