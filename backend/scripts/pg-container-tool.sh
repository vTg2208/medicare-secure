#!/bin/sh
set -eu
tool=$1
shift
case "$tool" in pg_dump|pg_restore) ;; *) exit 64 ;; esac
test -f "$PGSSLROOTCERT"
exec docker run --rm --network host --read-only --user 1000:1000 \
  --cap-drop ALL --security-opt no-new-privileges --cpus 1 --memory 512m --pids-limit 128 \
  --env PGHOST --env PGPORT --env PGDATABASE --env PGUSER --env PGPASSWORD \
  --env PGCONNECT_TIMEOUT --env PGSSLMODE --env PGSSLROOTCERT=/run/postgres-ca.crt \
  --mount "type=bind,source=$PGSSLROOTCERT,target=/run/postgres-ca.crt,readonly" \
  postgres:17-bookworm "$tool" "$@"
