#!/bin/bash
# Railway volumes report a 16 KB sector size and SQL Server refuses data/log files on anything above 4 KB
# (mounting the volume at /var/opt/mssql crashes the engine while recovering master). So the data files live
# on the container disk and the volume only holds .bak files: restore them on boot on a port Railway does not
# route, then serve on 1433 and back up every MSSQL_BACKUP_INTERVAL_MIN minutes and on SIGTERM.
# Writes after the last backup are lost only if the container dies without SIGTERM.
set -uo pipefail

: "${MSSQL_SA_PASSWORD:?MSSQL_SA_PASSWORD requerida}"
: "${PORTAL_DB_PASSWORD:?PORTAL_DB_PASSWORD requerida}"

SQLCMD=/opt/mssql-tools18/bin/sqlcmd
DB="$PORTAL_DB_NAME"
BK="$MSSQL_BACKUP_DIR"
DATA=/var/opt/mssql/data
PRIVATE_PORT=14330
PID=

mkdir -p "$BK" "$DATA"
log() { echo "[misalud-mssql] $*"; }

q() {
  local port=$1
  shift
  "$SQLCMD" -S "127.0.0.1,$port" -U sa -P "$MSSQL_SA_PASSWORD" -C -b -l 5 \
    -v DB="$DB" APPUSER="$PORTAL_DB_USER" APPPW="$PORTAL_DB_PASSWORD" "$@"
}

start_engine() {
  MSSQL_TCP_PORT=$1 /opt/mssql/bin/sqlservr &
  PID=$!
  for _ in $(seq 1 120); do
    q "$1" -Q "SELECT 1" >/dev/null 2>&1 && return 0
    kill -0 "$PID" 2>/dev/null || return 1
    sleep 2
  done
  return 1
}

stop_engine() {
  q "$1" -Q "SHUTDOWN" >/dev/null 2>&1 || kill -TERM "$PID" 2>/dev/null
  wait "$PID" 2>/dev/null
}

restore_from() {
  q "$PRIVATE_PORT" -Q "RESTORE DATABASE [\$(DB)] FROM DISK = N'$1' WITH REPLACE, CHECKSUM,
    MOVE N'\$(DB)' TO N'$DATA/\$(DB).mdf', MOVE N'\$(DB)_log' TO N'$DATA/\$(DB)_log.ldf'"
}

backup() {
  local port=$1 tmp="$BK/$DB.bak.tmp"
  rm -f "$tmp"
  if q "$port" -Q "BACKUP DATABASE [\$(DB)] TO DISK = N'$tmp' WITH INIT, FORMAT, CHECKSUM" >/dev/null &&
    q "$port" -Q "RESTORE VERIFYONLY FROM DISK = N'$tmp' WITH CHECKSUM" >/dev/null; then
    [ -f "$BK/$DB.bak" ] && mv -f "$BK/$DB.bak" "$BK/$DB.bak.prev"
    mv -f "$tmp" "$BK/$DB.bak"
    log "backup ok $(date -u +%FT%TZ)"
  else
    log "ERROR: falló el backup"
    rm -f "$tmp"
  fi
}

log "fase 1: restauración en puerto privado $PRIVATE_PORT"
start_engine "$PRIVATE_PORT" || { log "el motor no arrancó"; exit 1; }

if [ -f "$BK/$DB.bak" ]; then
  restore_from "$BK/$DB.bak" || { log "falló $DB.bak, pruebo $DB.bak.prev"; restore_from "$BK/$DB.bak.prev"; } ||
    { log "ERROR: no se pudo restaurar; no arranco para no pisar los backups"; stop_engine "$PRIVATE_PORT"; exit 1; }
  log "restaurada $DB"
fi

q "$PRIVATE_PORT" -Q "
IF DB_ID(N'\$(DB)') IS NULL
  CREATE DATABASE [\$(DB)] ON (NAME = N'\$(DB)', FILENAME = N'$DATA/\$(DB).mdf')
  LOG ON (NAME = N'\$(DB)_log', FILENAME = N'$DATA/\$(DB)_log.ldf');
ALTER DATABASE [\$(DB)] SET RECOVERY SIMPLE;
IF SUSER_ID(N'\$(APPUSER)') IS NULL
  CREATE LOGIN [\$(APPUSER)] WITH PASSWORD = N'\$(APPPW)', DEFAULT_DATABASE = [\$(DB)], CHECK_POLICY = OFF;
ELSE
  ALTER LOGIN [\$(APPUSER)] WITH PASSWORD = N'\$(APPPW)';
" || { log "ERROR: preparando base/login"; stop_engine "$PRIVATE_PORT"; exit 1; }
q "$PRIVATE_PORT" -d "$DB" -Q "
IF DATABASE_PRINCIPAL_ID(N'\$(APPUSER)') IS NULL CREATE USER [\$(APPUSER)] FOR LOGIN [\$(APPUSER)];
ELSE ALTER USER [\$(APPUSER)] WITH LOGIN = [\$(APPUSER)];
ALTER ROLE db_owner ADD MEMBER [\$(APPUSER)];
" || { log "ERROR: mapeando usuario"; stop_engine "$PRIVATE_PORT"; exit 1; }

backup "$PRIVATE_PORT"
stop_engine "$PRIVATE_PORT"

log "fase 2: sirviendo en 1433"
start_engine 1433 || { log "el motor no arrancó en 1433"; exit 1; }

on_term() {
  log "SIGTERM: backup final"
  backup 1433
  stop_engine 1433
  exit 0
}
trap on_term TERM INT

while kill -0 "$PID" 2>/dev/null; do
  sleep "$((MSSQL_BACKUP_INTERVAL_MIN * 60))" &
  wait $!
  kill -0 "$PID" 2>/dev/null && backup 1433
done
log "el motor terminó"
exit 1
