FROM mcr.microsoft.com/mssql/server:2022-latest

USER root
COPY entrypoint.sh /usr/local/bin/misalud-mssql.sh
RUN chmod 755 /usr/local/bin/misalud-mssql.sh

ENV ACCEPT_EULA=Y \
    MSSQL_PID=Express \
    MSSQL_BACKUP_DIR=/data/backups \
    MSSQL_BACKUP_INTERVAL_MIN=5 \
    PORTAL_DB_NAME=MiSaludPortal \
    PORTAL_DB_USER=misalud_app

EXPOSE 1433
ENTRYPOINT ["/usr/local/bin/misalud-mssql.sh"]
