#!/bin/sh
set -eu
# Official PostgreSQL entrypoint handles initialization and drops privileges.
# Copy Compose-mounted key material into postgres-owned ephemeral storage.
secret_dir=${PG_TLS_SECRETS_DIR:-/run/secrets}
runtime_dir=${PG_TLS_RUNTIME_DIR:-/run/postgresql-tls}
test -s "$secret_dir/postgres_tls_cert"
test -s "$secret_dir/postgres_tls_key"
mkdir -p "$runtime_dir"
cp "$secret_dir/postgres_tls_cert" "$runtime_dir/server.crt"
cp "$secret_dir/postgres_tls_key" "$runtime_dir/server.key"
chmod 0600 "$runtime_dir/server.key"
# Local trust is limited to this container's Unix socket for official init tooling.
# Every TCP connection, including loopback, must use TLS plus SCRAM credentials.
printf '%s\n' 'local all all trust' 'hostnossl all all all reject' 'hostssl all all all scram-sha-256' > "$runtime_dir/pg_hba.conf"
chown -R postgres:postgres "$runtime_dir"
exec /usr/local/bin/docker-entrypoint.sh postgres \
  -c ssl=on -c ssl_min_protocol_version=TLSv1.2 \
  -c "ssl_cert_file=$runtime_dir/server.crt" -c "ssl_key_file=$runtime_dir/server.key" \
  -c "hba_file=$runtime_dir/pg_hba.conf" "$@"
