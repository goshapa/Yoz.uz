#!/usr/bin/env bash
# Ежедневный бэкап файлового хранилища MinIO (фото/видео постов и чатов).
# Запуск: ./scripts/backup-minio.sh [каталог для бэкапов]
#
# Пример записи в crontab на хосте (ежедневно в 03:10, следом за backup.sh):
#   10 3 * * * cd /path/to/yoz && ./scripts/backup-minio.sh /var/backups/yoz >> /var/log/yoz-backup.log 2>&1

set -euo pipefail

BACKUP_DIR="${1:-./backups}"
TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
FILE="yoz_minio_${TIMESTAMP}.tar.gz"
VOLUME="${MINIO_VOLUME:-yoz_miniodata}"

mkdir -p "$BACKUP_DIR"

docker run --rm -v "$VOLUME":/data:ro -v "$BACKUP_DIR":/backup alpine \
  tar czf "/backup/$FILE" -C /data .

echo "Бэкап MinIO сохранён: $BACKUP_DIR/$FILE"

# Хранить только последние 7 бэкапов (медиа тяжелее дампа БД)
ls -1t "$BACKUP_DIR"/yoz_minio_*.tar.gz | tail -n +8 | xargs -r rm --
