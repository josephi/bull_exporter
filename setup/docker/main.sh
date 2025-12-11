#!/usr/bin/env bash
set -euo pipefail

prefix="${EXPORTER_PREFIX:-bull}"
metric_prefix="${EXPORTER_STAT_PREFIX:-bull_queue_}"
queues="${EXPORTER_QUEUES:-}"
EXPORTER_AUTODISCOVER="${EXPORTER_AUTODISCOVER:-${EXPORTER_AUTO_DISCOVER:-}}"
redis_url="${EXPORTER_REDIS_URL:-}"
redis_host="${EXPORTER_REDIS_HOST:-}"
redis_port="${EXPORTER_REDIS_PORT:-}"
redis_username="${EXPORTER_REDIS_USERNAME:-}"
redis_password="${EXPORTER_REDIS_PASSWORD:-}"
redis_db="${EXPORTER_REDIS_DB:-}"
redis_tls="${EXPORTER_REDIS_TLS:-}"
exporter_port="${EXPORTER_PORT:-}"

flags=(
  --prefix "$prefix"
  --metric-prefix "$metric_prefix"
)

# Use URL if provided, otherwise use individual Redis parameters
if [[ -n "$redis_url" ]]; then
  flags+=(--url "$redis_url")
else
  [[ -n "$redis_host" ]] && flags+=(--redis-host "$redis_host")
  [[ -n "$redis_port" ]] && flags+=(--redis-port "$redis_port")
  [[ -n "$redis_username" ]] && flags+=(--redis-username "$redis_username")
  [[ -n "$redis_password" ]] && flags+=(--redis-password "$redis_password")
  [[ -n "$redis_db" ]] && flags+=(--redis-db "$redis_db")
  [[ "$redis_tls" == "true" || "$redis_tls" == "1" ]] && flags+=(--tls)
fi

if [[ "$EXPORTER_AUTODISCOVER" != 0 && "$EXPORTER_AUTODISCOVER" != 'false' ]] ; then
  flags+=(-a)
fi

[[ -n "$exporter_port" ]] && flags+=(--port "$exporter_port")

# shellcheck disable=2206
flags+=($queues)

exec node dist/src/index.js "${flags[@]}"
