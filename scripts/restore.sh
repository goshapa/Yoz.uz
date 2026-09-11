#!/usr/bin/env bash
# Восстановление базы данных PostgreSQL из бэкапа, созданного backup.sh.
# Запуск: ./scripts/restore.sh path/to/yoz_2026-01-01_03-00-00.sql.gz
#
# ВНИМАНИЕ: полностью перезаписывает текущую базу данных.

set -euo pipefail

FILE="${1:?Укажите путь к файлу бэкапа (.sql.gz)}"

gunzip -c "$FILE" | docker compose exec -T postgres psql -U "${POSTGRES_USER:-yoz}" "${POSTGRES_DB:-yoz}"

echo "База восстановлена из $FILE"
