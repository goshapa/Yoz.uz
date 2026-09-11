#!/usr/bin/env bash
# Ежедневный бэкап базы данных PostgreSQL.
# Запуск: ./scripts/backup.sh [каталог для бэкапов]
#
# Пример записи в crontab на хосте (ежедневно в 03:00):
#   0 3 * * * cd /path/to/yoz && ./scripts/backup.sh /var/backups/yoz >> /var/log/yoz-backup.log 2>&1

set -euo pipefail

BACKUP_DIR="${1:-./backups}"
TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
FILE="$BACKUP_DIR/yoz_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-yoz}" "${POSTGRES_DB:-yoz}" | gzip > "$FILE"

echo "Бэкап сохранён: $FILE"

# Хранить только последние 14 бэкапов
ls -1t "$BACKUP_DIR"/yoz_*.sql.gz | tail -n +15 | xargs -r rm --
